// NPM packages
import React, { useEffect, useState, useRef } from 'react';
import { observer } from 'mobx-react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';

// All other imports
import { useServices, DatastreamNames } from 'services';
import { IComponentData, BargraphDataAnnotated, BargraphData, DiffType } from 'models/NCReviewData';
import { ZoneStops, ZoneStop } from 'models/HighchartsChart';
import { StatusIndicator } from 'components';
import { LoadStatus } from 'models/MiscTypes';
import {
    noData,
    diffColors,
    changed, removed, added,
    getSamplingInterval,
    chartHeight, sharedLeftMargin
} from 'resources/constants';
import {
    getDiff,
    redrawChart
} from 'utils';
//import { commonStyles } from 'styles/commonStyles';


const useStyles = makeStyles(theme => ({
    root: {},
    plot: {
        margin: 0,
        overflow: 'visible',
        '& .highcharts-container': {}
    },
    bargraph: {},
}));

function onChartCreated(chart): void
{
    redrawChart(chart);
    chart.showLoading();
}


function formatTooltip_Bargraph(this: Highcharts.Point)
{
    // pointFormat: `<span style="color:{point.color}">\u25CF</span> {series.name}: <b>{point.y:.0f}</b>`
    let tooltip = `<span style="color:${this.color};">\u25CF</span> ${this.series.name}`;

    const groupStart = ( this.dataGroup ? this.dataGroup.start : -1 );
    const groupLength = ( this.dataGroup ? this.dataGroup.length : 1 );
    // Provide additional data for grouped data points (when zoomed out)
    if (groupLength > 1) {
        const pointData: number[] = this.series.yData.slice(groupStart, groupStart + groupLength) as number[];
        let meanVal = 0,
            minVal = 0,
            maxVal = 0;

        meanVal = pointData.reduce((a,b) => a+b, 0) / pointData.length;
        minVal = Math.min(...pointData);
        maxVal = Math.max(...pointData);
        tooltip += ` (mean): <b>${meanVal}</b>`;
        if (minVal !== maxVal) {
            tooltip += `<br>&nbsp;&nbsp;(range: <b>${minVal}</b> \u2013 <b>${maxVal}</b>)`;
        }
    }
    else {
        tooltip += `: <b>${( this.y !== undefined ? this.y : noData )}</b>`;
    }

    return tooltip;
}

// BEGIN: data alignment and color stops functionality {
type Time = number;
type Index = number;
type IndexPair = [Index, Index];
type SegmentPair = [IndexPair, IndexPair];

const A: Index = 0;
const B: Index = 1;
const ti: Index = 0;  // index of time value at each data point
const vi: Index = 1;  // index of data value at each data point

function getNextSegment(target: Index, data, i: SegmentPair): IndexPair
{
    let n: Index = i[target][1] + 1;
    if (n < data[target].length && data[target][n][vi] === null) {
        n++;
    }
    return [n, n+1];
}

function determineActive(data, i: SegmentPair): IndexPair
{
    const A_is_done = ( i[A][0] > data[A].length - 1 );
    const B_is_done = ( i[B][0] > data[B].length - 1 );
    if ( !B_is_done &&
        ( A_is_done ||
          data[B][i[B][0]][ti] < data[A][i[A][0]][ti] ))
        return [B,A];
    else
        return [A,B];  // if A_is_done && B_is_done, we may inadvertently switch active,other, but it shouldn't matter by then
                       //   because of the one situation where determineActive() is used
}

// TODO: Adjust the exact stopValue per subsequent diff once visuals available, i.e. ( diff === same ? t : t+1 )
function setZoneStop(zones: ZoneStops, stopValue: Time, runningDiff: DiffType): void // , diff: DiffType
{
    let stopColor = ( runningDiff === changed ? diffColors.A.line : diffColors[runningDiff].line );
    const zoneStopA = {
        'value': stopValue as number,
        'color': stopColor,
        'fillColor': diffColors[runningDiff].fill as string,
    };
    zones.A.push(zoneStopA);

    const zoneStopB = {
        'value': stopValue as number,
        'color': ( runningDiff === changed ? diffColors.B.line : diffColors[runningDiff].line ),
        'fillColor': diffColors[runningDiff].fill as string,
    };
    zones.B.push(zoneStopB);
}

