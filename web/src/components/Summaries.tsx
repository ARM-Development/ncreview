// NPM packages
import React, { useState } from 'react';
import { TableContainer, Paper, Table, TableHead, TableBody, TableFooter, TableRow, TableCell } from '@material-ui/core';
import InfoIcon from '@material-ui/icons/Info';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';

// All other imports
import { useServices } from 'services';
import {
    noData,
    same, changed
} from 'resources/constants';
import { secondsToReadableDate, getDiff, format } from 'utils';
import { Section, StaticValueDiff, ToggleButton } from 'components';
import { commonStyles } from 'styles/commonStyles';


const useStyles = makeStyles(theme => ({
    summaryContainer: {
        width: 'unset',
        maxWidth: '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
        marginBottom: theme.spacing(3),
        '& .MuiTableCell-sizeSmall': {
            padding: `6px ${theme.spacing(1)}px`,
        }
    },
    sticky: {
        maxHeight: '90vh',
        '& table thead': {
            position: 'sticky',
            top: 0,
        },
        '& table tfoot': {
            position: 'sticky',
            bottom: 0,
        },
    },
    heightToggle: {
        width: 'auto',
        padding: `${theme.spacing(1)}px ${theme.spacing(2)}px`,
        backgroundColor: theme.palette.primary.dark,
        fontSize: '0.666rem',
        lineHeight: 1,
        '&:hover': {
            backgroundColor: theme.palette.background.paper,
            color: '#ffffff',
        },
    },
    summary: {
        '& caption': {
            captionSide: 'top',
            color: theme.palette.text.primary,
            fontSize: '1.0rem',
            fontWeight: 'bold',
            padding: `${theme.spacing(1)}px`,
            textAlign: 'center',
        },
    },
    staticSummary: {
        marginLeft: 0,
    },
    staticSummaryDiff: {},
    summaryInfo: {
        '& > svg': {
            color: 'rgba(204,204,204,0.875)',
            fontSize: '1.0rem',
            verticalAlign: 'middle',
        },
    },
    tr: {
        '&:nth-of-type(even)': {
            backgroundColor: 'rgba(0,0,0,0.05)',
        }
    },
    th: {
        backgroundColor: theme.palette.primary.dark,
        color: theme.palette.text.primary,
        fontWeight: 'bold',
        textAlign: 'right',
    },
    tf: {
        fontSize: 'unset',
        lineHeight: 'unset',
    },
    tfChanged: {
        backgroundColor: theme.palette.comparisons.changed.light,
    },
    td: {
        textAlign: 'right',
    },
    centerAlign: {
        textAlign: 'center',
    },
    resetAlign: {
        textAlign: 'revert',
    },
    rowLabel: {
        textAlign: 'left',
    },
    bad: {
        color: `${theme.palette.error.dark} !important`,
        fontWeight: 'bold',
    },
    attention: {
        color: 'rgb(204,116,0,1.0) !important',
        fontWeight: 'bold',
    }
}));


const infoQC = "Checks the QC data of each variable for each file in the directory passed in via command line arguments, returning the percentage of time each bit is non-zero. 100% is highlighted with red. The QC data is interpreted as Bit 1 being the rightmost bit, Bit 2 being the second to rightmost bit, etc.";

const SummariesWrapper = ({ srcData, className="", addlInfo="" }) => {
    const classes = useStyles();

    let infoIcon = <></>;
    if (addlInfo)
        infoIcon = <span title={ addlInfo } className={ classes.summaryInfo }><InfoIcon /></span>;

    return (
        <Section
            srcData={ srcData }
            className={ className }
            staticContent={ true }
            addlContent={ infoIcon }
            expandSections={ false }
            isDiff={ false }
        />
    );
};


