// NPM packages
import React from 'react';
import { observer } from 'mobx-react';

// All other imports
import { Section } from 'components';
import { IVariable, IVariableDiff } from 'models/NCReviewData';
import { ExpandState } from 'models/MiscTypes';
import { commonStyles } from 'styles/commonStyles';


type VariableProps = {
    srcData: IVariable|IVariableDiff,
    expandSections: ExpandState,
    isDiff: boolean,
}

const Variable = observer(({ srcData, expandSections, isDiff }: VariableProps) => {
    const commonClasses = commonStyles();
    const diffClass = commonClasses[srcData.difference];

    let dimsList = "";
    const dims = srcData['dims'];
    if (Array.isArray(dims) && dims.length)
        dimsList = ` (${dims.join(', ')})`;
    else if (dims === 'varying')
        dimsList = ` (varying dimensions)`;

    const dimsListElem = <span>{ dimsList }</span>

    return (
        <Section
            srcData={ srcData }
            className={ diffClass }
            addlContent={ dimsListElem }
            expandSections={ expandSections }
            isDiff={ isDiff }
        />
    );
});

export { Variable };
