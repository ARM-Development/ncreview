'''Datastream reader for the ncreview tool.

This contains the classes necessary to read a single datastream into a
Datastream object, collecting useful summary information about the datastream
which can be compared against another datastream with datastreamdiff, or
written out as a JSON string for display on the ncreview web page.

Recurring Attributes:
A '.name' attribute is the name of the object's corresponding section in the
    web-based UI

A '.ds' attribute refers back to the Datastream that contains the object.

Recurring methods:

A .load(data) method is used to update a summary object with a single file
    worth of data. The data parameter takes whatever data from is needed for
    the summary.

A .jsonify() method returns a data structure that can be converted to json
    and used to generate the report in the web-based UI.
'''

import os
import sys
import time
import json
import logging
import numpy as np
from collections import namedtuple

from . import colorformat as cf
from . import utils as utils
from .standard import ExStateVar, InStateVar, QCVar
from .version import __version__


# Timeline --------------------------------------------------------------------

# beg and end are indexes in ds.file_timeline
Log = namedtuple('Log', ['val', 'beg', 'end'])

# beg and end are seconds since the epoch
BLog = namedtuple('BLog', ['beg', 'end', 'val'])


class Bargraph(list):
    '''Basically the same thing as Timeline but with the distinction of being
    a bar graph and so we have a slightly different way of packaging the
    information
    '''
    def __init__(self, name, ds):
        super().__init__()
        self.name = name
        self.ds = ds

    def load(self, val):
        beg = self.ds.file_timeline[len(self)].beg
        end = self.ds.file_timeline[len(self)].end
        self.append(BLog(beg, end, val))

    def is_static(self):
        try:
            initial_val = self[0].val
        except IndexError:
            print(cf.setWarning((
                'WARNING: Dimension %s is empty. Creating staticSummary '
                'instead...'
            ) % self.name))
            return True
        for x in self:
            if x.val != initial_val:
                return False
        return True

    def jsonify(self):
        if self.is_static():
            sec = {
                'type': 'staticValue',
                'name': self.name,
                'val': self[0].val
            }
            self.logs = self[0].val
            if hasattr(self, '_difference'):
                sec['difference'] = getattr(self, '_difference')
            return sec
        return utils.json_section(self, [{
            'type': 'bargraph',
            'logs': ['beg, end, val'] + self,
        }])


class Timeline(list):
    '''A record of some data in the datastream which changes over time.

    A Timeline, which extends the builtin Python list, stores a sequence of
    logs which provide a comprehensive history of whatever value the timeline
    may be recording (an attribute value, a dimension length, etc.) in the
    datastream.
    '''
    def __init__(self, name, ds):
        super().__init__()
        self.name = name
        self.ds = ds

    def load(self, val):
        '''Parameters:
        val: Any object which can be tested for equality
        '''
        fi = len(self.ds.file_timeline) - 1

        # If the val is the same as the last val
        if self and self[-1].val == val and self[-1].end + 1 == fi:
            self[-1] = Log(self[-1].val, self[-1].beg, fi)
        else:
            self.append(Log(val, fi, fi))

    def jsonify(self):
        beg_gap = None
        end_gap = None
        if len(self) > 0:
            if self[0].beg > 0:
                beg_gap = [
                    self.ds.file_timeline[0].beg,
                    self.ds.file_timeline[self[0].beg-1].end,
                    None,
                ]
            if self[-1].end < len(self.ds.file_timeline)-1:
                end_gap = [
                    self.ds.file_timeline[self[-1].end+1].beg,
                    self.ds.file_timeline[-1].end,
                    None,
                ]
        if len(self) == 1 and beg_gap is None and end_gap is None:
            sec = {
                'type': 'staticValue',
                'name': self.name,
                'val': self[0].val
            }
            if hasattr(self, '_difference'):
                sec['difference'] = getattr(self, '_difference')
            return sec
        data = [['beg', 'end', 'val']]
        if beg_gap is not None:
            data += [beg_gap]
        data += [
            [
                self.ds.file_timeline[d.beg].beg,
                self.ds.file_timeline[d.end].end,
                d.val
            ]
            for d in self
        ]
        if end_gap is not None:
            data += [end_gap]
        return utils.json_section(self, [{
            'type': 'timeline',
            'data': data,
        }])


