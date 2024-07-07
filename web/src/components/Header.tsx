// NPM packages
import React, { useState } from 'react';
import { observer } from 'mobx-react';
import { AppBar, Toolbar, Card, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';

// All other imports
import { useServices } from 'services';
import { ActionsSet, OpenCloseButton, ColorDot } from 'components';
import { secondsTo } from 'utils';
import { ExpandState } from 'models/MiscTypes';
import { nonDiff, removed, added } from 'resources/constants';
import { commonStyles } from 'styles/commonStyles';


const useStyles = makeStyles(theme => ({
    root: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        width: '100%',
        marginBottom: theme.spacing(1),
        backgroundColor: theme.palette.background.default,
    },
    toolbar: {
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: theme.spacing(1),
        paddingBottom: theme.spacing(1),
        [theme.breakpoints.down('md')]: {
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-end',
        },
    },
    title: {
        flex: 1,
        margin: '0',
        color: theme.palette.text.primary,
        fontSize: '1.125rem',
        [theme.breakpoints.down('md')]: {
            flexShrink: 0,
            maxWidth: '100%',
            overflowX: 'auto',
            textOverflow: 'unset',
        },
    },
    argcolordot: {
        position: 'relative',
        top: '0.6em',
    },
    actionSet: {
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'space-between',
        '& > *': {
            marginLeft: `${theme.spacing(1)}px !important`,
        },
        [theme.breakpoints.down('md')]: {
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'left',
            marginBottom: theme.spacing(2),
            '& > *': {
                marginLeft: '0',
                marginBottom: `${theme.spacing(1)}px !important`,
            }
        },
    },
    metadataPanel: {
        width: '100%',
        padding: `${ theme.spacing(1) }px ${ theme.spacing(8) }px`,
        overflowX: 'auto',
        '& p': {
            fontSize: '0.75rem',
        },
        [theme.breakpoints.down('sm')]: {
            paddingLeft: theme.spacing(2),
            paddingRight: theme.spacing(2),
        },
    },
    panelButton: {
        bottom: '0',
        transform: 'translate(50%,50%)',
    },
    metadataPanelButton: {
        right: '50%',
    },
}));

const Title = observer(() => {
    const classes = useStyles();
    const commonClasses = commonStyles();
    const { dataService } = useServices();
    let pathA = '';
    let nameA = 'ncreview';
    let pathB = '';
    let nameB = '';
    let colorA = removed;
    let colorB = added;

    if (dataService.data) {
        pathA = dataService.data.paths['A'];
        nameA = dataService.data.names['A'];
        if (dataService.data.paths['B']) {
            pathB = dataService.data.paths['B'];
            nameB = ( dataService.data.names['B'] ? dataService.data.names['B'] : "" );
        }
        else {
            colorA = `${nonDiff}_line`;
        }
    }

    return (
        <Typography variant="h1" className={ classes.title } noWrap>
            <span title={ pathA }><b>{ nameA }</b>{( pathA ? <>:&nbsp;&nbsp;&nbsp; { pathA }</> : <></> )}</span>
            {( pathA ? <span className={ clsx(classes.argcolordot, commonClasses[colorA]) } title={ `Color related to ${ nameA }` }>&nbsp;&nbsp;&nbsp;&nbsp;<ColorDot /></span> : <></> )}
            {( nameB ? <br/> : <></> )}
            <span title={ pathB }><b>{ nameB }</b>{( pathB ? <>:&nbsp;&nbsp;&nbsp; { pathB }</> : <></> )}</span>
            {( nameB ? <span className={ clsx(classes.argcolordot, commonClasses[colorB]) } title={ `Color related to ${ nameB }` }>&nbsp;&nbsp;&nbsp;&nbsp;<ColorDot /></span> : <></> )}
        </Typography>
    );
});

const MetadataPanelText = observer(() => {
    const { dataService } = useServices();
    const dataSource = dataService.dataSource;

    let text = <Typography>Data Source:&nbsp;&nbsp;&nbsp;&nbsp;{ dataSource }</Typography>
    if (dataService.data) {
        const date = ( dataService.data['review_date'] ? (new Date(dataService.data['review_date'] * 1000)).toString() : "" );
        const interval = secondsTo(dataService.data['sample_interval']);
        const version = dataService.data['version'];
        const commandLine = dataService.data['command'];
        text = 
            <Typography>
                     Date:&nbsp;&nbsp;&nbsp;&nbsp;{ date }
                <br/>Sample Interval:&nbsp;&nbsp;&nbsp;&nbsp;{ interval }
                <br/>Command:&nbsp;&nbsp;&nbsp;&nbsp;{ commandLine }
                <br/>Version:&nbsp;&nbsp;&nbsp;&nbsp;{ version }
            </Typography>
    }

    return text;
});

type MetadataPanelProps = {
    metadataPanelOpen: boolean,
}

const MetadataPanel = ({ metadataPanelOpen }: MetadataPanelProps) => {
    const classes = useStyles();
    const commonClasses = commonStyles();

    return (
        <Card className={ clsx(classes.metadataPanel, !metadataPanelOpen && commonClasses.hide) }>
            <MetadataPanelText />
        </Card>
    );
};

type HeaderProps = {
    legendOpen: boolean,
    setLegendOpen: (legendOpen: boolean)=>void,
    expandSections: ExpandState,
    setExpandSections: (expandSections: ExpandState)=>void,
    isDiff: boolean,
}

const Header = ({ legendOpen, setLegendOpen, expandSections, setExpandSections, isDiff }: HeaderProps) => {
    const classes = useStyles();

    const [ metadataPanelOpen, setMetadataPanelOpen ] = useState(true);

    return (
        <AppBar position="static" classes={ { "positionStatic": classes.root } }>
            <Toolbar classes={ { "root": classes.toolbar } }>
                <Title />
                <ActionsSet
                    legendOpen={ legendOpen }
                    setLegendOpen={ setLegendOpen }
                    expandSections={ expandSections }
                    setExpandSections={ setExpandSections }
                    isDiff={ isDiff }
                    className={ classes.actionSet }
                />
                <OpenCloseButton
                    elemOpen={ metadataPanelOpen }
                    setElemOpen={ setMetadataPanelOpen }
                    hoverText="Toggle metadata panel"
                    className={ clsx(classes.panelButton, classes.metadataPanelButton) }
                />
            </Toolbar>
            <MetadataPanel metadataPanelOpen={ metadataPanelOpen } />
        </AppBar>
    );
};

export { Header };
