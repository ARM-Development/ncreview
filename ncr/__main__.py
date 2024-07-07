#!/usr/bin/env python3
'''Command line interface to the datastream and datastreamdiff review modules.

Provides a command line interface to the functionality inside of the
datastream and datastreamdiff modules, which writes the resulting json string
to the user's ncreview_web directory.
'''

import os
import re
import csv
import sys
import time
import json
import random
import argparse
import traceback
import datetime as dt
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, as_completed

from . import utils as utils
from . import colorformat as cf

from .version import __version__
from .summary import SumFile
from .datastream import Datastream
from .datastreamdiff import DatastreamDiff


# Progress Bar ----------------------------------------------------------------

class ProgressBar:
    '''Reports progress of loading datastreams, and estimates time remaining.
    '''

    def __init__(self, total, width=50):
        '''Initialize a progress bar
        Parameters:
            total  numeric value of what "complete" represents
            width  character width of the progress bar
        '''
        self.width = width
        self.done = 0
        self.total = total
        self.started = time.perf_counter()
        self.rainbow = (random.randint(1, 1000) == 298)

    def start(self):
        '''Save time when this method is called, and print a timeline at 0%
        progress.
        '''
        self.started = time.perf_counter()
        sys.stdout.write('\r[' + (' ' * self.width) + ']0%')

    def update(self, amount):
        '''Increment the number of files processed by one, and update the
        progress bar accordingly.
        '''
        self.done += amount
        elapsed = time.perf_counter() - self.started
        estimate = elapsed * self.total / self.done
        remains = (estimate - elapsed) * 1.1  # overestimate by 10%
        progress = self.done / self.total
        s = '#' * int(self.width * progress)
        if self.rainbow:
            s = cf.setRainbow(s)
        sys.stdout.write('\r[{0}{1}]{2}% ~{3} left    '.format(
            s,
            ' ' * int(self.width * (1 - progress)),
            int(progress * 100),
            utils.time_diff(int(remains)))
        )
        sys.stdout.flush()

    def complete(self):
        '''Display a progress bar at 100%
        '''
        s = ('#' * self.width)
        if self.rainbow:
            s = cf.setRainbow(s)
        print('\r[' + s + ']100%' + ' ' * 20)


# Utilities -------------------------------------------------------------------


class _ProcessPoolExecutor(ProcessPoolExecutor):

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Without this bit of code to kill the subprocesses, they end up living
        # forever without getting cleaned up.
        if exc_type in [KeyboardInterrupt, SystemExit]:
            for child in multiprocessing.active_children():
                child.kill()
        return super().__exit__(exc_type, exc_val, exc_tb)


def is_plottable(path):
    path_match = re.search(r'/([a-z]{3})/\1[a-zA-Z0-9\.]+\s*$', path)
    return path_match is not None