const SummaryVarDataTable = ({ srcData }) => {
    const classes = useStyles();

    const [ minTableHeight, setMinTableHeight ] = useState(true);

    return (
        <TableContainer component={Paper} className={ classes.summaryContainer } classes={{ root: clsx( minTableHeight && classes.sticky ) }}>
            <Table
                className={classes.summary}
                size='small'
                aria-label="Tabular summary of variable data"
            >
                <TableHead>
                    <TableRow>
                        <TableCell colSpan={ srcData.header.length } className={ clsx( classes.th, classes.rowLabel ) }>
                            <ToggleButton
                                onState={ minTableHeight }
                                setOnState={ setMinTableHeight }
                                onElem={ <span>Expand to Full Height</span> }
                                offElem={ <span>Constrain to Screen</span> }
                                hoverText="Maximize or minimize table height"
                                className={ classes.heightToggle }
                            />
                        </TableCell>
                    </TableRow>
                    <TableRow>
                    { srcData.header.map((col, idx) => {
                        return (
                            <TableCell key={ `DataSummary:Header${idx}` } title={ srcData.tooltips[col] } className={ clsx( classes.th, idx === 0 && classes.rowLabel ) }>
                                { col }
                            </TableCell>
                        )
                      })
                    }
                    </TableRow>
                </TableHead>
                <TableBody>
                { srcData.data.map((varData) => {
                    const varName = varData.name;
                    const dataCells = varData.values.map((value, idx) => {
                        const bad = ( idx === 2 && value >= 1 );  // 100%
                        const attention = ( idx > 2 && value !== 0 );
                        return (
                            <TableCell key={ `DataSummary:Row${varName}:Col${idx}` } className={ clsx( classes.td, bad && classes.bad, attention && classes.attention ) }>
                                {( value === null ? noData : ( idx === 2 ? ( value < 0.0001 && value > 0 ? "<" : "" ) + format(value, 'percent') : format(value, 'int') ))}
                            </TableCell>
                        );
                    });

                    return (
                        <TableRow key={ `DataSummary:Row${varName}` } hover={ true } className={ classes.tr }>
                            <TableCell key={ `DataSummary:Row${varName}:ColRowLabel` } className={ clsx( classes.td, classes.rowLabel ) }>{ varName }</TableCell>
                            { dataCells }
                        </TableRow>
                    );
                  })
                }
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell key="DataSummary:Footer:ColTotalsLabel" className={ clsx( classes.th, classes.tf, classes.rowLabel ) }>{ srcData.totals.name }</TableCell>
                    { srcData.totals.values.map((value, idx) => {
                        return (
                            <TableCell key={ `DataSummary:Footer:Col${idx}` } className={ clsx( classes.th, classes.tf ) }>
                                {( idx === 2 ? ( value < 0.0001 && value > 0 ? "<" : "" ) + format(value, 'percent') : format(value, 'int') )}
                            </TableCell>
                        );
                      })
                    }
                    </TableRow>
                </TableFooter>
            </Table>
        </TableContainer>
    );
};

const SummaryQCTable = ({ srcData }) => {
    const classes = useStyles();

    const [ minTableHeight, setMinTableHeight ] = useState(true);

    return (
        <TableContainer component={Paper} className={ classes.summaryContainer } classes={{ root: clsx( minTableHeight && classes.sticky ) }}>
            <Table
                className={classes.summary}
                size='small'
                aria-label="Tabular summary of QC variable data"
            >
                <TableHead>
                    <TableRow>
                        <TableCell colSpan={ srcData.header.length } className={ clsx( classes.th, classes.rowLabel ) }>
                            <ToggleButton
                                onState={ minTableHeight }
                                setOnState={ setMinTableHeight }
                                onElem={ <span>Expand to Full Height</span> }
                                offElem={ <span>Constrain to Screen</span> }
                                hoverText="Maximize or minimize table height"
                                className={ classes.heightToggle }
                            />
                        </TableCell>
                    </TableRow>
                    <TableRow>
                    { srcData.header.map((col, idx) => {
                        return (
                            <TableCell key={ `QCSummary:Header:Col${idx}` } title={ srcData.tooltips[col] } className={ clsx( classes.th, idx === 0 && classes.rowLabel ) }>
                                { col }
                            </TableCell>
                        )
                      })
                    }
                    </TableRow>
                </TableHead>
                <TableBody>
                { srcData.data.map((qcData) => {
                    const varName = qcData.name;
                    const dataCells = qcData.values.map((value, idx) => {
                        const lastValue = ( idx === srcData.bits );
                        const bad = ( lastValue ? false : value >= 1 );  // 100%
                        return (
                            <TableCell key={ `QCSummary:Row${varName}:Col${idx}` } className={ clsx( classes.td, bad && classes.bad ) }>
                                {( value === null ? noData : format(value, ( lastValue ? 'int' : 'percent' )) )}
                            </TableCell>
                        );
                    });

                    return (
                        <TableRow key={ `QCSummary:Row${varName}` } hover={ true } className={ classes.tr }>
                            <TableCell key={ `QCSummary:Row${varName}:ColRowLabel` } className={ clsx( classes.td, classes.rowLabel ) }>{ varName }</TableCell>
                            { dataCells }
                        </TableRow>
                    );
                  })
                }
                </TableBody>
            </Table>
        </TableContainer>
    );
};