// Initially, many common actions in this algorithm were abstracted out into functions,
//   for readability and understandability, but the algorithm ran slowly,
//   so many sections below are hard to read and repeat code.
//   And, so, where functions once explained, comments now do.
function getBargraphColors(valuesA, valuesB): ZoneStops
{
    const zones: ZoneStops = {
        'A': new Array<ZoneStop>(),
        'B': new Array<ZoneStop>()
    };
    const data = [valuesA, valuesB];
    let segments: SegmentPair = [[0,1], [0,1]];  // indices of current segments for A, B resp.
    const last_A: Index = valuesA.length - 1;
    const last_B: Index = valuesB.length - 1;
    let active: Index = 0;  // index for data of ds with lowest time in its current segment
    let other: Index = 1;  // index for data of the other ds
    let active_last: Index = last_A;
    let other_last: Index = last_B;
    // Find the earliest and latest times
    if (valuesB[0][ti] < valuesA[0][ti]) {
        active = 1;
        other = 0;
    }
    if (valuesB[last_B][ti] > valuesA[last_A][ti]) {
        active_last = last_B;
        other_last = last_A;
    }

    // Loop through the time segments
    let active_start: Index = 0;
    let active_start_t: Time = data[active][active_start][ti];
    let active_end: Index = 1;
    let active_end_t: Time = 0;
    let other_start: Index = 0;
    let other_start_t: Time = data[other][other_start][ti];
    let other_end: Index = 1;
    let other_end_t: Time = 0;
    let newDiff: DiffType = getDiff(data[A][segments[A][0]][vi], data[B][segments[B][0]][vi]);
    if (active_start_t < other_start_t) {
        newDiff = ( active === A ? removed : added );  // A or B only
    }
    let runningDiff = newDiff;
    let sampling_interval: Time = getSamplingInterval();  // 1000ms default (ms is default unit of provided times)

    while (segments[A][1] <= last_A && segments[B][1] <= last_B) {
        active_start = segments[active][0];
        active_end   = segments[active][1];
        active_last  = ( active === B ? last_B : last_A );
        active_start_t = data[active][active_start][ti];
        active_end_t = data[active][active_end][ti];
        other_start  = segments[other][0];
        other_end    = segments[other][1];
        other_last   = ( other === B ? last_B : last_A );
        other_start_t = data[other][other_start][ti];
        other_end_t = data[other][other_end][ti];

        // Same initial action for all except 1st scenario
        if (active_end_t >= other_start_t) {
            newDiff = getDiff(data[A][segments[A][0]][vi], data[B][segments[B][0]][vi]);
            if (runningDiff !== newDiff) {
                setZoneStop(zones, other_start_t - 1, runningDiff);
            }
            runningDiff = newDiff;
        }

        // [ ] ...
        //         [ ]
        if (active_end_t < other_start_t) {
            segments[active] = getNextSegment(active, data, segments);
            active_start = segments[active][0];
            active_start_t = ( active_start > active_last ? -1 : data[active][active_start][ti] );
            if (( active_start > active_last ) ||  // if done ...
                other_start_t < active_start_t)  // ... or switching up
            {
                setZoneStop(zones, other_start_t - 1, runningDiff);
                runningDiff = ( other === A ? removed : added );  // A or B only
                [active, other] = [other, active];  // switch active
            }
        }
        // [ ]
        //   [...
        else if (active_end_t === other_start_t) {
            segments[active] = getNextSegment(active, data, segments);
            active_start = segments[active][0];
            active_start_t = ( active_start > active_last ? -1 : data[active][active_start][ti] );
            if (( active_start > active_last ) ||  // if done ...
                ( (active_start_t - active_end_t) > sampling_interval ))  // ... or not adjacent
            {
                setZoneStop(zones, other_start_t, runningDiff);
                runningDiff = ( other === A ? removed : added );  // A or B only
            }
            [active, other] = [other, active];  // switch active
        }
        // [      ]
        // (  [)...
        else if (active_end_t > other_start_t) {
            // [      ]
            //       ...]
            if (active_end_t < other_end_t) {
                segments[active] = getNextSegment(active, data, segments);
                active_start = segments[active][0];
                active_start_t = ( active_start > active_last ? -1 : data[active][active_start][ti] );
                if (( active_start > active_last ) ||  // if done ...
                    ( (active_start_t - active_end_t) > sampling_interval ))  // ... or not adjacent
                {
                    setZoneStop(zones, active_end_t, runningDiff);
                    runningDiff = ( other === A ? removed : added );  // A or B only
                }
                [active, other] = [other, active];  // switch active
            }
            // [      ]
            //     ...]
            else if (active_end_t === other_end_t) {
                segments[active] = getNextSegment(active, data, segments);
                segments[other] = getNextSegment(other, data, segments);

                [active, other] = determineActive(data, segments);

                active_start = segments[active][0];
                active_last  = ( active === B ? last_B : last_A );
                active_start_t = ( active_start > active_last ? -1 : data[active][active_start][ti] );
                other_start = segments[other][0];
                other_last   = ( other === B ? last_B : last_A );
                other_start_t = ( other_start > other_last ? -1 : data[other][other_start][ti] );
                if (( other_start > other_last ) ||  // if other is done (implies both done) ...
                    active_start_t < other_start_t)  // ... or next segments' starts not equal
                {
                    setZoneStop(zones, other_end_t, runningDiff);
                    // if next segments' starts not equal (active is not done)
                    if (!( active_start > active_last ))
                        runningDiff = ( active === A ? removed : added );  // A or B only
                }
            }
            // [      ]
            //   ...]
            else if (active_end_t > other_end_t) {
                segments[other] = getNextSegment(other, data, segments);
                other_start = segments[other][0];
                other_start_t = ( other_start > other_last ? -1 : data[other][other_start][ti] );
                if (( other_start > other_last ) ||  // if done ...
                    ( (other_start_t - other_end_t) > sampling_interval ))  // ... or not adjacent
                {
                    setZoneStop(zones, other_end_t, runningDiff);
                    runningDiff = ( active === A ? removed : added );  // A or B only
                }
            }
        }
    }

    // Set one last zone stop just past the very end.
    // active and runningDiff should be valid still.
    active_last = ( active === B ? last_B : last_A );
    setZoneStop(zones, data[active][active_last][ti] + sampling_interval, runningDiff);

    return zones;
}

