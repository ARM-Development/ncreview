import { LoadStatus } from 'models/MiscTypes';
import {
    getDatastreamName,
    epochToUTC,
    toNumber,
    isEmpty,
    sortCaseInsensitive,
    sortTimespanData,
} from 'utils';
import {
    noData,
    nonDiff, same, changed, removed, added,
    getSamplingInterval,
    setSamplingInterval
} from 'resources/constants';


export type AppType = 'datastream' | 'datastreamDiff' | '';
export type DiffType = typeof nonDiff | typeof same | typeof changed | typeof removed | typeof added;

export type NCReviewType = 'section'|'groupDiff'|
                           'datastream'|'datastreamDiff'|
                           'fileTimeline'|'fileTimelineDiff'|
                           'variable'|'variableDiff'|
                           'timeline'|'timelineDiff'|
                           'plot'|'plotDiff'|
                           'bargraph'|'bargraphDiff'|
                           'staticValue'|'staticValueDiff'|
                           'summary'|'summaryDiff'|
                           'staticSummary'|'staticSummaryDiff';

export type NCReviewComponent = ISection|IGroupDiff|
                                IFileTimeline|IFileTimelineDiff|
                                IVariable|IVariableDiff|
                                ITimeline|ITimelineDiff|
                                IPlot|IPlotDiff|
                                IBargraph|IBargraphDiff|
                                IStaticSummary|IStaticSummaryDiff|
                                IStaticValue|IStaticValueDiff|
                                ISummary|ISummaryDiff;

export type NCReviewData = FileTimelineData | TimelineData | PlotData | BargraphData | BargraphDataAnnotated;

type Time = number;


/*     NCReviewComponent Types     */
/**
 * How ncreview provides its diff info in ncreview.json:
 * - For 'datastream' (nonDiff), "difference" attributes are never set.
 * - For 'datastreamDiff',
 *   - diff of a parent section depends on child diffs
 *   - if parent element ('section', 'groupDiff', 'variable', etc) difference == "added"|"removed",
 *     - nonDiff version of elements are used ('variable', 'plot', 'bargraph', etc)
 *     - difference is never set on child elements
 *   - if parent element difference == "same"|"changed",
 *     - diff version of elements are used ('variableDiff', 'plotDiff', 'bargraphDiff', etc)
 *     - difference is always set on child elements
 *       ! except the graph element itself ('plotDiff', 'bargraphDiff', 'timelineDiff')
 * --> must propagate the difference value through here, manually, so it is always clearly determined and available
 *     ! but don't overwrite it where it is already defined for an element
 *     - This is needed because I decided to associate colors with datastream, or with diff vs nonDiff,
 *         and especially therefore when difference == "added".
 */

export function newContentOfType(content, parentDiff: DiffType = nonDiff)
{
    const contentType = content.type;

    if (content.difference === undefined) {
        content.difference = parentDiff || nonDiff;
    }

    switch (contentType) {
        case 'section':
            return newSection(content);
        case 'groupDiff':
            return newGroupDiff(content);
        case 'fileTimeline':
            return newFileTimeline(content);
        case 'fileTimelineDiff':
            return newFileTimelineDiff(content);
        case 'variable':
            return newVariable(content);
        case 'variableDiff':
            return newVariableDiff(content);
        case 'timeline':
            return newTimeline(content);
        case 'timelineDiff':
            return newTimelineDiff(content);
        case 'plot':
            return newPlot(content);
        case 'plotDiff':
            return newPlotDiff(content);
        case 'bargraph':
            return newBargraph(content);
        case 'bargraphDiff':
            return newBargraphDiff(content);
        case 'staticValue':
            return newStaticValue(content);
        case 'staticValueDiff':
            return newStaticValueDiff(content);
        case 'summary':
            return newSummary(content);
        case 'summaryDiff':
            return newSummaryDiff(content);
        case 'staticSummary':
            return newStaticSummary(content);
        case 'staticSummaryDiff':
            return newStaticSummaryDiff(content);
        default:
            throw new Error(`Unexpected ncreview section: ${content}`);
        }
}



export interface ISection {
    "type": NCReviewType,
    "name": string,
    "difference": DiffType,
    "contents": NCReviewComponent[],
}