const Summary = ({ srcData, className="" }) => {

    const varDataTable = <SummaryVarDataTable srcData={ srcData.varDataSummary } />;

    const _srcData = {
        'name': "Variable Data Summary",
        'difference': undefined,
        'contents': varDataTable,
    };
    const varDataSummary = <SummariesWrapper srcData={ _srcData } className={ className } />;

    let qcSummary = <></>;
    if (srcData.qcDataSummary) {

        const qcTable = <SummaryQCTable srcData={ srcData.qcDataSummary } />;

        const _srcData = {
            'name': "QC Variable Summary",
            'difference': undefined,
            'contents': qcTable,
        };
        qcSummary = <SummariesWrapper srcData={ _srcData } className={ className } addlInfo={ infoQC } />;
    }

    return (
        <>
            { varDataSummary }
            { qcSummary }
        </>
    );
};



const SummaryTimeDiffsTable = ({ srcData }) => {
    const classes = useStyles();

    const [ minTableHeight, setMinTableHeight ] = useState(true);

    return (
        <TableContainer component={Paper} className={ classes.summaryContainer } classes={{ root: clsx( minTableHeight && classes.sticky ) }}>
            <Table
                className={classes.summary}
                size='small'
                aria-label="Tabular summary of time dimension changes"
            >
                <TableHead>
                    <TableRow>
                        <TableCell colSpan={ srcData.header.length } className={ clsx( classes.th, classes.rowLabel ) }>
                            <ToggleButton
                                onState={ minTableHeight }
                                setOnState={ setMinTableHeight }
                                onElem={ <span>Expand to Full Height</span> }
                                offElem={ <span>Constrain to Screen</span> }
                                hoverText="Maximize or minimize table height"
                                className={ classes.heightToggle }
                            />
                        </TableCell>
                    </TableRow>
                    <TableRow>
                    { srcData.header.map((col, idx) => {
                        return (
                            <TableCell key={ `TimesDiff:Header:Col${idx}` } className={ clsx( classes.th, idx === 0 && classes.rowLabel ) }>
                                { col }
                            </TableCell>
                        )
                      })
                    }
                    </TableRow>
                </TableHead>
                <TableBody>
                { srcData.data.map((timeDiff) => {
                    var date = timeDiff.date;
                    const dataCells = timeDiff.values.map((value, idx) => {
                        return (
                            <TableCell key={ `TimesDiff:Row${date}:Col${idx}` } className={ classes.td }>
                                { value }
                            </TableCell>
                        );
                    });

                    return (
                        <TableRow key={ `TimesDiff:Row${date}` } hover={ true } className={ classes.tr }>
                            <TableCell  key={ `TimesDiff:Row${date}:Col0` } className={ clsx( classes.td, classes.rowLabel ) }>{ date }</TableCell>
                            { dataCells }
                        </TableRow>
                    );
                  })
                }
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell key={ `TimesDiff:Footer:ColTotal` } className={ clsx( classes.th, classes.tf, classes.rowLabel ) }>{ srcData.totals.name }</TableCell>
                    { srcData.totals.values.map((value, idx) => {
                        return (
                            <TableCell key={ `TimesDiff:Footer:Col${idx}` } className={ clsx( classes.th, classes.tf ) }>
                                { value }
                            </TableCell>
                        );
                      })
                    }
                    </TableRow>
                </TableFooter>
            </Table>
        </TableContainer>
    );
};

