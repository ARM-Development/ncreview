# ncreview

A web-based viewer for ncreview data. ncreview compares netCDF files between two directories or summarizes from single directory.

Built on Create React App and the Data Services boilerplate.
[react-boilerplates @ stash.pnnl.gov](https://stash.pnnl.gov/projects/DITB/repos/react-boilerplates/browse)


## Setup

Currently the dev environment is set up locally. It may be transitioned to a container in the future.

1. Install node.js

2. Update npm, if it is not already up-to-date:

    `npm install -g npm`

3. Install all dependencies:

    `npm install`

4. Create a file .env.local, and update REACT_APP_URL_PREFIX to point to the relevant PHP web server.
For example, to enable calling files served from https://engineering.arm.gov/~user/ncreview/,  
set REACT_APP_URL_PREFIX=/~user/ncreview


Application should be ready to run.


## Running the App (Locally)

`npm start`

## Building the App for Development

To build the files that can be deployed to a development web directory, run the script `build.sh --web`.
It roughly follows the following procedure (except step 1):

1. In package.json, update "homepage".  
For example, to build for testing at https://engineering.arm.gov/~user/ncreview/,  
set "homepage": "/~user/ncreview"

2. Then run:  
    `npm run build`  
The command creates a folder ./build, containing optimized site files.

3. Copy the files in ./build/ to the location of your website.

## Errata

#### About D3
- Using anything other than D3 for plots appears problematic. Enabling users to send arbitrary quantities of data at the plots adds a difficult requirement. The plots handle lots of data points. And our use case has just enough oddities in its requirements that it's best to custom make our plots.
  Any 3rd-party library may come with nice features, or make not handling the plot nice, but either it will be too lightweight to do the custom things we want, or it will come with too much, and be too heavy for viewing 10,000 - 1,000,000+ data points for multiple plots on a page.
  So, do lots of research and experimentation if considering moving away from D3 in the future. Most of the plotting libraries are based on D3 anyway. And a lot went into choosing and setting up D3 in the first place for ncreview.

#### About HighCharts Boost
- Add modules/boost.js last.
- It's activated by default. Must disable on a chart-by-chart basis: boost.enabled = false
- If dataGrouping enabled (e.g. stockChart default), boost won't kick in.
- area fill: seems to work
- marker shape: circles only
- line width: 1px only
- point click handlers: tooltips seems to work