function newSection(data): ISection
{
    data.contents.sort(function(a, b) {
        let re = /[_.]?(\d+)[_.]?/
        if (a.name !== undefined && b.name !== undefined) {
            const a_name = a.name.toLowerCase();
            const b_name = b.name.toLowerCase();
            const a_has_num = re.exec(a_name);
            const b_has_num = re.exec(b_name);
            if (a_has_num && b_has_num && a_name.split(a_has_num[1])[0] === b_name.split(b_has_num[1])[0]) {
                const a_number = Number(a_has_num[1]);
                const b_number = Number(b_has_num[1]);
                return a_number - b_number;
            }
            else {
                return ( a_name > b_name ? 1 : a_name < b_name ? -1 : 0 );
            }
        }
        else {
            return 0;
        }
    });

    const contents: NCReviewComponent[] = data.contents.map( content  => newContentOfType(content, data.difference) );

    const section = {
        "type": data.type,
        "name": data.name,
        "difference": data.difference,
        "contents": contents,
    };

    return section;
}

export interface IGroupDiff extends ISection {
    "nDiffs": {
        "same":    number,
        "changed":  number,
        "removed": number,
        "added":   number,
    },
}

function newGroupDiff(data): IGroupDiff
{
    const groupDiff = newSection(data) as IGroupDiff;

    groupDiff.nDiffs = data.n_diffs;

    return groupDiff;
}



interface DataIds {
    "A": number,
    "B"?: number,
}

interface SimpleDataElement {
    "type": NCReviewType,
    "ids": DataIds,
    "difference": DiffType,
}

function newSimpleDataElement(data): SimpleDataElement
{
    if (data.old_data && data.new_data) {
        return {
            "type": data.type,
            "ids": {
                "A": Number(data.old_data),
                "B": Number(data.new_data),
            },
            "difference": data.difference,
        };
    }
    else if (data.type) {
        return {
            "type": data.type,
            "ids": {
                "A": Number(data.data),
            },
            "difference": data.difference,
        };
    }
    else {
        throw new Error(`Unexpected data detail format: ${data}`);
    }
}

export interface IFileTimeline extends SimpleDataElement {}

function newFileTimeline(data): IFileTimeline
{
    return newSimpleDataElement(data) as IFileTimeline;
}

export interface IFileTimelineDiff extends IFileTimeline {}

function newFileTimelineDiff(data): IFileTimelineDiff
{
    return newFileTimeline(data) as IFileTimelineDiff;
}

export interface IVariable {
    "type": NCReviewType,
    "name": string,
    "difference": DiffType,
    "dims": string[]|string,
    "contents": NCReviewComponent[],
}

function newVariable(data): IVariable
{
    const contents: NCReviewComponent[] = data.contents.map( content  => newContentOfType(content, data.difference) );

    return {
        "type": data.type,
        "name": data.name,
        "difference": data.difference,
        "dims": ( Array.isArray(data.dims) ? data.dims.map( value => value ) : data.dims.toString() ),
        "contents": contents,
    };
}

export interface IVariableDiff extends IVariable {}

function newVariableDiff(data): IVariableDiff
{
    return newVariable(data) as IVariableDiff;
}

export interface ITimeline extends SimpleDataElement {}

function newTimeline(data): ITimeline
{
    return newSimpleDataElement(data) as ITimeline;
}

export interface ITimelineDiff extends ITimeline {}

function newTimelineDiff(data): ITimelineDiff
{
    return newSimpleDataElement(data) as ITimelineDiff;
}

export interface IPlot extends SimpleDataElement {
    "path": string,
    "varName"?: string,
}

function newPlot(data): IPlot
{
    const plot = newSimpleDataElement(data) as IPlot;
    plot.path = data.ds_path;
    plot.varName = data.var_name || undefined;

    return plot;
}

// Class definitions in ./ncr/datastream.py
// timeseries: variable data dimensioned by time, avg'd per -t interval -> regular plotDiff timeseries summaries
// numericScalar: single numeric value per file, varying by file -> timeseries of single values, e.g. nimfraod_vs_arch_20sav.2
// numericSeries: variable dim'd by something other than time -> regular plotDiff timeseries summaries
// dimless: ?any different than numericScalar? I don't see a usage. Old name?
// stateExclusive, stateInclusive: analyses of state variables
// stateInclusiveQC: analyses of QC variables
export interface IPlotDiff extends SimpleDataElement {
    "dataType": ('timeseries'|'numericScalar'|'numericSeries'|'dimless'|'stateExclusive'|'stateInclusive'|'stateInclusiveQC'),
    "paths"?: {
        "A": string,
        "B": string,
    },
    "varName"?: string,
}

