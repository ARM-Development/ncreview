import re
import time
import logging
import calendar
import traceback
import numpy as np
import netCDF4 as nc
from netCDF4 import Dataset

from .standard import ExStateVar, InStateVar, QCVar
from . import colorformat as cf


# Data Types ------------------------------------------------------------------


class NumDataType:

    BIG = 10**10
    SMALL = -10**10

    '''Class containing methods for working with numerical data

    Performs numerical summary of data and returns the result as a NumSum.
    '''
    def __init__(self, ncvar, attributes):
        self.type_name = 'numeric'
        self.var_name = ncvar._name
        self.ncvar = ncvar
        self.missing_value = ncvar.getncattr('missing_value') \
            if 'missing_value' in ncvar.__dict__ else None
        self.units = ncvar.getncattr('units') \
            if 'units' in ncvar.__dict__ else None
        if self.missing_value is not None:
            if np.dtype(type(self.missing_value)) != ncvar.dtype:
                # Can't auto apply missing_value if type cannot be coerced
                ncvar.set_auto_mask(False)
                try:
                    self.missing_value = np.array(
                        self.missing_value
                    ).astype(ncvar.dtype)
                    if self.missing_value.size == 0:
                        # We get here if missing_value looks like this in CDL:
                        # Rayleigh_optical_depth_filter7:missing_value = "" ;
                        self.missing_value = None
                except ValueError:
                    self.missing_value = None
        if self.missing_value is None:
            self.missing_value = -9999
        self.fill_value = ncvar.getncattr('_FillValue') \
            if '_FillValue' in ncvar.__dict__ else None
        if self.fill_value is None:
            for t, v in getattr(nc, 'default_fillvals').items():
                if np.dtype(t) == ncvar.dtype:
                    self.fill_value = v
                    break

    @staticmethod
    def matches(ncvar, attributes):
        return True

    def summarize(self, data=None):
        '''Return a smaller summary of just the statistics in the
        Variable Data Summary table
        '''
        # DIFFICULT POTENTIAL TODO:
        # This function traverses the array many times, when
        # it should only need to traverse it twice:
        # once to get all the value counts and min, max, mean
        # and another to get standard deviation.
        # Some C code here could greatly outperform this.

        if data is None:
            return {
                'n': 0,
                'ngood': 0,
                'nmiss': 0,
                'nnan': 0,
                'ninf': 0,
                'nfill': 0,
                'nbig': 0,
                'nsmall': 0,
                'min': None,
                'max': None,
                'mean': None,
                'median': None,
                'var': None,
                'std': None,
            }

        size = int(data.size)

        nmiss, nfill = 0, 0
        if not hasattr(data, 'mask'):
            # Need to apply missing/fill mask manually.
            if size == 0:
                data = np.ma.masked_array()
            else:
                t = type(data[0])
                data = np.ma.masked_where(
                    (data == t(self.missing_value)) |
                    (data == t(self.fill_value)), data, copy=False)

        masked = data[data.mask].data

        nfill = int(np.size(masked))
        if nfill > 0:
            t = type(masked[0])
            if self.missing_value is not None:
                nmiss = int(np.sum(masked == t(self.missing_value)))
            if self.fill_value is not None:
                nfill = int(np.sum(masked == t(self.fill_value)))
            elif nfill > 0:
                nfill -= nmiss

        try:
            nans = np.where(np.isnan(data))
            nnan = int(nans[0].size)
        except TypeError:
            nnan = 0

        try:
            infs = np.where(np.isinf(data))
            ninf = int(infs[0].size)
        except TypeError:
            ninf = 0

        if nnan or ninf:
            if isinstance(data.mask, np.bool_):
                # Sometimes I really hate numpy.  Turns out "np.masked_where"
                # (above) will return a scalar True or False when the mask is
                # either all or none respectively.  But that means we have to
                # do this crazy thing where we force the mask to be the same
                # shape as the data so we can update the mask according to
                # where nans and/or infs were found.
                v = data.mask
                data.mask = np.empty(data.shape, bool)
                data.mask[:] = v
            if nnan:
                data.mask[nans] = True
            if ninf:
                data.mask[infs] = True

        if self.fill_value is not None:
            try:
                nbig = len(data[np.where(data >= 10**10)])
                if self.fill_value >= self.BIG:
                    nbig -= nfill
            except TypeError:
                nbig = 0
        else:
            nbig = 0

        try:
            if self.units == 'degC':
                nsmall = len(data[np.where(data <= -273.1)]) - nmiss
            else:
                nsmall = len(data[np.where(data <= self.SMALL)])
        except TypeError:
            nsmall = 0

        data = data.compressed()

        numsum = {
            'n': size,
            'ngood': np.size(data),
            'nmiss': nmiss,
            'nnan': nnan,
            'ninf': ninf,
            'nfill': nfill,
            'nbig': nbig,
            'nsmall': nsmall,
            'min': None,
            'max': None,
            'mean': None,
            'median': None,
            'var': None,
            'std': None,
        }

        try:
            if data.size:
                if data.dtype == np.dtype('S1'):
                    data = data.astype(int)

                numsum.update({
                    'min': data.min().item(),
                    'max': data.max().item(),
                    'mean': data.mean(dtype=np.float64).item(),
                    'median': np.median(data)
                })

                if data.size > 1:
                    numsum['var'] = data.var(dtype=np.float64)
                    numsum['std'] = np.sqrt(numsum['var']).item() \
                        if numsum['var'] is not None and numsum['var'] >= 0 \
                        else None
        except:  # noqa: E722
            # TODO: What type of exceptions?  Need to be explicit.
            pass

        return numsum


