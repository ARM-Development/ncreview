'''Datastream comparison classes for the ncreview tool.

This module contains the classes necessary to perform a comparison of two
datastreams and output the resulting comparison report to a json file which
can be rendered by the web tool.

Recurring Attributes

A name attribute is the name of the object's corresponding section in the
    web-based UI.

A dsd attribute refers back to the DatastreamDiff that contains the object.

Recurring methods:

Generally, a class's initializer generates the comparison data structure
    from params old and new as the data structures to be compared.
    These old and new params' type generally indicated by the class name,
    for example DatastreamDiff compares two Datastreams,
    TimelineDiff compares two Timelines.
    the dsd parameter should take in the parent DatastreamDiff.

A difference() method returns 'same', 'changed', 'added', or 'removed'
    indicating the nature of that comparison object. These difference strings
    are used later in the web tool to highlight entries accordingly.

A jsonify() method returns a data structure that can be converted to json
    and used to generate the report in the web-based UI.

'''

import sys
import time
import json
import numpy as np
from collections import namedtuple

from . import utils as utils
from . import colorformat as cf
from .version import __version__
from .datastream import TimedData
from .datastream import UntimedData
from .datastream import Variable

"""
General comments:
- Don't leave old code in comments, keep it in source control
- replace comprehensions + python builtins with numpy methods, will be faster
   and cleaner
- Don't use bare excepts unnecessarily
- Add spaces around operators
- Too many list comprehensions
- The majority of this file is just parsing data and passing it around, but
   most of the code is extremely difficult to read. Need to use more lines and
   name variables better. If you have to do something unintuitive, leave a
   comment.
"""

# Timeline --------------------------------------------------------------------

Diff = namedtuple('Diff', ['old', 'new', 'beg', 'end'])


class BargraphDiff(list):
    '''Comparison between two bargraphs.
    Logs the differences between two bargraphs in a list of Diff objects.
    '''
    def __init__(self, name, old, new, dsd):
        super(BargraphDiff, self).__init__(self)
        self.name = name
        self.dsd = dsd
        self.old_data = []
        self.new_data = []
        try:
            self.old_data = old[name]
        except KeyError:
            pass
        try:
            self.new_data = new[name]
        except KeyError:
            pass

    @utils.store_difference
    def difference(self):
        try:
            if np.isnan(self.old_data).all() and np.isnan(self.new_data).all():
                return 'same'
        except TypeError:
            pass
        if not self.old_data:
            return 'added'
        elif not self.new_data:
            return 'removed'
        elif self.is_static() and self.old_data[0].val == self.new_data[0].val:
            return 'same'
        elif self.old_data == self.new_data:
            return 'same'
        return 'changed'

    def is_static(self):
        if not self.old_data and not self.new_data:
            return True
        same_old = len(np.unique(self.old_data)) < 2 \
            if self.old_data else False
        same_new = len(np.unique(self.new_data)) < 2 \
            if self.new_data else False
        return same_old and same_new

    def jsonify(self):
        if self.is_static():
            sec = {
                'type': 'staticValueDiff',
                'name': self.name,
                'difference': self.difference(),
                'old': self.old_data[0].val if self.old_data else 'none',
                'new': self.new_data[0].val if self.new_data else 'none',
            }
            try:
                if np.isnan(sec['old']):
                    sec['old'] = 'NaN'
            except TypeError:
                pass
            try:
                if np.isnan(sec['new']):
                    sec['new'] = 'NaN'
            except TypeError:
                pass
            return sec

        return utils.json_section(self, [{
            'type': 'bargraphDiff',
            'old_data': [['beg', 'end', 'val']] + list(self.old_data),
            'new_data': [['beg', 'end', 'val']] + list(self.new_data),
        }])