# Summaries -------------------------------------------------------------------


class DimlessSum:
    '''Summary of dimensionless data.

    A "summary" of data in a dimensionless variable. Simply wraps the
    dimensionless value with the methods expected of a data summary.
    '''
    def __init__(self, val):
        # NOTE: type(val) == DimlessDataType
        for k, v in val.items():
            setattr(self, k, v)
        self.n = 1
        self.ngood = 1 if self.isgood else 0
        self.nmiss = 1 if self.ismiss else 0
        self.nnan = 1 if self.isnan else 0
        self.ninf = 1 if self.isinf else 0
        self.nfill = 1 if self.isfill else 0
        self.nbig = 1 if self.isbig else 0
        self.nsmall = 1 if self.issmall else 0
        self.min = self.value
        self.max = self.value
        self.mean = self.value
        self.std = 0
        self.var = 0

    def __eq__(self, other):
        return (
            isinstance(other, DimlessSum) and
            self.value == other.value and
            self.ismiss == other.ismiss and
            self.isfill == other.isfill and
            self.isinf == other.isinf and
            self.isnan == other.isnan
        )

    def __ne__(self, other):
        return not self.__eq__(other)

    def row(self):
        return [
            self.value,
            1 if self.isgood else 0,
            1 if self.ismiss else 0,
            1 if self.isnan else 0,
            1 if self.isinf else 0,
            1 if self.isfill else 0,
        ]

    def get_nifs(self):
        return {
            'good': 1 if self.isgood else 0,
            'miss': 1 if self.ismiss else 0,
            'nan': 1 if self.isnan else 0,
            'inf': 1 if self.isinf else 0,
            'fill': 1 if self.isfill else 0,
        }


class NumSum:
    '''Summary of the values in a variable holding numerical data.

    This numerical summary (NumSum) holds summary statistics of a dataset.
    The += operator correctly combines two statistical summaries, such that for
    datasets a and b, numsum(a)+numsum(b) = numsum(a concatenated with b).
    '''
    __slots__ = (
        'n', 'ngood', 'nmiss', 'ninf', 'nnan', 'nfill', 'nsmall', 'nbig',
        'min', 'max', 'mean', 'var', 'std'
    )

    def __init__(
        self,
        n=0,
        ngood=0,
        nmiss=0,
        ninf=0,
        nnan=0,
        nfill=0,
        nbig=0,
        nsmall=0,
        min=None,
        max=None,
        mean=None,
        median=None,
        var=None,
        std=None
    ):
        self.n = n
        self.ngood = ngood
        self.nmiss = nmiss
        self.ninf = ninf
        self.nnan = nnan
        self.nfill = nfill
        self.nsmall = nsmall
        self.nbig = nbig
        self.min = min
        self.max = max
        self.mean = mean
        self.var = var
        self.std = std

    def get_nifs(self):
        return {
            'n': self.n,
            'nmiss': self.nmiss,
            'nnan': self.nnan,
            'ninf': self.ninf,
            'nfill': self.nfill,
            'nbig': self.nbig,
            'nsmall': self.nsmall,
        }

    def __iadd__(self, other):
        s, o = self, other
        ngood = s.ngood + o.ngood
        mean = None
        try:
            if o.mean is None:
                mean = s.mean
            elif s.mean is None:
                mean = o.mean
            elif ngood > 0:
                mean = (s.mean * s.ngood + o.mean * o.ngood) / ngood
        except (TypeError, OverflowError):
            pass
        try:
            if o.var is None:
                pass
            elif s.var is None:
                s.var = o.var
            elif ngood > 0 and mean is not None:
                # http://stats.stackexchange.com/questions/43159/
                # NOTE: I added the abs() because you can never end up with a
                # negative variance and apparently sometimes if the number is
                # really close to zero you might end up with it looking
                # negative.
                s.var = abs(
                    (s.ngood * (s.var+s.mean**2) + o.ngood * (o.var+o.mean**2))
                    / ngood - mean**2
                )
            else:
                s.var = None
        except (TypeError, OverflowError):
            s.var = None

        s.n += o.n
        s.ngood = ngood
        s.nmiss += o.nmiss
        s.nnan += o.nnan
        s.ninf += o.ninf
        s.nfill += o.nfill
        s.nbig += o.nbig
        s.nsmall += o.nsmall

        if s.min is None and o.min is not None:
            s.min = o.min
        elif s.min is not None and o.min is not None:
            s.min = min(s.min, o.min)

        if s.max is None and o.max is not None:
            s.max = o.max
        elif s.max is not None and o.max is not None:
            s.max = max(s.max, o.max)

        s.mean = mean
        return s

    def __eq__(self, other):
        '''Tests the equivalence of two numerical summaries to within
        plausible rounding errors.
        '''
        if not isinstance(other, NumSum):
            return False
        for att in NumSum.__slots__:
            s = getattr(self, att)
            o = getattr(other, att)
            if s is None and o is None:
                continue
            if s is None or o is None:
                return False
            if np.abs(s - o) > 1e-4:
                return False
        return True

    def __ne__(self, other):
        return not self.__eq__(other)

    def row(self):
        '''Converts the summary into a list for storage in a table as a row.
        '''
        return [
            self.n,
            self.ngood,
            self.nmiss,
            self.ninf,
            self.nnan,
            self.nfill,
            self.min,
            self.max,
            self.mean,
            np.sqrt(self.var)
            if self.var is not None and self.var >= 0 else None
        ]

    def jsonify(self):
        data = {
            'n': self.n,
            'ngood': self.ngood,
            'nmiss': self.nmiss,
            'ninf': self.ninf,
            'nnan': self.nnan,
            'min': self.min,
            'max': self.max,
            'mean': self.mean,
            'std': np.sqrt(self.var)
            if self.var is not None and self.var >= 0 else None
        }
        return data


