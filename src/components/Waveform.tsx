import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Maximize2,X,SlidersHorizontal} from 'lucide-react';
import {edgeTimes,valueAt,formatValue} from '../../shared/waveform.mjs';
import type {WaveformData,WaveSignal,WaveformView,Lang} from '../model';
function firstSignals(wave:WaveformData){
 const scoped=wave.binding?wave.signals.filter(s=>s.name.startsWith(wave.binding!.dutPath+'.')):wave.signals;
 const preferred=scoped.filter(s=>/(^|\.)(clk|clock|rst_n|reset|rst|en|data|product|acc_reg|result)(\[.*\])?$/i.test(s.name));
 const order=['clk','clock','rst_n','reset','rst','en','data','product','acc_reg','result'];
 return (preferred.length?preferred:scoped.length?scoped:wave.signals).sort((a,b)=>order.indexOf(a.name.split('.').pop()!.replace(/\[.*\]/,''))-order.indexOf(b.name.split('.').pop()!.replace(/\[.*\]/,''))).slice(0,10).map(s=>s.name);
}
function viewKey(wave:WaveformData){return 'atlas-wave:'+wave.scope+':'+wave.file;}
function initialView(wave:WaveformData){try{const stored=JSON.parse(localStorage.getItem(viewKey(wave))||'null');if(stored&&Array.isArray(stored.signals))return {...stored,signals:stored.signals.filter((name:string)=>wave.signals.some(s=>s.name===name)).slice(0,64),time:Math.min(wave.endTime,Math.max(0,Number(stored.time)||0))};}catch{}return {time:0,phase:'after',clock:wave.signals.find(s=>(!wave.binding||s.name.startsWith(wave.binding.dutPath+'.'))&&s.width===1&&/(^|\.)(clk|clock)$/i.test(s.name))?.name||'',signals:firstSignals(wave),radix:'dec',edge:'rising'};}
export default function Waveform({wave,lang,onView,onClose,onSource}:{wave:WaveformData;lang:Lang;onView:(view:WaveformView)=>void;onClose:()=>void;onSource:()=>void}){
 const zh=lang==='zh',initial=useMemo(()=>initialView(wave),[wave]);
 const [time,setTime]=useState<number>(initial.time),[phase,setPhase]=useState<'before'|'after'>(initial.phase==='before'?'before':'after'),[clock,setClock]=useState<string>(initial.clock),[names,setNames]=useState<string[]>(initial.signals),[radix,setRadix]=useState<string>(initial.radix||'dec'),[edge,setEdge]=useState<string>(initial.edge||'rising');
 const [range,setRange]=useState<[number,number]>([0,Math.max(1,wave.endTime)]),[width,setWidth]=useState(700),[picker,setPicker]=useState(false),[filter,setFilter]=useState('');
 const plot=useRef<HTMLDivElement>(null),drag=useRef<{x:number;range:[number,number];moved:boolean}|null>(null);
 const selected=useMemo(()=>names.map(name=>wave.signals.find(s=>s.name===name)).filter((s):s is WaveSignal=>!!s),[names,wave]);
 const clockSignal=wave.signals.find(s=>s.name===clock),steps=useMemo(()=>edgeTimes(clockSignal,edge),[clockSignal,edge]);
 useEffect(()=>{const view={time,phase,clock,signals:names};onView(view);try{localStorage.setItem(viewKey(wave),JSON.stringify({...view,radix,edge}));}catch{}},[time,phase,clock,names,radix,edge,onView,wave]);
 useEffect(()=>{const element=plot.current;if(!element)return;const observer=new ResizeObserver(entries=>{const next=Math.round(entries[0].contentRect.width);if(next>0)setWidth(next);});observer.observe(element);return()=>observer.disconnect();},[]);
 const left=Math.min(230,Math.max(150,width*.24)),right=Math.max(left+30,width-14),span=range[1]-range[0],x=(tick:number)=>left+(tick-range[0])/span*(right-left),tick=(position:number)=>Math.round(range[0]+(position-left)/(right-left)*span);
 function windowRange(start:number,end:number){const total=Math.max(1,wave.endTime),length=Math.min(total,Math.max(1,end-start)),a=Math.min(Math.max(0,start),total-length);setRange([a,a+length]);}
 useEffect(()=>{const element=plot.current;if(!element)return;const wheel=(event:WheelEvent)=>{if(Math.abs(event.deltaX)>Math.abs(event.deltaY))return;event.preventDefault();const box=element.getBoundingClientRect(),ratio=Math.max(0,Math.min(1,(event.clientX-box.left-left)/(right-left)));const scale=event.deltaY>0?1.25:.8;const length=Math.min(Math.max(1,wave.endTime),Math.max(1,span*scale)),center=range[0]+ratio*span;windowRange(center-ratio*length,center+(1-ratio)*length);};element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);},[range,left,right,span,wave.endTime]);
 function jump(direction:number){const next=direction>0?steps.find(t=>t>time):[...steps].reverse().find(t=>t<time);if(next===undefined)return;setTime(next);if(next<range[0]||next>range[1])windowRange(next-span*.25,next+span*.75);}
 const factor=Number(wave.timescale.split(' ')[0])||1,unit=wave.timescale.split(' ')[1]||'ns',timeLabel=(t:number)=>`${Number((t*factor).toPrecision(6))} ${unit}`;
 const rowHeight=37,top=28,height=Math.max(100,top+selected.length*rowHeight+8);
 function trace(signal:WaveSignal,index:number){
  const y=top+index*rowHeight,high=y+5,low=y+25,middle=y+17;
  const changes=signal.changes.filter(([t])=>t>range[0]&&t<range[1]);
  const points:[[number,string],...[number,string][]]=[[range[0],valueAt(signal,range[0])],...changes,[range[1],valueAt(signal,range[1])]];
  if(signal.width===1&&!['real','realtime'].includes(signal.kind)){let d='';for(let i=0;i<points.length;i++){const px=x(points[i][0]),py=points[i][1]==='1'?high:points[i][1]==='0'?low:middle;d+=i?` H ${px} V ${py}`:`M ${px} ${py}`;}return <path className="wave-trace wave-bit" d={d}/>;}
  return <>{points.slice(0,-1).map(([t,value],i)=>{const a=x(t),b=x(points[i+1][0]),label=formatValue(value.padStart(signal.width,/^[xz]/.test(value)?value[0]:'0'),radix,false,signal.kind),room=b-a;return <g key={i}><path className="wave-trace" d={`M ${a} ${high} H ${b} M ${a} ${low} H ${b}${i?` M ${a-3} ${high} L ${a+3} ${low} M ${a-3} ${low} L ${a+3} ${high}`:''}`}/>{room>label.length*7+8&&<text x={(a+b)/2} y={middle+3} textAnchor="middle">{label}</text>}</g>;})}</>;
 }
 return <section className="waveform-panel" aria-label={zh?'波形':'Waveform'}>
  <header className="waveform-toolbar"><strong title={wave.file}>{wave.file?.split('/').pop()||'VCD'}</strong><button aria-label={zh?'上一拍':'Previous cycle'} disabled={!steps.some(t=>t<time)} onClick={()=>jump(-1)}><ChevronLeft size={14}/></button><button aria-label={zh?'下一拍':'Next cycle'} disabled={!steps.some(t=>t>time)} onClick={()=>jump(1)}><ChevronRight size={14}/></button>
   <select aria-label={zh?'波形时钟':'Waveform clock'} value={clock} onChange={e=>setClock(e.target.value)}><option value="">{zh?'选择时钟':'Clock'}</option>{wave.signals.filter(s=>s.width===1).map(s=><option key={s.name} value={s.name}>{s.name.split('.').pop()}</option>)}</select>
   <select aria-label={zh?'采样边沿':'Sampling edge'} value={edge} onChange={e=>setEdge(e.target.value)}><option value="rising">↑</option><option value="falling">↓</option><option value="change">↕</option></select>
   <select aria-label={zh?'取值时刻':'Sampling phase'} value={phase} onChange={e=>setPhase(e.target.value as 'before'|'after')}><option value="after">{zh?'沿后':'After'}</option><option value="before">{zh?'沿前':'Before'}</option></select>
   <select aria-label={zh?'数值进制':'Value radix'} value={radix} onChange={e=>setRadix(e.target.value)}><option value="dec">DEC</option><option value="hex">HEX</option><option value="bin">BIN</option></select>
   <span className="waveform-time">{clock&&steps.includes(time)?`${zh?'第':'Cycle '}${steps.indexOf(time)+1}${zh?' 拍 · ':' · '}`:''}{timeLabel(time)}</span>
   <button aria-label={zh?'选择波形信号':'Select waveform signals'} onClick={()=>setPicker(!picker)}><SlidersHorizontal size={14}/></button><button aria-label={zh?'适应波形':'Fit waveform'} onClick={()=>setRange([0,Math.max(1,wave.endTime)])}><Maximize2 size={14}/></button><button aria-label={zh?'关闭波形':'Close waveform'} onClick={onClose}><X size={14}/></button>
  </header>
  {picker&&<div className="waveform-picker"><input aria-label={zh?'筛选波形信号':'Filter waveform signals'} value={filter} onChange={e=>setFilter(e.target.value)}/><div>{wave.signals.filter(s=>s.name.toLowerCase().includes(filter.toLowerCase())).slice(0,300).map(s=><label key={s.name}><input type="checkbox" checked={names.includes(s.name)} disabled={!names.includes(s.name)&&names.length>=64} onChange={e=>setNames(old=>e.target.checked?[...old,s.name]:old.filter(name=>name!==s.name))}/><code>{s.name}</code></label>)}</div></div>}
  <div className="waveform-plot" ref={plot} onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,range,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;const offset=(e.clientX-drag.current.x)/(right-left)*(drag.current.range[1]-drag.current.range[0]);if(Math.abs(e.clientX-drag.current.x)>3)drag.current.moved=true;if(drag.current.moved)windowRange(drag.current.range[0]-offset,drag.current.range[1]-offset);}} onPointerUp={e=>{if(drag.current&&!drag.current.moved){const local=e.clientX-e.currentTarget.getBoundingClientRect().left;if(local>=left)setTime(Math.max(0,Math.min(wave.endTime,tick(local))));}drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
   <svg width={width} height={height} role="img" aria-label={zh?'信号时序波形':'Signal timing waveform'}><defs><clipPath id="wave-clip"><rect x={left} y={top} width={right-left} height={height-top}/></clipPath></defs>
    {Array.from({length:Math.max(2,Math.floor((right-left)/110))},(_,i)=>{const count=Math.max(2,Math.floor((right-left)/110)),t=Math.round(range[0]+i/(count-1)*span),px=x(t);return <g key={i}><line className="wave-grid" x1={px} x2={px} y1={top} y2={height}/><text x={px} y={18} textAnchor={i===0?'start':i===count-1?'end':'middle'}>{timeLabel(t)}</text></g>;})}
    {selected.map((signal,index)=><g key={signal.name}><line className="wave-grid" x1={0} x2={right} y1={top+(index+1)*rowHeight} y2={top+(index+1)*rowHeight}/><text className="wave-name" x={12} y={top+index*rowHeight+13} onClick={onSource}><title>{signal.name}</title>{signal.name.split('.').pop()!.length>24?signal.name.split('.').pop()!.slice(0,22)+'…':signal.name.split('.').pop()}</text><text x={12} y={top+index*rowHeight+29}>{formatValue(valueAt(signal,time,phase),radix,false,signal.kind)}</text><g clipPath="url(#wave-clip)">{trace(signal,index)}</g></g>)}
    {time>=range[0]&&time<=range[1]&&<line className="wave-cursor" x1={x(time)} x2={x(time)} y1={top} y2={height}/>} 
   </svg>
  </div>
 </section>;
}
