// NPM packages
import React, { useState } from 'react';
import {
    Accordion as MuiAccordion,
    AccordionSummary as MuiAccordionSummary,
    AccordionDetails as MuiAccordionDetails,
    Typography
    } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { makeStyles, withStyles } from '@material-ui/core/styles';
import clsx from 'clsx';

// All other imports
import { renderContents } from 'components';
import { NCReviewComponent, ISection, IGroupDiff, DiffType } from 'models/NCReviewData';
import { ExpandState } from 'models/MiscTypes';
import { nonDiff, same } from 'resources/constants';
import { commonStyles } from 'styles/commonStyles';


// Customized accordion, to control styles and transitions easily
const Accordion = withStyles((theme) => ({
    root: {
        border: '1px solid rgba(0, 0, 0, .125)',
        boxShadow: 'none',
        backgroundColor: 'transparent',
        color: theme.palette.text.primary,
        '&:not(:last-child)': {
            borderBottom: 0,
        },
        '&:before': {
            display: 'none',
        },
        '&$expanded': {
            margin: 0,
        },
        '& *': {
            transitionDuration: '0s!important',
        },
    },
    expanded: {},
}))(MuiAccordion);

const AccordionSummary = withStyles((theme) => ({
    root: {
        flexDirection: 'row-reverse',
        minHeight: 'unset',
        '&$expanded': {
            minHeight: 'unset',
        },
        backgroundColor: 'rgba(255,255,255,0.0075)',
        borderBottom: '1px solid rgba(0,0,0,0.0625)',
        padding: `0 ${theme.spacing(1)}px 0 0`
    },
    content: {
        marginTop: 0,
        marginBottom: 0,
        '&$expanded': {
            margin: 0,
        },
        '& .MuiTypography-body1': {
            fontSize: '0.875rem',
            fontWeight: 'bold',
        },
    },
    expanded: {
        margin: 0,
        minHeight: 'unset',
    },
    expandIcon: {
        marginRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
    },
}))(MuiAccordionSummary);

const AccordionDetails = withStyles((theme) => ({
    root: {
        marginLeft: theme.spacing(4),
        padding: `0 0 ${theme.spacing(1)}px`,
        backgroundColor: theme.palette.background.default,
        overflowX: 'auto',
    },
}))(MuiAccordionDetails);


const useStyles = makeStyles(theme => ({
    section: {
        width: '99.5%',
    },
    sectionHeader: {
        flexShrink: 0,
    },
    addlHeaderContent: {
        paddingLeft: theme.spacing(2),
    },
    sectionSummary: {
        fontStyle: 'italic',
    },
    sectionContent: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
    },
    primaryReviewGroup: {
        backgroundColor: theme.palette.background.section,
        '& .MuiTypography-body1': {},
    },
    plotSection: {
        marginLeft: 0,
    },
}));


type SectionContent = NCReviewComponent|NCReviewComponent[]|React.ReactElement

type SectionProps = {
    srcData: ISection,
    staticContent?: boolean,
    className?: string,
    sectionSummary?: React.ReactElement,
    addlContent?: React.ReactElement,
    expandSections: ExpandState,
    isDiff: boolean,
}

const Section = ({ srcData, staticContent=false, className='', sectionSummary=<></>, addlContent=<></>, expandSections, isDiff }: SectionProps) => {
    const classes = useStyles();
    const commonClasses = commonStyles();

    const [ sectionLoaded, setSectionLoaded ] = useState(false);
    const [ expanded, setExpanded ] = useState(false as ExpandState);
    const [ previousExpandSections, setPreviousExpandSections ] = useState(false as ExpandState);
    const [ sectionContents, setSectionContents ] = useState(<></> as SectionContent);
    const [ sectionName, ] = useState(() => srcData['name']);
    const sectionId = sectionName.replace(/\s+/g, '_');
    const sectionDiff: DiffType = srcData.difference;
    const plotData = ( sectionName === 'Data' ? true : false );

    function loadSection() {
        if (!sectionLoaded) {
            if (staticContent) {
                setSectionContents(srcData['contents']);
            }
            else {
                setSectionContents(renderContents(srcData, undefined, expandSections, isDiff));
            }
            setSectionLoaded(true);
        }
    }

    if (previousExpandSections !== expandSections) {
        const newExpandSections = ( isDiff ? ( [nonDiff, same].includes(sectionDiff) ? false : expandSections ) : expandSections );
        if (previousExpandSections !== newExpandSections) {
            setExpanded(newExpandSections);
            setPreviousExpandSections(newExpandSections);
            if (newExpandSections === true)
                loadSection();
        }
    }

    return (
        <Accordion
            classes={{ 'root': classes.section }}
            onChange={ () => { loadSection(); setExpanded(!expanded); } }
            expanded={ expanded }
        >
            <AccordionSummary
                expandIcon={ <ExpandMoreIcon /> }
                aria-controls={ `dataSection-${sectionId}` }
                id={ `dataSection-${sectionId}` }
                classes={{ 'root': className }}
            >
                <Typography className={ clsx( classes.sectionHeader, commonClasses[sectionDiff] ) }>
                    { sectionName }
                    { sectionSummary }
                </Typography>
                <Typography className={ classes.addlHeaderContent }>
                    { addlContent }
                </Typography>
            </AccordionSummary>
            <AccordionDetails classes={{ 'root': clsx( classes.sectionContent, plotData && classes.plotSection ) }}>
                { sectionContents }
            </AccordionDetails>
        </Accordion>
    );
};

/**
  Section that contains summary data in the section header.
    Generates summary, and passes result to section.
*/
type GroupDiffProps = {
    srcData: IGroupDiff,
    className?: string,
    expandSections: ExpandState,
    isDiff: boolean,
}

const GroupDiff = ({ srcData, className="", expandSections, isDiff }: GroupDiffProps) => {
    const classes = useStyles();

    let sectionSummary = "";
    const nDiffs = srcData['nDiffs'];
    let nDiffsLabels: string[] = [];

    Object.keys(nDiffs).forEach((diffType) => {
        if (nDiffs[diffType] > 0) {
            nDiffsLabels.push(`${nDiffs[diffType]} ${diffType}`);
        }
    });
    if (nDiffsLabels.length)
        sectionSummary = ` (${nDiffsLabels.join(', ')})`;

    const sectionSummaryElem = <span className={ clsx( classes.addlHeaderContent, classes.sectionSummary ) }>{ sectionSummary }</span>;

    return (
        <Section
            srcData={ srcData }
            className={ className }
            sectionSummary={ sectionSummaryElem }
            expandSections={ expandSections }
            isDiff={ isDiff }
        />
    );
};

export { Section, GroupDiff };