class StateSum(list):
    '''Summary of a state indicator variable.

    Holds an array with the number of occurrences of each state in a state
    indicator variable. the += operator combines two state summaries by the
    second operand's flag counts to the first.
    '''
    def __init__(self, vals):
        list.__init__(self)
        self._s = list(map(lambda x: x[0], vals))
        self._m = {s: i for i, s in enumerate(self._s)}
        self[:] = list(map(lambda x: int(x[1]), vals))

    def __iadd__(self, other):
        for i, x in enumerate(other):
            self.add(other.state(i), x)
        return self

    def __eq__(self, other):
        return (
            isinstance(other, StateSum) and
            len(self) == len(other) and
            all(a == b for a, b in zip(self, other)) and
            all(a == b for a, b in zip(self.states(), other.states()))
        )

    def __ne__(self, other):
        return not self.__eq__(other)

    def get_bits(self):
        # TODO: return self.bits
        return [], 0

    def state(self, i):
        return self._s[i]

    def states(self):
        return self._s

    def add(self, s, x):
        if s not in self._m:
            self._m[s] = len(self._s)
            self._s.append(s)
        self[self._m[s]] += x

    def row(self):
        return self[:]


# Data Types ------------------------------------------------------------------


class DimlessDataType:
    '''Wraps a single value with the expected DataType interface.
    '''
    def __init__(self, sumvar, ds):
        self.type_name = 'numericScalar'

    @staticmethod
    def matches(sumvar, ds):
        return not sumvar['dimensions']

    def summarize(self, data=None):
        return DimlessSum(data)

    def columns(self):
        return [
            'value', 'good', 'miss', 'nan', 'inf', 'fill',
        ], [
            'Value',
            'Has good value',
            'Has missing value',
            'Has nan value',
            'Has inf value',
            'Has fill value',
        ]