class DimlessDataType(NumDataType):
    '''Wraps a single value with the expected DataType interface.
    '''
    def __init__(self, ncvar, attributes):
        super().__init__(ncvar, attributes)
        self.type_name = 'dimless'

    @staticmethod
    def matches(ncvar, attributes):
        return not ncvar.dimensions

    def summarize(self, data=None):
        value = None
        if data is not None:
            value = data[0].item()
        ismiss = value is None or value == self.missing_value
        isfill = value == self.fill_value
        isnan = np.isnan(value)
        isinf = np.isinf(value)
        isbig = value is not None and value >= self.BIG
        issmall = value is not None and value <= self.SMALL
        return {
            'value': value,
            'isgood': (
                not ismiss and
                not isfill and
                not isnan and
                not isinf and
                not isbig and
                not issmall
            ),
            'ismiss': ismiss,
            'isfill': isfill,
            'isnan': isnan,
            'isinf': isinf,
            'isbig': isbig,
            'issmall': issmall,
        }


class ExStateDataType:
    '''Class containing methods for working with exclusive state data

    Reads important metadata from an exclusive state variable, and collects
    the counts of each exclusive state in a data set into a StateSum.
    '''

    def __init__(self, ncvar, attributes):
        self.type_name = 'exclusiveState'
        (self.flag_values, self.flag_descriptions) = ExStateVar.parse({
            name: getattr(ncvar, name) for name in ncvar.ncattrs()
        })

    @staticmethod
    def matches(ncvar, attributes):
        return (
            ExStateVar.has_attrs({
                name: getattr(ncvar, name)
                for name in ncvar.ncattrs()
            })
        ) and issubclass(ncvar.dtype.type, np.integer)

    def summarize(self, data=None):
        if data is None:
            return {v: 0 for v in self.flag_values}

        d = data.astype(int)
        if hasattr(d, 'mask'):
            d = d.compressed()

        if not d.size:
            return {str(v): 0 for v in self.flag_values}

        u, c = np.unique(d, return_counts=True)

        s = {}
        for v in self.flag_values:
            i = np.where(u == v)
            s[str(v)] = c[i[0][0]] if i[0].size > 0 else 0

        return s


class InStateDataType:
    '''Class containing methods for working with inclusive state data

    Reads important metadata from an inclusive state variable, and collects
    the counts of each inclusive state in a data set into a StateSum.
    '''

    def __init__(self, ncvar, attributes):
        self.type_name = 'inclusiveState'
        (self.flag_masks, self.flag_descriptions) = InStateVar.parse({
            name: getattr(ncvar, name) for name in ncvar.ncattrs()
        })

    @staticmethod
    def matches(ncvar, attributes):
        return (
            InStateVar.has_attrs({
                name: getattr(ncvar, name) for name in ncvar.ncattrs()
            })
        ) and issubclass(ncvar.dtype.type, np.integer)

    def summarize(self, data=None):
        if data is None:
            return {str(m): 0 for m in self.flag_masks}

        d = data.astype(int)
        if hasattr(d, 'mask'):
            d = d.compressed()

        return {str(m): np.sum(d & m > 0).item() for m in self.flag_masks}


