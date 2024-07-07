// NPM packages
import React from 'react';
import ReactDOM from 'react-dom';
import { CssBaseline, ThemeProvider } from '@material-ui/core';

// All other imports
import App from 'components/App';
import Services from 'services/Services';
import ServicesProvider from 'services/ServicesProvider';
import DataService from 'services/DataService';
import createTheme from 'styles/createTheme';
import {
  diffColors,
  nonDiff, same, changed, removed, added
} from 'resources/constants';


const theme = createTheme({
  typography: {
    fontFamily: `"Helvetica", "Arial", sans-serif`,
  },
  palette: {
    type: 'dark',
    background: {
      default: 'rgba(35,35,35,1.0)',
      paper: 'rgba(255,255,255,0.08)',
      section: 'rgba(255,255,255,0.08)',
    },
    text: {
      primary: 'rgba(186,186,210,1.0)',
    },
    comparisons: {
      nonDiff: {
        light: diffColors[nonDiff].light,
        main: diffColors[nonDiff].main,
        dark: diffColors[nonDiff].dark,
        contrastText: diffColors[nonDiff].contrastText,
      },
      same: {
        light: diffColors[same].light,
        main: diffColors[same].main,
        dark: diffColors[same].dark,
        contrastText: diffColors[same].contrastText,
      },
      same_RxG: {
        light: diffColors[same+'_RxG'].light,
        main: diffColors[same+'_RxG'].main,
        dark: diffColors[same+'_RxG'].dark,
        contrastText: diffColors[same+'_RxG'].contrastText,
      },
      changed: {
        light: diffColors[changed].light,
        main: diffColors[changed].main,
        dark: diffColors[changed].dark,
        contrastText: diffColors[changed].contrastText,
      },
      removed: {
        light: diffColors[removed].light,
        main: diffColors[removed].main,
        dark: diffColors[removed].dark,
        contrastText: diffColors[removed].contrastText,
      },
      added: {
        light: diffColors[added].light,
        main: diffColors[added].main,
        dark: diffColors[added].dark,
        contrastText: diffColors[added].contrastText,
      }
    }
  }
});

const services: Services = {
  dataService: new DataService(),
};

// To see what mobx is doing...
// spy(event => {
//   console.log(event)
// })

ReactDOM.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ServicesProvider services={services}>
        <App />
      </ServicesProvider>
    </ThemeProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