function newPlotDiff(data): IPlotDiff
{
    const plot = newSimpleDataElement(data) as IPlotDiff;
    plot.dataType = data.data_type || 'timeseries';
    if (plot.dataType === 'timeseries') {
        plot.paths = {
            "A": data.old_ds_path,
            "B": data.new_ds_path,
        };
        plot.varName = data.var_name || undefined;
    }

    return plot;
}

export interface IBargraph {
    "type": NCReviewType,
    "data": (string|string[]|number[])[],
    "difference": DiffType,
}

function newBargraph(data): IBargraph
{
    return {
        "type": data.type,
        "data": data.logs,
        "difference": data.difference,
    };
}

export interface IBargraphDiff extends SimpleDataElement {}

function newBargraphDiff(data): IBargraphDiff
{
    return newSimpleDataElement(data) as IBargraphDiff;
}

export interface IStaticValue {
    "type": NCReviewType,
    "name": string,
    "value": string,
    "difference": DiffType,
}

function newStaticValue(data)
{
    const value = (data.val instanceof Array
        ? data.val.join(', ')
        : String(data.val)
    );
    return {
        "type": data.type,
        "name": data.name,
        "value": value,
        "difference": data.difference,
    };
}

export interface IStaticValueDiff {
    "type": NCReviewType,
    "name": string,
    "A": string,
    "B": string,
    "difference": DiffType,
}

function newStaticValueDiff(data)
{
    const valueA = (data.old instanceof Array
        ? data.old.join(', ')
        : String(data.old)
    );
    const valueB = (data.new instanceof Array
        ? data.new.join(', ')
        : String(data.new)
    );
    return {
        "type": data.type,
        "name": data.name,
        "A": valueA,
        "B": valueB,
        "difference": data.difference,
    };
}

export interface IStaticSummary {
    "type": NCReviewType,
    "name": string,
    "header": string[],
    "tooltips": string[],
    "values": (number|string|null)[],
    "difference": DiffType,
}

function newStaticSummary(data): IStaticSummary
{
    const values = data.val.map( value => value );

    return {
        "type": data.type,
        "name": data.name,
        "header": data.columns,
        "tooltips": data.tooltips,
        "values": values,
        "difference": data.difference,
    };
}

export interface IStaticSummaryDiff {
    "type": NCReviewType,
    "name": string,
    "header": string[],
    "tooltips": string[],
    "A": (number|string|null)[],
    "B": (number|string|null)[],
    "difference": DiffType,
    "dataType"?: string,
}

function newStaticSummaryDiff(data)
{
    const dataA = data.old.map( value => value );
    const dataB = data.new.map( value => value );

    const staticSummaryDiff = {
        "type": data.type,
        "name": data.name,
        "header": data.columns,
        "tooltips": data.tooltips,
        "A": dataA,
        "B": dataB,
        "difference": data.difference,
        "dataType": data.data_type || undefined,
    };

    return staticSummaryDiff;
}



const TOOLTIPS_VARDATA = {
    'Variable': "Name of variable",
    'n': "Number of values",
    'miss': "Number of missing values",
    '% miss': "Percentage of missing values",
    'nans': "Total NOT A NUMBER values",
    'infs': "Total INFINITY values",
    'fill': "Total FILL values",
    '+limit': "Number of values > 10^10",
    '-limit': "Number of values < -10^10 (if measured in degC, values < -273)"
};

interface IVarSummary {
    "name": string,
    "values": (number|null)[],
}

function newVarSummary(varName, data): IVarSummary
{
    const values: (number|null)[] = [];
    data.forEach((value, idx) => {
        let v = ( value.startsWith && value.startsWith('--') ? null : toNumber(value) );
        if (idx === 2 && v !== null) v = v/100;
        values.push(v);
    });

    return {
        "name": varName,
        "values": values,
    };
}

interface IVarDataSummary {
    "header": string[],
    "tooltips": {},
    "data": IVarSummary[],
    "totals": IVarSummary,
}

function newVarDataSummary(data): IVarDataSummary
{
    const tooltips = TOOLTIPS_VARDATA;

    const sortedKeys = Object.keys(data);
    sortedKeys.splice(sortedKeys.indexOf('Header'), 1);
    sortedKeys.splice(sortedKeys.indexOf('Total'), 1);
    sortedKeys.sort(sortCaseInsensitive);

    const varDataSummaries: IVarSummary[] = [];
    sortedKeys.forEach((varName) => {
        varDataSummaries.push(newVarSummary(varName, data[varName]));
    });

    return {
        "header": data.Header,
        "tooltips": tooltips,
        "data": varDataSummaries,
        "totals": newVarSummary("Total", data.Total),
    };
}

