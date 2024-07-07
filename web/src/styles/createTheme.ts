import {
  createTheme as defaultCreateTheme,
  ThemeOptions,
  Theme
} from '@material-ui/core';
import type { PaletteColor, PaletteColorOptions } from '@material-ui/core/styles/createPalette'

/* eslint-disable no-unused-vars */
declare module '@material-ui/core/styles/createPalette' {
  interface TypeBackground {
    section: string,
  }
  interface Palette {
    comparisons: {
      nonDiff: PaletteColor,
      same: PaletteColor,
      same_RxG: PaletteColor,
      changed: PaletteColor,
      added: PaletteColor,
      removed: PaletteColor,
    }
  }
  interface PaletteOptions {
    comparisons?: {
      nonDiff: PaletteColorOptions,
      same: PaletteColorOptions,
      same_RxG: PaletteColorOptions,
      changed: PaletteColorOptions,
      added: PaletteColorOptions,
      removed: PaletteColorOptions,
    }
  }
}

declare module '@material-ui/core/styles/createTheme' {
  interface Theme {
    // Custom theme properties go here
  }
  interface ThemeOptions {
    // Allow users to configure the custom properties by also adding
    // the custom properties here
  }
}

export default function createTheme(options?: ThemeOptions): Theme {
  return defaultCreateTheme(options);
}