const SummaryDiffDimsTable = ({ srcData }) => {
    const classes = useStyles();
    const commonClasses = commonStyles();
    const { dataService } = useServices();

    const datastreamNames = dataService.getDatastreamNames();
    const dimensionName = srcData.name;

    const [ minTableHeight, setMinTableHeight ] = useState(true);

    return (
        <TableContainer component={Paper} className={ classes.summaryContainer } classes={{ root: clsx( minTableHeight && classes.sticky ) }}>
            <Table
                className={classes.summary}
                size='small'
                aria-label="Tabular summary of changed dimension"
            >
                <caption>{ dimensionName }</caption>
                <TableHead>
                    <TableRow>
                        <TableCell colSpan={ 6 } className={ clsx( classes.th, classes.rowLabel ) }>
                            <ToggleButton
                                onState={ minTableHeight }
                                setOnState={ setMinTableHeight }
                                onElem={ <span>Expand to Full Height</span> }
                                offElem={ <span>Constrain to Screen</span> }
                                hoverText="Maximize or minimize table height"
                                className={ classes.heightToggle }
                            />
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell colSpan={ 3 } className={ clsx( classes.th, classes.centerAlign ) }>{ datastreamNames[0] }</TableCell>
                        <TableCell colSpan={ 3 } className={ clsx( classes.th, classes.centerAlign ) }>{ datastreamNames[1] }</TableCell>
                    </TableRow>
                    <TableRow>
                    { srcData.header.map((col, idx) => {
                        return (
                            <TableCell key={ `DimsChanges${dimensionName}:Header:Col${idx}` } className={ clsx( classes.th ) }>
                                { col }
                            </TableCell>
                        )
                      })
                    }
                    </TableRow>
                </TableHead>
                <TableBody>
                { srcData.data.map((dimDiff, idx) => {
                    const dataCellsA = dimDiff.A.map((value, i) => {
                        const comparisonValue = dimDiff.B[i];
                        const diffClass = commonClasses[( value === null || comparisonValue === null || value === comparisonValue ? same : changed )];
                        return (
                            <TableCell key={ `DimsChanges${dimensionName}:Row${idx}:ColA${i}` } className={ clsx( classes.td, diffClass ) }>
                                {( value === null ? noData : ( i === dimDiff.A.length-1 ? value : secondsToReadableDate(value) ) )}
                            </TableCell>
                        );
                    });
                    const dataCellsB = dimDiff.B.map((value, i) => {
                        const comparisonValue = dimDiff.A[i];
                        const diffClass = commonClasses[( value === null || comparisonValue === null || value === comparisonValue ? same : changed )];
                        return (
                            <TableCell key={ `DimsChanges${dimensionName}:Row${idx}:ColB${i}` } className={ clsx( classes.td, diffClass ) }>
                                {( value === null ? noData : ( i === dimDiff.B.length-1 ? value : secondsToReadableDate(value) ) )}
                            </TableCell>
                        );
                    });

                    return (
                        <TableRow key={ `DimsChanges${dimensionName}:Row${idx}` } hover={ true } className={ classes.tr }>
                            { dataCellsA }
                            { dataCellsB }
                        </TableRow>
                    );
                  })
                }
                </TableBody>
            </Table>
        </TableContainer>
    );
};

