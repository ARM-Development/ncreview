import { makeAutoObservable } from 'mobx';
import Papa from 'papaparse';

// All other imports
import { LoadStatus } from 'models/MiscTypes';
import {
    AppType,
    IDataMaster,
    IDataDetails,
    IDataDetailsStatuses,
    NCReviewType,
    newDatastream,
    newDataDetail
} from 'models/NCReviewData';
import { setDiffColors } from 'resources/constants';
import { isEmpty } from 'utils';


export type DatastreamNames = [string, string|undefined];
export type DatastreamPaths = [string, string|undefined];
export type DataIds = number[];

interface PapaParseResult {
    "data": object[],
    "errors": object[],
    "meta": { // object with extra info
        "aborted": boolean,
        "cursor": number,
        "delimiter": string, // ","
        "fields": string[],  // e.g. ["beg", "end"]
        "linebreak": string, // e.g. "\r\n",
        "truncated": boolean,
    },
}

class DataService
{
    dataSource = "";
    status: LoadStatus = null;
    data: IDataMaster|undefined = undefined;
    reviewType:  AppType = '';
    sampleCount: number = -1;
    dataDetailsStatuses: IDataDetailsStatuses = {};
    dataDetails: IDataDetails = {};
    lastNewDataId: number = 0;

    constructor()
    {
        makeAutoObservable(this);
        this.setDataSource();
    }

    private setDataSource()
    {
        const id = window.location.href.split('?')[1] || "";
        if (!id) {
            this.setStatus("Response: Invalid request (no source provided for ncreview)");
            return;
        }
        this.dataSource = `${process.env.REACT_APP_URL_PREFIX}/data.php?id=${id}`;
    }

    async loadMaster()
    {
        if (this.status === null) {
            this.setStatus('loading');
            const response = await fetch(
                this.dataSource,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );
            if (response.ok && response.status !== 204 && response.status !== 205) {
                const responseData = await response.json();
                if (!isEmpty(responseData)) {
                    this.setDataMaster(responseData);
                }
                else {
                    this.setStatus("No data. Source returned an empty data object.");
                }
            }
            else {
                this.setStatus(`Response: ${response.status} (${response.statusText})`);
            }
        }
    }

    async loadDataDetail(dataId: number, dataType: string)
    {
        var instance = this;

        function onSuccess(results: PapaParseResult)
        {
            /* PapaParse will generally produce errors, because of malformed responses from the backend
            results.errors.forEach((error) => {
                console.log(`PapaParse csv parsing error: ${JSON.stringify(error)}`);
            });
            */
            instance.setDataDetail(dataId, dataType, results.data);
        }

        function onError(error)
        {
            // error parameter is odd.
            // typeof is object;
            //   JSON.stringify returns an empty object,
            //   as does Object.keys an empty array;
            //   but printing it to a string returns an Error message.
            instance.setDataDetailStatus(dataId, `Failed to read CSV data file of id ${dataId}: ${error}`);
        }

        if (this.dataDetailsStatuses[dataId] === undefined) {
            this.setDataDetailStatus(dataId, 'loading');
            Papa.parse(
                this.dataSource + `&num=${dataId}`,
                {
                    download: true,
                    header: true,
                    skipEmptyLines: true,
                    complete: onSuccess,
                    error: onError
                }
            );
        }
    }

    async addDataDetail(dataId: number, dataType: string, data: (string|string[]|number[])[])
    {
        if (this.dataDetailsStatuses[dataId] === undefined) {
            this.setDataDetailStatus(dataId, 'loading');

            let _data = JSON.parse(JSON.stringify(data));  // Make a copy to work with
            const labels = _data[0].split(', ').join(',');  // Copy the header
            _data.splice(0,1);  // Remove the header
            _data = Papa.unparse(  // Convert it to CSV
                _data,
                {
                    header: false,
                    delimiter: ',',
                    newline: '\n',
                }
            );
            _data = labels + '\n' + _data;  // Add the header back in
            const results = Papa.parse(  // Now we can work with it "normally"
                _data,
                {
                    header: true,
                    skipEmptyLines: true
                }
            );
            if (results.meta.aborted) {
                this.setDataDetailStatus(dataId, `Failed to read ${dataType} data of id ${dataId}.`);
            }
            else {
                results.errors.forEach((error) => {
                    console.log(`PapaParse csv parsing error: ${JSON.stringify(error)}`);
                });
                this.setDataDetail(dataId, dataType, results.data);
            }
        }
    }

    setDataMaster(master: object)
    {
        try {
            this.data = newDatastream(master);
            this.reviewType = master['type'];
            this.sampleCount = master['summary_times'].length;
            setDiffColors( this.reviewType === 'datastreamDiff' ? false : true );
            this.setStatus('success');
        }
        catch (e) {
            console.log(e);
            if (e instanceof Error)
                this.setStatus(`Error saving JSON data: ${e.message}`);
        }
    }

    setStatus(value: LoadStatus)
    {
        this.status = value;
    }

    getDatastreamNames(): DatastreamNames
    {
        return ( this.data
                 ? [this.data.names['A'], this.data.names['B']]
                 : ['', '']
               ) as DatastreamNames;
    }

    getDatastreamPaths(): DatastreamPaths
    {
        return ( this.data
                 ? [this.data.paths['A'], this.data.paths['B']]
                 : ['', '']
               ) as DatastreamPaths;
    }

    getDataIds(srcData: object): DataIds
    {
        const dataIds: DataIds = [];
        dataIds.push(srcData['ids']['A']);
        if (srcData['ids']['B']) {
            dataIds.push(srcData['ids']['B']);
        }
        return dataIds;
    }

    getNewDataIds(qty:number): DataIds
    {
        const dataIds: DataIds = [--this.lastNewDataId];
        for (let i=1; i < qty; i++)
            dataIds.push(--this.lastNewDataId);
        return dataIds;
    }

    setDataDetail(dataId, dataType, detailData)
    {
        try {
            this.dataDetails[dataId] = newDataDetail(
                dataId,
                dataType as NCReviewType,
                detailData,
            );
            this.setDataDetailStatus(dataId, 'success');
        }
        catch (e) {
            console.log(e);
            if (e instanceof Error)
                this.setDataDetailStatus(dataId, `Error saving CSV data of id ${dataId}: ${e.message}`);
        }
    }

    setDataDetailStatus(dataId, value: LoadStatus)
    {
        this.dataDetailsStatuses[dataId] = value;
    }

    getDataDetailsStatus(dataIds: number[]): LoadStatus
    {
        const instance = this;
        let detailsStatus: LoadStatus = null;

        dataIds.forEach((dataId, idx) => {
            const currentStatus = instance.dataDetailsStatuses[dataId];
            if (currentStatus) {
                if (currentStatus === 'loading') {
                    if (detailsStatus === null || detailsStatus === 'success')
                        detailsStatus = currentStatus; // Started loading, or still waiting for one to load
                    // Else don't overwrite a previous error, or just go with the flow
                }
                else if (currentStatus === 'success') {
                    if (detailsStatus === null && idx === 0)
                        detailsStatus = currentStatus; // Initialize success
                    // Else current success is irrelevant
                }
                else { // Load error for this one
                    if (detailsStatus === null || detailsStatus === 'loading' || detailsStatus === 'success')
                        detailsStatus = currentStatus; // Error state overwrites any previous non-error state
                    else
                        detailsStatus = `${detailsStatus}; ${currentStatus}`; // Accumulate error statuses
                }
            }
            // Else, passthrough, denotes load not yet started
        });

        return detailsStatus;
    }
}

export default DataService;
