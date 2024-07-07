// NPM packages
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { observer } from 'mobx-react';
import * as d3 from 'd3';
import { makeStyles } from '@material-ui/core/styles';

// All other imports
//import { DiffType } from 'models/NCReviewData';
import {
    noData,
    diffColors, chartBackgroundColor,
    nonDiff, same, changed, added,
    chartHeight, sharedLeftMargin
} from 'resources/constants';
import {
    secondsToReadableDate,
    format,
    getDiff
} from 'utils';
//import { commonStyles } from 'styles/commonStyles';

const useStyles = makeStyles(theme => ({
    root: {},
    plot: {
        width: '100%',
        height: `${chartHeight}px`,
        margin: 0,
        backgroundColor: chartBackgroundColor, //theme.palette.background.default,
        WebkitTapHighlightColor: 'transparent',
    },
    axis: {
        color: theme.palette.text.primary,
    },
}));


// TODO:
// _ Profile initial delay, after data loaded, and improve it.
//   Initial "loading" time is slower than the original by about x2.
//   It's not the time loading the document,
//     it's something processing for a while after data is retrieved.
// _ Make tooltip Y values arg color circle work
// ? Fix zoom scale (per original; use plotData.interval)?
// _ Use brush to set mousedrag up/down for zoom, instead of using scroll wheel, please... if possible
// _ Add plot legend: arg1 name and plot color; arg2 name and plot color, if arg2
// ? Define styles as CSS that can be?
// ? Convert to Typescript?


// Plot formatter and utility functions

// type Time = number;
// type TimeValues = [ Time, Time ];
// type PlotValues = number[];
// type PlotSrc = 'A'|'B';
// type D3PlotDataValue = {
//     "src": PlotSrc,
//     "x": Time,
//     "y": (number|null),
// };
// type D3PlotData = D3PlotDataValue[];

function formatPlotData(plotData) {//: IComponentData): D3PlotData {
    const T = [];//: TimeValues[] = [];
    const X = [];//: Time[] = [];
    const Y_all = [];//: PlotValues[] = [];
    const Z = [];//: PlotSrc[] = [];
    const plotDataA = plotData.A.data[0].values;//: PlotDataValues[]
    const plotDataB = ( plotData.B ? plotData.B.data[0].values : undefined );//: PlotDataValues[]|undefined

    // Each value is plotted at the mean of begin and end
    for (let i=0; i < plotDataA.length; i++) {
        T.push([ plotDataA[i][0], plotDataA[i][1] ]);
        X.push( (plotDataA[i][0] + plotDataA[i][1]) / 2 );
        Y_all.push(plotDataA[i][2]);
        Z.push('A');
    }
    if (plotDataB) {
        for (let i=0; i < plotDataB.length; i++) {
            T.push([ plotDataB[i][0], plotDataB[i][1] ]);
            X.push( (plotDataB[i][0] + plotDataB[i][1]) / 2 );
            Y_all.push(plotDataB[i][2]);
            Z.push('B');
        }
    }

    return [T, X, Y_all, Z];
}

function getDiffData(diff, T, Y, lenData)
{
    const diffX = [];
    const diffD = [];
    const diffZ = [];

    if (diff === changed) {
        let diffY = same;
        let lastDiff = undefined;

        Y.slice(0,lenData).forEach((y, idx) => {
            diffY = getDiff(y, Y[lenData+idx]);

            if (diffY === same) {
                if (diffX.length > 0) {
                    diffX.push(null); // gap to separate segments of repeated diffs
                    diffZ.push(same);
                    diffD.push(false);
                }
            }
            else {
                lastDiff = diffZ[diffZ.length-1];
                if (lastDiff === diffY) {
                    diffX[diffX.length-2] = T[idx][1]; // revise end
                }
                else {
                    diffX.push(T[idx][0], T[idx][1], null); // start, end, gap
                    diffZ.push(diffY, diffY, diffY);
                    diffD.push(true, true, false);
                }
            }
        });
    }
    const diffI = d3.range(diffX.length);

    return [diffX, diffZ, diffD, diffI];
}