class TimelineDiff(list):
    '''Comparison between two Timelines.
    Logs the differences between two timelines in a list of Diff objects.
    '''
    def __init__(self, name, old, new, dsd):
        super().__init__()
        self.name = name
        self.dsd = dsd

        for beg, end, old_i, new_i in (
            utils.join_times(
                dsd.old_file_times, dsd.new_file_times, union=(
                    type(new) == UntimedData and type(old) == type(new)
                )
            )
        ):
            old_val = None if old_i is None else next(
                (d.val for d in old if d.beg <= old_i <= d.end), None
            )
            new_val = None if new_i is None else next(
                (d.val for d in new if d.beg <= new_i <= d.end), None
            )
            self.append(Diff(old_val, new_val, beg, end))

    @utils.store_difference
    def difference(self):
        if not self:
            return 'same'

        def diff(d):
            if d.old == d.new:
                return 'same'
            if d.old is None:
                return 'added'
            if d.new is None:
                return 'removed'
            return 'changed'

        try:
            if np.isnan(self[0].old).all() and np.isnan(self[0].new).all():
                return 'same'
        except TypeError:
            pass
        except ValueError:
            pass
        first = diff(self[0])
        if first == 'changed' or all(diff(d) == first for d in self):
            return first
        return 'changed'

    def jsonify(self):
        if len(self) == 1:
            sec = {
                'type': 'staticValueDiff',
                'name': self.name,
                'old': self[0].old,
                'new': self[0].new
            }
            try:
                if np.isnan(self[0].old):
                    sec['old'] = 'NaN'
            except TypeError:
                pass
            try:
                if np.isnan(self[0].new):
                    sec['new'] = 'NaN'
            except TypeError:
                pass
            if hasattr(self, '_difference'):
                sec['difference'] = getattr(self, '_difference')
            return sec
        return utils.json_section(self, [{
            'type': 'timelineDiff',
            'data': [['old', 'new', 'beg', 'end']] + [
                [d.old, d.new, d.beg, d.end] for d in self
            ]
        }])


def compare_timelines(name, old, new, dsd):
    td = TimelineDiff(name, old, new, dsd)
    if td.difference() == 'same':
        setattr(new, '_difference', 'same')
        setattr(new, 'difference', lambda: 'same')
        return new
    return td


# Data ------------------------------------------------------------------------

# TODO: Create a new kind of object (TimedDataDelta) which will plot new minus
#       old data.
# TODO: Yan wants a feature where differences between individual values are
#       plotted.
# TODO: somebody else wants a feature where a density of scatterpoints of old
#       and new is plotted.

