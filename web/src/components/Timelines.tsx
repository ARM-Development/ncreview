// NPM packages
import React, { useEffect, useState, useRef } from 'react';
import { observer } from 'mobx-react';
import Highcharts from 'highcharts/highstock';
import HighchartsGantt from 'highcharts/highcharts-gantt';
import HighchartsReact from 'highcharts-react-official';
import { makeStyles } from '@material-ui/core/styles';
//import clsx from 'clsx';

// All other imports
import { useServices, DatastreamNames, DataIds } from 'services';
import { IComponentData, splitTimelineData, DiffType } from 'models/NCReviewData';
import { ZoneStops, ZoneStop, ColorArrays } from 'models/HighchartsChart';
import { StatusIndicator } from 'components';
import { LoadStatus } from 'models/MiscTypes';
import {
    noData,
    ganttTurboThreshold,
    diffColors,
    same, changed, removed, added
} from 'resources/constants';
import { redrawChart, secondsToTimespan, mode } from 'utils';
//import { commonStyles } from 'styles/commonStyles';


const useStyles = makeStyles(theme => ({
    root: {},
    timeline: {
        margin: '0',
        overflow: 'visible',
        '& .highcharts-container': {}
    },
}));

function onChartCreated(chart)
{
    redrawChart(chart);
    chart.showLoading();
}

function formatYAxis(this: Highcharts.AxisLabelsFormatterContextObject)
{
    return secondsToTimespan((this.value as number) / 1000);
}

function formatTooltip(this: Highcharts.Point)
{
    // pointFormat: `<span style="color:{point.color}">\u25CF</span> {series.name}<br>End Time: <b>{point.high:%H:%M:%S}</b><br>Start Time: <b>{point.low:%H:%M:%S}</b><br>`
    let tooltip = `<span style="color:${this.color}; font-decoration: underline">\u25CF</span> ${this.series.name}`;

    const groupStart = ( this.dataGroup ? this.dataGroup.start : -1 );
    const groupLength = ( this.dataGroup ? this.dataGroup.length : 1 );
    // Provide additional data for grouped data points (when zoomed out)
    if (groupLength > 1) {
        const pointData = this.series.yData.slice(groupStart, groupStart + groupLength);
        let modeLow = 0,
            minLow = 0,
            maxLow = 0,
            modeHigh = 0,
            minHigh = 0,
            maxHigh = 0;
        const lows: number[] = [],
              highs: number[] = [];
        pointData.forEach( (yData) => {
            lows.push(yData[0]);
            highs.push(yData[1]);
        });
        if (lows.length) {
            //meanLow = lows.reduce((a,b) => a+b, 0) / lows.length;
            minLow = Math.min(...lows);
            maxLow = Math.max(...lows);
            modeLow = ( minLow === maxLow ? minLow : mode(...lows) );
            //meanHigh = highs.reduce((a,b) => a+b, 0) / highs.length;
            minHigh = Math.min(...highs);
            maxHigh = Math.max(...highs);
            modeHigh = ( minHigh === maxHigh ? maxHigh : mode(...highs) );
            tooltip += `<br>End Time (mode): <b>${secondsToTimespan(modeHigh / 1000)}</b>`;
            if (minHigh !== maxHigh) {
                tooltip += `<br>&nbsp;&nbsp;\
                (range: <b>${secondsToTimespan(minHigh / 1000)}</b>\
                 \u2013 <b>${secondsToTimespan(maxHigh / 1000)}</b>)`;
            }
            tooltip += `<br>Start Time (mode): <b>${secondsToTimespan(modeLow / 1000)}</b>`;
            if (minLow !== maxLow) {
                tooltip += `<br>&nbsp;&nbsp;\
                (range: <b>${secondsToTimespan(minLow / 1000)}</b>\
                 \u2013 <b>${secondsToTimespan(maxLow / 1000)}</b>)`;
            }
        }
        else {
            tooltip += `<br>${noData}`;
        }
    }
    else {
        if (this.high > 0) {
            const times: string[] = [];
            // Displays times of all files in a timespan (sometimes there are multiple)
            for (let pt of this.series.points) {
                if (pt.category === this.category) {
                    times.push(`<br>Start Time: <b>${secondsToTimespan(pt.low as number / 1000)}</b>`);
                    times.push(`<br>End Time: <b>${secondsToTimespan(pt.high as number / 1000)}</b>`);
                }
                if (pt.category > this.category)
                    break;
            }
            tooltip += times.reverse();
        }
        else {
            tooltip += `<br>${noData}`;
        }
    }
    return tooltip;
}

