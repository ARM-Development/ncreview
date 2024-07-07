// NPM packages
import React from 'react';
import { Button, IconButton, SvgIcon } from '@material-ui/core';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';

// All other imports


const useStyles = makeStyles(theme => ({
    toggleButton: {},
    openCloseButton: {
        position: 'absolute',
        backgroundColor: 'rgba(0,0,0,0.25)',
        padding: '0',
    },
}));

const ToggleButton = ({ onState, setOnState, onElem=<span>On</span>, offElem=<span>Off</span>, startIcon=undefined as React.ReactNode, endIcon=undefined as React.ReactNode, hoverText="Switch state", className="" }) => {
    const classes = useStyles();

    function toggleState() {
        setOnState(!onState);
    }

    return (
        <Button
            variant="outlined"
            size="small"
            aria-label={ hoverText }
            title={ hoverText }
            startIcon={ startIcon }
            endIcon={ endIcon }
            className={ clsx( classes.toggleButton, className ) }
            onClick={ toggleState }
        >
            { onState ? onElem : offElem }
        </Button>
    );
};

const OpenCloseButton = ({ elemOpen, setElemOpen, hoverText="Toggle element", className="" }) => {
    const classes = useStyles();

    function toggleElement() {
        setElemOpen(!elemOpen);
    }

    return (
        <IconButton
            aria-label={ hoverText }
            title={ hoverText }
            className={ clsx( classes.openCloseButton, className ) }
            onClick={ toggleElement }
        >
            { elemOpen ? <ExpandLessIcon /> : <ExpandMoreIcon /> }
        </IconButton>
    );
};

const ColorSwatch = (props) => {
    return (
        <SvgIcon {...props}>
            <path d="M3,3 h16 a3,3 0 0 1 3,3 v16 a3,3 0 0 1 -3,3 h-16 a3,3 0 0 1 -3,-3 v-16 a3,3 0 0 1 3,-3 z" />
        </SvgIcon>
    );
}

const ColorDot = (props) => {
    return (
        <SvgIcon {...props}>
            <circle cx="6" cy="6" r="6" />
        </SvgIcon>
    );
}

const MiniColorDot = (props) => {
    return (
        <SvgIcon {...props}>
            <circle cx="3" cy="3" r="3" />
        </SvgIcon>
    );
}

export { ToggleButton, OpenCloseButton, ColorSwatch, ColorDot, MiniColorDot };