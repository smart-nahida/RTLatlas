// VCD timestamps are integer ticks; same-timestamp changes collapse to stable values.
export function parseVcd(text,{maxSignals=4096,maxChanges=1000000}={}){
 if(typeof text!=='string'||text.length>32*1024*1024)throw Error('VCD size limit (32 MiB) / 波形文件过大');
 const tokens=/\S+/g;const next=()=>tokens.exec(text)?.[0];
 const scopes=[],signals=[],codes=new Map();let time=0,endTime=0,changes=0,timescale='1 ns',declared=false;
 const directive=()=>{const values=[];let token;while((token=next())!==undefined&&token!=='$end'){if(values.length>100000)throw Error('VCD directive limit');values.push(token);}if(token===undefined)throw Error('Incomplete VCD directive');return values;};
 let token;while((token=next())!==undefined){
  if(token==='$scope'){const values=directive();if(!values[1])throw Error('Invalid VCD scope');scopes.push(values[1]);}
  else if(token==='$upscope'){directive();scopes.pop();}
  else if(token==='$timescale'){timescale=directive().join(' ').replace(/(\d)\s*(s|ms|us|ns|ps|fs)$/, '$1 $2');if(!/^(1|10|100) (s|ms|us|ns|ps|fs)$/.test(timescale))throw Error('Invalid VCD timescale');}
  else if(token==='$var'){const values=directive(),width=Number(values[1]),code=values[2],name=values.slice(3).join('').replace(/^\\/,'');if(!code||!name||!Number.isInteger(width)||width<1||width>65536)throw Error('Invalid VCD variable');let samples=codes.get(code);if(!samples){samples=[];codes.set(code,samples);}signals.push({id:String(signals.length),name:[...scopes,name].join('.'),width,kind:values[0],changes:samples});if(signals.length>maxSignals)throw Error('VCD signal limit');}
  else if(token==='$enddefinitions'){directive();declared=true;}
  else if(['$dumpvars','$dumpon','$dumpoff','$dumpall','$end'].includes(token))continue;
  else if(token.startsWith('$'))directive();
  else if(token.startsWith('#')){const value=Number(token.slice(1));if(!/^#\d+$/.test(token)||!Number.isSafeInteger(value)||value<time)throw Error('Invalid VCD time');time=value;endTime=Math.max(time,endTime);}
  else {
   if(!declared)throw Error('Invalid VCD header');let value,code;
   if(/^[bBrR]/.test(token)){value=token.slice(1).toLowerCase();if(token[0].toLowerCase()==='b'?!/^[01xz]+$/.test(value):!Number.isFinite(Number(value)))throw Error('Invalid VCD value');code=next();if(!code)throw Error('Incomplete VCD value');}
   else if(/^[01xXzZ]/.test(token)){value=token[0].toLowerCase();code=token.slice(1);}
   else throw Error('Invalid VCD value record');
   if(!code)throw Error('Incomplete VCD value');const samples=codes.get(code);if(!samples)throw Error('Unknown VCD signal identifier');
   if(samples.at(-1)?.[0]===time)samples[samples.length-1]=[time,value];else if(samples.at(-1)?.[1]!==value){samples.push([time,value]);if(++changes>maxChanges)throw Error('VCD change limit');}
  }
 }
 if(!declared||!signals.length)throw Error('Invalid VCD: no declared signals / VCD 无信号');
 return {timescale,endTime,signals};
}
export function valueAt(signal,time,phase='after'){
 const list=signal.changes;let lo=0,hi=list.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(phase==='before'?list[mid][0]<time:list[mid][0]<=time)lo=mid+1;else hi=mid;}
 const value=lo?list[lo-1][1]:'x';if(signal.kind==='real'||signal.kind==='realtime')return value;
 return value.padStart(signal.width,/^[xz]/.test(value)?value[0]:'0').slice(-signal.width);
}
export function edgeTimes(signal,edge='rising'){
 if(!signal)return [];let before='x';const result=[];
 for(const [time,value] of signal.changes){if(edge==='change'||(edge==='rising'?before==='0'&&value==='1':before==='1'&&value==='0'))result.push(time);before=value;}return result;
}
export function sampleWaveform(wave,time,names){
 if(!Number.isFinite(time)||time<0||time>wave.endTime)throw Error('Invalid waveform time');
 const chosen=names?.length?wave.signals.filter(s=>names.includes(s.name)):wave.signals.slice(0,30);
 return {time,timescale:wave.timescale,signals:chosen.slice(0,64).map(s=>({name:s.name,width:s.width,kind:s.kind,value:valueAt(s,time),before:valueAt(s,time,'before')}))};
}
export function formatValue(value,radix='dec',signed=false,kind='wire'){
 if(kind==='real'||kind==='realtime')return value;
 if(/[xz]/i.test(value))return /^x+$/i.test(value)?'X':/^z+$/i.test(value)?'Z':value;
 if(!/^[01]+$/.test(value))return value;
 if(radix==='bin')return value;let n=BigInt('0b'+value);
 if(signed&&value[0]==='1')n-=1n<<BigInt(value.length);
 return radix==='hex'?'0x'+n.toString(16):n.toString(10);
}
