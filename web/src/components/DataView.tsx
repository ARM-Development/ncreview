// NPM packages
import React, { useEffect } from 'react';
import { observer } from 'mobx-react';

// All other imports
import { useServices } from 'services';
import { LoadStatus, ExpandState } from 'models/MiscTypes';
import { renderContents, StatusIndicator } from 'components';


type DataViewProps = {
    expandSections: ExpandState,
    isDiff: boolean,
}

const DataView = observer(({ expandSections, isDiff }: DataViewProps) => {
    const { dataService } = useServices();

    useEffect(() => {
        if (dataService.status === null)
            dataService.loadMaster();
    }, [dataService]);

    const statusMsg: LoadStatus = dataService.status;

    let ncreviewData = [];
    if (statusMsg === 'success') {
        ncreviewData = renderContents(dataService.data, 'primaryReviewGroup', expandSections, isDiff);
    }

    return (
        <>
            <StatusIndicator statusMsg={ statusMsg } />
            { ncreviewData }
        </>
    );
})

export { DataView };