const SummaryDiffVarDataTable = ({ srcData }) => {
    const classes = useStyles();
    const commonClasses = commonStyles();
    const { dataService } = useServices();

    const datastreamNames = dataService.getDatastreamNames();

    const [ minTableHeight, setMinTableHeight ] = useState(true);

    return (
        <TableContainer component={Paper} className={ classes.summaryContainer } classes={{ root: clsx( minTableHeight && classes.sticky ) }}>
            <Table
                className={classes.summary}
                size='small'
                aria-label="Tabular summary of variable data"
            >
                <TableHead>
                    <TableRow>
                        <TableCell className={ clsx( classes.th, classes.rowLabel ) }>
                            <ToggleButton
                                onState={ minTableHeight }
                                setOnState={ setMinTableHeight }
                                onElem={ <span>Expand to Full Height</span> }
                                offElem={ <span>Constrain to Screen</span> }
                                hoverText="Maximize or minimize table height"
                                className={ classes.heightToggle }
                            />
                        </TableCell>
                        <TableCell colSpan={ srcData.totals.A.length } className={ clsx( classes.th, classes.centerAlign ) }>{ datastreamNames[0] }</TableCell>
                        <TableCell colSpan={ srcData.totals.B.length } className={ clsx( classes.th, classes.centerAlign ) }>{ datastreamNames[1] }</TableCell>
                    </TableRow>
                    <TableRow>
                    { srcData.header.map((col, idx) => {
                        return (
                            <TableCell key={ `DataSummary:Header:Col${idx}` } title={ srcData.tooltips[col] } className={ clsx( classes.th, idx === 0 && classes.rowLabel ) }>
                                { col }
                            </TableCell>
                        )
                      })
                    }
                    </TableRow>
                </TableHead>
                <TableBody>
                { srcData.data.map((varData) => {
                    const varName = varData.name;
                    const dataCells = ['A', 'B'].map((ds) => {
                        return varData[ds].map((value, idx) => {
                            const comparisonValue = varData[( ds === 'A' ? 'B' : 'A' )][idx];
                            const diffClass = commonClasses[( value === null || comparisonValue === null || value === comparisonValue ? same : changed )];
                            const bad = ( idx === 2 && value >= 1 );  // 100%
                            const attention = ( idx > 2 && value !== null && value > 0 );
                            return (
                                <TableCell key={ `DataSummary:Row${varName}:Col${ds}${idx}` } className={ clsx( classes.td, diffClass, bad && classes.bad, attention && classes.attention ) }>
                                    {( value === null ? noData : ( idx === 2 ? ( value < 0.0001 && value > 0 ? "<" : "" ) + format(value, 'percent') : format(value, 'int') ))}
                                </TableCell>
                            );
                        })
                    }).reduce( (accum, cells) => accum.concat(cells), []);

                    return (
                        <TableRow key={ `DataSummary:Row${varName}` } hover={ true } className={ classes.tr }>
                            <TableCell key={ `DataSummary:Row${varName}:ColRowLabel` } className={ clsx( classes.td, classes.rowLabel ) }>{ varName }</TableCell>
                            { dataCells }
                        </TableRow>
                    );
                  })
                }
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell key="DataSummary:Footer:ColTotalsLabel" className={ clsx( classes.th, classes.tf, classes.rowLabel ) }>{ srcData.totals.name }</TableCell>
                    { ['A', 'B'].map((ds) => {
                        return srcData.totals[ds].map((value, idx) => {
                            const comparisonValue = srcData.totals[( ds === 'A' ? 'B' : 'A' )][idx];
                            const diffClass = ( value === null || comparisonValue === null || value === comparisonValue ? commonClasses[same] : classes.tfChanged );
                            return (
                                <TableCell key={ `DataSummary:Footer:Col${ds}}${idx}` } className={ clsx( classes.th, classes.tf, diffClass ) }>
                                    {( idx === 2 ? ( value < 0.0001 && value > 0 ? "<" : "" ) + format(value, 'percent') : format(value, 'int') )}
                                </TableCell>
                            );
                        })
                      }).reduce( (accum, cells) => accum.concat(cells), [])
                    }
                    </TableRow>
                </TableFooter>
            </Table>
        </TableContainer>
    );
};