# Data Plot Command
def plot():
    import act
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import io
    import base64

    class ArgumentParserError(Exception):
        def __init__(self, message):
            super().__init__(message)

    class ExceptionalArgumentParser(argparse.ArgumentParser):
        def error(self, message):
            raise ArgumentParserError(message)

    parser = ExceptionalArgumentParser(
        prog='ncrplot',
        description=(
            'Use ACT to plot data for a netCDF variable and its '
            'corresponding QC variable, if available. '
            'Searches for files containing a datetime part '
            'between the provided begin and end dates.'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        'nc_dir',
        help='netCDF files directory'
    )

    parser.add_argument(
        'varname',
        help=(
            'Name of variable in netCDF file whose data will be plotted.'
        )
    )

    def compact_datestring(arg_value):
        regex = re.compile(r"^\d{8}$")
        if not regex.match(arg_value):
            raise argparse.ArgumentTypeError(
                "value does not match format 'YYYYMMDD'"
            )
        return arg_value

    parser.add_argument(
        '--begin', '-b', type=compact_datestring, default='00010101',
        metavar='YYYYMMDD', help="Ignore files before YYYYMMDD"
    )
    parser.add_argument(
        '--end', '-e', type=compact_datestring, default='99991231',
        metavar='YYYYMMDD', help="Ignore files after YYYYMMDD"
    )

    result = {
        'img': "",
        'errors': []
    }

    try:
        args = parser.parse_args()
    except ArgumentParserError as e:
        result['errors'].append("Arguments error: {}.".format(e))
        return json.dumps(result)
    else:
        nc_dir = args.nc_dir
        var_name = args.varname
        beg_date = args.begin
        end_date = args.end
        if beg_date == end_date:
            end_date = f'{int(end_date) + 1}'

    files_list = []
    if os.path.isdir(nc_dir):
        for file in os.listdir(nc_dir):
            filename, file_ext = os.path.splitext(file)
            if file_ext == '.nc' or file_ext == '.cdf':
                matches = re.search(r'\.(\d{8})\.', filename)
                file_date = matches.group(1) if matches else ''
                if file_date and beg_date <= file_date < end_date:
                    files_list.append(os.path.join(nc_dir, file))

    if len(files_list) == 0:
        result['errors'].append(
            "Unable to find or match any files using the provided parameters."
        )
        return json.dumps(result)

    # https://arm-doe.github.io/ACT/source/auto_examples/plot_qc.html#sphx-glr-source-auto-examples-plot-qc-py
    # I don't want to catch all exceptions, but ACT already returns a few
    # different error types in just the first few rounds of tests. And whatever
    # the specific error, I take the same action. So ... catch it all.
    try:
        nc_data = act.io.armfiles.read_netcdf(files_list)
        nc_data.clean.cleanup()

        if var_name not in nc_data:
            raise KeyError("Variable not in dataset.")
        num_plots = 1
        has_qc = False
        if nc_data.qcfilter.check_for_ancillary_qc(var_name, add_if_missing=False):
            num_plots = 2
            has_qc = True

        ts_display = act.plotting.TimeSeriesDisplay(
            nc_data,
            figsize=(19, 5.5 * num_plots),
            subplot_shape=(num_plots,),
        )
    except Exception as e:
        result['errors'].append(
            f"Error fetching or plotting netCDF data, {type(e)}:\n{e}"
        )
    else:
        if has_qc:
            try:
                ts_display.qc_flag_block_plot(var_name, subplot_index=(1,))
            except Exception as e:
                result['errors'].append("QC error, {}: {}".format(type(e), e))
                ts_display.fig.delaxes(ts_display.axes[1])
        ts_display.plot(var_name, subplot_index=(0,))
        ts_display.fig.tight_layout()

        fig_bytes = io.BytesIO()
        plt.savefig(fig_bytes)
        result['img'] = base64.b64encode(fig_bytes.getvalue()).decode()

    return json.dumps(result)


# Main ------------------------------------------------------------------------

def main():

    start = time.time()

    min_readers = 1
    max_readers = 20

    # NOTE: the defaults for begin time and end time
    # Begin : 00010101
    # End : 99991231

    # Parse Args -------------------------------------------------------------

    M1 = cf.setSuccess("Notes that appear in green are Success messages")
    M2 = cf.setWarning("Notes that appear in yellow are Warning messages")
    M3 = cf.setError("Notes that appear in red are Error messages")
    M4 = cf.setDebug("Notes that appear in cyan are Debug messages")

    parser = argparse.ArgumentParser(
        prog='ncreview',
        description=(
            'Compare netCDF files between two directories or summarize from '
            'single directory.'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            'Note that if --begin and --end are unspecified when comparing '
            'datastreams, the time span chosen will be the intersection of '
            'the time periods spanned by both datastreams.'
            '\n\r'
            '%s'
            '\n\r'
            'You can turn colors off by using the command, -nc'
        ) % "\n\r".join([M1, M2, M3, M4])
    )

    parser.add_argument(
        '--version', '-v', action='version',
        version='%(prog)s v' + __version__
    )

    parser.add_argument(
        'old_dir',
        help='Old netCDF files directory'
    )

    parser.add_argument(
        'new_dir', nargs='?', default=None,
        help=(
            'New netCDF files directory, exclude to simply summarize a single '
            'directory.'
        )
    )

    parser.add_argument(
        '--begin', '-b', default='00010101',
        metavar='YYYYMMDD', help='Ignore files before YYYYMMDD'
    )
    parser.add_argument(
        '--end', '-e', default='99991231',
        metavar='YYYYMMDD', help='Ignore files after YYYYMMDD'
    )

    parser.add_argument(
        '--no-trim', dest='nt', action='store_true', default=False,
        help="Show full range of both datastreams"
    )

    parser.add_argument(
        '--sample_interval', '-t', default=None,
        help=(
            'Time interval to average data over in HH-MM-SS. If not provided, '
            'defaults to 1 day if more than 10 days are being processed, '
            'otherwise defaults to hourly samples.'
        )
    )

    parser.add_argument(
        '--metadata_only', '-m', action='store_true', default=False,
        help=(
            'Review only metadata, ignoring variable data (much faster than '
            'alternative).'
        )
    )

    parser.add_argument(
        '--write_dir', '-w', default=None, metavar='DIR',
        help='Write output data files to specified directory'
    )

    parser.add_argument(
        '--name', '-n', default=None,
        help=(
            'Specify custom name to be used for the run.  Will be the '
            'directory name where the summary files ncreview creates are '
            'stored as well as the URL suffix.'
        )
    )

    parser.add_argument(
        '--readers', type=int, default=10,
        help=(
            'Specify number of concurrent file readers. Will accept a number '
            'between %d and %d (inclusive).'
        ) % (min_readers, max_readers)
    )

    parser.add_argument(
        '--vars+', dest='white_listed_regexes', nargs='+', default=[".*?"],
        help="Run only these variables (works with wildcard '*')"
    )
    parser.add_argument(
        '--vars-', dest='black_listed_regexes', nargs='+', default=[],
        help="Run everything but these variables (works with wildcard '*')"
    )

    parser.add_argument(
        '--no-color', dest='nc', action="store_true",
        help="disable color output"
    )
    parser.add_argument(
        '--debug', action="store_true",
        help="show debug messages"
    )

    args = parser.parse_args()

    # Disables colored output for Warnings, Errors, and Successes
    cf.NO_COLOR = args.nc

    # Enable colored output for Debug messages (CYAN)
    cf.DEBUG = args.debug

    if args.nt:
        args.begin = '00010102'
        args.end = '99991230'

    args.old_dir = os.path.abspath(
        args.old_dir.encode('ascii', errors='ignore').decode()
    )
    if args.new_dir:
        args.new_dir = os.path.abspath(
            args.new_dir.encode('ascii', errors='ignore').decode()
        )
    if args.write_dir:
        args.write_dir = os.path.abspath(
            args.write_dir.encode('ascii', errors='ignore').decode()
        )
        if not os.path.exists(os.path.dirname(args.write_dir)):
            raise ValueError(cf.setError((
                "Error: write directory %s does not exist\n"
            ) % os.path.dirname(args.write_dir)))

    args.begin = dt.datetime.strptime(args.begin, '%Y%m%d')
    args.end = dt.datetime.strptime(args.end, '%Y%m%d')

    if args.readers < min_readers or args.readers > max_readers:
        raise ValueError(cf.setError((
            "Error: number of readers must be between %d and %d (inclusive)."
        ) % (min_readers, max_readers)))

    try:
        if args.sample_interval is not None:
            h, m, s = re.split(r'\D+', args.sample_interval)
            args.sample_interval = int(h) * 60 * 60 + int(m) * 60 + int(s)
        # If date range is more than 10 days
        elif args.end - args.begin > dt.timedelta(days=10):
            args.sample_interval = 24 * 60 * 60  # Set interval to 24 hr
        else:
            args.sample_interval = 60 * 60  # Set interval to 1 hr
    except ValueError as e:
        raise ValueError(cf.setError(
            "Error: chunk time %s is invalid (%s).\n" % (
                args.sample_interval,
                str(e)
            )
        ))

    if args.sample_interval <= 0:
        raise ValueError(cf.setError((
            'Error: sample interval must be a positive number, not %s'
        ) % str(args.sample_interval)))

    # Review Data -------------------------------------------------------------

    def is_valid(fname):
        t = utils.file_time(fname)
        return t is not None and args.begin <= t <= args.end

    args.new_dir = os.path.abspath(
        args.new_dir) if args.new_dir else args.new_dir
    args.old_dir = os.path.abspath(
        args.old_dir) if args.old_dir else args.old_dir

    jdata = None
    summary_size = 0
    if args.new_dir:
        new_files = sorted(filter(is_valid, os.listdir(args.new_dir)))
        old_files = sorted(filter(is_valid, os.listdir(args.old_dir)))

        if not new_files:
            raise RuntimeError(cf.setError((
                '%s contains no netCDF files in the specified time period.'
            ) % args.new_dir))
        if not old_files:
            raise RuntimeError(cf.setError((
                '%s contains no netCDF files in the specified time period.'
            ) % args.old_dir))

        # Get the latest begin and earliest end
        new_times = list(map(utils.file_time, new_files))
        old_times = list(map(utils.file_time, old_files))

        # These values are hardcoded to match the default dates.  If user
        # passed in start/end times, show the entire timeline at those dates.
        # Otherwise defaults to only showing overlap.
        if str(args.begin) != '0001-01-01 00:00:00':
            args.begin = min(
                min(new_times),
                min(old_times)
            ).replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            args.begin = max(
                min(new_times),
                min(old_times)
            ).replace(hour=0, minute=0, second=0, microsecond=0)

        if str(args.end) != '9999-12-31 00:00:00':
            args.end = max(
                max(new_times),
                max(old_times)
            ).replace(hour=23, minute=59, second=59, microsecond=999)
        else:
            args.end = min(
                max(new_times),
                max(old_times)
            ).replace(hour=23, minute=59, second=59, microsecond=999)

        # Re-filter the files with the new time bounds
        new_files = sorted(filter(is_valid, new_files))
        old_files = sorted(filter(is_valid, old_files))

        if not new_files or not old_files:
            raise RuntimeError(cf.setWarning((
                'Old and New directories do not appear to have overlapping '
                'measurement times in the specified time period. Cannot '
                'determine a comparison interval.'
            )))

        print(cf.setText(
            'Scanning directories...',
            col=cf.DEFAULT, attr=[cf.BOLD], bg=cf.BG_DEFAULT, reset=True
        ))

        total_size = 0
        for (_, path, files) in (
            ('old', args.old_dir, old_files),
            ('new', args.new_dir, new_files)
        ):
            for f in files:
                total_size += os.stat('%s/%s' % (path, f)).st_size

        progress_bar = ProgressBar(total_size)

        print(cf.setText(
            'Reading data...',
            col=cf.DEFAULT, attr=[cf.BOLD], bg=cf.BG_DEFAULT, reset=True
        ))

        old_is_plottable = is_plottable(args.old_dir)
        new_is_plottable = is_plottable(args.new_dir)

        if not old_is_plottable:
            print(cf.setWarning((
                'WARNING: Could not create DQ inspector plots because %s does '
                'not pass the name check.\nConsider changing the path to '
                'match the pattern: <site>/<datastream>/<files…>'
            ) % args.old_dir))

        if not new_is_plottable:
            print(cf.setWarning((
                'WARNING: Could not create DQ inspector plots because %s does '
                'not pass the name check.\nConsider changing the path to '
                'match the pattern: <site>/<datastream>/<files…>'
            ) % args.new_dir))

        old_ds = Datastream(old_is_plottable, args.sample_interval)
        new_ds = Datastream(new_is_plottable, args.sample_interval)

        progress_bar.start()

        with _ProcessPoolExecutor(max_workers=args.readers) as executor:
            futures = map(
                lambda f: executor.submit(f.summarize),
                map(lambda f: SumFile(
                    path='%s/%s' % (args.old_dir, f),
                    interval=args.sample_interval,
                    mdonly=args.metadata_only,
                    white_listed_regexes=args.white_listed_regexes,
                    black_listed_regexes=args.black_listed_regexes
                ), old_files)
            )
            futures = list(futures)
            results = [None] * len(futures)
            for f in as_completed(futures):
                s = f.result()
                results[futures.index(f)] = s
                progress_bar.update(os.stat(s['path']).st_size)
            for s in results:
                old_ds.add(s)

            futures = map(
                lambda f: executor.submit(f.summarize),
                map(lambda f: SumFile(
                    path='%s/%s' % (args.new_dir, f),
                    interval=args.sample_interval,
                    mdonly=args.metadata_only,
                    white_listed_regexes=args.white_listed_regexes,
                    black_listed_regexes=args.black_listed_regexes
                ), new_files)
            )
            futures = list(futures)
            results = [None] * len(futures)
            for f in as_completed(futures):
                s = f.result()
                results[futures.index(f)] = s
                progress_bar.update(os.stat(s['path']).st_size)
            for s in results:
                new_ds.add(s)

        progress_bar.complete()

        old_ds.post_add()
        new_ds.post_add()

        print(cf.setText(
            'Comparing...',
            col=cf.DEFAULT, attr=[cf.BOLD], bg=cf.BG_DEFAULT, reset=True
        ))
        dsdiff = DatastreamDiff(old_ds, new_ds)
        jdata = dsdiff.jsonify()

    else:
        path = args.old_dir

        files = sorted(filter(is_valid, os.listdir(path)))

        if not files:
            raise RuntimeError(cf.setError((
                '%s contains no netCDF files in the specified time period.'
            ) % path))

        print(cf.setText(
            'Scanning Directory...',
            col=cf.DEFAULT, attr=[cf.BOLD], bg=cf.BG_DEFAULT, reset=True
        ))

        total_size = 0
        for f in files:
            total_size += os.stat('%s/%s' % (path, f)).st_size

        progress_bar = ProgressBar(total_size)

        print(cf.setText(
            'Reading Data...',
            col=cf.DEFAULT, attr=[cf.BOLD], bg=cf.BG_DEFAULT, reset=True
        ))

        path_is_plottable = is_plottable(path)

        if not path_is_plottable:
            print(cf.setWarning((
                'WARNING: Could not create DQ inspector plots because %s '
                'does not pass the name check.\nConsider changing the path to '
                'match the pattern: <site>/<datastream>/<file(s)>'
            ) % path))

        ds = Datastream(path_is_plottable, args.sample_interval)

        progress_bar.start()

        with _ProcessPoolExecutor(max_workers=args.readers) as executor:
            futures = map(
                lambda f: executor.submit(f.summarize),
                map(lambda f: SumFile(
                    path='%s/%s' % (path, f),
                    interval=args.sample_interval,
                    mdonly=args.metadata_only,
                    white_listed_regexes=args.white_listed_regexes,
                    black_listed_regexes=args.black_listed_regexes
                ), files)
            )
            futures = list(futures)
            results = [None] * len(futures)
            for f in as_completed(futures):
                s = f.result()
                results[futures.index(f)] = s
                progress_bar.update(os.stat(s['path']).st_size)
            for s in results:
                ds.add(s)

        progress_bar.complete()

        ds.post_add()

        jdata = ds.jsonify()

    summary_size = len(jdata['summary_times'])
    large_review = False
    if summary_size > 86400:  # 86400 s/day, 86400 min/2mo, 87600 hrs/10yrs
        large_review = True
    if large_review:
        print(cf.setText((
                "This review generated a large number of datapoints. "
                "Rendering large numbers of datapoints may impact display "
                "performance. Consider splitting the review into smaller "
                "segments."
            ),
            col=cf.BLUE, attr=[cf.BOLD], bg=cf.BG_DEFAULT, reset=True
        ))

    # Write out the data ------------------------------------------------------

    def unique_name(format_str, path):
        '''Produce a unique directory name at the specified path'''
        ID = 1
        while os.path.exists(path + '/' + format_str.format(ID)):
            ID += 1
        return format_str.format(ID)

    wpath = '/data/tmp/ncreview/'

    if args.write_dir is not None:
        wpath = args.write_dir

    if not os.path.exists(wpath):
        os.makedirs(wpath)

    format_str = ''
    if args.name:
        format_str = args.name
        if os.path.exists(wpath + '/' + args.name):
            # If the directory already exists, add a unique ID
            format_str += '.{0}'

    elif args.write_dir:
        format_str = '.ncr.' + dt.datetime.now().strftime('%y%m%d.%H%M%S')
        if os.path.exists(format_str):
            # If the directory already exists, add a unique ID
            format_str += '.{0}'
    else:
        format_str = '%s.%s.{0}' % (
            os.getenv('USER', 'unknown'),
            os.getenv('HOST', 'unknown')
        )

    jdata_dir = unique_name(format_str, wpath)

    jdata_path = wpath + '/' + jdata_dir + '/'
    os.mkdir(jdata_path)

    def separate_data(obj, n=1):
        to_separate = []
        if obj['type'] in ['plot', 'timeline', 'fileTimeline', 'timelineDiff']:
            to_separate = ['data']
        elif obj['type'] in ['plotDiff', 'fileTimelineDiff', 'bargraphDiff']:
            to_separate = ['old_data', 'new_data']

        for key in to_separate:
            # Generate a unique CSV file name
            while os.path.isfile(jdata_path + 'ncreview.{0}.csv'.format(n)):
                n += 1

            # Write out the data as CSV
            with open(
                jdata_path + 'ncreview.{0}.csv'.format(n), 'w', newline=''
            ) as csvfile:
                writer = csv.writer(csvfile, quoting=csv.QUOTE_NONNUMERIC)
                for row in obj[key]:
                    writer.writerow(row)

            # Make what was the data a reference to the file
            obj[key] = n

        if 'contents' in obj:
            for c in obj['contents']:
                separate_data(c, n)

    separate_data(jdata)

    with open(jdata_path + 'ncreview.json', 'w') as jfile:
        jfile.write(json.dumps(jdata, default=utils.JEncoder))

    first_dir, user, *_ = os.path.realpath(__file__).split('/')[1:]
    location = '/~' + user if first_dir == 'home' else ''

    url_string = jdata_dir

    if args.write_dir:  # if custom write location, put full path
        url_string = jdata_path

    print("")
    s = "Complete! Took %s." % utils.time_diff(time.time() - start)
    line = "------------------------------------------------------------------"
    url = (
        f'https://engineering.arm.gov{location}/ncreview/?{url_string}'
    )
    print(cf.setText(
        s, col=cf.GREEN, attr=[cf.BOLD], bg=cf.BG_DEFAULT, reset=True
    ))
    print(line)
    print(url)
    print("")

    return 0


def run():
    try:
        return main()
    except (SystemExit, KeyboardInterrupt):
        return 1
    except:  # noqa: E722
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    multiprocessing.set_start_method('spawn', True)
    sys.exit(run())