type Time = number;
type Index = number;

function getFileTimelineColors(valuesA, valuesB): ZoneStops
{
    const zones: ZoneStops = {
        'A': new Array<ZoneStop>(),
        'B': new Array<ZoneStop>()
    };
    const last_A: Index = valuesA.length - 1;
    const last_B: Index = valuesB.length - 1;
    let t_A: Time = 0;
    let t_B: Time = 0;
    let diff = same, runningDiff = same;
    let stopValue: Time = 0;
    const fillColor = 'rgba(0,0,0,0)';

    for (let a=0, b=0; a <= last_A && b <= last_B; ) {
        diff = same;
        t_A = valuesA[a][0];
        t_B = valuesB[b][0];
        if (t_A < t_B) {
            diff = removed;
        }
        else if (t_A > t_B) {
            diff = added;
        }
        else if (valuesA[a][1] !== valuesB[b][1] ||
                 valuesA[a][2] !== valuesB[b][2]) 
        {
            diff = changed;
        }

        if (runningDiff !== diff || a === last_A || b === last_B) {
            if (diff === same) stopValue = t_A;
            const zoneStop = {
                'value': stopValue,
                'color': diffColors[runningDiff].line,
                'fillColor': fillColor,
            };
            zones.A.push(zoneStop);
            zones.B.push(zoneStop);

            runningDiff = diff;
        }

        if (diff !== added) a++;
        if (diff !== removed) b++;
        stopValue = ( diff === added ? t_B + 1 : t_A + 1 );
    }
    // Push one last stop, because colors at the end don't get set otherwise.
    diff = same;
    t_A = valuesA[last_A][0];
    t_B = valuesB[last_B][0];
    if (t_A < t_B) {
        diff = added;
    }
    else if (t_A > t_B) {
        diff = removed;
    }
    else if (valuesA[last_A][1] !== valuesB[last_B][1] ||
             valuesA[last_A][2] !== valuesB[last_B][2]) 
    {
        diff = changed;
    }
    stopValue = Math.max(t_A, t_B) + 1000;
    const zoneStop = {
        'value': stopValue,
        'color': diffColors[diff].line,
        'fillColor': fillColor,
    };
    zones.A.push(zoneStop);
    zones.B.push(zoneStop);

    return zones;
}

function getFileTimelineData(fileTimelineData, dataLoaded, names: DatastreamNames)
{
    let data: Highcharts.SeriesColumnrangeOptions[] = [];
    const dataGroupOptions: Highcharts.DataGroupingOptionsObject = {
        anchor: 'end',
        groupAll: true,
        enabled: false,
    };

    if (dataLoaded) {
        if (fileTimelineData['A']) {
            data.push({
                name: names[0],
                type: 'columnrange',
                data: fileTimelineData['A'].data,
                dataGrouping: dataGroupOptions,
                color: diffColors.A.line,
                zoneAxis: 'x',
            });
        }
        if (fileTimelineData['B']) {
            data.push({
                name: names[1],
                type: 'columnrange',
                data: fileTimelineData['B'].data,
                dataGrouping: dataGroupOptions,
                color: diffColors.B.line,
                zoneAxis: 'x',
            });
            const zones = getFileTimelineColors(fileTimelineData['A'].data, fileTimelineData['B'].data);
            data[data.length-2].zones = zones.A;
            data[data.length-1].zones = zones.B;
        }
    }

    return data;
}