const SummaryDiffQCTable = ({ srcData }) => {
    const classes = useStyles();
    const commonClasses = commonStyles();
    const { dataService } = useServices();

    const datastreamNames = dataService.getDatastreamNames();

    const [ minTableHeight, setMinTableHeight ] = useState(true);

    return (
        <TableContainer component={Paper} className={ classes.summaryContainer } classes={{ root: clsx( minTableHeight && classes.sticky ) }}>
            <Table
                className={classes.summary}
                size='small'
                aria-label="Tabular summary of QC variable data"
            >
                <TableHead>
                    <TableRow>
                        <TableCell className={ clsx( classes.th, classes.rowLabel ) }>
                            <ToggleButton
                                onState={ minTableHeight }
                                setOnState={ setMinTableHeight }
                                onElem={ <span>Expand to Full Height</span> }
                                offElem={ <span>Constrain to Screen</span> }
                                hoverText="Maximize or minimize table height"
                                className={ classes.heightToggle }
                            />
                        </TableCell>
                        <TableCell colSpan={ srcData.bitsA+1 } className={ clsx( classes.th, classes.centerAlign ) }>{ datastreamNames[0] }</TableCell>
                        <TableCell colSpan={ srcData.bitsB+1 } className={ clsx( classes.th, classes.centerAlign ) }>{ datastreamNames[1] }</TableCell>
                    </TableRow>
                    <TableRow>
                    { srcData.header.map((col, idx) => {
                        return (
                            <TableCell key={ `QCSummary:Header:Col${idx}` } title={ srcData.tooltips[col] } className={ clsx( classes.th, idx === 0 && classes.rowLabel ) }>
                                { col }
                            </TableCell>
                        )
                      })
                    }
                    </TableRow>
                </TableHead>
                <TableBody>
                { srcData.data.map((qcData) => {
                    const varName = qcData.name;
                    const dataCells = ['A', 'B'].map((ds) => {
                        return qcData[ds].map((value, idx) => {
                            const lastValue = ( idx === qcData[ds].length-1 );
                            const comparisonValue = qcData[( ds === 'A' ? 'B' : 'A' )][idx];
                            const comparisonValueIsEmpty = ( comparisonValue === undefined || comparisonValue === null );
                            const diffClass = commonClasses[( value === null || ( !lastValue && comparisonValueIsEmpty ) || value === comparisonValue ? same : changed )];
                            const bad = ( lastValue ? false : value >= 1 );  // 100%
                            return (
                                <TableCell key={ `QCSummary:Row${varName}:Col${ds}${idx}` } className={ clsx( classes.td, diffClass, bad && classes.bad ) }>
                                    {( value === null ? noData : format(value, ( lastValue ? 'int' : 'percent' )) )}
                                </TableCell>
                            );
                        })
                    }).reduce( (accum, cells) => accum.concat(cells), []);

                    return (
                        <TableRow key={ `QCSummary:Row${varName}` } hover={ true } className={ classes.tr }>
                            <TableCell key={ `QCSummary:Row${varName}:ColRowLabel` } className={ clsx( classes.td, classes.rowLabel ) }>{ varName }</TableCell>
                            { dataCells }
                        </TableRow>
                    );
                  })
                }
                </TableBody>
            </Table>
        </TableContainer>
    );
};

const SummaryDiff = ({ srcData, className="" }) => {

    // WILL NOT BE NECCESSARY AFTER VERSION 0.9 (7/13/17)
    // KEEP FOR BACKWARDS COMPATABILITY
    let timeDiffsSummary = <></>;
    if (srcData.timeDiffsSummary) {

        const timeDiffsTable = <SummaryTimeDiffsTable srcData={ srcData.timeDiffsSummary } />;

        const _srcData = {
            'name': `Dimension Changes \u2012 time`,
            'difference': undefined,
            'contents': timeDiffsTable,
        };
        timeDiffsSummary = <SummariesWrapper srcData={ _srcData } className={ className } />;
    }
    // END BACKWARDS COMPATABILITY

    let dimensionChangesSummary = <></>;
    if (srcData.dimensionChangesSummaries) {

        const dimensionChangesTables = new Array<React.ReactNode>();
        for (const dimensionChangeSummary of srcData.dimensionChangesSummaries) {
            dimensionChangesTables.push(<SummaryDiffDimsTable srcData={ dimensionChangeSummary } key={ dimensionChangeSummary.name } />);
        }

        const _srcData = {
            'name': `Dimension Changes`,
            'difference': undefined,
            'contents': dimensionChangesTables,
        };

        dimensionChangesSummary = <SummariesWrapper srcData={ _srcData } className={ className } />;
    }

    let varDataSummary = <></>;
    if (srcData.varDataDiffSummary) {

        const varDataTable = <SummaryDiffVarDataTable srcData={ srcData.varDataDiffSummary } />;

        const _srcData = {
            'name': "Variable Data Summary",
            'difference': undefined,
            'contents': varDataTable,
        };
        varDataSummary = <SummariesWrapper srcData={ _srcData } className={ className } />;
    }

    let qcSummary = <></>;
    if (srcData.qcDataDiffSummary) {

        const qcTable = <SummaryDiffQCTable srcData={ srcData.qcDataDiffSummary } />;

        const _srcData = {
            'name': "QC Variable Summary",
            'difference': undefined,
            'contents': qcTable,
        };
        qcSummary = <SummariesWrapper srcData={ _srcData } className={ className } addlInfo={ infoQC } />;
    }

    return (
        <>
            { timeDiffsSummary }
            { dimensionChangesSummary }
            { varDataSummary }
            { qcSummary }
        </>
    );
};

