'''A few miscellaneous functions and objects used by the datastream and
datastreamdiff modules.
'''
import re
import time
import numpy as np
import datetime as dt
import calendar

from . import colorformat as cf


# Regex for checking netcdf file names
ncfname_re = \
    re.compile(r'^([a-z]{3})([a-z0-9]*)([A-Z]\d+)\.([a-z]\d).' +
               r'(\d{4})(\d\d)(\d\d)\.(\d\d)(\d\d)(\d\d)\.(cdf|nc)$')


def strtotime(timestring, timeformat):
    t = time.strptime(timestring, timeformat)
    return calendar.timegm(t)


def timetostr(timestamp, timeformat):
    return time.strftime(timeformat, time.gmtime(timestamp))


def file_time(fname):
    '''Return time in netcdf file name as a datetime object
    '''
    match = ncfname_re.match(fname)
    return dt.datetime(*map(int, match.groups()[4:10])) if match else None


def file_datastream(fname):
    '''return the datstream substring from a filename'''
    match = ncfname_re.match(fname)
    return ''.join(match.groups()[:4])


# This functionality exists in the standard library through functools.lru_cache
# starting in version 3.2.
def store_difference(func):
    '''Decorator that causes difference() methods to store and reuse their result.
    '''
    def difference(self):
        if not hasattr(self, '_difference'):
            setattr(self, '_difference', func(self))
        return self._difference
    return difference


def json_section(self, contents):
    '''Returns a json section object with the specified contents.
    '''
    sec = {
        'type': 'section',
        'name': self.name,
        'contents': contents
    }
    if hasattr(self, 'difference'):
        sec['difference'] = self.difference()
    elif hasattr(self, '_difference'):
        sec['difference'] = self._difference
    return sec


def JEncoder(obj):
    ''' Defines a few default behaviours when the json encoder doesn't know
    what to do
    '''
    try:
        if np.isnan(obj):
            return None
        elif obj // 1 == obj:  # loses precision after about 15 decimal places
            return int(obj)
        else:
            return float(obj)
    except:  # noqa: E722
        try:
            return str(obj)
        except:  # noqa: E722
            raise TypeError(
                cf.setError((
                    'Object of type {0} with value {1} is not JSON ' +
                    'serializable'
                ).format(type(obj), repr(obj)))
            )


def join_times(old_ftimes, new_ftimes, union=False):
    '''Yields time intervals shared by both the old and new files, in order.

    Parameters:
        old_ftimes  list of old file times as TimeInterval objects
        new_ftimes  list of new file times as TimeInterval objects

    Yields:
        yields the tuple:
            beg    beginning of the shared time interval
            end    end of the shared time interval
            old_i  index of interval in old_ftimes that overlaps this shared
                   interval
            new_i  index of interval in new_ftimes that overlaps this shared
                   interval
    '''
    old_itr = iter(enumerate(old_ftimes))
    new_itr = iter(enumerate(new_ftimes))

    old_i, old_f = next(old_itr, (None, None))
    new_i, new_f = next(new_itr, (None, None))

    if union:
        while old_f or new_f:
            beg = old_f.beg if old_f else None
            if beg is None or (new_f and new_f.beg < beg):
                beg = new_f.beg
            end = old_f.end if old_f else None
            if end is None or (new_f and new_f.end < end and new_f.beg < end):
                end = new_f.end

            yield (
                beg,
                end,
                old_i if (
                    old_f and old_f.end > beg and old_f.beg < end
                ) else None,
                new_i if (
                    new_f and new_f.end > beg and new_f.beg < end
                ) else None
            )

            if old_f and old_f.beg < end:
                old_i, old_f = next(old_itr, (None, None))
            if new_f and new_f.beg < end:
                new_i, new_f = next(new_itr, (None, None))
        return

    while old_f and new_f:
        beg = max(old_f.beg, new_f.beg)
        end = min(old_f.end, new_f.end)

        if beg < end:
            yield beg, end, old_i, new_i

        if old_f.end < new_f.end:
            old_i, old_f = next(old_itr, (None, None))
        elif old_f.end > new_f.end:
            new_i, new_f = next(new_itr, (None, None))
        else:
            old_i, old_f = next(old_itr, (None, None))
            new_i, new_f = next(new_itr, (None, None))


def time_diff(n):
    # unnecessary parentheses around assignments
    (m, s) = divmod(n, 60)
    (h, m) = divmod(m, 60)
    if h > 23:
        (d, h) = divmod(h, 24)
        return '%dd:%02dh:%02dm:%02ds' % (d, h, m, s)
    return '%dh:%02dm:%02ds' % (h, m, s)
