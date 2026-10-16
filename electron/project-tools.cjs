const fs=require('node:fs/promises');const syncFs=require('node:fs');const path=require('node:path');const {spawn}=require('node:child_process');
const schema=(name,description,properties,required=[])=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}});
const string={type:'string'},strings={type:'array',items:string};
const toolDefinitions=[
 schema('list_files','List project RTL and generated scene files. Hidden credentials/build folders are excluded.',{directory:string}),
 schema('read_file','Read a project RTL/include file or generated scene text. Use before writing a testbench.',{path:string},['path']),
 schema('write_file','Create/update an editable scene file only at .rtl-atlas/sim/<scene>/<file>. Existing RTL cannot be overwritten.',{path:string,content:string},['path','content']),
 schema('simulators','Discover available local iverilog/vvp and verilator executables.',{}),
 schema('run_simulation','Compile/run .rtl-atlas/sim/<scene>/run.json. Config: engine iverilog|verilator, top testbench module, sources project-relative file array (include the testbench), optional includeDirs, defines, waveform (default waves.vcd), dutPath and instanceId. TB must use $dumpfile/$dumpvars, deterministic clock/reset/input stimulus, bounded $finish. Runs in scene folder. Returns real logs, not invented values.',{scene:string},['scene']),
 schema('open_waveform','Open/restore a real project VCD in the waveform panel; use after successful simulation or to reopen a hidden waveform. Optional dutPath maps VCD DUT hierarchy to instanceId.',{path:string,dutPath:string,instanceId:string},['path']),
 schema('inspect_waveform','Read actual before/after values at an integer VCD tick. Omit time to use current UI cursor. Signal names must be full VCD hierarchical names.',{time:{type:'number'},signals:strings}),
 schema('read_waveform_view','Read the current trace file, cursor tick, timescale, phase, clock and recorded signal names. Use before explaining a particular cycle.',{})
];
const scenePattern=/^\.rtl-atlas\/sim\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,63})\//;
const secret=/(^|\/)(node_modules|\.git|\.env[^/]*|\.ssh|\.aws|api-settings\.json|auth\.json|credentials[^/]*)(\/|$)/i;
function throwIfAborted(signal){if(signal?.aborted)throw signal.reason||Error('Cancelled / 已取消');}
async function projectPath(root,relative,{create=false}={}){
 if(typeof relative!=='string'||!relative||relative.includes('\\')||relative.includes('\0')||path.isAbsolute(relative)||relative.split('/').includes('..')||secret.test(relative))throw Error('Invalid project path / 工程路径无效');
 const parts=relative.split('/').filter(p=>p&&p!=='.');if(!parts.length)throw Error('Invalid project path');
 const realRoot=await fs.realpath(root);let target=realRoot;
 for(let i=0;i<parts.length;i++){target=path.join(target,parts[i]);try{const stat=await fs.lstat(target);if(stat.isSymbolicLink())throw Error('Symlink paths are not allowed / 不允许符号链接');if(i<parts.length-1&&!stat.isDirectory())throw Error('Invalid path directory');}catch(e){if(e.code!=='ENOENT')throw e;if(create&&i<parts.length-1)await fs.mkdir(target);else if(i<parts.length-1)throw e;}}
 return target;
}
async function runProcess(command,args,{cwd,signal,timeout=30000,wavePath,stdoutFile}={}){
 throwIfAborted(signal);
 return new Promise((resolve,reject)=>{
  const descriptor=stdoutFile?syncFs.openSync(stdoutFile,'w',0o600):null;
  const child=spawn(command,args,{cwd,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe'],env:{...process.env,PATH:`${process.env.PATH||''}:/opt/homebrew/bin:/usr/local/bin`}});let log='',settled=false,failure,outputBytes=0;
  const kill=()=>{try{if(process.platform==='win32')child.kill('SIGKILL');else process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}};
  const stop=error=>{failure=error;kill();};
  const abort=()=>stop(signal.reason||Error('Cancelled / 已取消'));
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>stop(Error('Simulation timeout / 仿真超时')),timeout);
  const watcher=wavePath?setInterval(async()=>{try{if((await fs.stat(wavePath)).size>32*1024*1024)stop(Error('VCD size limit (32 MiB)'));}catch{}},200):null;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(watcher)clearInterval(watcher);signal?.removeEventListener('abort',abort);if(descriptor!==null)syncFs.closeSync(descriptor);error?reject(error):resolve(value);};
  child.stdout.on('data',b=>{if(descriptor!==null){outputBytes+=b.length;if(outputBytes>32*1024*1024){stop(Error('Preprocessed HDL size limit'));return;}try{syncFs.writeSync(descriptor,b);}catch(e){stop(e);}}else log=(log+b).slice(-24000);});child.stderr.on('data',b=>{log=(log+b).slice(-24000);});
  child.once('error',e=>finish(Error(`${command} unavailable / 仿真器不可用: ${e.message}`)));
  child.once('close',code=>finish(failure,{code,log}));
  if(signal?.aborted)abort();
 });
}
class ProjectTools{
 constructor(project,{onWaveform=()=>{},onFile=()=>{}}={}){this.project=project;this.onWaveform=onWaveform;this.onFile=onFile;this.wave=null;this.view=null;this.bindings=new Map();this.definitions=toolDefinitions;}
 async list(directory=''){
  const files=[];const walk=async(relative,depth)=>{if(depth>12||files.length>=500)return;const folder=relative?await projectPath(this.project.root,relative):await fs.realpath(this.project.root);for(const item of await fs.readdir(folder,{withFileTypes:true})){const name=relative?relative+'/'+item.name:item.name;if(item.name==='build'||item.isSymbolicLink()||secret.test(name)||(item.name.startsWith('.')&&item.name!=='.rtl-atlas'))continue;if(item.isDirectory())await walk(name,depth+1);else if(/\.(svh?|vh?|json|md|txt|hex|mem|vcd)$/i.test(name))files.push(name);if(files.length>=500)break;}};
  await walk(directory,0);return {files,truncated:files.length>=500};
 }
 async text(relative){const target=await projectPath(this.project.root,relative);if(!/\.(svh?|vh?|json|md|txt|hex|mem)$/i.test(relative))throw Error('Unsupported text file');const stat=await fs.stat(target);if(!stat.isFile()||stat.size>256*1024)throw Error('Text file limit (256 KiB)');return fs.readFile(target,'utf8');}
 async open(relative,binding){
  const file=await projectPath(this.project.root,relative);if(!/\.vcd$/i.test(file))throw Error('Choose a VCD file');const stat=await fs.stat(file);if(!stat.isFile()||stat.size>32*1024*1024)throw Error('VCD size limit (32 MiB)');
  const {parseVcd}=await import('../shared/waveform.mjs');const wave=parseVcd(await fs.readFile(file,'utf8'));wave.file=relative;wave.scope=this.project.root;
  const map=binding||this.bindings.get(relative);if(map){if(typeof map.dutPath!=='string'||!map.dutPath||!this.project.instances[map.instanceId])throw Error('Invalid DUT mapping / DUT 映射无效');wave.binding=map;}
  const previous=this.wave?.file===relative?this.view:null;
  this.wave=wave;this.view=previous?{...previous,time:Math.min(previous.time,wave.endTime),signals:previous.signals.filter(name=>wave.signals.some(s=>s.name===name))}:{time:0,phase:'after',signals:[],clock:''};this.onWaveform(wave);
  return {file:relative,timescale:wave.timescale,endTime:wave.endTime,binding:wave.binding,signals:wave.signals.map(({name,width})=>({name,width}))};
 }
 setView(view){if(!this.wave)return;if(!view||!Number.isFinite(view.time)||view.time<0||view.time>this.wave.endTime||!['before','after'].includes(view.phase)||!Array.isArray(view.signals)||view.signals.length>64||!view.signals.every(s=>typeof s==='string'))throw Error('Invalid waveform view');this.view={time:view.time,phase:view.phase,clock:typeof view.clock==='string'?view.clock:'',signals:view.signals};}
 async execute(name,args={},options={}){
  throwIfAborted(options.signal);if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Invalid tool arguments');
  if(name==='list_files')return this.list(args.directory||'');
  if(name==='read_file')return {path:args.path,content:await this.text(args.path)};
  if(name==='write_file'){
   if(typeof args.path!=='string'||!scenePattern.test(args.path))throw Error('Writes require .rtl-atlas/sim/<scene>/ / 仅允许写入场景目录');
   if(typeof args.content!=='string'||Buffer.byteLength(args.content)>256*1024||! /\.(svh?|vh?|json|md|txt|hex|mem)$/i.test(args.path))throw Error('Invalid scene file / 场景文件无效');
   const target=await projectPath(this.project.root,args.path,{create:true});const temp=target+`.${process.pid}.${Date.now()}.tmp`;
   try{await fs.writeFile(temp,args.content,{flag:'wx',mode:0o600});await projectPath(this.project.root,args.path);await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true}).catch(()=>{});}
   this.onFile({file:args.path,content:args.content});return {path:args.path,bytes:Buffer.byteLength(args.content)};
  }
  if(name==='simulators'){
   const available={};for(const engine of ['iverilog','vvp','verilator']){try{const result=await runProcess(engine,[engine==='verilator'?'--version':'-V'],{cwd:this.project.root,signal:options.signal,timeout:5000});available[engine]=result.code===0;}catch(e){throwIfAborted(options.signal);available[engine]=false;}}return available;
  }
  if(name==='open_waveform')return this.open(args.path,args.dutPath?{dutPath:args.dutPath,instanceId:args.instanceId}:undefined);
  if(name==='read_waveform_view'){if(!this.wave)throw Error('No waveform open / 尚未打开波形');return {file:this.wave.file,timescale:this.wave.timescale,endTime:this.wave.endTime,binding:this.wave.binding,...this.view,recordedSignals:this.wave.signals.slice(0,200).map(s=>s.name)};}
  if(name==='inspect_waveform'){if(!this.wave)throw Error('No waveform open / 尚未打开波形');const {sampleWaveform}=await import('../shared/waveform.mjs');if(args.signals!==undefined&&(!Array.isArray(args.signals)||args.signals.length>64||!args.signals.every(s=>typeof s==='string')))throw Error('Invalid signal list');return {...sampleWaveform(this.wave,args.time??this.view.time,args.signals||this.view.signals),phase:this.view.phase};}
  if(name==='run_simulation')return this.run(args.scene,options.signal);
  throw Error('Unknown project tool / 未知工程工具');
 }
 async run(scene,signal){
  if(typeof scene!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(scene))throw Error('Invalid scene');const relative=`.rtl-atlas/sim/${scene}`,config=JSON.parse(await this.text(relative+'/run.json'));
  if(!['iverilog','verilator'].includes(config.engine)||typeof config.top!=='string'||!/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(config.top)||!Array.isArray(config.sources)||!config.sources.length||config.sources.length>300)throw Error('Invalid run.json: engine, top, sources required');
  const cwd=await projectPath(this.project.root,relative),sources=[];
  for(const file of config.sources){if(typeof file!=='string'||! /\.(sv|v)$/i.test(file))throw Error('Invalid simulation source');const source=await this.text(file);if(/\$system\b|\bimport\s*"DPI|\bexport\s*"DPI/i.test(source))throw Error('Shell system tasks and foreign code are not allowed');sources.push(await projectPath(this.project.root,file));}
  const includes=config.includeDirs||[],defines=config.defines||[];
  if(!Array.isArray(includes)||includes.length>50||!Array.isArray(defines)||defines.length>100||!defines.every(s=>typeof s==='string'&&/^[A-Za-z_][A-Za-z0-9_]*(=[A-Za-z0-9_'hHbBdDxXzZ.+-]+)?$/.test(s)))throw Error('Invalid simulation includes/defines');
  const includePaths=[];for(const dir of includes)includePaths.push(dir==='.'?await fs.realpath(this.project.root):await projectPath(this.project.root,dir));
  const waveName=config.waveform||'waves.vcd';if(typeof waveName!=='string'||waveName.includes('/')||! /^[a-zA-Z0-9_.-]+\.vcd$/i.test(waveName))throw Error('Invalid waveform file name');
  const waveRelative=relative+'/'+waveName,wavePath=await projectPath(this.project.root,waveRelative);await fs.rm(wavePath,{force:true});
  const build=await projectPath(this.project.root,relative+'/build/simulation',{create:true});
  const timeout=Math.min(120,Math.max(1,Number(config.timeoutSeconds)||30))*1000;
  // Validate expanded compiler inputs too: an include must not bypass source checks.
  const preprocessed=await projectPath(this.project.root,relative+'/build/preprocessed.sv',{create:true});
  const manifest=await projectPath(this.project.root,relative+'/build/includes.txt',{create:true});
  const preArgs=config.engine==='iverilog'?['-g2012','-E','-M','include='+manifest,'-o',preprocessed,...includePaths.flatMap(p=>['-I',p]),...defines.map(d=>'-D'+d),...sources]:['-E','-Wno-fatal',...includePaths.map(p=>'-I'+p),...defines.map(d=>'-D'+d),...sources];
  const preprocess=await runProcess(config.engine,preArgs,{cwd,signal,timeout:30000,stdoutFile:config.engine==='verilator'?preprocessed:undefined,wavePath:preprocessed});
  if(preprocess.code!==0)return {ok:false,stage:'preprocess',log:preprocess.log};
  if((await fs.stat(preprocessed)).size>32*1024*1024)throw Error('Preprocessed HDL size limit');
  const expanded=await fs.readFile(preprocessed,'utf8');
  if(/\$system\b|\bimport\s*"DPI|\bexport\s*"DPI/i.test(expanded))throw Error('Shell system tasks and foreign code are not allowed, including in headers');
  const projectRoot=await fs.realpath(this.project.root);
  if(config.engine==='iverilog'){const headers=(await fs.readFile(manifest,'utf8')).split(/\r?\n/).filter(Boolean);for(const header of headers){const resolved=path.resolve(cwd,header);await projectPath(this.project.root,path.relative(projectRoot,resolved).split(path.sep).join('/'));}}
  for(const match of expanded.matchAll(/`line\s+\d+\s+"([^"]+)"/g)){
   if(match[1].startsWith('<'))continue;
   const resolved=path.resolve(cwd,match[1]),rel=path.relative(projectRoot,resolved).split(path.sep).join('/');
   await projectPath(this.project.root,rel);
  }
  let compile,run;
  if(config.engine==='iverilog'){
   compile=await runProcess('iverilog',['-g2012','-s',config.top,'-o',build,...includePaths.flatMap(p=>['-I',p]),...defines.map(d=>'-D'+d),...sources],{cwd,signal,timeout:90000});
   if(compile.code===0)run=await runProcess('vvp',[build],{cwd,signal,timeout,wavePath});
  }else{
   compile=await runProcess('verilator',['--binary','--timing','--trace-vcd','-Wno-fatal','--top-module',config.top,'--Mdir',path.dirname(build),'-o','simulation',...includePaths.map(p=>'-I'+p),...defines.map(d=>'-D'+d),...sources],{cwd,signal,timeout:90000});
   if(compile.code===0)run=await runProcess(build,[],{cwd,signal,timeout,wavePath});
  }
  const log=[compile.log,run?.log].filter(Boolean).join('\n').slice(-24000);
  if(compile.code!==0)return {ok:false,stage:'compile',log};if(run.code!==0)return {ok:false,stage:'run',log};
  try{const stat=await fs.stat(wavePath);if(!stat.size||stat.size>32*1024*1024)throw Error('VCD size limit');}catch(e){return {ok:false,stage:'waveform',log:log+'\n'+(e.code==='ENOENT'?'No VCD produced: TB needs $dumpfile/$dumpvars / 未生成 VCD':e.message)};}
  if(config.dutPath&&config.instanceId)this.bindings.set(waveRelative,{dutPath:config.dutPath,instanceId:config.instanceId});
  return {ok:true,engine:config.engine,log,waveform:waveRelative};
 }
}
module.exports={ProjectTools,toolDefinitions,projectPath,runProcess};
