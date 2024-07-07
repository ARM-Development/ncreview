import React from 'react';
import { Header } from './Header';
import { Legend } from './Legend';
import { LinkToOriginalNCR } from './LinkToOriginalNCR';
import { StatusIndicator } from './StatusIndicator';
import { ToggleButton, OpenCloseButton, ColorSwatch, ColorDot, MiniColorDot } from './UIComponents';
import { ActionsSet } from './ActionsSet'
import { DataView } from './DataView';
import { Section, GroupDiff } from './Sections';
import { FileTimeline, Timeline } from './Timelines';
import { Bargraph } from './Bargraphs';
import { Variable } from './Variable';
import { D3Plot } from './D3Plot';
import { Plot, D3StateProxy } from './Plot';
import { DataTable } from './DataTable';
import { PlotToolbar } from './PlotToolbar';
import { VariablePlot } from './VariablePlot';
import { StaticValue, StaticValueDiff } from './StaticValue';
import { Summary, SummaryDiff, StaticSummary, StaticSummaryDiff } from './Summaries';

import { ExpandState } from 'models/MiscTypes';



const ComponentMap = {
    "section": Section,
    "groupDiff": GroupDiff,
    "datastream": undefined,
    "datastreamDiff": undefined,
    "fileTimeline": FileTimeline,
    "fileTimelineDiff": FileTimeline,
    "variable": Variable,
    "variableDiff": Variable,
    "timeline": Timeline,
    "timelineDiff": Timeline,
    "bargraph": Bargraph,
    "bargraphDiff": Bargraph,
    "plot": Plot,
    "plotDiff": Plot,
    "staticValue": StaticValue,
    "staticValueDiff": StaticValueDiff,
    "summary": Summary,
    "summaryDiff": SummaryDiff,
    "staticSummary": StaticSummary,
    "staticSummaryDiff": StaticSummaryDiff,
};

const renderContents = (dataSrc, className?: string, expandSections?: ExpandState, isDiff?: boolean) => {
    return dataSrc['contents'].map(content => {
        if (!(content.type in ComponentMap)) {
            throw new Error(`Unrecognized object type: ${content.type}`);
        }
        const ElemName = ComponentMap[content.type];
        const elemKey = `${content.type}${content.name}`;
        return (
            <ElemName
                srcData={ content }
                key={ elemKey }
                className={ className }
                expandSections={ expandSections }
                isDiff={ isDiff }
            />
        )
    });
}

export {
    Header,
    Legend,
    LinkToOriginalNCR,
    StatusIndicator,
    ActionsSet,
    ToggleButton, OpenCloseButton, ColorSwatch, ColorDot, MiniColorDot,
    DataView,
    Section, GroupDiff,
    FileTimeline, Timeline,
    Bargraph,
    Variable,
    D3Plot, D3StateProxy,
    Plot, 
    DataTable, PlotToolbar, VariablePlot,
    StaticValue, StaticValueDiff,
    Summary, SummaryDiff,
    StaticSummary, StaticSummaryDiff,
    renderContents,
};
