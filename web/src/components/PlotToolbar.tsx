// NPM packages
import React from 'react';
import { observer } from 'mobx-react';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';

// All other imports
import { ToggleButton, D3StateProxy } from 'components';


const useStyles = makeStyles(theme => ({
    plotToolbar: {
        position: 'absolute',
        top: 0,
        width: '100%',
        padding: '2px 30px 0',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'flex-end',
        '& > *': {
            marginLeft: theme.spacing(1),
        },
        zIndex: 100,
    },
    toolPanelButton: {
        paddingTop: '2px',
        paddingBottom: '0px',
        backgroundColor: theme.palette.background.paper,
        whiteSpace: 'nowrap',
    },
}));


type PlotToolbarProps = {
    d3StateProxy: D3StateProxy,
    className?: string,
}

const PlotToolbar = observer(({ d3StateProxy, className }: PlotToolbarProps) => {
    const classes = useStyles();

    const dynamicYBtnOnElem = ( d3StateProxy.dynamicY ? <span>Y-Axis &rarr; Absolute</span> : <span>Y-Axis &rarr; Relative</span> );
    const dynamicYBtnOffElem = dynamicYBtnOnElem;
    const dynamicYBtnHoverText =`Toggle y-axis domain. Absolute = always sized to range of entire dataset. Relative = resizes to range of data visible when zoomed in/out.`;
    const dynamicYHandler = (yState: boolean) => { // Because React has to make everything difficult, and it takes forever to figure out how to pass things around *just* right to make it happy.
        d3StateProxy.setDynamicY(yState); // So let's call 3 functions to execute one (plus all the functions React calls)...
    }

    return (
        <div className={ clsx( classes.plotToolbar, className ) }>
            <ToggleButton
                onState={ d3StateProxy.dynamicY }
                setOnState={ dynamicYHandler }
                onElem={ dynamicYBtnOnElem }
                offElem={ dynamicYBtnOffElem }
                hoverText={ dynamicYBtnHoverText }
                className={ classes.toolPanelButton }
            />
        </div>
    );
});

export { PlotToolbar };
