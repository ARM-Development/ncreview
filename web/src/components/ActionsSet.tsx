// NPM packages
import React from 'react';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';

// All other imports
import { ToggleButton, LinkToOriginalNCR } from 'components';
import { ExpandState } from 'models/MiscTypes';


const useStyles = makeStyles(theme => ({
    actionSet: {},
    toolPanelButton: {
        paddingTop: '2px',
        paddingBottom: '0px',
        backgroundColor: theme.palette.background.paper,
        whiteSpace: 'nowrap',
    },
}));


type ActionsSetProps = {
    legendOpen: boolean,
    setLegendOpen: (legendOpen: boolean)=>void,
    expandSections: ExpandState,
    setExpandSections: (expandSections: ExpandState)=>void,
    isDiff: boolean,
    className?: string,
}

const ActionsSet = ({ legendOpen, setLegendOpen, expandSections, setExpandSections, isDiff, className }: ActionsSetProps) => {
    const classes = useStyles();

    const expandBtnOnElem = ( isDiff ? <span>Changed Sections</span> : <span>All Sections</span> );
    const expandBtnOffElem = expandBtnOnElem;
    const expandBtnHoverText =`Expands or collapses ${ isDiff ? "" : "all " }sections${ isDiff ? " containing changes" : "" }. \nNote! This may be a slow operation, or cause the page to freeze.`;

    const legendBtnOnElem = <span>Legend</span>;
    const legendBtnOffElem = <span>Legend</span>;
    const legendBtnHoverText = "Show or hide the legend sidebar";

    return (
        <div className={ clsx( classes.actionSet, className ) }>
            <LinkToOriginalNCR />
            <ToggleButton
                onState={ expandSections }
                setOnState={ setExpandSections }
                onElem={ expandBtnOnElem }
                offElem={ expandBtnOffElem }
                startIcon={ expandSections ? <ExpandLessIcon /> : <ExpandMoreIcon /> }
                hoverText={ expandBtnHoverText }
                className={ classes.toolPanelButton }
            />
            <ToggleButton
                onState={ legendOpen }
                setOnState={ setLegendOpen }
                onElem={ legendBtnOnElem }
                offElem={ legendBtnOffElem }
                startIcon={ legendOpen ? <ChevronRightIcon /> : <ChevronLeftIcon /> }
                hoverText={ legendBtnHoverText }
                className={ classes.toolPanelButton }
            />
        </div>
    );
};

export { ActionsSet };
