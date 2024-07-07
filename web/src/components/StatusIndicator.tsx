// NPM packages
import React from 'react';
import { Typography, LinearProgress } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';

// All other imports
import { LoadStatus } from 'models/MiscTypes';
import { commonStyles } from 'styles/commonStyles';


const useStyles = makeStyles(theme => ({
    statusIndicator: {
        width: '98%',
        marginBottom: theme.spacing(3),
    },
    progressBar: {
        maxWidth: '720px',
        marginLeft: 'auto',
        marginRight: 'auto',
    },
}));


type Props = {
    statusMsg: LoadStatus,
}

const StatusIndicator = ({ statusMsg }: Props) => {
    const classes = useStyles();
    const commonClasses = commonStyles();

    let hideStatus = false;
    let hideLoadingIndicator = false;
    if (![null, 'loading'].includes(statusMsg)) {
        if (statusMsg === 'success') {
            hideStatus = true;
        }
        else {
            hideLoadingIndicator = true;
        }
    }

    return (
        <div className={ clsx(classes.statusIndicator, hideStatus && commonClasses.hide) }>
            <Typography align='center' gutterBottom>
                {( [null, 'loading'].includes(statusMsg) ?
                   "Loading..." :
                   ( hideLoadingIndicator ?
                     `Load failed: ${statusMsg}` :
                     statusMsg )
                )}
            </Typography>
            <div className={ clsx( classes.progressBar, hideLoadingIndicator && commonClasses.hide ) }><LinearProgress /></div>
        </div>
    );
};

export { StatusIndicator };