class NumDataType:
    '''Class containing methods for working with numerical data

    Performs numerical summary of data and returns the result as a NumSum
    '''
    def __init__(self, sumvar, ds):
        self.type_name = 'numericSeries'

    @staticmethod
    def matches(sumvar, ds):
        return True

    def summarize(self, data=None):
        '''Return summary statistics of the data as a NumSum object

        parameters:
        data: dict of numeric summaries to be wrapped in a NumSum instance
        '''
        if data is None:
            return NumSum()
        return NumSum(**data)

    def columns(self):
        cols = [
            'n', 'ngood', 'nmiss', 'ninf', 'nnan', 'nfill',
            'min', 'max', 'mean', 'std',
        ]
        tooltips = [
            'Number of samples',
            'Number of good samples',
            'Number of missing samples',
            'Number of infs',
            'Number of nans',
            'Number of fill values',
            'Minimum value',
            'Maximum value',
            'Mean value',
            'Median value',
            'Standard deviation'
        ]
        return cols, tooltips


class ExStateDataType:
    '''Class containing methods for working with exclusive state data.

    Reads important metadata from an exclusive state variable, and collects
    the counts of each exclusive state in a data set into a StateSum.
    '''

    def __init__(self, sumvar, ds):
        self.type_name = 'stateExclusive'
        (self.flag_values, self.flag_descriptions) = ExStateVar.parse({
            a['name']: a['val'] for a in sumvar['attributes']
        })

    def columns(self):
        return [
            'flag %s' % str(v) for v in self.flag_values
        ], self.flag_descriptions

    @staticmethod
    def matches(sumvar, ds):
        '''
        Parameters
        sumvar: summary variable dict to check
        ds: parent Datastream
        '''
        return sumvar['dtype'][:3] == 'int' and (
            ExStateVar.has_attrs({
                a['name']: a['val'] for a in sumvar['attributes']
            })
        )

    def summarize(self, data=None):
        if not data:
            return StateSum([
                (str(v), 0) for v in self.flag_values
            ])
        return StateSum([
            (str(v), data[str(v)] if str(v) in data else 0)
            for v in self.flag_values
        ])


class InStateDataType:
    '''Class containig methods for working with inclusive state data.

    Reads important metadata from an inclusive state variable, and collects
    the counts of each inclusive state in a data set into a StateSum.
    '''

    def __init__(self, sumvar, ds):
        self.type_name = 'stateInclusive'
        (self.flag_masks, self.flag_descriptions) = InStateVar.parse({
            a['name']: a['val'] for a in sumvar['attributes']
        })

    @staticmethod
    def matches(sumvar, ds):
        return sumvar['dtype'][:3] == 'int' and (
            InStateVar.has_attrs({
                a['name']: a['val'] for a in sumvar['attributes']
            })
        )

    def summarize(self, data=None):
        if not data:
            return StateSum([
                (str(m), 0) for m in self.flag_masks
            ])
        return StateSum([
            (str(m), data[str(m)] if str(m) in data else 0)
            for m in self.flag_masks
        ])

    def columns(self):
        return [
            'bit %s' % str(n+1) for n in range(len(self.flag_masks))
        ], self.flag_descriptions


class QCDataType(InStateDataType):
    '''Class containing methods for working with Quality control data.

    Subclass of InStateData, only difference is that variable names must
    start with a qc_ to be identified as QC and not just inclusive state.
    '''

    def __init__(self, sumvar, ds):
        self.type_name = 'stateInclusiveQC'
        (self.flag_masks, self.flag_descriptions) = QCVar.parse({
            a['name']: a['val'] for a in sumvar['attributes']
        }, ds.attributes)

    @staticmethod
    def matches(sumvar, ds):
        return QCVar.is_match(sumvar['name'], {
            a['name']: a['val'] for a in sumvar['attributes']
        }, ds.attributes)


def data_type_of(sumvar, ds, typeonly=False):
    '''Determines the data type of ncvar.
    '''
    for dt in (
        DimlessDataType,
        QCDataType,
        ExStateDataType,
        InStateDataType,
        NumDataType
    ):
        if dt.matches(sumvar, ds):
            if typeonly:
                return dt
            return dt(sumvar, ds)


# Data classes ----------------------------------------------------------------