class QCDataType(InStateDataType):
    '''Class containing methods for working with Quality control data

    Subclass of InStateData, only difference is that variable names must
    start with a qc_ to be identified as QC and not just inclusive state.
    '''

    def __init__(self, ncvar, attributes):
        self.type_name = 'qualityControl'
        (self.flag_masks, self.flag_descriptions) = QCVar.parse({
            name: getattr(ncvar, name) for name in ncvar.ncattrs()
        }, QCDataType.mapglobals(attributes))

    @staticmethod
    def mapglobals(attributes):
        return {attr['name']: attr['val'] for attr in attributes}

    @staticmethod
    def matches(ncvar, attributes):
        return QCVar.is_match(ncvar._name, {
            name: getattr(ncvar, name) for name in ncvar.ncattrs()
        }, QCDataType.mapglobals(attributes))


def data_type_of(ncvar, attributes):
    '''Determines the data type of ncvar
    '''
    data_types = (
        DimlessDataType,
        QCDataType,
        ExStateDataType,
        InStateDataType,
        NumDataType,
    )

    for data_type in data_types:
        if data_type.matches(ncvar, attributes):
            return data_type(ncvar, attributes)


# Data classes ----------------------------------------------------------------

def sum_timed_data(ncvar, summary_times, attributes, data_type=None):
    '''Summarize the data in a variable with a time dimension

    Parameters:
    ncvar: netCDF4 variable to get data from
    summary_times: 1D array with length of time dimension
                   where samples to be fed into a single summary
                   share a value in the array.
    attributes: global atts dictionary from get_attributes function
    '''

    # data_type is an instance of a class and not what is returned by type(...)
    data_type = data_type_of(ncvar, attributes) \
        if data_type is None else data_type
    var_data = None
    try:
        var_data = ncvar[:]
    except:  # noqa: E722
        logging.error(cf.setError(
            'Unreadable variable data: %s' % (ncvar._name)
        ))
        logging.error(traceback.format_exc())
        return {}

    time_i = ncvar.dimensions.index('time')
    if time_i > 0:
        var_data = var_data.swapaxes(0, time_i)

    summaries = []

    for t in map(int, np.unique(summary_times)):
        # Select only the chunk at the desired time
        sample_data = var_data[summary_times == t]
        # Flatten the array
        sample_data = sample_data.ravel()
        # Summarize the data and update the summary
        summaries.append(data_type.summarize(sample_data))

    sum_keys = summaries[0].keys()
    return {k: [s[k] for s in summaries] for k in sum_keys}


def sum_untimed_data(ncvar, attributes, data_type=None):
    '''Summarize the data in a variable without a time dimension

    Parameters:
    ncvar: netCDF4 variable to get data from
    attributes: global atts dictionary from get_attributes function
    '''
    data_type = data_type_of(ncvar, attributes) \
        if data_type is None else data_type
    var_data = None
    try:
        var_data = ncvar[:]
    except:  # noqa: E722
        logging.error(cf.setError(
            'Unreadable variable data: %s' % ncvar._name
        ))
        logging.error(traceback.format_exc())
        return {}
    var_data = var_data.ravel()
    return data_type.summarize(var_data)


# Higher level summarizers ----------------------------------------------------

def sum_attributes(group):
    try:
        return [
            {
                'name': str(k),
                'val': list(v) if isinstance(v, np.ndarray) else v
            } for k, v in group.__dict__.items()
        ]
    except AttributeError:
        logging.error(cf.setError('Variable: %s' % group._name))
        logging.error(cf.setError(traceback.format_exc()))
    return []


def sum_variable(ncvar, attributes, summary_times=None, metadata_only=False):
    '''Get summary information for a netCDF4 variable

    Parameters:
    ncvar: netCDF4 variable to get data from
    attributes: global atts dictionary from get_attributes function
    summary_times: 1d array with length of time dimension
                   where samples to be fed into a single summary
                   share a value in the array.
    metadata_only: if True, skip the data summary and only return header data.
    '''
    doc = {
        'name': ncvar._name,
        'attributes': sum_attributes(ncvar),
        'dimensions': ncvar.dimensions,
        'dtype': str(ncvar.dtype),
    }
    vtype = data_type_of(ncvar, attributes)
    if metadata_only:
        return doc
    try:
        data = None
        if 'time' in ncvar.dimensions:
            data = sum_timed_data(
                ncvar, summary_times, attributes, vtype
            )
        else:
            data = sum_untimed_data(ncvar, attributes, vtype)
    except:  # noqa: E722
        logging.error(cf.setError(
            "Failed on variable: %s" % ncvar._name
        ))
        raise

    numsum_data = None
    if not isinstance(vtype, NumDataType):
        try:
            numsum_ref = NumDataType(ncvar, attributes)
            if 'time' in ncvar.dimensions:
                numsum_data = sum_timed_data(
                    ncvar, summary_times, attributes, numsum_ref
                )
                numsum_data = {
                    # A few of the stats lists can contain None values if, for
                    # example, all variable data values are "missing"
                    k: sum([n for n in v if n is not None])
                    for k, v in numsum_data.items()
                }
            else:
                numsum_data = sum_untimed_data(ncvar, attributes, numsum_ref)

        except Exception:  # noqa: E722
            logging.error(cf.setWarning(
                "Failed on making numsum for variable: %s (%s)" % (
                    ncvar._name, traceback.format_exc(),
                )
            ))

    doc['data'] = data
    doc['numsum_data'] = numsum_data
    return doc


