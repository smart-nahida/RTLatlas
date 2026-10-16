export interface WaveSignal {id:string;name:string;width:number;kind:string;changes:[number,string][]}
export interface WaveformData {timescale:string;endTime:number;signals:WaveSignal[];file?:string;scope?:string;binding?:{dutPath:string;instanceId:string}}
export function parseVcd(text:string,limits?:{maxSignals?:number;maxChanges?:number}):WaveformData;
export function valueAt(signal:WaveSignal,time:number,phase?:string):string;
export function edgeTimes(signal:WaveSignal|undefined,edge?:string):number[];
export function sampleWaveform(wave:WaveformData,time:number,names?:string[]):unknown;
export function formatValue(value:string,radix?:string,signed?:boolean,kind?:string):string;
