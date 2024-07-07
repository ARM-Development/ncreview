export type HighchartsChart = HTMLDivElement|undefined;

export type ZoneStop = {
    'value': number,
    'color': string,
    'fillColor': string,
};
export type ZoneStops = {
    'A': ZoneStop[],
    'B': ZoneStop[],
};

export type ColorArray = Array<string>;
export type ColorArrays = {
    'A': ColorArray,
    'B': ColorArray,
};