function convertBargraphData(data: BargraphDataAnnotated[]): BargraphData[]
{
    const out: BargraphData[] = [];
    data.forEach( (d) => {
        if (d[2])
            out.push([d[0], d[1]] as BargraphData); 
    });
    return out;
}
// END: data alignment and color stops functionality

function getBargraphData(bargraphData, dataLoaded, names: DatastreamNames, diff: DiffType)
{
    let data: Highcharts.SeriesAreaOptions[] = [];

    if (dataLoaded) {
        if (bargraphData.A) {
            data.push({
                name: names[0],
                type: 'area',
                data: convertBargraphData(bargraphData.A.data),
                step: 'left',
                color: ( diff === added ? diffColors.B.line : diffColors.A.line ),
                fillColor: ( diff === added ? diffColors.B.fill : diffColors.A.fill ),
                zoneAxis: 'x',
            });
        }
        if (bargraphData.B) {
            data.push({
                name: names[1],
                type: 'area',
                data: convertBargraphData(bargraphData.B.data),
                step: 'left',
                color: diffColors.B.line,
                fillColor: diffColors.B.fill,
                zoneAxis: 'x',
            });

            const zones = getBargraphColors(bargraphData.A.data, bargraphData.B.data);
            // delete data[data.length-2].color;
            delete data[data.length-2].fillColor;
            data[data.length-2].zones = zones.A;
            data[data.length-1].zones = zones.B;
        }
    }

    return data;
}

const Bargraph = observer(({ srcData }) => {
    const classes = useStyles();
    const { dataService } = useServices();

    const chartRef = useRef<HighchartsReact.RefObject>(null);

    const [ dataLoaded, setDataLoaded ] = useState(false);
    const [ bargraphData, setBargraphData ] = useState({} as Partial<IComponentData>);
    const [ datastreamNames, ] = useState((): DatastreamNames => dataService.getDatastreamNames());
    const [ dataIds, ] = useState(() => {
        if (srcData.type.includes('Diff'))
            return dataService.getDataIds(srcData);
        else // Non-diff data is stored inline in the JSON
            return dataService.getNewDataIds(1);
    });
    const statusMsg: LoadStatus = dataService.getDataDetailsStatus(dataIds);

    useEffect(() => {
        if (statusMsg === null) {
            dataIds.forEach((dataId) => {
                if (srcData.type.includes('Diff'))
                    dataService.loadDataDetail(dataId, srcData.type);
                else // So we call an alternate method of parsing and storing the data
                    dataService.addDataDetail(dataId, srcData.type, srcData.data);
            });
        }
        else if (statusMsg === 'success') {
            if (!dataLoaded) {
                setBargraphData({
                    'A': dataService.dataDetails[dataIds[0]],
                    'B': ( dataIds.length > 1 ? dataService.dataDetails[dataIds[1]] : undefined ),
                });
                setDataLoaded(true);
            }
            else {
                if (chartRef.current && chartRef.current.chart) {
                    const chart = chartRef.current.chart;
                    chart.hideLoading();
                }
            }
        }
    }, [statusMsg, dataLoaded, dataIds, dataService, srcData, chartRef]);

    // Common chart config options are in App component
    const chartConfig: Highcharts.Options = {
        chart: {
            type: 'area',
            height: chartHeight + 100,
            panning: {
                enabled: true,
                type: 'x',
            },
            panKey: 'alt',
            zoomType: 'x',
            ignoreHiddenSeries: false,
            marginLeft: sharedLeftMargin,
        },
        rangeSelector: {
            selected: 5
        },
        legend: {
            enabled: true,
            itemHiddenStyle: {
                color: diffColors.inactive.dark,
            },
        },
        tooltip: {
            xDateFormat: "%Y-%m-%d %H:%M:%S",
            pointFormatter: formatTooltip_Bargraph,
        },
        xAxis: {
            type: 'datetime',
            ordinal: false,
            accessibility: {
                rangeDescription: ``,
            },
        },
        yAxis: {
            title: {
                text: ""
            },
            opposite: false,
        },
        series: getBargraphData(bargraphData, dataLoaded, datastreamNames, srcData.difference),
    }

    return (
        <>
            <StatusIndicator statusMsg={ statusMsg } />
            { dataLoaded &&
            <div className={ clsx( classes.plot, classes.bargraph ) }>
                <HighchartsReact
                    ref={ chartRef }
                    highcharts={ Highcharts }
                    constructorType={ 'stockChart' }
                    options={ chartConfig }
                    callback={ onChartCreated }
                />
            </div>
            }
        </>
    );
});

export { Bargraph };