interface IBitSummary {
    "name": string,
    "values": (number|null)[],
}

function newBitSummary(qcVarName, data, bits): IBitSummary
{
    const values: (number|null)[] = [];
    const n = data.length-1;
    data.forEach((value, idx) => {
        if (idx === n && idx < bits) {
            // Not all QC variables have same number of bits defined; align last column for all rows
            for (let i=idx; i < bits; i++) {
                values.push(null);
            }
        }
        if ( value === undefined || (value.startsWith && value.startsWith('--')) || value < 0 ) {
            values.push(null);
        }
        else {
            values.push(Number(value)/100);
        }
    });
    // Last value is for col "n", number of data points.
    // It was set to a negative value to set it apart from the other data.
    values[bits] = toNumber(data[n]) * -1;

    return {
        "name": qcVarName,
        "values": values,
    };
}

interface IQCDataSummary {
    "header": string[],
    "tooltips": {},
    "data": IBitSummary[],
    "bits": number,
}

function newQCDataSummary(data): IQCDataSummary
{
    const bits = Number(data.Bits);

    let header = new Array<string>();
    let tooltips = {};
    header.push("Variable");
    tooltips['Variable'] = "Name of variable";
    for (var i = 1; i <= bits; i++) {
        const label = `Bit ${i}`;
        header.push(label);
        tooltips[label] = `2^(${i}-1) = ${String(Math.pow(2,i-1))}`;
    }
    header.push("n");
    tooltips['n'] = "Total number of data points for each variable";

    const sortedKeys = Object.keys(data);
    sortedKeys.splice(sortedKeys.indexOf('Bits'), 1);
    sortedKeys.sort(sortCaseInsensitive);

    const qcDataSummaries: IBitSummary[] = [];
    sortedKeys.forEach((qcVarName) => {
        qcDataSummaries.push(newBitSummary(qcVarName, data[qcVarName], bits));
    });

    return {
        "header": header,
        "tooltips": tooltips,
        "data": qcDataSummaries,
        "bits": bits,
    };
}

export interface ISummary {
    "type": NCReviewType,
    "name"?: string,
    "varDataSummary": IVarDataSummary,
    "qcDataSummary"?: IQCDataSummary,
}

function newSummary(data): ISummary
{
    const varDataSummary = newVarDataSummary(data.data);
    let qcDataSummary: (IQCDataSummary|null) = null;
    if (data.qc_data && !isEmpty(data.qc_data))
        qcDataSummary = newQCDataSummary(data.qc_data);

    const summary = {
        "type": data['type'],
        "name": 'PrimarySummary',
        "varDataSummary": varDataSummary,
        "qcDataSummary": qcDataSummary || undefined,
    };

    return summary;
}



interface ITimeDiff {
    "date": string,
    "values": Time[],
}

function newTimeDiff(data): ITimeDiff
{
    const dateLabel = String(epochToUTC(data[0])).substring(4, 15);
    const values = data.slice(1).map( value => Number(value) );

    return {
        "date": dateLabel,
        "values": values,
    };
}

interface ITimeDiffsSummary {
    "header": string[],
    "data": ITimeDiff[],
    "totals": IVarSummary,
}

function newTimeDiffsSummary(data): ITimeDiffsSummary
{
    const header = ['Date', 'A', 'B', 'Diff'];

    const totalsKey = Object.keys(data).filter(key => data[key][0] === 'Total')[0];
    const totals = newVarSummary(data[totalsKey][0], data[totalsKey].slice(1));

    const dataKeys = Object.keys(data);
    dataKeys.splice(dataKeys.indexOf(totalsKey), 1);

    const timeDiffs: ITimeDiff[] = [];
    dataKeys.forEach((key) => {
        timeDiffs.push(newTimeDiff(data[key]));
    });


    return {
        "header": header,
        "data": timeDiffs,
        "totals": totals
    }
}

interface IDimensionDiffSummary {
    "A": (number|null)[],
    "B": (number|null)[],
}

function newDimensionDiffSummary(data): IDimensionDiffSummary
{
    const numDsCols = data.length/2;
    const dataA = data.slice(0,numDsCols).map( value => (
        value.startsWith && value.startsWith('--') ? null : Number(value)
    ));
    const dataB = data.slice(numDsCols).map( value => (
        value.startsWith && value.startsWith('--') ? null : Number(value)
    ));

    return {
        "A": dataA,
        "B": dataB,
    };
}

