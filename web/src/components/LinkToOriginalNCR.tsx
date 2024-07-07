// NPM packages
import React from 'react';
import Link from '@material-ui/core/Link';
import { makeStyles } from '@material-ui/core/styles';

// All other imports


const useStyles = makeStyles(theme => ({
    root: {
        display: 'block',
        margin: 0,
        marginRight: theme.spacing(2),
        padding: '3px 0 0',
        zIndex: 10,
        color: 'rgb(163,117,209)',
        fontSize: '0.75rem',
        lineHeight: 2,
    },
}));

const LinkToOriginalNCR = () => {
    const classes = useStyles();

    const linkText = "Open in the original ncreview UI";
    const id = window.location.href.split('?')[1] || "";
    const URL = `${process.env.REACT_APP_URL_ORIGINAL_PREFIX}/?${id}`;

    return (
        <Link
            href={ URL }
            aria-label={ linkText }
            title={ linkText }
            className={ classes.root }
        >
            { linkText }
        </Link>
    );
};

export { LinkToOriginalNCR };