class TimedData:
    '''The TimedData object is used to summarize and write out all kinds of
    data with a time dimension.

    Attributes:
        ds         parent Datastream
        data       dictionary of sample time : summary object pairs
        data_type  provides interface to a specific type of data
    '''
    def __init__(self, sumvar, ds):
        self.ds = ds
        self.name = 'Data'
        self.data = {}  # Key is time in epoch, val is numsum/statesum/...
        self._data_type = data_type_of(sumvar, ds, True)
        self.data_type = self._data_type(sumvar, ds)
        self.numsum_ref = NumSum() \
            if sumvar['numsum_data'] is not None else None

    def load(self, sumvar):
        '''
        parameters:
        sumvar: variable summary dict
        '''
        self.var_name = sumvar['name']
        if self.numsum_ref and sumvar['numsum_data'] is not None:
            self.numsum_ref += NumSum(**sumvar['numsum_data'])
        time = self.ds.current_summary['time']
        for i in range(len(time)):
            if self._data_type != data_type_of(sumvar, self.ds, True):
                # TODO: Make this a typed exception such that main() can give
                # the command-line advice rather than this lib.
                raise Exception(cf.setError((
                    "Fatally inconsistent variable '%s' (at %s): %s and %s."
                    "\n"
                    "Consider using the --vars- <VARIABLE_NAME_OR_REGEX_"
                    "EXPRESSION> argument to exclude this variable."
                ) % (
                    sumvar['name'],
                    utils.timetostr(time[i], '%Y-%m-%d %H:%M:%S'),
                    self._data_type,
                    data_type_of(sumvar, self.ds, True)
                )))

            if time[i] not in self.data:
                self.data[time[i]] = self.data_type.summarize()
            self.data[time[i]] += self.data_type.summarize({
                k: v[i] for k, v in sumvar['data'].items()
            })

    def get_bits(self):
        if (
            self.data
            and hasattr(self.data_type, 'flag_masks')
            and self.numsum_ref
        ):
            # The number of bits (starting at bit 1)
            bits = [0] * len(self.data_type.flag_masks)
            for _, vals in self.data.items():
                for index, val in enumerate(vals):
                    bits[index] += val
            return bits, self.numsum_ref.get_nifs()['n']
        return [], 0

    def get_nifs(self):
        if self.numsum_ref is not None:
            return self.numsum_ref.get_nifs()
        ns = NumSum()
        if self.data:
            for _ns in self.data.values():
                if _ns is not None:
                    ns += _ns
        return ns.get_nifs()

    def jsonify(self):
        columns, tooltips = self.data_type.columns()
        if len(self.data) == 1:
            val = next(iter(self.data.values())).row()
            sec = {
                'type': 'staticSummary',
                'name': self.name,
                'columns': columns,
                'tooltips': tooltips,
                'val': val
            }
            if hasattr(self, '_difference'):
                sec['difference'] = getattr('_difference')
            return sec
        # Format data for a csv file...
        columns = ['beg', 'end'] + columns
        tooltips = ['', ''] + tooltips
        csv = [
            [time, time+self.ds.sample_interval] + summary.row()
            for time, summary in sorted(self.data.items())
        ]
        csv = [columns, tooltips]+csv
        plot_json = {
            'type': 'plot',
            'data': csv,
            'ds_path': self.ds.path
        }
        if self.ds.use_dq_inspector:
            plot_json['var_name'] = self.var_name
        return utils.json_section(self, [plot_json])


