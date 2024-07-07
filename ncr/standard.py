import re
from numpy import ndarray
from typing import Tuple


class ExStateVar:
    ''' Static class containing methods for identifying and parsing an
    exclusive state var based on its attributes.
    '''

    flag_desc_re = re.compile(r'^flag_(\d+)_description$')

    @classmethod
    def has_attrs(cls, varattrs: dict) -> bool:
        return 'flag_values' in varattrs or any(
            cls.flag_desc_re.match(a)
            for a in varattrs.keys()
        )

    @classmethod
    def parse(cls, varattrs: dict) -> Tuple[list, list]:
        flag_vals = []
        flag_desc = []
        if 'flag_values' in varattrs:
            try:
                flag_vals = varattrs['flag_values']
                if not (isinstance(flag_vals, ndarray) or isinstance(flag_vals, list)):
                    flag_vals = f"{flag_vals}"
                    flag_vals = list(
                        map(lambda v: int(v), re.split(r'[\s,]+', flag_vals))
                    )
            except (ValueError, TypeError, AttributeError):
                print(f"flag_values has an unexpected value: {varattrs['flag_values']} (of type {type(varattrs['flag_values'])}). Requires further development.")
                flag_vals = []
        if not any(flag_vals):
            n_flags = 0
            for name, value in varattrs.items():
                match = cls.flag_desc_re.match(name)
                if not match:
                    continue
                n_flags = max(n_flags, int(match.group(1)))
                # Attempt a non-standard way to get the value and description
                # embedded in the description:
                # e.g. "-3 = missing data"
                match = re.match(r'^([\-\d]+)\s*=\s*(.+)$', value.strip())
                if not match:
                    continue
                flag_vals.append(int(match.group(1)))
                flag_desc.append(str(match.group(2)).strip())
            if n_flags > 0 and not any(flag_vals):
                flag_vals = range(1, n_flags+1)
        if not any(flag_desc):
            flag_desc = [''] * len(flag_vals)
            for n in range(len(flag_vals)):
                # Allow for gaps in numbers...
                flag = flag_vals[n]
                desc = 'flag_%s_description' % str(flag)
                if desc in varattrs:
                    flag_desc[n] = varattrs[desc]
                elif 'flag_meanings' in varattrs:
                    try:
                        flag_desc[n] = re.split(
                            r'[\s,]+',
                            str(varattrs['flag_meanings']).strip(),
                        )[n]
                    except IndexError:
                        pass
        return (flag_vals, flag_desc)


class InStateVar:
    ''' Static class containing methods for identifying and parsing an
    inclusive state var based on its attributes.
    '''

    bit_desc_re = re.compile(r'^bit_(\d+)_description$')

    @classmethod
    def has_attrs(cls, varattrs: dict) -> bool:
        return 'flag_values' in varattrs or any(
            cls.bit_desc_re.match(a)
            for a in varattrs.keys()
        )

    @classmethod
    def parse(cls, varattrs: dict) -> Tuple[list, list]:
        flag_masks = []
        if 'flag_masks' in varattrs:
            try:
                flag_masks = list(varattrs['flag_masks'])
            except TypeError:
                flag_masks = [varattrs['flag_masks']]
        if not any(flag_masks):
            n_flags = 0
            for a, _ in varattrs.items():
                match = cls.bit_desc_re.match(a)
                if not match:
                    continue
                n_flags = max(n_flags, int(match.group(1)))
            flag_masks = [2**x for x in range(n_flags)]
        flag_desc = [''] * len(flag_masks)
        for n in range(len(flag_masks)):
            bit_desc = f'bit_{str(n+1)}_description'
            if bit_desc in varattrs:
                flag_desc[n] = varattrs[bit_desc]
            elif 'flag_meanings' in varattrs:
                try:
                    flag_desc[n] = re.split(
                        r'[\s,]+',
                        str(varattrs['flag_meanings']).strip(),
                    )[n]
                except IndexError:
                    pass
        return (flag_masks, flag_desc)


class QCVar:
    ''' Static class containing methods for identifying and parsing a QC var
    based on its attributes and name.
    '''
    qc_bit_desc_re = re.compile(r'qc_bit_(\d+)_description')

    @classmethod
    def is_match(cls, varname: str, varattrs: dict, ncattrs: dict) -> bool:
        return varname.startswith('qc_') and (
            InStateVar.has_attrs(varattrs) or
            any(cls.qc_bit_desc_re.match(a) for a in varattrs.keys()) or
            any(cls.qc_bit_desc_re.match(a) for a in ncattrs.keys())
        )

    @classmethod
    def parse(cls, varattrs: dict, ncattrs: dict) -> Tuple[list, list]:
        (flag_masks, flag_descs) = InStateVar.parse(varattrs)
        if not any(flag_masks) or not any(flag_descs):
            (flag_masks, flag_descs) = cls.fromattrs(varattrs)
            if not any(flag_masks) or not any(flag_descs):
                (flag_masks, flag_descs) = cls.fromattrs(ncattrs)
        return (flag_masks, flag_descs)

    @classmethod
    def fromattrs(cls, attrs: dict) -> Tuple[list, list]:
        n_flags = 0
        for name in attrs.keys():
            match = cls.qc_bit_desc_re.match(name)
            if not match:
                continue
            n_flags = max(n_flags, int(match.group(1)))
        flag_masks = [2**x for x in range(n_flags)]
        flag_descs = ['']*len(flag_masks)
        for n in range(len(flag_masks)):
            bit_desc = f'qc_bit_{str(n+1)}_description'
            if bit_desc in attrs:
                flag_descs[n] = attrs[bit_desc]
        return (flag_masks, flag_descs)
