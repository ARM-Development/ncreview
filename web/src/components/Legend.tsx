// NPM packages
import React from 'react';
import {
  Drawer,
  List, ListItem, ListItemIcon, ListItemText,
  Typography,
  Divider
} from '@material-ui/core';
import WbIncandescentOutlinedIcon from '@material-ui/icons/WbIncandescentOutlined';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';

// All other imports
import { ToggleButton, ColorSwatch } from 'components';
import { same, changed, removed, added } from 'resources/constants';
import { commonStyles } from 'styles/commonStyles';


const useStyles = makeStyles(theme => ({
  legend: {
    flex: '0 0 auto',
  },
  legendPaper: {
    width: '200px',
    [theme.breakpoints.down('sm')]: {
      width: '100%',
      zIndex: '10000',
      backgroundColor: 'rgb(52,52,52,1.0)',
    },
  },
  legendBody: {
    width: '100%',
    padding: `${theme.spacing(3)}px ${theme.spacing(2)}px`,
  },
  legendHeading: {
    fontSize: '0.75rem',
    fontWeight: 'bold',
  },
  legendText: {
    fontSize: '0.75rem',
  },
  legendList: {
    textAlign: 'left',
    '& li': {
      padding: '0',
    },
  },
  legendListNav: {
    '& li': {
      marginBottom: theme.spacing(1),
    },
  },
  legendListIcon: {
    minWidth: 'unset',
    paddingRight: theme.spacing(2),
  },
  legendDivider: {
    margin: `${theme.spacing(3)}px 0`,
  },
  legendToggleButton: {
    display: 'none !important',
    backgroundColor: 'black',
    [theme.breakpoints.down('sm')]: {
      display: 'block !important',
      marginBottom: `${theme.spacing(1)}px !important`,
    },
  },
}));


const DiffColorsDefinitions = ({ visible }) => {
  const classes = useStyles();
  const commonClasses = commonStyles();

  if (!visible)
    return ( <></> );

  return (
    <>
    <Typography className={ classes.legendText }>Colors used in labels or graphs have the following meaning:</Typography>
    <List classes={{ root: classes.legendList }}>
    <ListItem key="Same" title="Data is the same for arg 1 and 2" aria-label="Data is the same for arg 1 and 2">
            <ListItemIcon className={ clsx( classes.legendListIcon, commonClasses[same] ) }><ColorSwatch /></ListItemIcon>
            <ListItemText primary="Same" />
        </ListItem>
        <ListItem key="Same_VarData" title="Data is the same for arg 1 and 2 (for plots within Variable &ldquo;Data&rdquo; sections only)" aria-label="Data is the same for arg 1 and 2. Used only on plots within Variable &ldquo;Data&rdquo; sections.">
            <ListItemIcon className={ clsx( classes.legendListIcon, commonClasses[same+'_RxG'] ) }><ColorSwatch /></ListItemIcon>
            <ListItemText primary="Same" secondary="(for Var &ldquo;Data&rdquo; only)" />
        </ListItem>
        <ListItem key="Differs" title="Data exists for both arg 1 and 2, but differs" aria-label="Data exists for both arg 1 and 2, but differs">
            <ListItemIcon className={ clsx( classes.legendListIcon, commonClasses[changed] ) }><ColorSwatch /></ListItemIcon>
            <ListItemText primary="Differs" secondary="(betw Arg 1 and 2)" />
        </ListItem>
        <ListItem key="AOnly" title="Data exists for arg 1 only" aria-label="Data exists for arg 1 only">
            <ListItemIcon className={ clsx( classes.legendListIcon, commonClasses[removed] ) }><ColorSwatch /></ListItemIcon>
            <ListItemText primary="Arg 1 Only" />
        </ListItem>
        <ListItem key="BOnly" title="Data exists for arg 2 only" aria-label="Data exists for arg 2 only">
            <ListItemIcon className={ clsx( classes.legendListIcon, commonClasses[added] ) }><ColorSwatch /></ListItemIcon>
            <ListItemText primary="Arg 2 Only" />
        </ListItem>
    </List>
    </>
  );
}

