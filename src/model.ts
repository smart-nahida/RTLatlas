import type {WaveformData} from '../shared/waveform.mjs';
export type {WaveformData,WaveSignal} from '../shared/waveform.mjs';
export interface WaveformView {time:number;phase:'before'|'after';clock:string;signals:string[]}
export type Lang='zh'|'en';
export interface Source {file:string;line:number;endLine:number}
export interface Port {name:string;direction:string;width:number;expression?:string;refs?:{id:string;name:string;width:number}[];source?:Source|null}
export interface GraphNode {id:string;label:string;kind:'instance'|'logic'|'input'|'output';detail:string;source:Source|null;sequential:boolean;ports:Port[];parameters?:Record<string,string>}
export interface GraphEdge {id:string;source:string;target:string;sourceHandle:string;targetHandle:string;signal:string;signalId:string;width:number;control:boolean}
export interface Instance {id:string;name:string;module:string;parent:string|null;children:string[];ports:Port[];parameters:Record<string,string>;source:Source|null;instanceSource:Source|null;graph:{nodes:GraphNode[];edges:GraphEdge[]}}
export interface Project {version:number;project:string;root:string;roots:string[];instances:Record<string,Instance>;files:Record<string,string>;diagnostics:string;notes:string[];demo?:boolean}
export interface Result<T> {ok:boolean;value?:T;error?:string}
export interface AssistantEvent {type:string;text?:string;stage?:string;id?:string;name?:string;status?:string;result?:string;file?:string;content?:string;waveform?:WaveformData}
export interface ApiSettings {baseUrl:string;model:string;stream:boolean;hasKey:boolean}
export interface AtlasBridge {platform:string;openWaveform:(payload:{path:string;binding?:{dutPath:string;instanceId:string}})=>Promise<Result<unknown>>;importWaveform:()=>Promise<Result<unknown>>;waveformView:(view:WaveformView)=>Promise<Result<boolean>>;openProject:()=>Promise<Result<Project|null>>;demo:()=>Promise<Result<Project>>;reload:()=>Promise<Result<Project>>;assistantSettings:()=>Promise<Result<ApiSettings|null>>;testAssistant:()=>Promise<Result<{model:string}>>;saveAssistant:(input:{baseUrl:string;model:string;stream:boolean;apiKey?:string;clearKey?:boolean})=>Promise<Result<ApiSettings>>;forgetAssistant:()=>Promise<Result<boolean>>;ask:(payload:{instanceId:string;nodeId:string|null;question:string;lang:Lang})=>Promise<Result<string>>;cancel:()=>Promise<Result<void>>;resetAssistant:()=>Promise<Result<void>>;onAssistant:(listener:(event:AssistantEvent)=>void)=>()=>void}
declare global {interface Window {atlas?:AtlasBridge}}
