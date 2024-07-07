// NPM packages
import React from 'react';
import { observer } from 'mobx-react';
import { TableContainer, Paper, Table, TableHead, TableBody, TableRow, TableCell, Button } from '@material-ui/core';
import { D3StateProxy } from 'components';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';


const useStyles = makeStyles(theme => ({
    datatableContainer: {
        width: 'unset',
        minWidth: '10%',
        marginLeft: 'auto',
        marginRight: 'auto',
        marginBottom: theme.spacing(1),
        '& .MuiTableCell-sizeSmall': {
            padding: `1px ${theme.spacing(1)}px`,
        },
        zIndex: 10,
    },
    datatable: {},
    tr: {
        '&:nth-of-type(even)': {
            backgroundColor: 'rgba(0,0,0,0.05)',
        }
    },
    th: {
        padding: '0 !important',
        '&:first-child > button': {
            display: 'none',
        }
    },
    td: {
        textAlign: 'right',
        '&$activePlot': {},
    },
    plotSwitchBtn: {
        width: '100%',
        height: '100%',
        justifyContent: 'flex-end',
        backgroundColor: theme.palette.primary.dark,
        fontSize: '0.75rem',
        lineHeight: 1.5,
        textAlign: 'right',
        textTransform: 'unset',
        padding: `${theme.spacing(1)/4}px ${theme.spacing(2)/4}px`,
        '&:hover': {
            backgroundColor: theme.palette.background.paper,
            color: '#ffffff',
        },
        '&$activePlot': {
            backgroundColor: theme.palette.comparisons.nonDiff.dark,
            color: theme.palette.comparisons.nonDiff.contrastText,
        },
    },
    activePlot: {},
    changed: {
        backgroundColor: theme.palette.comparisons.changed.dark,
        color: theme.palette.comparisons.changed.contrastText,
    },
    removed: {
        backgroundColor: theme.palette.comparisons.removed.dark,
        color: theme.palette.comparisons.removed.contrastText,
    },
    added: {
        backgroundColor: theme.palette.comparisons.added.dark,
        color: theme.palette.comparisons.added.contrastText,
    },
}));


export type RowData = (string|number)[];

type DataTableProps = {
    d3StateProxy: D3StateProxy,
}

const DataTable = observer(({ d3StateProxy }: DataTableProps) => {
    const classes = useStyles();

    const maxChars: number = 25;
    const labels = d3StateProxy.labels;
    const rowsValues = d3StateProxy.rowsValues;
    const rowDiffs = d3StateProxy.rowDiffs;
    const activePlot = d3StateProxy.activePlot;

    return (
        <>
        <TableContainer component={Paper} className={ classes.datatableContainer }>
            <Table
                className={classes.datatable}
                size='small'
                aria-label="Tabular display of all data at hovered point in chart"
            >
                <TableHead>
                    <TableRow>
                    { labels.map((label, idx) => {
                        const plotId = idx - 1;
                        const explanatoryText = `Switch the displayed plot to "${label}"`;
                        return (
                            <TableCell
                                key={ `DataTable:Header${idx}` }
                                className={ clsx( classes.th ) }
                            >
                                <Button
                                    variant="outlined"
                                    size="small"
                                    aria-label={ explanatoryText }
                                    title={ explanatoryText }
                                    onClick={ ( plotId >= 0 ? () => d3StateProxy.setActivePlot(plotId) : undefined ) }
                                    disabled={ plotId === activePlot ? true : false }
                                    className={ clsx( classes.plotSwitchBtn, plotId === activePlot && classes.activePlot ) }
                                >
                                    { label.length > maxChars ? label.slice(0, maxChars) + "..." : label }
                                </Button>
                            </TableCell>
                        )
                      })
                    }
                    </TableRow>
                </TableHead>
                <TableBody>
                { rowsValues.map((rowValues, rowIdx) => {
                    return (
                        <TableRow key={ `DataTable:Row${rowIdx}` } hover={ true } className={ classes.tr }>
                        { rowValues.map((value, colIdx) => {
                            const plotId = colIdx - 1;
                            const rowDiff = rowDiffs[rowIdx][colIdx];
                            return (
                                <TableCell
                                    key={ `DataTable:Row${rowIdx}:Col${colIdx}` }
                                    className={ clsx( classes.td, plotId === activePlot && classes.activePlot, rowDiff !== '' && classes[rowDiff] ) }
                                >
                                    { value }
                                </TableCell>
                            )
                        })}
                        </TableRow>
                    );
                  })
                }
                </TableBody>
            </Table>
        </TableContainer>
        </>
    );
});

export { DataTable };