interface IDimensionChangeSummary {
    "name": string,
    "header": string[],
    "data": IDimensionDiffSummary[],
}

function newDimensionChangeSummary(dimName, data): IDimensionChangeSummary
{
    const header = data[0].map((value) =>
        value.replace('Old', '')
             .replace('New', '')
             .replace('Begin', 'Start')
             .replace('Val', 'Value')
    );

    const dimensionDiffSummaries: IDimensionDiffSummary[] = [];
    data.slice(1).forEach((dimensionDiff) => {
        dimensionDiffSummaries.push(newDimensionDiffSummary(dimensionDiff));
    });

    return {
        "name": dimName,
        "header": header,
        "data": dimensionDiffSummaries,
    };
}

interface IVarDiffSummary {
    "name": string,
    "A": (number|null)[],
    "B": (number|null)[],
}

function newVarDiffSummary(varName, data, startB): IVarDiffSummary
{
    const dataA = data.slice(0,startB).map( value => 
        ( value.startsWith && value.startsWith('--') ? null : toNumber(value) ));
    if (dataA[2] !== null) dataA[2] /= 100;

    if (data[startB] === "" && data.length > startB*2) startB++;

    const dataB = data.slice(startB).map( value => 
        ( value.startsWith && value.startsWith('--') ? null : toNumber(value) ));
    if (dataB[2] !== null) dataB[2] /= 100;

    return {
        "name": varName,
        "A": dataA,
        "B": dataB,
    };
}

interface IVarDataDiffSummary {
    "header": string[],
    "tooltips": {},
    "data": IVarDiffSummary[],
    "totals": IVarDiffSummary,
}

function newVarDataDiffSummary(data): IVarDataDiffSummary
{
    const header = data.Header;
    const tooltips = TOOLTIPS_VARDATA;

    const numCols = Object.keys(header).length;
    const numDsCols = (numCols - 1)/2;

    const totals = newVarDiffSummary("Total", data.Total, numDsCols);

    const sortedKeys = Object.keys(data);
    sortedKeys.splice(sortedKeys.indexOf('Header'), 1);
    sortedKeys.splice(sortedKeys.indexOf('Total'), 1);
    sortedKeys.sort(sortCaseInsensitive);

    const varDataSummaries: IVarDiffSummary[] = [];
    sortedKeys.forEach((varName) => {
        varDataSummaries.push(newVarDiffSummary(varName, data[varName], numDsCols));
    });

    return {
        "header": header,
        "tooltips": tooltips,
        "data": varDataSummaries,
        "totals": totals,
    };
}

interface IBitDiffSummary {
    "name": string,
    "A": (number|null)[],
    "B": (number|null)[],
}

function newBitDiffSummary(qcVarName, data, dsBits: number[]): IBitDiffSummary
{
    const bitDiffSummaries = [new Array<(number|null)>(), new Array<(number|null)>()]; // A and B data
    for (let ds = 0; ds < data.length; ds++) {
        const _data = data[ds];
        const bits = dsBits[ds];
        const bitDiffSummary = bitDiffSummaries[ds];
        const n = data[ds].length-1
        if (_data.length === 0) {
            for (let i=0; i < bits+1; i++) bitDiffSummary.push(null);
        }
        else {
            _data.forEach((value, idx) => {
                if (idx === n && idx < bits) {
                    // Not all QC variables have same number of bits defined; align last column for all rows
                    for (let i=idx; i < bits; i++) {
                        bitDiffSummary.push(null);
                    }
                }
                if (value === undefined || (value.startsWith && value.startsWith('--')) || value < 0) {
                    bitDiffSummary.push(null);
                }
                else {
                    bitDiffSummary.push(Number(value)/100);
                }
            });
            // Last value is for col "n", number of data points.
            // It was set to a negative value to set it apart from the other data.
            bitDiffSummary[bits] = toNumber(_data[n]) * -1;
        }
    }

    return {
        "name": qcVarName,
        "A": bitDiffSummaries[0],
        "B": bitDiffSummaries[1],
    };
}

interface IQCDataDiffSummary {
    "header": string[],
    "tooltips": {},
    "data": IBitDiffSummary[],
    "bitsA": number,
    "bitsB": number,
}

