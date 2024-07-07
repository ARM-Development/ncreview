// NPM packages
import React, { useEffect, useState, useRef } from 'react';
import { makeObservable, observable, action } from 'mobx';
import { observer } from 'mobx-react';

// All other imports
import { useServices, DatastreamNames, DatastreamPaths, DataIds } from 'services';
import { IComponentData, PlotData } from 'models/NCReviewData';
import { StatusIndicator, D3Plot, DataTable, PlotToolbar, VariablePlot } from 'components';
import { RowData } from './DataTable';
import { LoadStatus } from 'models/MiscTypes';

// All other imports
import {
    noData,
} from 'resources/constants';
import {
    capitalize,
    format, NumFormat,
    dateToYYYYMMDD,
    getDiff
} from 'utils';


// TODO: Move to D3Plot when that's converted to Typescript
class D3StateProxy
{

    plotDataA: PlotData|undefined;
    plotDataB: PlotData|undefined;
    activePlot: number;
    labels: string[];
    dataFormats: NumFormat[];
    rowsValues: RowData[];
    rowDiffs: [string[], string[]];
    activeIndex: number;
    chartWidth: number;
    zoomXMin: string;
    zoomXMax: string;
    dynamicY: boolean; // true: y-axis sizes to data; false: y-axis always based at 0 (or min y)

    constructor()
    {
        this.plotDataA = undefined;
        this.plotDataB = undefined;
        this.activePlot = 0;
        this.labels = [''];
        this.dataFormats = ['int']
        this.rowsValues = [];
        this.initRowsValues();
        this.rowDiffs = [[],[]];
        this.activeIndex = -1;
        this.chartWidth = 1200;
        this.zoomXMin = '19700101';
        this.zoomXMax = '99991231';
        this.dynamicY = true;

        makeObservable(this, {
            activePlot: observable,
            activeIndex: observable,
            rowsValues: observable,
            chartWidth: observable,
            zoomXMin: observable,
            zoomXMax: observable,
            dynamicY: observable,
            setActivePlot: action,
            setActiveIndex: action,
            setRowsValues: action,
            setChartWidth: action,
            setPlotExtents: action,
            setDynamicY: action,
        })
    }

    setPlotData(plotData: IComponentData)
    {
        this.plotDataA = ( plotData.A.data as PlotData[] )[0];
        this.plotDataB = ( plotData.B ? ( plotData.B.data as PlotData[] )[0] : undefined );
        const dataLabels = this.plotDataA.labels;

        this.plotDataA.tooltips.forEach((tooltip, i) => {
            this.labels.push(this.formatLabel(tooltip, dataLabels[i]));
            this.dataFormats.push( 
                tooltip.toLowerCase().startsWith('number of') || tooltip.toLowerCase().startsWith('bit') ||
                dataLabels[i].toLowerCase().startsWith('bit') || dataLabels[i].toLowerCase().startsWith('flag') ?
                'int' :
                'float6'
            );
        });

        this.setRowsValues();

        if (dataLabels.includes('mean')) {
            this.setActivePlot(dataLabels.indexOf('mean'));
        }
    }

    formatLabel(tooltip: string, dataLabel: string): string
    {
        const labelPrefix = `${( dataLabel.toLowerCase().startsWith('bit') ? `${capitalize(dataLabel)}: ` : "" )}`;
        let label = `${labelPrefix}${tooltip}`;
        if (label.toLowerCase().startsWith('bit'))
            label = label.split(':')[0];
        return label;
    }

    initRowsValues()
    {
        this.rowsValues = [['arg 1']];
        if (this.plotDataB) this.rowsValues.push(['arg 2']);
    }

    setRowsValues()
    {
        let fmt: NumFormat = 'int';
        let valueB: number|null = null;
        const lenData = this.plotDataA!.values.length;
        const _activeIndex = ( this.activeIndex >= lenData ? this.activeIndex - lenData : this.activeIndex );

        this.rowDiffs = [[''],['']];

        if (this.activeIndex > -1) {
            this.initRowsValues();
            this.plotDataA!.values[_activeIndex][2].forEach((valueA, i) => {
                fmt = this.dataFormats[i+1];
                this.rowsValues[0].push( valueA !== null ? format(valueA,fmt) : noData );
                if (this.plotDataB) {
                    valueB = this.plotDataB.values[_activeIndex][2][i];
                    this.rowsValues[1].push( valueB !== null ? format(valueB,fmt) : noData );
                    this.setRowDiffs(valueA, valueB);
                }
            });
        }
        else {
            this.initRowsValues();
            if (this.plotDataA) {
                for (let i=1; i < this.labels.length; i++) {
                    this.rowsValues[0].push('');
                    if (this.plotDataB) {
                        this.rowsValues[1].push('');
                    }
                }
            }
        }
    }