const PlotTips = () => {
  const classes = useStyles();

  return (
    <>
      <Typography variant='h4' className={ classes.legendHeading }>Variable &ldquo;Data&rdquo; Plots</Typography>
      <Typography className={ classes.legendText }>The following actions are available in each plot:</Typography>
      <List classes={{ root: clsx( classes.legendList, classes.legendListNav ) }}>
          <ListItem key="zoom" className={ classes.legendText }>
              <ListItemIcon className={ classes.legendListIcon }><WbIncandescentOutlinedIcon style={{ transform: 'rotate(180deg) scale(0.75)' }} /></ListItemIcon>
              Use the scroll wheel to zoom in and out.
          </ListItem>
          <ListItem key="pan" className={ classes.legendText }>
              <ListItemIcon className={ classes.legendListIcon }><WbIncandescentOutlinedIcon style={{ transform: 'rotate(180deg) scale(0.75)' }} /></ListItemIcon>
              Click &amp; drag on a plot to pan left and right.
          </ListItem>
          <ListItem key="tooltipFreeze" className={ classes.legendText }>
              <ListItemIcon className={ classes.legendListIcon }><WbIncandescentOutlinedIcon style={{ transform: 'rotate(180deg) scale(0.75)' }} /></ListItemIcon>
              Click on a plot to freeze the tooltip at its current location. Click again to free it. The tooltip is also freed on pan, zoom, or rescaling the y-axis.
          </ListItem>
      </List>
      <Typography variant='h4' className={ classes.legendHeading }>Timelines and Attribute Graphs</Typography>
      <Typography className={ classes.legendText }>The following actions are available for each graph:</Typography>
      <List classes={{ root: clsx( classes.legendList, classes.legendListNav ) }}>
          <ListItem key="navigator" className={ classes.legendText }>
              <ListItemIcon className={ classes.legendListIcon }><WbIncandescentOutlinedIcon style={{ transform: 'rotate(180deg) scale(0.75)' }} /></ListItemIcon>
              Use the navigator at the bottom of each graph to pan and zoom.
          </ListItem>
          <ListItem key="zoom" className={ classes.legendText }>
              <ListItemIcon className={ classes.legendListIcon }><WbIncandescentOutlinedIcon style={{ transform: 'rotate(180deg) scale(0.75)' }} /></ListItemIcon>
              Click &amp; drag to select an area to zoom in on.
          </ListItem>
          <ListItem key="pan" className={ classes.legendText }>
              <ListItemIcon className={ classes.legendListIcon }><WbIncandescentOutlinedIcon style={{ transform: 'rotate(180deg) scale(0.75)' }} /></ListItemIcon>
              While holding down alt&nbsp;/&nbsp;option, drag a graph to pan left and right.
          </ListItem>
      </List>
    </>
  );
};

type LegendProps = {
    legendOpen: boolean,
    setLegendOpen: (legendOpen: boolean)=>void,
    isDiff: boolean,
}

const Legend = ({ legendOpen, setLegendOpen, isDiff }: LegendProps) => {
    const classes = useStyles();
    const commonClasses = commonStyles();

    const legendBtnOnElem = <span>Close</span>;
    const legendBtnOffElem = <span>Close</span>;
    const legendBtnHoverText = "Close the legend sidebar";

    return (
      <>
          <Drawer 
              variant='persistent'
              anchor='right'
              className={ classes.legend }
              classes={ { "paper": classes.legendPaper } }
              open={ legendOpen }
          >
              <div className={ classes.legendBody }>
                  <ToggleButton
                      onState={ legendOpen }
                      setOnState={ setLegendOpen }
                      onElem={ legendBtnOnElem }
                      offElem={ legendBtnOffElem }
                      hoverText={ legendBtnHoverText }
                      className={ classes.legendToggleButton }
                  />
                  <DiffColorsDefinitions visible={isDiff} />
                  <Divider classes={{ root: clsx( classes.legendDivider, !isDiff && commonClasses.hide ) }} />
                  <PlotTips />
              </div>
          </Drawer>
        </>
    );
};

export { Legend };