function newQCDataDiffSummary(data): IQCDataDiffSummary
{
    const bitsA = Number(data.Bits[0]);
    const bitsB = Number(data.Bits[1]);

    let header = new Array<string>();
    let tooltips = {};
    header.push("Variable");
    tooltips['Variable'] = "Name of variable";
    for (let i = 1; i <= bitsA; i++) {
        const label = `Bit ${i}`;
        header.push(label);
        tooltips[label] = `2^(${i}-1) = ${String(Math.pow(2,i-1))}`;
    }
    header.push("n");
    tooltips['n'] = "Total number of data points for each variable";
    for (let j = 1; j <= bitsB; j++) {
        const label = `Bit ${j}`;
        header.push(label);
        if (!tooltips[label])
            tooltips[label] = `2^(${j}-1) = ${String(Math.pow(2,j-1))}`;
    }
    header.push("n");

    const sortedKeys = Object.keys(data);
    sortedKeys.splice(sortedKeys.indexOf('Bits'), 1);
    sortedKeys.sort(sortCaseInsensitive);

    const qcDataDiffSummaries: IBitDiffSummary[] = [];
    sortedKeys.forEach((qcVarName) => {
        qcDataDiffSummaries.push(newBitDiffSummary(qcVarName, data[qcVarName], [bitsA, bitsB]));
    });

    return {
        "header": header,
        "tooltips": tooltips,
        "data": qcDataDiffSummaries,
        "bitsA": bitsA,
        "bitsB": bitsB,
    };
}

export interface ISummaryDiff {
    "type": NCReviewType,
    "name"?: string,
    "timeDiffsSummary"?: ITimeDiffsSummary,
    "dimensionChangesSummaries"?: IDimensionChangeSummary[],
    "varDataDiffSummary"?: IVarDataDiffSummary,
    "qcDataDiffSummary"?: IQCDataDiffSummary,
}

function newSummaryDiff(data): ISummaryDiff
{
    let timeDiffsSummary: (ITimeDiffsSummary|null) = null;
    if (data.different_times && !isEmpty(data.different_times)) {
        timeDiffsSummary = newTimeDiffsSummary(data.different_times);
    }
    let dimensionChanges: IDimensionChangeSummary[] = [];
    const dimensionChangesList = data.dimension_changes;
    if (dimensionChangesList && !isEmpty(dimensionChangesList)) {
        Object.keys(dimensionChangesList).forEach((dimensionName) => {
            if (dimensionChangesList[dimensionName].length > 1)
                dimensionChanges.push(newDimensionChangeSummary(dimensionName, dimensionChangesList[dimensionName]));
        });
    }
    let varDataDiffSummary: (IVarDataDiffSummary|null) = null;
    if (data.data && !isEmpty(data.data)) {
        varDataDiffSummary = newVarDataDiffSummary(data.data);
    }
    let qcDataDiffSummary: (IQCDataDiffSummary|null) = null;
    if (data.qc_data && !isEmpty(data.qc_data) && data.qc_data.Bits) {
        qcDataDiffSummary = newQCDataDiffSummary(data.qc_data);
    }

    const summaryDiff = {
        "type": data.type,
        "name": 'PrimarySummaryDiff',
    };
    if (timeDiffsSummary)
        summaryDiff["timeDiffsSummary"] = timeDiffsSummary;
    if (dimensionChanges.length)
        summaryDiff["dimensionChangesSummaries"] = dimensionChanges;
    if (varDataDiffSummary)
        summaryDiff["varDataDiffSummary"] = varDataDiffSummary;
    if (qcDataDiffSummary)
        summaryDiff["qcDataDiffSummary"] = qcDataDiffSummary;

    return summaryDiff;
}

export interface IDataDetail {
    "id": number,
    "type": (NCReviewType|undefined),
    "axes": [string,string],
    "data": NCReviewData[],
}

export interface IDataDetails {
    [key: number]: IDataDetail,
}

export interface IDataDetailsStatuses {
    [key: number]: LoadStatus,
}

export function newDataDetail(
    dataId: number,
    dataType?: string,
    detailData?: object[],
    labelY?: string,
    labelX?: string
): IDataDetail
{
    return {
        'id': dataId,
        'type': ( dataType ? dataType as NCReviewType : undefined ),
        'axes': ( dataType ?
            getAxisLabels(dataType, labelY=( labelY || undefined ), labelX=( labelX || undefined )) :
            ["",""] ),
        'data': ( detailData ? newDataOfType(dataType as NCReviewType, detailData) : new Array<NCReviewData>() ),
    };
}

