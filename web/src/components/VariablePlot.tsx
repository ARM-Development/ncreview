import React, { useState, useRef } from 'react';
import { observer } from 'mobx-react';
import {Button, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';

// All other imports
import { DatastreamNames, DatastreamPaths } from 'services';
import { StatusIndicator, D3StateProxy, OpenCloseButton } from 'components';
import { LoadStatus } from 'models/MiscTypes';


const useStyles = makeStyles(theme => ({
    varPlotContainer: {
        width: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    varPlotBtnRow: {
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        [theme.breakpoints.down('md')]: {
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
        },
    },
    plotBtn: {
        flex: '0 0 auto',
        width: 'auto',
        padding: `${theme.spacing(1)}px ${theme.spacing(2)}px`,
        backgroundColor: theme.palette.primary.dark,
        lineHeight: 1,
        '&:hover': {
            backgroundColor: theme.palette.background.paper,
            color: '#ffffff',
        },
    },
    loadBtn: {},
    cancelBtn: {
        backgroundColor: theme.palette.warning.light,
        color: theme.palette.warning.contrastText,
    },
    inactiveBtn: {
        display: 'none',
    },
    varPlotAdvisory: {
        flex: '1 1 auto',
        paddingLeft: theme.spacing(4),
        paddingRight: theme.spacing(8),
        [theme.breakpoints.down('md')]: {
            padding: 0,
            marginTop: theme.spacing(1),
        },
        '& span': {
            fontSize: '0.75rem',
        },
    },
    varPlotToggle: {
        top: `${theme.spacing(1)/2}px`,
        right: `${theme.spacing(1)}px`,
    },
    plotCaption: {
        textAlign: 'center',
    },
    varPlot: {
        display: 'block',
        width: '100%',
        marginBottom: `${theme.spacing(1)}px`,
    },
}));


type VariablePlotData = {
    "cmd": string,
    "plot": string,
    "error": string,
};

async function loadVariablePlot(dsPath, varName: string, beginTime: string, endTime: string, controller: AbortController): Promise<VariablePlotData>
{
    let cmd = `${process.env.REACT_APP_URL_PREFIX}/plotvar.php?dir=${dsPath}&var=${varName}`;
    if (beginTime)
        cmd += `&beg=${beginTime}`;
    if (endTime)
        cmd += `&end=${endTime}`;

    const signal = controller.signal;

    const response = await fetch(
        cmd,
        {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            signal
        }
    );
    if (response.ok) {
        return await response.json();
    }
    else {
        return {
            'cmd': '',
            'plot': '',
            'error': `Command failed with response: ${response.status} (${response.statusText})`,
        };
    }
}

type VariablePlotDisplayProps = {
    dsName: string,
    varName: string,
    statusMsg: LoadStatus,
    plotData: (VariablePlotData|null),
}

const VariablePlotDisplay = observer(({ dsName, varName, statusMsg, plotData }: VariablePlotDisplayProps) => {
    const classes = useStyles();

    return (
        <>
            { statusMsg !== null &&
            <>
            <br/>
            { plotData && plotData['cmd'] &&
            <Typography className={ classes.plotCaption } gutterBottom={ true }><b>Command:</b> { plotData['cmd'] }</Typography>
            }
            <StatusIndicator statusMsg={ statusMsg } />
            </>
            }
            { plotData && plotData['plot'] &&
            <img
                src={ `data:image/png;charset=utf-8;base64, ${ plotData['plot'] }` }
                alt={ `Plot of variable ${ varName } data for ${ dsName }` }
                className={ classes.varPlot }
            />
            }
        </>
    );
});


interface VariablePlotAdvisoryProps {
    beginDate: string;
    endDate: string;
}
const VariablePlotAdvisory = ({ beginDate, endDate }: VariablePlotAdvisoryProps) => {
    const classes = useStyles();

    const advisoryText = <>Currently selected to load: <b>{beginDate}&ndash;{endDate}</b>. <span>(Plotting large amounts of data will result in long wait times and heavy loads on the server. For best results, select limited time frames from the plot above.)</span></>;

    return (
        <Typography className={classes.varPlotAdvisory} noWrap>
            {advisoryText}
        </Typography>
    );
};


interface VariablePlotProps {
    dsNames: DatastreamNames,
    dsPaths: DatastreamPaths,
    varName: string,
    d3StateProxy: D3StateProxy,
}

const VariablePlot = observer(({ dsNames, dsPaths, varName, d3StateProxy }: VariablePlotProps) => {
    const classes = useStyles();

    if (!varName)
        return ( <></> );

    const [ statusMsgA, setStatusMsgA ] = useState(null as LoadStatus);
    const [ statusMsgB, setStatusMsgB ] = useState(null as LoadStatus);
    const [ controllerA, setControllerA ] = useState(null as (AbortController|null));
    const [ controllerB, setControllerB ] = useState(null as (AbortController|null));
    const [ plotDataA, setPlotDataA ] = useState(null as (VariablePlotData|null));
    const [ plotDataB, setPlotDataB ] = useState(null as (VariablePlotData|null));
    const [ showPlots, setShowPlots ] = useState(true);

    const loading = ( statusMsgA === 'loading' || statusMsgB === 'loading' );
    const controllerARef = useRef(controllerA);
    const controllerBRef = useRef(controllerB);
    const [minX, maxX] = d3StateProxy.getPlotExtents();

    const loadPlots = () => {
        setPlotDataA(null);
        setStatusMsgA('loading');
        if (dsPaths[1]) {
            setPlotDataB(null);
            setStatusMsgB('loading');
        }
        const [minX, maxX] = d3StateProxy.getPlotExtents();
        controllerARef.current = new AbortController();
        setControllerA(controllerARef.current);
        loadVariablePlot(dsPaths[0], varName, minX, maxX, controllerARef.current as AbortController)
            .then(p => {
                setPlotDataA(p);
                setStatusMsgA( p.error ? p.error : 'success' );
                setControllerA(null);
            })
            .catch(e => {
                setStatusMsgA(null);
            });
        if (dsPaths[1]) {
            controllerBRef.current = new AbortController();
            setControllerB(controllerBRef.current);
            loadVariablePlot(dsPaths[1], varName, minX, maxX, controllerBRef.current as AbortController)
                .then(p => {
                    setPlotDataB(p);
                    setStatusMsgB( p.error ? p.error : 'success' );
                    setControllerB(null);
                })
                .catch(e => {
                    setStatusMsgB(null);
                });
        }
    };

    const cancelLoad = () => {
        if (controllerARef.current)
            controllerARef.current.abort();
        if (controllerBRef.current)
            controllerBRef.current.abort();
        setControllerA(null);
        setControllerB(null);
    };

    return (
        <div className={classes.varPlotContainer}>
            <div className={classes.varPlotBtnRow}>
                { !loading &&
                <Button
                    variant="outlined"
                    size="small"
                    aria-label="Load variable data plot (rendered by ACT), using currently displayed plot area"
                    title="Load variable data plot (rendered by ACT), using currently displayed plot area"
                    onClick={ loadPlots }
                    disabled={ loading ? true : false }
                    className={ clsx( classes.plotBtn, classes.loadBtn, loading && classes.inactiveBtn ) }
                >
                    Load Variable Data Plot
                </Button>
                }
                { loading &&
                <Button
                    variant="outlined"
                    size="small"
                    aria-label="Cancel request for variable data plot(s)"
                    title="Cancel request for variable data plot(s)"
                    onClick={ cancelLoad }
                    disabled={ !loading ? true : false }
                    className={ clsx( classes.plotBtn, classes.cancelBtn, !loading && classes.inactiveBtn ) }
                >
                    Cancel Plot Load
                </Button>
                }
                <VariablePlotAdvisory beginDate={ minX } endDate={ maxX } />
                <OpenCloseButton elemOpen={ showPlots } setElemOpen={ setShowPlots } hoverText="Show/hide variable plot" className={ classes.varPlotToggle } />
            </div>
            { showPlots &&
            <VariablePlotDisplay dsName={ dsNames[0] } varName={ varName } statusMsg={ statusMsgA } plotData={ plotDataA } />
            }
            { dsNames[1] && showPlots &&
            <VariablePlotDisplay dsName={ dsNames[1] } varName={ varName } statusMsg={ statusMsgB } plotData={ plotDataB } />
            }
        </div>
    );
});

export { VariablePlot };