class TimedDataDiff:
    '''Comparison of old and new timed data.
    '''
    def __init__(self, old, new, dsd):
        self.var_name = old.var_name
        self.dsd = dsd
        self.name = 'Data'
        self.data_type = new.data_type
        self.old = [
            old.data[t] if t in old.data else None for t in dsd.summary_times
        ]
        self.new = [
            new.data[t] if t in new.data else None for t in dsd.summary_times
        ]
        self.old_timed_data = old
        self.new_timed_data = new

    def get_nifs(self):
        return self.old_timed_data.get_nifs(), self.new_timed_data.get_nifs()

    def get_bits(self):
        return self.old_timed_data.get_bits(), self.new_timed_data.get_bits()

    @utils.store_difference
    def difference(self):
        if not self.old and not self.new:
            return 'same'

        def diff(o, n):
            if o == n:
                return 'same'
            if o is None:
                return 'added'
            if n is None:
                return 'removed'
            return 'changed'

        summary_times = self.dsd.summary_times
        sample_interval = self.dsd.sample_interval

        shared_times = list(
            utils.join_times(
                self.dsd.old_file_times, self.dsd.new_file_times, union=True
            )
        )

        # Gets the first difference
        def sample_diffs():
            i = 0
            for beg, end, old_fi, new_fi in shared_times:
                if old_fi is None:
                    yield 'added'
                if new_fi is None:
                    yield 'removed'
                beg = (beg//sample_interval)*sample_interval
                while i < len(summary_times) and summary_times[i] < beg:
                    i += 1
                while i < len(summary_times) and summary_times[i] <= end:
                    yield diff(self.old[i], self.new[i])
                    i += 1

        # Pick a different variable name for the result of the function
        sample_diffs = sample_diffs()

        first = next(sample_diffs, 'same')

        # If the first one is changed, we don't need to check any more
        if first == 'changed':
            return first

        # Check the remaining differences
        for d in sample_diffs:
            if d != first:
                return 'changed'

        return first

    def jsonify(self):

        columns, tooltips = self.data_type.columns()

        if len(self.dsd.summary_times) == 1:
            sec = None
            if self.old[0] != self.new[0]:
                sec = {
                    'type': 'staticSummaryDiff',
                    'name': self.name,
                    'columns': columns,
                    'tooltips': tooltips,
                    'old': self.old[0].row(),
                    'new': self.new[0].row(),
                }
            else:
                sec = {
                    'type': 'staticSummary',
                    'name': self.name,
                    'val': self.new[0].row(),
                }

            sec['difference'] = self.difference()
            return sec

        columns = ['beg', 'end'] + columns
        tooltips = ['', ''] + tooltips

        old_csv = [columns, tooltips] + [
            [t, t+self.dsd.sample_interval] + (
                x.row() if x is not None else []
            ) for t, x in zip(self.dsd.summary_times, self.old)
        ]
        new_csv = [columns, tooltips] + [
            [t, t+self.dsd.sample_interval] + (
                x.row() if x is not None else []
            ) for t, x in zip(self.dsd.summary_times, self.new)
        ]

        # Add Nones to complete any empty rows
        for csv in old_csv, new_csv:
            length = max(map(len, csv))
            if length == 2:
                continue
            for row in csv:
                if len(row) == 2:
                    row += [None]*(length-2)

        plotDiff_json = {
            'type': 'plotDiff',
            'old_data': old_csv,
            'new_data': new_csv,
            'old_ds_path': self.dsd.old_path,
            'new_ds_path': self.dsd.new_path,
        }

        if self.dsd.use_dq_inspector:
            plotDiff_json['var_name'] = self.var_name

        return utils.json_section(self, [plotDiff_json])


class UntimedDataDiff(TimelineDiff):
    '''Comparison of old and new untimed data.
    '''
    def __init__(self, old, new, dsd):
        super().__init__('Data', old, new, dsd)
        self.data_type = new.data_type

        self.old_untimed_data = old
        self.new_untimed_data = new

    def get_nifs(self):
        return (
            self.old_untimed_data.get_nifs(),
            self.new_untimed_data.get_nifs(),
        )

    def get_bits(self):
        '''Returns how many of each bit are not zero, and then the total number
        of rows for both old and new data
        '''
        try:
            return (
                self.old_untimed_data.get_bits(),
                self.new_untimed_data.get_bits(),
            )
        except:  # noqa: E722
            pass
        return ([], 0), ([], 0)

    def jsonify(self):
        columns, tooltips = self.data_type.columns()
        if len(self) == 1:
            sec = None
            if self[0].old != self[0].new:
                sec = {
                    'type': 'staticSummaryDiff',
                    'name': self.name,
                    'columns': columns,
                    'tooltips': tooltips,
                    'old': self[0].old.row(),
                    'new': self[0].new.row(),
                }
            else:
                sec = {
                    'type': 'staticSummary',
                    'name': self.name,
                    'columns': columns,
                    'tooltips': tooltips,
                    'val': self[0].new.row(),
                }
            sec['difference'] = self.difference()
            return sec

        columns = ['beg', 'end'] + columns
        tooltips = ['', ''] + tooltips
        old_csv = [columns, tooltips] + [
            [d.beg, d.end]+(d.old.row() if d.old is not None else [])
            for d in self
        ]
        new_csv = [columns, tooltips] + [
            [d.beg, d.end]+(d.new.row() if d.new is not None else [])
            for d in self
        ]

        # Add nones to complete any empty rows
        # TODO: this same funcionality exists above...extract into function?
        for csv in old_csv, new_csv:
            length = max(map(len, csv))
            if length == 2:
                continue
            for row in csv:
                if len(row) == 2:
                    row += [None]*(length-2)

        return utils.json_section(self, [{
            'type': 'plotDiff',
            'data_type': self.data_type.type_name,
            'old_data': old_csv,
            'new_data': new_csv,
        }])


def compare_data(old, new, dsd):
    '''Generic data comparison function.
    '''
    if type(old) != type(new) or type(old.data_type) != type(new.data_type):
        raise ValueError(
            cf.setError('Cannot compare data summaries of different type')
        )
    if isinstance(old, TimedData):
        return TimedDataDiff(old, new, dsd)

    if isinstance(old, UntimedData):
        return UntimedDataDiff(old, new, dsd)


# Variable --------------------------------------------------------------------

class VariableDiff:
    '''Comparison of old and new variables.

    Attribtues:
        name        Variable name
        dims        TimelineDiff of variables' dimensions
        dtype       TimelineDiff of vareiables' data types
        attributes  TimelineDictDiff of the variables' attributes
        companions  VariableDictDiff of the variables' companion variables
        data        Comparison of the variables' data
        old_data    if the old and new data types are incomparable, this stores
                    old data
        new_data    if the old and new data types are incomparable, this stores
                    new data
    '''
    def __init__(self, name, old, new, dsd):
        self.name = name
        self.dims = compare_timelines('Dimensions', old.dims, new.dims, dsd)
        self.dtype = compare_timelines('Data Type', old.dtype, new.dtype, dsd)
        self.attributes = TimelineDictDiff(
            'Attributes', old.attributes, new.attributes, dsd
        )
        self.companions = VariableDictDiff(
            'Companions', old.companions, new.companions, dsd
        )
        self.data = None
        self.old_data = None
        self.new_data = None
        if not old.metadata_only or not new.metadata_only:
            try:
                self.data = compare_data(old.data, new.data, dsd)
            except ValueError:
                # Create data to display error later
                dsd.has_warnings = True
                if not hasattr(dsd, 'incomparable_summaries'):
                    dsd.incomparable_summaries = []
                dsd.incomparable_summaries.append((
                    name,
                    old.data.data_type.type_name,
                    new.data.data_type.type_name,
                ))
                self.old_data = old.data
                self.old_data.name = 'Old Data'
                self.new_data = new.data
                self.new_data.name = 'New Data'

    @utils.store_difference
    def difference(self):
        first = self.dims.difference()
        if first == 'changed' or not self.data:
            return 'changed'
        if (
            first == self.dtype.difference() and
            first == self.attributes.difference() and
            first == self.companions.difference() and
            first == self.data.difference()
        ):
            return first
        return 'changed'

    def get_bits(self):
        '''Returns how many of each bit are not zero, and then the total number
        of rows for both old and new data
        '''
        if self.data:
            return self.data.get_bits()
        if self.old_data and self.new_data:
            return self.old_data.get_bits(), self.new_data.get_bits()
        return ([], 0), ([], 0)

    def get_nifs(self):
        if self.data:
            return self.data.get_nifs()
        if self.old_data and self.new_data:
            return self.old_data.get_nifs(), self.new_data.get_nifs()
        x = {
            'n': 0,
            'ngood': 0,
            'nmiss': 0,
            'nnan': 0,
            'ninf': 0,
            'nfill': 0,
            'nbig': 0,
            'nsmall': 0,
        }
        return x, x

    def jsonify(self):
        contents = [
            self.dtype.jsonify(),
            self.dims.jsonify(),
            self.attributes.jsonify(),
        ]

        if self.data:
            contents.append(self.data.jsonify())
        elif self.old_data and self.new_data:
            contents += self.old_data.jsonify(), self.new_data.jsonify()

        sec = utils.json_section(self, contents)

        if self.companions:
            sec['contents'].append(self.companions.jsonify())

        sec['type'] = 'variableDiff'
        if isinstance(self.dims, TimelineDiff):
            dims = (
                set(map(lambda d: d.new, self.dims)) |
                set(map(lambda d: d.old, self.dims))
            )
        else:
            dims = set(map(lambda d: d.val, self.dims))
        sec['dims'] = dims.pop() if len(dims) == 1 else 'varying'
        return sec


# Dicts -----------------------------------------------------------------------

class NCDictDiff(dict):
    '''Extention of the dictionary story nc objects, either attributes or
    variable summaries.
    '''
    def __init__(self, name, old, new, dsd, constructor):
        super().__init__()
        self.name = name
        self.dsd = dsd
        for name in set(old.keys()) | set(new.keys()):
            if name in old and name in new:
                self[name] = constructor(name, old[name], new[name], dsd)
            elif name in old:
                self[name] = old[name]
                setattr(self[name], '_difference', 'removed')
            elif name in new:
                self[name] = new[name]
                setattr(self[name], '_difference', 'added')

    @utils.store_difference
    def difference(self):
        if not self:
            return 'same'
        first = self.get_difference(next(iter(self.values())))
        if all(self.get_difference(d) == first for d in self.values()):
            return first
        return 'changed'

    @classmethod
    def get_difference(cls, x):
        if hasattr(x, 'difference'):
            return x.difference()
        if hasattr(x, '_difference'):
            return x._difference
        return 'same'

    def jsonify(self):
        n_diffs = {
            'same': 0,
            'changed': 0,
            'added': 0,
            'removed': 0,
        }
        for val in self.values():
            diff = self.get_difference(val)
            n_diffs[diff] += 1
        sec = utils.json_section(self, [t.jsonify() for t in self.values()])
        sec['type'] = 'groupDiff'
        sec['n_diffs'] = n_diffs
        return sec


class TimelineDictDiff(NCDictDiff):
    def __init__(self, name, old, new, dsd):
        super().__init__(name, old, new, dsd, compare_timelines)


class VariableDictDiff(NCDictDiff):
    def __init__(self, name, old, new, dsd):
        super().__init__(name, old, new, dsd, VariableDiff)


class BargraphDictDiff(dict):
    '''Handles the entire Dimensions dropdown
    '''
    def __init__(self, name, old, new, dsd):
        self.name = name
        for name in set(old.keys()) | set(new.keys()):
            self[name] = BargraphDiff(name, old, new, dsd)

    def jsonify(self):
        n_diffs = {
            'same': 0,
            'changed': 0,
            'added': 0,
            'removed': 0,
        }
        sec = {
            'type': 'groupDiff',
            'name': self.name,
            'contents': [self[name].jsonify() for name in self]
        }
        for name in self:
            status = self[name].difference()
            n_diffs[status] += 1
        sec['n_diffs'] = n_diffs
        if (
            n_diffs['changed'] == 0 and
            n_diffs['added'] == 0 and
            n_diffs['removed'] == 0
        ):
            sec['difference'] = 'same'
        else:
            sec['difference'] = 'changed'
        return sec


# Datastream ------------------------------------------------------------------

def difference(old, new):
    '''Compare two file timelines and return their difference. This is
    separated out into a function purely to keep DatastreamDiff's jsonify()
    looking tidy.
    '''
    if old and not new:
        return 'removed'
    if new and not old:
        return 'added'
    if all(a == b for a, b in zip(old, new)):
        return 'same'
    return 'changed'


class DatastreamDiff:
    def __init__(self, old, new):
        self.sample_interval = old.sample_interval
        if old.sample_interval != new.sample_interval:
            raise ValueError(cf.setError(
                'Old and new datastreams must share the same sample interval'
            ))
        self.has_warnings = False
        self.old_path = old.path
        self.new_path = new.path
        self.old_ds_name = old.ds_name
        self.new_ds_name = new.ds_name
        self.summary_times = sorted(
            set(old.summary_times) | set(new.summary_times)
        )
        self.old_file_times = old.file_timeline
        self.new_file_times = new.file_timeline
        self.attributes = TimelineDictDiff(
            'Attributes', old.attributes, new.attributes, self
        )
        self.dimensions = BargraphDictDiff(
            'Dimensions', old.dimensions, new.dimensions, self
        )
        self.variables = VariableDictDiff(
            'Variables', old.variables, new.variables, self
        )
        self.use_dq_inspector = old.use_dq_inspector and new.use_dq_inspector
        if self.has_warnings:
            if hasattr(self, 'incomparable_summaries'):
                # TODO: Use logging
                sys.stderr.write(
                    cf.setWarning((
                        "\n%d variable summaries are of different type and " +
                        "cannot be compared:\n"
                    ) % len(getattr(self, 'incomparable_summaries')))
                )
                sys.stderr.write(
                    cf.setWarning("\n".join([(
                        '%s - Old: %s, New: %s'
                    ) % x for x in getattr(self, 'incomparable_summaries')]))
                )
                sys.stderr.write("\n")
                sys.stderr.flush()

    def summarize(self):
        # TODO: Clean up this mess
        DNE = '---'
        dimension_changes = {}
        for key in self.dimensions.keys():
            changes = [
                (
                    'Old Begin',
                    'Old End',
                    'Old Val',
                    'New Begin',
                    'New End',
                    'New Val'
                )
            ]
            begin_times = {}
            end_times = {}
            if (
                self.dimensions[key].is_static() or
                not self.dimensions[key].old_data or
                not self.dimensions[key].new_data
            ):
                continue

            for old_b in self.dimensions[key].old_data:
                vals = [old_b.beg, old_b.end, old_b.val, DNE, DNE, DNE]
                begin_times[old_b.beg] = vals
                end_times[old_b.end] = vals

            for new_b in self.dimensions[key].new_data:
                if new_b.beg in begin_times:
                    begin_times[new_b.beg][3] = new_b.beg
                    begin_times[new_b.beg][4] = new_b.end
                    begin_times[new_b.beg][5] = new_b.val
                elif new_b.end in end_times:
                    end_times[new_b.end][3] = new_b.beg
                    end_times[new_b.end][4] = new_b.end
                    end_times[new_b.end][5] = new_b.val
                else:
                    vals = [DNE, DNE, DNE, new_b.beg, new_b.end, new_b.val]
                    begin_times[new_b.beg] = vals
                    end_times[new_b.end] = vals

            begin_values = sorted(
                list(begin_times.values()),
                key=lambda row: row[0] if row[0] != DNE else row[3]
            )
            end_values = sorted(
                list(end_times.values()),
                key=lambda row: row[0] if row[0] != DNE else row[3]
            )

            begin_values = tuple([tuple(b) for b in begin_values])
            end_values = tuple([tuple(e) for e in end_values])

            begin_values = tuple([
                row for row in begin_values
                if row[0:3] != row[3:]
            ])
            end_values = tuple([
                row for row in end_values
                if row[0:3] != row[3:]
            ])

            values = set([])
            for b in begin_values:
                values.add(b)
            for e in end_values:
                values.add(e)

            # Sort by start time
            values = sorted(
                values,
                key=lambda row: row[0] if row[0] != DNE else row[3]
            )

            for row in values:
                changes.append(row)

            dimension_changes[key] = changes

        data = {}
        old_nifs = {
            'n': 0,
            # 'ngood': 0,
            'nmiss': 0,
            'nnan': 0,
            'ninf': 0,
            'nfill': 0,
            'nbig': 0,
            'nsmall': 0,
        }

        new_nifs = {
            'n': 0,
            # 'ngood': 0,
            'nmiss': 0,
            'nnan': 0,
            'ninf': 0,
            'nfill': 0,
            'nbig': 0,
            'nsmall': 0,
        }

        qc_data = {}
        max_old_bits = 0
        max_new_bits = 0

        for key, value in self.variables.items():
            if type(value) is VariableDiff:
                if key[0:3] == 'qc_':
                    (
                        (old_bits, old_total),
                        (new_bits, new_total),
                    ) = value.get_bits()
                    old_p = []
                    new_p = []

                    if old_total > 0:
                        old_p = [str(100*x/old_total)[0:5] for x in old_bits]
                        old_p.append(-old_total)
                    if new_total > 0:
                        new_p = [str(100*x/new_total)[0:5] for x in new_bits]
                        new_p.append(-new_total)

                    qc_data[value.name] = (old_p, new_p)
                    max_old_bits = max(max_old_bits, len(old_bits))
                    max_new_bits = max(max_new_bits, len(new_bits))

                else:
                    # nifs
                    # sum them all up
                    # old and new data
                    temp_old_nifs, temp_new_nifs = value.get_nifs()
                    old_nifs = {
                        k: v + temp_old_nifs[k] for k, v in old_nifs.items()
                    }
                    new_nifs = {
                        k: v + temp_new_nifs[k] for k, v in new_nifs.items()
                    }

                    old_percentage = str(
                        temp_old_nifs['nmiss'] / temp_old_nifs['n'] * 100
                    )[0:5] if temp_old_nifs['n'] != 0 else '--'
                    new_percentage = str(
                        temp_new_nifs['nmiss'] / temp_new_nifs['n'] * 100
                    )[0:5] if temp_new_nifs['n'] != 0 else '--'

                    if old_percentage == '0.000':
                        old_percentage = '<.000'
                    if new_percentage == '0.000':
                        new_percentage = '<.000'

                    data[value.name] = (
                        temp_old_nifs['n'],
                        temp_old_nifs['nmiss'], old_percentage,
                        temp_old_nifs['nnan'],
                        temp_old_nifs['ninf'],
                        temp_old_nifs['nfill'],
                        temp_old_nifs['nbig'],
                        temp_old_nifs['nsmall'], '',
                        temp_new_nifs['n'],
                        temp_new_nifs['nmiss'], new_percentage,
                        temp_new_nifs['nnan'],
                        temp_new_nifs['ninf'],
                        temp_new_nifs['nfill'],
                        temp_new_nifs['nbig'],
                        temp_new_nifs['nsmall'],
                    )

            elif type(value) is Variable:
                if key[0:3] == 'qc_':
                    bits, total = value.get_bits()
                    p = []
                    if total != 0:
                        p = [str(x*100/total)[0:5] for x in bits]
                        p.append(-total)
                    if value._difference == 'added':
                        qc_data[value.name] = ([], p)
                        max_new_bits = max(max_new_bits, len(p)-1)
                    elif value._difference == 'removed':
                        qc_data[value.name] = (p, [])
                        max_old_bits = max(max_old_bits, len(p)-1)
                else:
                    # nifs
                    # sum them up
                    temp_nifs = value.get_nifs()
                    percentage = str(
                        temp_nifs['nmiss'] / temp_nifs['n'] * 100
                    )[0:5] if temp_nifs['n'] != 0 else '--'
                    if percentage == '0.000':
                        percentage = '<.000'
                    if value._difference == 'removed':
                        # old data only
                        old_nifs = {
                            k: v + temp_nifs[k] for k, v in old_nifs.items()
                        }
                        data[value.name] = [
                            temp_nifs['n'],
                            temp_nifs['nmiss'], percentage,
                            temp_nifs['nnan'],
                            temp_nifs['ninf'],
                            temp_nifs['nfill'],
                            temp_nifs['nbig'],
                            temp_nifs['nsmall'],
                            '--', '--', '--', '--', '--', '--', '--', '--'
                        ]
                    elif value._difference == 'added':
                        # new data only
                        new_nifs = {
                            k: v + temp_nifs[k] for k, v in new_nifs.items()
                        }

                        data[value.name] = [
                            '--', '--', '--', '--', '--', '--', '--', '--',
                            temp_nifs['n'],
                            temp_nifs['nmiss'], percentage,
                            temp_nifs['nnan'],
                            temp_nifs['ninf'],
                            temp_nifs['nfill'],
                            temp_nifs['nbig'],
                            temp_nifs['nsmall'],
                        ]
        if data:
            data['Header'] = (
                'Variable', 'n', 'miss', '% miss', 'nans', 'infs', 'fill',
                '+limit', '-limit', 'n', 'miss', '% miss', 'nans', 'infs',
                'fill', '+limit', '-limit'
            )
            old_percentage = str(
                old_nifs['nmiss'] / old_nifs['n'] * 100
            )[0:5] if old_nifs['n'] != 0 else '--'
            new_percentage = str(
                new_nifs['nmiss'] / new_nifs['n'] * 100
            )[0:5] if new_nifs['n'] != 0 else '--'

            if old_percentage == '0.000':
                old_percentage = '<.000'
            if new_percentage == '0.000':
                new_percentage = '<.000'

            data['Total'] = (
                old_nifs['n'],
                old_nifs['nmiss'], old_percentage,
                old_nifs['nnan'],
                old_nifs['ninf'],
                old_nifs['nfill'],
                old_nifs['nbig'],
                old_nifs['nsmall'],
                # '',
                new_nifs['n'],
                new_nifs['nmiss'], new_percentage,
                new_nifs['nnan'],
                new_nifs['ninf'],
                new_nifs['nfill'],
                new_nifs['nbig'],
                new_nifs['nsmall'],
            )

        if qc_data:
            qc_data['Bits'] = (max_old_bits, max_new_bits)
        return {
            'type': 'summaryDiff',
            'dimension_changes': dimension_changes,
            'data': data,
            'qc_data': qc_data,
        }

    def jsonify(self):
        return {
            'type': 'datastreamDiff',
            'old_path': self.old_path,
            'new_path': self.new_path,
            'old_ds_name': self.old_ds_name,
            'new_ds_name': self.new_ds_name,
            'sample_interval': self.sample_interval,
            'summary_times': self.summary_times,
            'command': " ".join(sys.argv),
            'version': __version__,
            'review_date': int(time.time()),
            'contents': [
                {
                    'type': 'section',
                    'name': 'File Timeline',
                    'difference': difference(
                        self.old_file_times,
                        self.new_file_times
                    ),
                    'contents': [
                        {
                            'type': 'fileTimelineDiff',
                            'old_data': [['beg', 'end']]+self.old_file_times,
                            'new_data': [['beg', 'end']]+self.new_file_times,
                        }
                    ]
                },
                self.attributes.jsonify(),
                self.dimensions.jsonify(),
                self.variables.jsonify(),
                self.summarize()
            ]
        }

    def json(self):
        j = self.jsonify()
        return json.dumps(j, default=utils.JEncoder)