const FileTimeline = observer(({ srcData }) => {
    const classes = useStyles();
    const { dataService } = useServices();

    const chartRef = useRef<HighchartsReact.RefObject>(null);

    const [ dataLoaded, setDataLoaded ] = useState(false);
    const [ fileTimelineData, setFileTimelineData ] = useState({} as Partial<IComponentData>);
    const [ datastreamNames, ] = useState((): DatastreamNames => dataService.getDatastreamNames());
    const [ dataIds, ] = useState((): DataIds => dataService.getDataIds(srcData));
    const statusMsg: LoadStatus = dataService.getDataDetailsStatus(dataIds);

    useEffect(() => {
        if (statusMsg === null) {
            dataIds.forEach((dataId) => {
                dataService.loadDataDetail(dataId, srcData.type);
            });
        }
        else if (statusMsg === 'success') {
            if (!dataLoaded) {
                setFileTimelineData({
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
            type: 'columnrange',
            panning: {
                enabled: true,
                type: 'x',
            },
            panKey: 'alt',
            zoomType: 'x',
            ignoreHiddenSeries: false,
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
            xDateFormat: "%b %e, %Y",
            pointFormatter: formatTooltip,
        },
        xAxis: {
            type: 'datetime',
            ordinal: false,
            accessibility: {
                rangeDescription: `Files span ...`,
            },
        },
        yAxis: {
            type: 'datetime',
            title: {
                text: "Timespan"
            },
            labels: {
                formatter: formatYAxis,
            },
            opposite: false,
            min: 0,
        },
        series: getFileTimelineData(fileTimelineData, dataLoaded, datastreamNames),
    }

    return (
        <>
            <StatusIndicator statusMsg={ statusMsg } />
            { dataLoaded &&
            <div className={ classes.timeline }>
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


function getTimelineColors(valuesA, valuesB): ColorArrays
{
    const colors: ColorArrays = {
        A: new Array<string>(),
        B: new Array<string>()
    };
    const last_A: Index = valuesA.length - 1;
    const last_B: Index = valuesB.length - 1;
    let bt_A: Time = 0;
    let et_A: Time = 0;
    let bt_B: Time = 0;
    let et_B: Time = 0;
    let diff = same;
    let diff_A = same;
    let diff_B = same;

    for (let a=0, b=0; a <= last_A && b <= last_B; ) {
        diff = same;
        bt_A = valuesA[a][0];
        et_A = valuesA[a][1];
        bt_B = valuesB[b][0];
        et_B = valuesB[b][1];
        if (et_A < bt_B) {
            diff = removed;
        }
        else if (bt_A > et_B) {
            diff = added;
        }
        else if (bt_A !== bt_B || et_A !== et_B ||
                 valuesA[a][2] !== valuesB[b][2]) 
        {
            diff = changed;
        }

        if (colors.A.length < a+1) {
            diff_A = ( diff === changed ? removed : diff );
            colors.A.push(diffColors[diff_A].line);
        }
        if (colors.B.length < b+1) {
            diff_B = ( diff === changed ? added : diff );
            colors.B.push(diffColors[diff_B].line);
        }

        if (diff !== added && et_A <= et_B) a++;
        if (diff !== removed && et_A >= et_B) b++;
    }

    return colors;
}

function getTimelineData(timelineData, dataLoaded, categories: string[], names: DatastreamNames, diff: DiffType): HighchartsGantt.SeriesXrangeOptions[]
{
    let data: HighchartsGantt.SeriesXrangeOptions[] = [];
    const categoriesLength = categories.length;

    if (dataLoaded) {
        let colors: ColorArrays = {A: [], B: []};
        if (timelineData['B'])
            colors = getTimelineColors(timelineData['A'].data, timelineData['B'].data);

        if (timelineData['A']) {
            const series: HighchartsGantt.XrangePointOptionsObject[] = [];
            const colorA: string = ( diff === added || diff === same ? diffColors[diff].line : diffColors.A.line );

            timelineData['A'].data.forEach((values, idx) => {
                const pointColor = ( colors.A.length ? colors.A[idx] : colorA );
                series.push({
                    name: values[2],
                    x: values[0],
                    x2: values[1],
                    color: pointColor,
                    partialFill: {
                        fill: pointColor,
                        amount: 1.00,
                    },
                    y: ( categoriesLength ? categories.indexOf(values[2]) : 0 ),
                });
            });
            data.push({
                name: ( diff === same ? `${names[0]} and ${names[1]} (combined)` : ( diff === added ? names[1] : names[0] )),
                type: 'xrange',
                data: series,
                legendColor: colorA,
            });
        }
        if (timelineData['B']) {
            const series: HighchartsGantt.XrangePointOptionsObject[] = [];
            const colorB: string = diffColors.B.line;

            timelineData['B'].data.forEach((values, idx) => {
                series.push({
                    name: values[2],
                    x: values[0],
                    x2: values[1],
                    color: colors.B[idx],
                    partialFill: {
                        fill: colors.B[idx],
                        amount: 1.00,
                    },
                    y: ( categoriesLength ? categories.indexOf(values[2]) : 0 ),
                });
            });
            data.push({
                name: names[1],
                type: 'xrange',
                data: series,
                legendColor: colorB,
            });
        }
    }

    return data;
}

function convertTimelineValuesToCategories(timelineData, dataLoaded): string[]
{
    let categories: string[] = [];
    const categoriesMergeThreshold = 6;

    if (dataLoaded) {
        if (timelineData['A']) {
            timelineData['A'].data.forEach((values) => {
                const value = values[2];
                if (!categories.includes(value))
                    categories.push(value);
            });
        }
        if (timelineData['B']) {
            timelineData['B'].data.forEach((values) => {
                const value = values[2];
                if (!categories.includes(value))
                    categories.push(value);
            });
        }
    }

    if (categories.length > categoriesMergeThreshold) {  // Merge all values onto a single row, if too many
        categories = [];
    }

    return categories;
}

// TODO: Address failure of GanttChart to draw large datasets
//       One issue is the inability to apply turboThreshold:
//       - when set, any dataset over the threshold size causes the chart to require data be (x,y) values only;
//      GanttChart fails to render zoomed out data beyond @ 50000 datapoints.
//       * Main reason GanttChart was selected: text data values.
//       * Second reason: horizontal width of data (timespans).
//       ? Use a scatterplot (or similar)?
//       ? Use "regular" plots: with a point on either end of span, line connecting, and gaps inserted between spans?
//       + Control tooltip to use name attribute (same as GanttChart anyway).
const Timeline = observer(({ srcData }) => {
    const classes = useStyles();
    const { dataService } = useServices();

    const chartRef = useRef<HighchartsReact.RefObject>(null);

    const [ dataLoaded, setDataLoaded ] = useState(false);
    const [ timelineData, setTimelineData ] = useState({} as Partial<IComponentData>);
    const [ datastreamNames, ] = useState((): DatastreamNames => dataService.getDatastreamNames());
    const [ dataIds, ] = useState((): DataIds => dataService.getDataIds(srcData));
    const statusMsg: LoadStatus = dataService.getDataDetailsStatus(dataIds);

    useEffect(() => {
        if (statusMsg === null) {
            dataIds.forEach((dataId) => {
                dataService.loadDataDetail(dataId, srcData.type);
            });
        }
        else if (statusMsg === 'success') {
            if (!dataLoaded) {
                setTimelineData(splitTimelineData(dataService.dataDetails[dataIds[0]]));
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

    const categories = convertTimelineValuesToCategories(timelineData, dataLoaded);
    const seriesData = getTimelineData(timelineData, dataLoaded, categories, datastreamNames, srcData.difference);

    // Common chart config options are in App component
    const chartConfig: Highcharts.Options = {
        chart: {
            type: 'xrange',
            panning: {
                enabled: true,
                type: 'x',
            },
            panKey: 'alt',
            zoomType: 'x',
            ignoreHiddenSeries: false,
        },
        plotOptions: {
            xrange: {
                turboThreshold: ganttTurboThreshold,
            },
        },
        scrollbar: {
            enabled: true,
        },
        navigator: {
            enabled: true,
            series: {
                type: 'gantt'
            }
        },
        rangeSelector: {
            enabled: true,
            selected: 5
        },
        legend: {
            enabled: true,
            itemHiddenStyle: {
                color: diffColors.inactive.dark,
            },
        },
        tooltip: {
            animation: false,
            headerFormat: "{point.x:%Y-%m-%d %H:%M:%S} - {point.x2:%Y-%m-%d %H:%M:%S}<br>",
            pointFormat: "<span style=\"color:{point.color}\">\u25CF</span> {series.name}:<br><b>{point.name}</b>",
            split: ( categories.length ? undefined : true ),
        },
        xAxis: {
            type: 'datetime',
        },
        yAxis: {
            categories: ( categories.length ? categories : ["(Hover over segment to see value)"] ),
            reversed: true,
            uniqueNames: true,
        },
        series: seriesData,
    }

    return (
        <>
            <StatusIndicator statusMsg={ statusMsg } />
            <div className={ classes.timeline }>
                <HighchartsReact
                    ref={ chartRef }
                    highcharts={ HighchartsGantt }
                    constructorType={ 'ganttChart' }
                    options={ chartConfig }
                    callback={ onChartCreated }
                />
            </div>
        </>
    );
});

export { FileTimeline, Timeline };
