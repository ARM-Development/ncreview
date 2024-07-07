// NPM packages
import React, { useState } from 'react';
import { Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';

// All other imports
import { useServices } from 'services';
import { commonStyles } from 'styles/commonStyles';


const useStyles = makeStyles(theme => ({
    staticValue: {
        marginLeft: theme.spacing(6.25),
        fontSize: '0.875rem',
    },
    staticValueHeading: {},
    expanded: {
        display: 'block',
        paddingLeft: theme.spacing(3.125),
    }
}));

function isLongString(value, maxChars): boolean {
    return ( typeof value === 'string' && value.length > maxChars );
}

const DataValue = ({ value, maxChars, truncated }) => {
    if (value === null || value.length !== undefined && !value.length) {
        return ( <i>none</i> );
    }
    else if (isLongString(value, maxChars) && truncated) {
        return ( value.slice(0, maxChars) + "..." );
    }
    else {
        return ( value );
    }
}

const StaticValueWrapper = ({ children, heading, diffType, truncate, truncated, setTruncated }) => {
    const classes = useStyles();
    const commonClasses = commonStyles();
    const headingClass = commonClasses[diffType];

    function toggleTruncation() {
        setTruncated(!truncated);
    }

    return (
        <Typography className={ classes.staticValue } onClick={ truncate ? toggleTruncation : undefined }>
            <b className={ clsx( classes.staticValueHeading, headingClass) }>{ heading }:</b>&nbsp;&nbsp;&nbsp;
            { children }
        </Typography>
    );
};

const StaticValue = ({ srcData }) => {
    const maxChars = 80;
    const truncate = isLongString(srcData.value, maxChars);
    const [ truncated, setTruncated ] = useState(truncate);

    return (
        <StaticValueWrapper
            heading={ srcData.name }
            diffType={ srcData.difference }
            truncate={ truncate }
            truncated={ truncated }
            setTruncated={ setTruncated }
        >
            <DataValue value={ srcData.value } maxChars={ maxChars} truncated={ truncated } />
        </StaticValueWrapper>
    );
};

const StaticValueDiff = ({ srcData }) => {
    const classes = useStyles();
    const { dataService } = useServices();

    const datastreamNames = dataService.getDatastreamNames();
    const maxChars = 40;
    const truncate = true;
    const [ truncated, setTruncated ] = useState(truncate);

    return (
        <StaticValueWrapper
            heading={ srcData.name }
            diffType={ srcData.difference }
            truncate={ truncate }
            truncated={ truncated }
            setTruncated={ setTruncated }
        >
            <span className={ clsx( !truncated && classes.expanded ) }>
                <b>{ datastreamNames[0] }:</b> <DataValue value={ srcData.A } maxChars={ maxChars} truncated={ truncated } />&nbsp;&nbsp;&nbsp;
            </span>
            <span className={ clsx( !truncated && classes.expanded ) }>
                <b>{ datastreamNames[1] }:</b> <DataValue value={ srcData.B } maxChars={ maxChars} truncated={ truncated } />
            </span>
        </StaticValueWrapper>
    );
};

export { StaticValue, StaticValueDiff };