class UntimedData(Timeline):
    '''Summarizes variable data which lacks a time dimension.
    Stores a file-by-file summary of the data in its Timeline superclass.

    Attributes:
        ds         parent Datastream
        data_type  provides interface to a specific type of data
    '''
    def __init__(self, sumvar, ds):
        super().__init__('Data', ds)
        self.data_type = data_type_of(sumvar, ds)
        self.numsum_ref = NumSum() \
            if sumvar['numsum_data'] is not None else None

    def load(self, sumvar):
        self.var_name = sumvar['name']
        summ = self.data_type.summarize(sumvar['data'])
        if self.numsum_ref is not None and sumvar['numsum_data'] is not None:
            self.numsum_ref += NumSum(**sumvar['numsum_data'])
        super().load(summ)

    def get_bits(self):
        if type(self[0].val) is DimlessSum:
            bits = [0]
        elif hasattr(self.data_type, 'flag_masks'):
            bits = [0] * len(getattr(self.data_type, 'flag_masks'))
        for ds in self:
            if type(ds.val) is DimlessSum:
                bits[0] += ds.val.row()[0] * (ds.end - ds.beg + 1)
            else:
                for index, value in enumerate(ds[0]):
                    bits[index] += value * (ds.end - ds.beg + 1)
        length = self.numsum_ref.get_nifs()['n'] \
            if self.numsum_ref else 0
        return bits, length

    def get_nifs(self):
        if self.numsum_ref is not None:
            return self.numsum_ref.get_nifs()
        ns = NumSum()
        if self:
            for i in self:
                if i.val is not None:
                    ns += i.val
        return ns.get_nifs()

    def jsonify(self):
        columns, tooltips = self.data_type.columns()
        if len(self) == 1:
            sec = {
                'type': 'staticSummary',
                'name': self.name,
                'columns': columns,
                'tooltips': tooltips,
                'val': self[0].val.row()
            }
            if hasattr(self, '_difference'):
                sec['difference'] = getattr(self, '_difference')
            return sec
        columns = ['beg', 'end']+columns
        tooltips = ['', '']+tooltips
        csv = [
            [
                self.ds.file_timeline[log.beg].beg,
                self.ds.file_timeline[log.end].end
            ] + log.val.row() for log in self
        ]
        csv = [columns, tooltips] + csv
        return utils.json_section(self, [{
            'type': 'plot',
            'data': csv,
            'separate': ['data']
        }])


# Variable --------------------------------------------------------------------

class Variable:
    '''Stores summary information about a variable in a datastream.

    Attributes:
        name        variable name
        dims        timeline where values are tuples of variable dimensions
        dtype       variable's data type (numpy name)
        attributes  timeline dict of the variable's attributes
        companions  QC and other companion variables get stored in this dict
    '''
    def __init__(self, sumvar, ds):
        self.ds = ds
        self.name = sumvar['name']
        self.dims = Timeline('Dimensions', ds)
        self.dtype = Timeline('Data Type', ds)
        self.attributes = TimelineDict('Attributes', ds)
        self.companions = VariableDict('Companions', ds)
        self.companion_names = set()
        self.metadata_only = 'data' not in sumvar
        if not self.metadata_only:
            self.data = TimedData(sumvar, ds) \
                if 'time' in sumvar['dimensions'] \
                else UntimedData(sumvar, ds)

    def load(self, sumvar):
        self.dims.load(sumvar['dimensions'])
        self.dtype.load(sumvar['dtype'])
        self.attributes.load({
            a['name']: a['val']
            for a in sumvar['attributes']
        })
        if 'companions' in sumvar:
            self.companion_names = \
                self.companion_names | set(sumvar['companions'])
        if not self.metadata_only:
            self.data.load(sumvar)

    def get_nifs(self):
        if not self.metadata_only:
            return self.data.get_nifs()
        return {
            'n': 0,
            'nmiss': 0,
            'nnan': 0,
            'ninf': 0,
            'nfill': 0,
            'nbig': 0,
            'nsmall': 0,
        }

    def get_bits(self):
        if not self.metadata_only:
            return self.data.get_bits()
        return [], 0

    def jsonify(self):
        sec = utils.json_section(self, [
            self.dtype.jsonify(),
            self.dims.jsonify(),
            self.attributes.jsonify(),
        ])
        if not self.metadata_only:
            sec['contents'].append(self.data.jsonify())
        if self.companions:
            sec['contents'].append(self.companions.jsonify())
        sec['type'] = 'variable'
        dims = set(map(lambda d: d.val, self.dims))
        sec['dims'] = dims.pop() if len(dims) == 1 else 'varying'
        return sec