    setRowDiffs(valueA: number|null, valueB: number|null)
    {
        const diff = getDiff(valueA, valueB);
        this.rowDiffs[0].push(valueA === null ? '' : diff);
        this.rowDiffs[1].push(valueB === null ? '' : diff);
    }

    setActivePlot(newIndex: number)
    {
        this.activePlot = newIndex;
    }

    setActiveIndex(newIndex: number)
    {
        this.activeIndex = newIndex;
        this.setRowsValues();
    }

    setChartWidth(w: number)
    {
        this.chartWidth = w;
    }

    getPlotExtents(): [string, string]
    {
        return [ this.zoomXMin, this.zoomXMax ];
    }

    setPlotExtents(xMin: Date, xMax: Date)
    {
        this.zoomXMin = dateToYYYYMMDD(xMin);
        this.zoomXMax = dateToYYYYMMDD(xMax);
    }

    setDynamicY(yState: boolean)
    {
        this.dynamicY = yState;
    }
}

let uniqueId = 0;

// These are ugly, but get it done. I'm not sure there's a better way to distinguish
//   which data is displayed in non-diff plots (added, removed) on diffDatastreams.
function _getDatastreams(srcData, dataService): {names: DatastreamNames, paths: DatastreamPaths}
{
    const datastreamNames = dataService.getDatastreamNames();
    const datastreamPaths = dataService.getDatastreamPaths();
    let dsNames: DatastreamNames = ['', ''];
    let dsPaths: DatastreamPaths = ['', ''];
    if (srcData.paths) {
        dsNames = datastreamNames;
        dsPaths = datastreamPaths;
    }
    else if (srcData.path && srcData.path === datastreamPaths[1]) {
        dsNames[0] = datastreamNames[1];
        dsPaths[0] = datastreamPaths[1];
    }
    else {
        dsNames[0] = datastreamNames[0];
        dsPaths[0] = datastreamPaths[0];
    }
    return {
        names: dsNames,
        paths: dsPaths
    };
}

const Plot = observer(({ srcData }) => {
    const { dataService } = useServices();

    const [ dataLoaded, setDataLoaded ] = useState(false);
    const [ dataIds, ] = useState((): DataIds => dataService.getDataIds(srcData));
    const [ datastreams, ] = useState((): {names: DatastreamNames, paths: DatastreamPaths} => _getDatastreams(srcData, dataService));
    const [ plotId, ] = useState(++uniqueId);
    const [ plotData, setPlotData ] = useState({} as Partial<IComponentData>);
    const statusMsg: LoadStatus = dataService.getDataDetailsStatus(dataIds);

    const plotParent = useRef<HTMLDivElement>(null);
    const d3StateProxy = new D3StateProxy();
    if (dataLoaded) {
        d3StateProxy.setPlotData(plotData as IComponentData);
    }
    if (plotParent.current) {
        d3StateProxy.setChartWidth(plotParent.current.offsetWidth);
    }

    useEffect(() => {
        if (statusMsg === null) {
            dataIds.forEach((dataId) => {
                dataService.loadDataDetail(dataId, srcData.type);
            });
        }
        else if (statusMsg === 'success') {
            if (!dataLoaded) {
                const dataDetailA = dataService.dataDetails[dataIds[0]];
                const dataDetailB = ( dataIds.length > 1 ? dataService.dataDetails[dataIds[1]] : undefined );
                setPlotData({
                    'A': dataDetailA,
                    'B': dataDetailB
                } as IComponentData);
                // TODO: If memory becomes an issue, then
                //         have this reconfigure A,B data as needed (a 3rd, combined copy);
                //         then delete the DataService.dataDetails cop(y/ies).
                //         Does that help?
                setDataLoaded(true);
            }
        }
    }, [statusMsg, dataLoaded, dataIds, dataService, srcData]);

    return (
        <div ref={ plotParent } style={{ position: 'relative' }}>
            <StatusIndicator statusMsg={ statusMsg } />
            { dataLoaded &&
            <>
            <PlotToolbar
                d3StateProxy={ d3StateProxy }
            />
            <D3Plot
                plotData={ plotData }
                dsNames={ datastreams.names }
                diff={ srcData.difference }
                plotId={ plotId }
                d3StateProxy={ d3StateProxy }
            />
            <DataTable
                d3StateProxy={ d3StateProxy }
            />
            <VariablePlot
                dsNames={ datastreams.names }
                dsPaths={ datastreams.paths }
                varName={ srcData.varName }
                d3StateProxy={ d3StateProxy }
            />
            </>
            }
        </div>
    ); 
});

export { Plot, D3StateProxy };