export interface IDataMaster {
    "type":  AppType,
    "paths": { 'A': string, 'B'?: string },
    "names": { 'A': string, 'B'?: string },
    "sample_interval": Time,
    "sample_count": number[],
    "command": string,
    "version": string,
    "review_date": number,
    "contents": NCReviewComponent[],
}

export const newDatastream = (master): IDataMaster =>
{
    const defaultDiff: DiffType = ( master.type === 'datastreamDiff' ? same : nonDiff );
    const contents: NCReviewComponent[] = master.contents.map( content  => newContentOfType(content, defaultDiff) );

    let nameA = 'Datastream A';
    let nameB: string|undefined = undefined;
    if (master.type === 'datastreamDiff') {
        const pathA = master.old_path;
        let name = getDatastreamName(pathA);
        if (name !== '' && pathA.includes('/') && name !== pathA)
            nameA = name;
        nameA += ' (arg 1)';
        
        const pathB = master.new_path;
        name = getDatastreamName(pathB);
        if (name !== '' && pathA.includes('/') && name !== pathB)
            nameB = name;
        else
            nameB = 'Datastream B';
        nameB += ' (arg 2)'
    }
    else {
        const pathA = master.path;
        let name = getDatastreamName(pathA);
        if (name !== '' && pathA.includes('/') && name !== pathA)
            nameA = name;
    }

    setSamplingInterval(Number(master.sample_interval));

    return {
        "type": master.type,
        "paths": ( master.type === 'datastreamDiff'
                   ? { 'A': master.old_path, 'B': master.new_path }
                   : { 'A': master.path }
                 ),
        "names": { 'A': nameA, 'B': nameB },
        "sample_interval": master.sample_interval,
        "sample_count": master.summary_times.length,
        "command": master.command,
        "version": master.version,
        "review_date": master.review_date,
        "contents": contents,
    };
}



/*     NCReviewData Types     */

export function newDataOfType(dataType: NCReviewType, data)
{
    switch (dataType) {
        case 'fileTimeline':
        case 'fileTimelineDiff':
            return newFileTimelineData(data);
        case 'timeline':
        case 'timelineDiff':
            return newTimelineData(data);
        case 'plot':
        case 'plotDiff':
            return newPlotData(data);
        case 'bargraph':
        case 'bargraphDiff':
            return newBargraphData(data);
        default:
            throw new Error(`Unexpected ncreview data type: ${dataType}`);
        }
}


// TODO: Specify something equivalent to pointInterval(Unit?) on the y-axis for FileTimeline (<= x/y-axes are flipped)
//         and remove the extraneous currentDays being tracked and appended? (gapSize not on columnRange)
//         If so, also remove the check for high == 0 in formatTooltip() pointData.forEach loop.
export type FileTimelineData = [ Time, Time, Time ];

function newFileTimelineData(input): FileTimelineData[]
{
    const output: FileTimelineData[] = [];

    input.forEach((times) => {
        const startOfDay = new Date(times.beg * 1000);
        startOfDay.setUTCHours(0,0,0,0);
        const startOfDay_ms = startOfDay.getTime();
        const beg_msSinceMidnight = (times.beg * 1000) - startOfDay_ms;
        const end_msSinceMidnight = (times.end * 1000) - startOfDay_ms;

        output.push([ startOfDay.getTime(), beg_msSinceMidnight, end_msSinceMidnight]);
    });

    return output;
}


export type TimelineData = [ Time, Time, string, string|undefined ];

function newTimelineData(input): TimelineData[]
{
    const output: TimelineData[] = [];

    input = sortTimespanData(input);

    const valueLabels = ( 'val' in input[0] ? ['val'] : ['old','new'] );
    input.forEach((values) => {
        let dataValues: string[] = [];
        for (const idx of valueLabels) {
            dataValues.push( !values[idx] ? noData : String(values[idx]) );
        }
        output.push([Number(values.beg) * 1000, Number(values.end) * 1000, dataValues[0], dataValues[1]]);
    });

    return output;
}

export function splitTimelineData(dataDetail: IDataDetail): IComponentData
{
    const timelineData: TimelineData[][] = [[],[]];
    const data = dataDetail.data as TimelineData[];
    data.forEach((values) => {
        const beginTime = values[0];
        const endTime = values[1];
        const valueA = values[2];
        const valueB = values[3];
        timelineData[0].push([beginTime, endTime, valueA, undefined]);
        if (valueB) {
            timelineData[1].push([beginTime, endTime, valueB, undefined]);
        }
    });

    return {'A': {
                  "id":   dataDetail.id,
                  "type": dataDetail.type,
                  "axes": dataDetail.axes,
                  "data": timelineData[0],
                 },
            'B': ( timelineData[1].length > 0 ?
                 {
                  "id":   dataDetail.id,
                  "type": dataDetail.type,
                  "axes": dataDetail.axes,
                  "data": timelineData[1]
                 }
                 : undefined ),
    };
}