# Dicts -----------------------------------------------------------------------

class NCDict(dict):
    def __init__(self, name, ds):
        dict.__init__(self)
        self.name = name
        self.ds = ds

    def jsonify(self):
        return utils.json_section(self, [x.jsonify() for x in self.values()])


class BargraphDict(NCDict):
    '''An equivalent to the timeline Dict but with the distinction of being a
    bar graph instead of a timeline.
    '''
    def __init__(self, name, ds):
        NCDict.__init__(self, name, ds)

    def load(self, data):
        '''data: a dictionary of name: data pairs. Each name will be associated
        with its own timeline.
        '''
        for name, val in data.items():
            if name not in self:
                self[name] = Bargraph(name, self.ds)
            self[name].load(val)


class TimelineDict(NCDict):
    '''Extension of the dictionary class specialized for loading in name:
    timeline pairs.
    '''
    def __init__(self, name, ds):
        NCDict.__init__(self, name, ds)

    def load(self, data):
        '''data: a dictionary of name: data pairs. Each name will be associated
        with its own timeline.
        '''
        for name, val in data.items():
            if name not in self:
                self[name] = Timeline(name, self.ds)
            self[name].load(val)


class VariableDict(NCDict):

    def load(self, data):
        '''data: a dictionary of name: ncvar pairs, where ncvar is a netCDF4
        variable object
        '''
        for name, var in data.items():
            if name not in self:
                self[name] = Variable(var, self.ds)
            self[name].load(var)

    def _clear_companions(self):
        '''Remove companion variables from the top-level variable dict, so they
        don't exist twice.

        This is a recursive function which should only be called through
        nest_companions
        '''
        companion_names = set()
        for var in self.values():
            companion_names |= set(var.companions.keys())

        for var_name in companion_names:
            self.pop(var_name, None)

        for var in self.values():
            var.companions._clear_companions()

    def nest_companions(self):
        '''Moves companon variable such as qc_<var> down into the companions
        attr of their parent var
        '''
        for var in self.values():
            var.companions.update({
                n: v for n, v in self.items() if n in var.companion_names
            })
        self._clear_companions()


# Datastream ------------------------------------------------------------------

TimeInterval = namedtuple('TimeInterval', ['beg', 'end'])