/**
 * Retrieve indices for subsection of data visible in the plot
 */
function getPlotExtentsIndices(lenData, X, xScale) {
    let beg_i = 0;
    let end_i = lenData;
    let xRange = xScale.range();
    const leftExtent = xScale.invert(xRange[0]);
    const rightExtent = xScale.invert(xRange[1]);
    const _X = X.slice(0, lenData); // If is diff, only use the 'A' half of X.
    beg_i = d3.bisectLeft(_X, leftExtent);
    end_i = d3.bisectRight(_X, rightExtent, beg_i);

    return [beg_i, end_i];
}

function getXScale(scaleType, X, xRange, zoomState) {
    const xDomain = d3.extent(X); // [xmin, xmax]
    const xScale = scaleType(xDomain, xRange);
    if (zoomState) {
        const xScaled = zoomState.rescaleX(xScale);
        xScale.domain(xScaled.domain());
    }

    return xScale;
}

function getYScale(scaleType, Y, yRange, lenData, dynamicY, X, xScale) {
    const isDiff = lenData < Y.length;

    let beg_i = 0;
    let end_i = lenData;
    if (dynamicY) {
        [beg_i, end_i] = getPlotExtentsIndices(lenData, X, xScale);
    }

    let _Y = Y.slice(beg_i, end_i);
    if (isDiff) // If is diff, need to check min/max for the 'A' and 'B' halves of Y.
        _Y = _Y.concat(Y.slice(lenData + beg_i, lenData + end_i));
    if (_Y.length <= 0) _Y = [0]; // If zoomed to an empty extent
    let yMin = d3.min(_Y);
    if (!dynamicY)
        yMin = d3.min([0, yMin]);
    let yMax = d3.max(_Y);
    if (!dynamicY)
        yMax = d3.max([0, yMax]);
    let yPadding = (yMax - yMin) * .02;
    yMin = yMin - yPadding;
    yMax = yMax + yPadding;
    const yDomain = [yMin, yMax]; // [ymin, ymax]
    const yScale = scaleType(yDomain, yRange);

    return yScale;
}

function getPlotColor(z, diff) { // z == d.src
    const _z = ( diff === added ? added : z );
    return diffColors[_z].line;
}

function yFormat(d) { // formats y-axis tick labels
    if (d >= Math.pow(10, 12) || d <= -1 * Math.pow(10, 12) ||
        (d <= Math.pow(10, -6) && d >= -1 * Math.pow(10, -6) && d !== 0))
    {
        return d.toExponential(2);
    }
    else if (d >= Math.pow(10, 6) || d <= -1 * Math.pow(10, 6)) {
        return new Intl.NumberFormat('en-US', {style: 'decimal', notation: "compact", compactDisplay: "short"}).format(d);
    }
    else {
        return d.toPrecision(7).replace(/0+$/,"");  // remove trailing zeros
    }
}

function isValidCoord(x, y, i, I, cfg) {
    return ((0 <= i && I.includes(i)) &&
        (x === 0 || x) &&
        (cfg.plotLeft <= x && x <= cfg.plotRight) &&
        (y === 0 || y) &&
        (cfg.plotTop <= y && y <= cfg.plotBottom));
}

/**
 * Approach to using D3 in React:
 * https://www.pluralsight.com/guides/using-d3.js-inside-a-react-app
 */
const useD3Plot = (renderD3Plot) => {
    const chartRef = useRef(null); //useRef<SVGSVGElement>(null);

    useEffect(() => {
        renderD3Plot(d3.select(chartRef.current));
    }, [ renderD3Plot ]);

    return chartRef;
};

// type D3PlotProps = {
//     plotData: IComponentData,
//     dsNames: DatastreamNames,
//     dsPaths: DatastreamPaths,
//     diff: DiffType,
//     plotId: number,
//     d3StateProxy: D3StateProxy,
// }

