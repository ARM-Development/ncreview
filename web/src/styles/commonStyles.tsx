import { makeStyles } from '@material-ui/core/styles';
import { nonDiff, same, changed, removed, added, diffColors } from 'resources/constants';

const commonStyles = makeStyles(theme => ({
  nonDiff: {
    color: theme.palette.comparisons[nonDiff].dark + '!important',
  },
  nonDiff_light: {
    color: theme.palette.comparisons[nonDiff].light + '!important',
  },
  nonDiff_main: {
    color: theme.palette.comparisons[nonDiff].main + '!important',
  },
  nonDiff_dark: {
    color: theme.palette.comparisons[nonDiff].dark + '!important',
  },
  nonDiff_line: {
    color: diffColors[nonDiff].line + '!important',
  },
  same: {
    color: theme.palette.comparisons[same].dark + '!important',
  },
  same_light: {
    color: theme.palette.comparisons[same].light + '!important',
  },
  same_main: {
    color: theme.palette.comparisons[same].main + '!important',
  },
  same_dark: {
    color: theme.palette.comparisons[same].dark + '!important',
  },
  same_RxG: {
    color: diffColors[same+'_RxG'].fill + '!important',
  },
  same_light_RxG: {
    color: theme.palette.comparisons[same+'_RxG'].light + '!important',
  },
  same_main_RxG: {
    color: theme.palette.comparisons[same+'_RxG'].main + '!important',
  },
  same_dark_RxG: {
    color: theme.palette.comparisons[same+'_RxG'].dark + '!important',
  },
  changed: {
    color: theme.palette.comparisons[changed].dark + '!important',
  },
  changed_light: {
    color: theme.palette.comparisons[changed].light + '!important',
  },
  changed_main: {
    color: theme.palette.comparisons[changed].main + '!important',
  },
  changed_dark: {
    color: theme.palette.comparisons[changed].dark + '!important',
  },
  added: {
    color: theme.palette.comparisons[added].dark + '!important',
  },
  added_light: {
    color: theme.palette.comparisons[added].light + '!important',
  },
  added_main: {
    color: theme.palette.comparisons[added].main + '!important',
  },
  added_dark: {
    color: theme.palette.comparisons[added].dark + '!important',
  },
  removed: {
    color: theme.palette.comparisons[removed].dark + '!important',
  },
  removed_light: {
    color: theme.palette.comparisons[removed].light + '!important',
  },
  removed_main: {
    color: theme.palette.comparisons[removed].main + '!important',
  },
  removed_dark: {
    color: theme.palette.comparisons[removed].dark + '!important',
  },
  hide: {
    display: 'none',
  }
}));

export { commonStyles };