class Datastream:
    '''Data structure storing summary information of a datastream.
    '''
    def __init__(
        self,
        use_dq_inspector=True,
        sample_interval=None
    ):
        self.sample_interval = sample_interval
        self.summary_times = []
        self.file_timeline = []
        self.attributes = TimelineDict('Attributes', self)
        self.dimensions = BargraphDict('Dimensions', self)
        self.variables = VariableDict('Variables', self)
        self.ds_name = None
        self.current_summary = None
        self.use_dq_inspector = use_dq_inspector

    def add(self, summary):
        f = summary
        self.current_summary = f
        fn = os.path.basename(f['path'])
        if self.ds_name is None:
            self.path = os.path.dirname(f['path'])
            self.ds_name = utils.file_datastream(fn)
        else:
            ds_name = utils.file_datastream(fn)
            if ds_name != self.ds_name:
                raise RuntimeError(cf.setError((
                    '%s contains files from different datastreams: %s and %s'
                ) % (self.path, self.ds_name, ds_name)))

        beg, end = int(f['span'][0]), int(f['span'][1])

        self.summary_times = sorted(
            set(f['time']) |
            set(self.summary_times)
        )

        # Add this begin, end pair to the file timeline...
        if self.file_timeline and self.file_timeline[-1].end > beg:
            logging.warning(cf.setWarning(
                '%s overlaps with previous file.' % f['path']
            ))
        self.file_timeline.append(TimeInterval(beg, end))

        # Load global metadata...
        beg, end = f['span']
        self.attributes.load({
            a['name']: a['val'] for a in f['attributes']
        })
        self.dimensions.load({
            d['name']: d['length'] for d in f['dimensions']
        })
        self.variables.load({
            v['name']: v for v in f['variables']
        })

    def summarize(self):
        data = {}
        qc_data = {}
        max_bits = 0
        sum_nifs = {
            'n': 0,
            'nmiss': 0,
            'nnan': 0,
            'ninf': 0,
            'nfill': 0,
            'nbig': 0,
            'nsmall': 0,
        }

        def intfmt(n: int) -> str:
            return format(n, ',d')

        def fltfmt(n: float) -> str:
            return format(n, '.3f')

        for _, value in self.variables.items():
            if type(value) is Variable:
                if value.companions:
                    for qc_key, qc_value in value.companions.items():
                        bits, total = qc_value.get_bits()
                        if total > 0:
                            qc_data[qc_key] = [
                                '--' if x == 0 else fltfmt(100*x/total)
                                for x in bits
                            ] + [-total]
                            # Dumb. The "-total" thing above is a hack to get
                            # the UI to display the total as the last column
                            # regardless of how many bits were relevant to this
                            # particular variable. The right way would be to
                            # not do number formatting at all here but to let
                            # the UI do it.

                        if len(bits) > max_bits:
                            max_bits = len(bits)

                temp_nifs = value.get_nifs()
                sum_nifs = {k: v + temp_nifs[k] for k, v in sum_nifs.items()}

                pct = temp_nifs['nmiss'] / temp_nifs['n'] * 100 \
                    if temp_nifs['n'] > 0 else None

                data[value.name] = (
                    intfmt(temp_nifs['n']),
                    intfmt(temp_nifs['nmiss']),
                    fltfmt(pct) if pct is not None else '--',
                    intfmt(temp_nifs['nnan']),
                    intfmt(temp_nifs['ninf']),
                    intfmt(temp_nifs['nfill']),
                    intfmt(temp_nifs['nbig']),
                    intfmt(temp_nifs['nsmall']),
                )

        if data:
            data['Header'] = (
                'Variable', 'n', 'miss', '% miss', 'nans', 'infs', 'fill',
                '+limit', '-limit'
            )
            pct = sum_nifs['nmiss'] / sum_nifs['n'] * 100 \
                if sum_nifs['n'] > 0 else None

            data['Total'] = (
                intfmt(sum_nifs['n']),
                intfmt(sum_nifs['nmiss']),
                fltfmt(pct) if pct is not None else '--',
                intfmt(sum_nifs['nnan']),
                intfmt(sum_nifs['ninf']),
                intfmt(sum_nifs['nfill']),
                intfmt(sum_nifs['nbig']),
                intfmt(sum_nifs['nsmall'])
            )

        if qc_data:
            qc_data["Bits"] = max_bits

        return {
            'type': 'summary',
            'data': data,
            'qc_data': qc_data,
        }

    def post_add(self):
        # Check for single-time-value files and adjust the time range to be
        # the median gap between them, defaulting to 86400 (1 day)
        i = 1
        gaps = []
        while i < len(self.file_timeline):
            gaps.append(
                self.file_timeline[i].beg - self.file_timeline[i-1].end
            )
            i += 1
        gap = 86400
        if len(gaps) > 1:
            gap = gaps[round(len(gaps)/2)]
        for i in range(len(self.file_timeline)):
            f = self.file_timeline[i]
            if f.beg == f.end:
                self.file_timeline[i] = TimeInterval(f.beg, f.beg + gap)

    def jsonify(self):
        self.variables.nest_companions()
        return {
            'type': 'datastream',
            'ds_name': self.ds_name,
            'path': self.path,
            'sample_interval': self.sample_interval,
            'summary_times': self.summary_times,
            'command': " ".join(sys.argv),
            'version': __version__,
            'review_date': time.time()//1,
            'contents': [
                {
                    'type': 'section',
                    'name': 'File Timeline',
                    'contents': [
                        {
                            'type': 'fileTimeline',
                            'data': [['beg', 'end']]+self.file_timeline
                        }
                    ]
                },
                self.attributes.jsonify(),
                self.dimensions.jsonify(),
                self.variables.jsonify(),
                self.summarize(),
            ]
        }

    def json(self):
        return json.dumps(self.jsonify(), default=utils.JEncoder)
