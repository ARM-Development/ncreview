// NPM packages
import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import Highcharts from 'highcharts/highstock';
import HighchartsGantt from 'highcharts/highcharts-gantt';
import highchartsMore from 'highcharts/highcharts-more';
import highchartsNoData from 'highcharts/modules/no-data-to-display';
import highchartsBoost from 'highcharts/modules/boost';
import highchartsDarkTheme from 'highcharts/themes/gray';

// All other imports
import { useServices } from 'services';
import { redrawCharts } from 'utils';
import { ExpandState } from 'models/MiscTypes';
import { Header, Legend, DataView } from 'components';
import { loadingText, emptyText } from 'resources/constants';


highchartsMore(Highcharts);
highchartsNoData(Highcharts);
highchartsDarkTheme(Highcharts);
highchartsBoost(Highcharts);
Highcharts.setOptions({
    chart: {
        animation: false,
    },
    plotOptions: {
        series: {
            animation: false,
        },
        area: {
            animation: {
                duration: 0,
            }
        },
    },
    title: {
        text: "",
    },
    lang: {
        loading: loadingText,
        noData: emptyText,
    },
    loading: {
        hideDuration: 0,
        showDuration: 0,
    },
});
highchartsMore(HighchartsGantt);
highchartsNoData(HighchartsGantt);
highchartsDarkTheme(HighchartsGantt);
highchartsBoost(HighchartsGantt);
HighchartsGantt.setOptions({
    chart: {
        animation: false,
    },
    plotOptions: {
        series: {
            animation: false,
            showInNavigator: true,
        }
    },
    title: {
        text: "",
    },
    lang: {
        loading: loadingText,
        noData: emptyText,
    },
});
// Enable colorization of series marker icon in Gantt chart legends
// https://www.highcharts.com/forum/viewtopic.php?f=19&t=47917&p=172832
(function(H) {
    H.wrap(H.Legend.prototype, 'colorizeItem', function(this, proceed, item, visible) {
        const color = item.color;

        item.color = item.options.legendColor;
        proceed.apply(this, Array.prototype.slice.call(arguments, 1));
        item.color = color;
    });
}(HighchartsGantt));

declare module 'highcharts/highstock' {
    interface Series {
        yData: [number,number][]|number[],
    }
    interface Point {
        high: number,
        low: number,
    }
}
declare module 'highcharts/highcharts-gantt' {
    interface SeriesXrangeOptions {
        legendColor?: (Highcharts.ColorString|Highcharts.GradientColorObject|Highcharts.PatternObject),
    }
}


const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    paddingBottom: theme.spacing(3),
    color: theme.palette.text.primary,
  },
  legendOpen: {
    paddingRight: '200px',
    [theme.breakpoints.down('sm')]: {
        paddingRight: '0',
    },
  },
}));


const App = observer(() => {
    const classes = useStyles();
    const { dataService } = useServices();
    const [ legendOpen, setLegendOpen ] = useState(false);
    const [ isDiff, setIsDiff ] = useState(false);
    const [ expandSections, setExpandSections ] = useState(false as ExpandState);

    useEffect(() => {
        if ( dataService.reviewType === 'datastreamDiff' )
            setIsDiff(true);
    }, [dataService.reviewType, setIsDiff]);

    function toggleLegend(notLegendOpen) {
        setLegendOpen(notLegendOpen);
        redrawCharts();
    }

    return (
        <div className={ clsx( classes.root, legendOpen && classes.legendOpen ) }>
            <Header
                legendOpen={ legendOpen }
                setLegendOpen={ toggleLegend }
                expandSections={ expandSections }
                setExpandSections={ setExpandSections }
                isDiff={ isDiff }
            />
            <DataView
                expandSections={ expandSections }
                isDiff={ isDiff }
            />
            <Legend
                legendOpen={ legendOpen }
                setLegendOpen={ toggleLegend }
                isDiff={ isDiff }
            />
        </div>
    );
})

export default App;