class SumFile:

    def __init__(
        self, path, white_listed_regexes, black_listed_regexes,
        interval=60*60, mdonly=False, automask=False
    ):
        self.path = path
        self.interval = interval
        self.mdonly = mdonly
        self.automask = automask
        self.white_listed_regexes = []
        self.black_listed_regexes = []

        # White-listed regexes are a list of string regexes. We need to
        # convert them into an array of compiled re objects.
        for pattern in white_listed_regexes:
            self.white_listed_regexes.append(re.compile(pattern))
        for pattern in black_listed_regexes:
            self.black_listed_regexes.append(re.compile(pattern))

    def summarize(self):
        self.read()
        return self.jsonify()

    def read(self):
        ncfile = Dataset(self.path)
        ncvars = ncfile.variables
        for ncvar in ncvars.values():
            ncvar.set_auto_mask(self.automask)

        def passes_regex_check(name):

            def is_white_listed():
                for obj in self.white_listed_regexes:
                    if obj.search(name):
                        return True
                return False

            def is_black_listed():
                for obj in self.black_listed_regexes:
                    if obj.search(name):
                        return True
                return False

            return is_white_listed() and not is_black_listed()

        times = None
        if 'time' in ncvars:
            atts = ncvars['time'].__dict__
            if 'units' in atts:
                pattern = re.compile(
                    (
                        r'^(days|seconds) since '
                        r'(\d{4})-(\d+)-(\d+)[\sT](\d+):(\d+):(\d+)'
                    ),
                    re.IGNORECASE
                )
                m = pattern.match(atts['units'])
                if m is not None:
                    m = list(m.groups())
                    u = m.pop(0)
                    bt = time.strptime(
                        "-".join(m), "%Y-%m-%d-%H-%M-%S"
                    )
                    bt = calendar.timegm(bt)
                    t = ncvars['time'][:]
                    if u.lower() == 'days':
                        t *= 86400
                    times = bt + t
        if times is None and 'base_time' in ncvars and 'time_offset' in ncvars:
            times = ncvars['base_time'][0] + ncvars['time_offset'][:]

        summary_times = None
        if times is None:
            logging.error(
                'No sample time variable found for {}\n'.format(self.path)
            )
            self.mdonly = True
        else:
            # If there are masked values in the time array then we have issues
            # and can't go on since time is a critical component here.
            if np.ma.getmaskarray(times).any():
                raise Exception(cf.setError(
                    "Invalid time data: %s" % self.path
                ))
            self.beg = times[0]
            self.end = times[-1]
            summary_times = (times // self.interval).astype(int)*self.interval
            self.summary_times = np.unique(summary_times)
        try:
            self.dimensions = [
                {
                    'name': str(k),
                    'length': len(v),
                    'unlimited': v.isunlimited()
                } for k, v in ncfile.dimensions.items()
            ]
            self.attributes = sum_attributes(ncfile)
            # Using passes_regex_check() to make sure that we want to run this
            # variable in the review.  It will pass the name check as long as
            # it is both in the white list (defaults to ALL .*?) and not in
            # the black list (defaults to nothing '')
            self.variables = [
                sum_variable(v, self.attributes, summary_times, self.mdonly)
                for v in ncvars.values() if passes_regex_check(v._name)
            ]

        except:  # noqa: E722
            logging.error(cf.setError('Failed on file: %s' % self.path))
            raise

        companion_prefixes = {
            'fgp': 'fraction of good points',
            'be': 'best estimate',
            'qc': 'quality control',
            'aqc': 'ancillary quality control'
        }
        for var in self.variables:
            companions = [
                v['name'] for v in self.variables
                if any(
                    p+'_'+var['name'] == v['name'] for p in companion_prefixes
                )
            ]
            if companions:
                var['companions'] = companions

    def jsonify(self):
        return {
            'path': self.path,
            'span': (self.beg, self.end),
            'time': self.summary_times,
            'attributes': self.attributes,
            'dimensions': self.dimensions,
            'variables': self.variables,
        }