export type PlotDataValues = [ Time, Time, (number|null)[] ];

export type PlotData = {
    "labels": string[],
    "tooltips": string[],
    "values": PlotDataValues[],
    "interval": number,
};

function newPlotData(input): PlotData[]
{
    const output: PlotData[] = [];

    const labels = Object.keys(input[0]);
    const timeKeys = labels.splice(0,2);
    const tooltips = Object.values(input[0]) as string[];
    tooltips.splice(0,2);
    // Remove "Median value" from the common timeseries data, 
    //   because the ncreview script inserts it,
    //   but not the corresponding column label or values
    // And, actually, let's do some extra work,
    //   because the extra tooltip messes with 
    //   expectations of the number of columns.
    //   ==> PapaParse adds in an array of "extras" at the end,
    //       sooo, remove that, too.
    const iExtras = labels.indexOf("__parsed_extra");
    const iMedian = tooltips.indexOf("Median value");
    if (iExtras > -1) {
        tooltips[iExtras] = tooltips[iExtras][0];  // Convert the array to a single value, its only value
        tooltips.splice(iMedian, 1);  // Remove the extraneous tooltip
        labels.splice(iExtras, 1);  // Remove the extras column
    }

    input.splice(0,1);

    const values = new Array<PlotDataValues>();
    let rowValues: (number|null)[];
    let t1: Time, t2: Time;
    const intervals: number[] = [];
    let i: number, value: string;

    for (const row of input) {
        rowValues = [];
        for (i=0; i < labels.length; i++) {
            value = row[labels[i]];
            rowValues.push( value === "" ? null : Number(value));
        }
        t1 = Number(row[timeKeys[0]]) * 1000;
        t2 = Number(row[timeKeys[1]]) * 1000;
        values.push( [ t1, t2, rowValues ] );
        intervals.push(t2 - t1);
    }
    let interval = Infinity;
    for (i=0; i < intervals.length; i++) // Don't use Math.min -- fails for huge arrays; limit to number of parameters
        if (intervals[i] < interval) interval = intervals[i];

    output.push({
        "labels": labels,
        "tooltips": tooltips,
        "values": values,
        "interval": interval,
    });
    return output;
}


// The boolean value is a marker for which values to keep after determining diff colors,
//   because the data displays better "stepped" by Highchart than it does manually spanned 
//   by plotting both begin and end.
export type BargraphDataAnnotated = [ Time, number|null, boolean ];
export type BargraphData = [ Time, number|null ];

function newBargraphData(input): BargraphDataAnnotated[]
{
    const output: BargraphDataAnnotated[] = [];

    input = sortTimespanData(input);

    const sampling_interval = getSamplingInterval();
    let previousDataBeg = Number(input[0].beg);
    let previousDataEnd = Number(input[0].end);

    input.forEach((values) => {
        const dataStart = Number(values.beg);
        const dataEnd   = Number(values.end);
        const dataValue = Number(values.val);
        // 
        if (dataEnd - previousDataBeg > 2 * sampling_interval) {
            if (output.length > 0)
                output[output.length-1][2] = true;
            output.push([(previousDataEnd + 1) * 1000, null, true]);
        }
        output.push([dataStart * 1000, dataValue, true]);
        output.push([dataEnd * 1000, dataValue, false]);
        previousDataBeg   = dataStart;
        previousDataEnd   = dataEnd;
    });
    output[output.length-1][2] = true;

    return output;
}



function getAxisLabels(dataType, labelY?: string, labelX?: string): [string,string]
{
    switch (dataType) {
        case 'fileTimeline':
        case 'fileTimelineDiff':
            return ["File Date", "Time"];
        case 'timeline':
        case 'timelineDiff':
            return ["Date", labelY || "Value"];
        case 'plot':
        case 'plotDiff':
            return [labelY || "Date", labelX || ""];
        case 'bargraph':
        case 'bargraphDiff':
            return [labelY || "Date", labelX || ""];
        default:
            throw new Error(`Unexpected data type provided to generate axis labels for: ${dataType}`);
    }
}



export interface IComponentData {
    'A': IDataDetail,
    'B'?: IDataDetail,
}