const D3Plot = observer(({ plotData, dsNames, diff, plotId, d3StateProxy }) => { //}: D3PlotProps) => {
    const classes = useStyles();

    const chartWidth = d3StateProxy.chartWidth;
    const margins = {
        top: 30,
        right: 30,
        bottom: 30,
        left: sharedLeftMargin,
    };
    const plotWidth = chartWidth - margins.left - margins.right;
    const plotHeight = chartHeight - margins.top - margins.bottom;
    const plotTop = margins.top;
    const plotBottom = plotHeight + plotTop;
    const plotLeft = margins.left;
    const plotRight = plotLeft + plotWidth;
    const [ d3PlotConfig, ] = useState({
        curve: d3.curveLinear, // method of interpolation between points
        margins: margins,
        plotWidth: plotWidth,
        plotHeight: plotHeight,
        plotTop: plotTop,
        plotBottom: plotBottom,
        plotLeft: plotLeft,
        plotRight: plotRight,
        xType: d3.scaleUtc, // the x-scale type
        yType: d3.scaleLinear, // the y-scale type
        backgroundColor: chartBackgroundColor,
        tooltipBgColor: '#0a0a0a',
        textColor: diffColors[nonDiff].dark, // color of axes labels and other text
        axisFontSize: "12px", // font-size of axes 
        tooltipFontSize: "13px", // font-size of tooltip text
        strokeLinecap: "round", // stroke line cap of the line
        strokeLinejoin: "round", // stroke line join of the line
        strokeWidth: 2.0, // stroke width of line, in pixels
        strokeOpacity: 1, // stroke opacity of line
        pointRadius: 1.5, // radius of point circles, in pixels
    });
    const chartElemRefs = useRef({});
    const [ tooltipInit, setTooltipInit ] = useState(false);
    const [ tooltipActive, setTooltipActive ] = useState(false);
    const [ tooltipCoords, setTooltipCoords ] = useState({x: 0, y: 0});
    const [ tooltipSticky, setTooltipSticky ] = useState(false);
    const [ zoomState, setZoomState ] = useState();

    // Compute working values
    // T: Array of (t1, t2)
    // X: Array of the means of t1 and t2
    // Y_all: Array of (data for plot 1, data for plot 2, etc.)
    // Z: Array of the "category", A|B, each data point belongs to.
    const [T, X, Y_all, Z] =  useMemo(() => formatPlotData(plotData), [plotData]);
    const lenData = plotData.A.data[0].values.length;
    const activePlot = d3StateProxy.activePlot;
    const dynamicY = d3StateProxy.dynamicY
    // Omit any data not present in the z-domain
    const zDomain = new d3.InternSet(Z); // Exactly as expected: Z reduced to a set of 2
    const I = d3.range(X.length).filter(i => zDomain.has(Z[i])); // Array of values 0 -> X.length - 1, continuous ?unless Z has bad values?
    const isDiff = ( lenData < I.length ? true : false );

    const chartRef = useD3Plot((svg) => {
        const cfg = d3PlotConfig;

        // Compute working values
        const Y = d3.map(Y_all, y => y[activePlot]); // Array of data values
        const D = d3.map(Y, y => !( [null, undefined].includes(y) || isNaN(y) )); // Array of true|false
        const [diffX, diffZ, diffD, diffI] = getDiffData(diff, T, Y, lenData);

        // Construct scales for axes
        const xScale = getXScale(cfg.xType, X, [cfg.plotLeft, cfg.plotRight], zoomState);
        const yScale = getYScale(cfg.yType, Y, [cfg.plotBottom, cfg.plotTop], lenData, dynamicY, X, xScale);

        // Restrict rendered data to visible portion
        let [beg_i, end_i] = getPlotExtentsIndices(lenData, X, xScale);
        if (beg_i > 0) beg_i--; // Draw lines connecting to hidden data
        if (end_i < lenData - 1) end_i++;
        let visibleI = I.slice(beg_i, end_i);
        if (isDiff) // If is diff, need to get data from both the 'A' and 'B' halves of I.
            visibleI = visibleI.concat(I.slice(lenData + beg_i, lenData + end_i));
        if (visibleI.length <= 0) visibleI = []; // If zoomed to an empty extent
    
        // Construct axes
        const xAxis = d3.axisBottom(xScale)
            .ticks(chartWidth / (chartWidth/12))
            .tickSizeOuter(0);
        const yAxis = d3.axisLeft(yScale)
            .ticks(plotHeight / (plotHeight/10))
            .tickSizeInner(4)
            .tickFormat(yFormat)
            .tickPadding(9);

        // Construct a line generator
        const line = d3.line()
            .defined(i => D[i])
            .curve(cfg.curve)
            .x(i => xScale(X[i]))
            .y(i => yScale(Y[i]));

        // Construct an area generator
        const area = d3.area()
            .defined(i => diffD[i])
            .x(i => xScale(diffX[i]))
            .y0(plotBottom)
            .y1(plotTop);

        // Construct a zoom transform
        const zoom = d3.zoom()
            .scaleExtent([1, X.length])
            .translateExtent([[0, 0], [chartWidth, chartHeight]])

        // Event handlers
        // NOTE: Events may fire before render

        function pointerclick() {
            setTooltipSticky(!tooltipSticky);
        }

        function pointermoved(event) {
            if (chartElemRefs.current['tooltip'] && !tooltipSticky) {
                let [xm, ym] = d3.pointer(event);
                let i = d3.least(visibleI.slice(1,visibleI.length-1), i => ( D[i] ? Math.abs(xScale(X[i]) - xm) : null )); // closest visible point along x-axis
                let x = xScale(X[i]); // Get x pixel coordinate of data at i
                let y = yScale(Y[i]); // Get y pixel coordinate of data at i
                if (isValidCoord(x, y, i, visibleI, d3PlotConfig)) {
                    if (!tooltipActive) setTooltipActive(true);
                    d3StateProxy.setActiveIndex(i);
                    setTooltipCoords({x: x, y: ym});
                }
                else {
                    setTooltipActive(false);
                }
            }
        }

        function pointerentered() {
            if (chartElemRefs.current['tooltip']) {
                if (!tooltipInit)
                    setTooltipInit(true);
                setTooltipActive(true);
            }
        }

        function pointerleft() {
            if (chartElemRefs.current['tooltip'] && !tooltipSticky) {
                setTooltipActive(false);
            }
        }

        function zoomed(event) {
            setZoomState(event.transform);
            setTooltipSticky(false);
            setTooltipCoords({x: -999, y: -99});
        }
        zoom.on('zoom', zoomed);

        // Create the plot

        svg
            .attr("viewBox", [0, 0, chartWidth, chartHeight])
            .on("click", pointerclick)
            .on("pointerenter", pointerentered)
            .on("pointermove", pointermoved)
            .on("pointerleave", pointerleft);

        const xAxisGroup = svg.select("g.x-axis");
        chartElemRefs.current['xAxisGroup'] = xAxisGroup;
        xAxisGroup.call(xAxis)
            .selectAll("text")
                .style("font-size", cfg.axisFontSize);

        const yAxisGroup = svg.select("g.y-axis");
        chartElemRefs.current['yAxisGroup'] = yAxisGroup;
        yAxisGroup.call(yAxis)
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll(".horizontal-grid").remove())
            .call(g => g.selectAll(".tick line").clone()
                .attr("class", "horizontal-grid")
                .attr("x2", cfg.plotWidth)
                .attr("stroke-opacity", 0.1))
            .selectAll("text")
                .style("font-size", cfg.axisFontSize);

        const paths = svg.select("g.plotPaths");
        chartElemRefs.current['pathsGroup'] = paths;

        paths.selectAll("path")
            .data(d3.group(visibleI, i => Z[i]))
            .join("path")
                .attr("class", ([z]) => `plotLine${z} plotPath${z}`)
                .attr("stroke", ([z]) => getPlotColor(z, diff))
                .attr("d", ([ , z_I]) => line(z_I));

        paths.selectAll("circle.plotPathPt")
            .data(() => { // d3.filter(I, i => D[i]; // To emphasize every point
                let ptsCt = 0;
                return visibleI.reduce((loners, i) => {
                    if (i === lenData) ptsCt = 0;
                    if (Y[i] === null) {
                        if (ptsCt === 1)
                            loners.push(I[i-1]);
                        ptsCt = 0
                    }
                    else ptsCt++;
                    return loners;
                }, []);
            })
            .join("circle")
                .attr("class", i => `plotPathPt plotPathPt${Z[i]} plotPath${Z[i]}`)
                .attr("fill", i => getPlotColor(Z[i], diff))
                .attr("stroke", "none")
                .attr("r", cfg.pointRadius)
                .attr("cx", i => xScale(X[i]))
                .attr("cy", i => yScale(Y[i]));

        if (diff === changed) {
            svg.select("g.diff-areas")
                .selectAll("path")
                .data(d3.group(diffI, i => diffZ[i]))
                .join("path")
                    .attr("class", ([z]) => `diff-area diff-area-${z}`)
                    .attr("fill", ([z]) => diffColors[z].fill)
                    .attr("d", ([ , z_I]) => area(z_I));
        }

        const tooltip = svg.select("g.plotTooltip");
        chartElemRefs.current['tooltip'] = tooltip;
        tooltip.attr("display", ( tooltipInit ? null : 'none' ))
            .attr("transform", `translate(${tooltipCoords.x},0)`);
        if (tooltipInit) {
            let i = d3StateProxy.activeIndex;
            if (i >= lenData) i = i - lenData;
            const xHorizShift = ( tooltipCoords.x - margins.left < cfg.plotWidth * 0.1 ? 75 : ( tooltipCoords.x - margins.left > plotWidth * 0.9 ? -75 : 0 ));
            const xVertiShift = Math.floor(cfg.plotBottom + 1);
            tooltip.select("g.tooltipX")
                .attr("transform", `translate(${xHorizShift},${xVertiShift})`) // Overlays it on the x-axis
            tooltip.select("g.tooltipX path")
                .attr("d", `M-76,5${( xHorizShift === 0 ? 'H-5l5,-5l5,5H76' : ( xHorizShift > 0 ? 'l1,-5l5,5H76' : 'H70l5,-5l1,5' ))}v23h-152z`);
            tooltip.select("g.tooltipX text")
                .text(secondsToReadableDate(X[i]/1000));
            if (tooltipActive) {
                const fmt = d3StateProxy.dataFormats[activePlot];
                const yHeight = ( isDiff ? 88 : 44 );
                const yWidth = 22 + Math.max(
                    tooltip.select("g.tooltipY text.tooltipYA").node().getBBox().width,
                    tooltip.select("g.tooltipY text.tooltipYB").node().getBBox().width
                );
                const yHorizShift = ( tooltipCoords.x - margins.left > cfg.plotWidth * 0.5 ? -1 * yWidth - 5 : 5 );
                const yVertiShift = tooltipCoords.y + ( tooltipCoords.y - cfg.plotTop > cfg.plotHeight * 0.5 ? -1 * yHeight - 3 : 3 );
                tooltip.select("g.tooltipY")
                    .attr("display", ("display", null))
                    .attr("transform", `translate(${yHorizShift},${yVertiShift})`)
                tooltip.select("g.tooltipY path")
                    .attr("d", `M0,0h${yWidth}v${yHeight}h-${yWidth}z`);
                tooltip.select("g.tooltipY text.tooltipYA tspan.value")
                    .text( Y[i] !== null ? format(Y[i], fmt) : noData );
                tooltip.select("g.tooltipY text.tooltipYB tspan.value")
                    .text( Y[i+lenData] !== null ? format(Y[i+lenData], fmt) : noData );
            }
            else {
                tooltip.select("g.tooltipY")
                    .attr("display", ("display", 'none'))
            }
        }

        svg.call(zoom)
            .on('wheel', event => event.preventDefault());
        //    .on("wheel.zoom", null); // Disable scroll-wheel-based zooming

        // Set current plot extents
        const zoomExtent = xScale.domain();
        d3StateProxy.setPlotExtents(
            zoomExtent[0],
            zoomExtent[zoomExtent.length-1]
        );

        return svg;
    });


    return (
        <svg
            ref={ chartRef }
            id={ `plot${plotId}` }
            className={ classes.plot }
            width={ chartWidth }
            height={ chartHeight }
        >
            <defs>
                <clipPath id={`clip${plotId}`}>
                    <rect x={margins.left} y={margins.top} width={plotWidth} height={plotHeight} />
                </clipPath>
            </defs>
            <g className={ `${classes.axis} x-axis` }
                transform={ `translate(0,${plotBottom + 6})` }
            />
            <g className={ `${classes.axis} y-axis` }
                transform={ `translate(${plotLeft - 6},0)` }
            />
            <g className='diff-areas'
                clipPath={ `url(#clip${plotId})` }
            />
            <g className='plotPaths'
                clipPath={ `url(#clip${plotId})` }
                fill='none'
                strokeWidth={ d3PlotConfig.strokeWidth }
                strokeLinecap={ d3PlotConfig.strokeLinecap }
                strokeLinejoin={ d3PlotConfig.strokeLinejoin }
                strokeOpacity={ d3PlotConfig.strokeOpacity }
                onTouchStart={ event => event.preventDefault() }
            />
            <g className='plotTooltip' display='none'>
                <line
                    stroke={ d3PlotConfig.textColor }
                    strokeOpacity='0.5'
                    strokeWidth='1'
                    y1={plotTop}
                    y2={plotBottom}
                />
                <g className='tooltipX'>
                    <path
                        fill={ d3PlotConfig.tooltipBgColor }
                        stroke={ d3PlotConfig.textColor }
                    />
                    <text
                        transform='translate(0,22)'
                        fill={ d3PlotConfig.textColor }
                        fontSize={ d3PlotConfig.tooltipFontSize }
                        textAnchor='middle'
                    />
                </g>
                <g className='tooltipY'>
                    <path
                        fill={ d3PlotConfig.tooltipBgColor }
                        stroke={ d3PlotConfig.textColor }
                    />
                    <circle cx='4' cy='4' r='4' stroke='none' fill={ getPlotColor('A', diff) } transform='translate(10,7)' />
                    <text
                        className='tooltipYA'
                        transform='translate(10,15)'
                        fill={ d3PlotConfig.textColor }
                        fontSize={ d3PlotConfig.tooltipFontSize }
                    >
                        <tspan className='label' fontSize='0.846154em' dx='16px'>{ dsNames[0] }:</tspan>
                        <tspan className='value' x='0' dy='21' />
                    </text>
                    <circle cx='4' cy='4' r='4' stroke='none' fill={ getPlotColor('B', diff) } transform='translate(10,49)' display={ isDiff ? null : 'none' } />
                    <text
                        className='tooltipYB'
                        transform='translate(10,57)'
                        fill={ d3PlotConfig.textColor }
                        fontSize={ d3PlotConfig.tooltipFontSize }
                        display={ isDiff ? null : 'none' }
                    >
                        <tspan className='label' fontSize='0.846154em' dx='16px'>{ dsNames[1] }:</tspan>
                        <tspan className='value' x='0' dy='21' />
                    </text>
                </g>
            </g>
        </svg>
    );
});


export { D3Plot };