const StaticSummary = ({ srcData, className="" }) => {
    const classes = useStyles();

    const dataElem = (
        <TableContainer component={Paper} className={ clsx( classes.summaryContainer, classes.staticSummary ) }>
            <Table
                size='small'
                aria-label="Tabular summary of data values"
            >
            <TableHead>
                <TableRow>
                { srcData.header.map((col, idx) => {
                    return (
                    <TableCell
                        key={ `${srcData.name}:Header:Col${idx}` }
                        title={ srcData.tooltips[idx] }
                        className={ classes.th }
                    >
                        { col }
                    </TableCell>
                    )
                  })
                }
                </TableRow>
            </TableHead>
            <TableBody>
                <TableRow className={ classes.tr }>
                { srcData.values.map((value, idx) => {
                    return (
                        <TableCell
                            key={ `${srcData.name}:Row1:Col${idx}` }
                            className={ classes.td }
                        >
                            { value === null ? <i>none</i> : value }
                        </TableCell>
                    );
                  })
                }
                </TableRow>
            </TableBody>
            </Table>
        </TableContainer>
    );
    const _srcData = {
        'name': srcData.name,
        'difference': srcData.difference,
        'contents': dataElem,
    };

    return (
        <SummariesWrapper srcData={ _srcData } className={ className } />
    );
};

const StaticSummaryDiff = ({ srcData, className="" }) => {
    const classes = useStyles();

    if (srcData.dataType === 'dimless') {
        return (
            <StaticValueDiff srcData={ srcData } />
        );
    }

    const dataElem = (
        <TableContainer component={Paper} className={ clsx( classes.summaryContainer, classes.staticSummary, classes.staticSummaryDiff ) }>
            <Table
                size='small'
                aria-label="Tabular summary of compared data values"
            >
            <TableHead>
                <TableRow>
                    <TableCell></TableCell>
                { srcData.header.map((col, idx) => {
                    return (
                    <TableCell
                        key={ `${srcData.name}:Header:Col${idx}` }
                        title={ srcData.tooltips[idx] }
                        className={ classes.th }
                    >
                        { col }
                    </TableCell>
                    )
                  })
                }
                </TableRow>
            </TableHead>
            <TableBody>
                <TableRow className={ classes.tr }>
                    <TableCell component="th" scope="row">A:</TableCell>
                { srcData.A.map((value, idx) => {
                    return (
                        <TableCell
                            key={ `${srcData.name}:RowA:Col${idx}` }
                            className={ clsx( classes.td, getDiff(srcData.A[idx], srcData.B[idx]) ) }
                        >
                            { value === null ? <i>none</i> : value }
                        </TableCell>
                    );
                  })
                }
                </TableRow>
                <TableRow className={ classes.tr }>
                    <TableCell component="th" scope="row">B:</TableCell>
                { srcData.B.map((value, idx) => {
                    return (
                        <TableCell
                            key={ `${srcData.name}:RowB:Col${idx}` }
                            className={ clsx( classes.td, getDiff(srcData.A[idx], srcData.B[idx]) ) }
                        >
                            { value === null ? <i>none</i> : value }
                        </TableCell>
                    );
                  })
                }
                </TableRow>
            </TableBody>
            </Table>
        </TableContainer>
    );
    const _srcData = {
        'name': srcData.name,
        'difference': srcData.difference,
        'contents': dataElem,
    };

    return (
        <SummariesWrapper srcData={ _srcData } className={ className } />
    );
};

export { Summary, SummaryDiff, StaticSummary, StaticSummaryDiff };
