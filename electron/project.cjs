const {spawn}=require('node:child_process');const path=require('node:path');
function parseProject(root,{packaged=false,resourcesPath='',python=process.env.RTL_ATLAS_PYTHON||'python3'}={}){
 return new Promise((resolve,reject)=>{
  const command=packaged?path.join(resourcesPath,'parser',process.platform==='win32'?'rtl-parser.exe':'rtl-parser'):python;
  const args=packaged?[]:[path.join(__dirname,'..','backend','parse_rtl.py')];
  const p=spawn(command,args,{stdio:['pipe','pipe','pipe'],env:{...process.env,PATH:`${process.env.PATH||''}:/opt/homebrew/bin:/usr/local/bin`}});
  let out='',err='',settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
  const timer=setTimeout(()=>{p.kill();finish(Error('RTL elaboration timed out (90 s) / RTL 展开超时'));},90000);
  p.stdin.on('error',()=>{});p.once('error',e=>finish(Error(`Parser unavailable / 解析器不可用: ${e.message}`)));
  p.stdout.on('data',x=>{out+=x;if(out.length>100*1024*1024){p.kill();finish(Error('Parser output too large / 工程过大'));}});
  p.stderr.on('data',x=>err=(err+x).slice(-16000));
  p.once('close',()=>{if(settled)return;try{const result=JSON.parse(out);result.ok?finish(null,result.project):finish(Error(result.error));}catch{finish(Error(err||'Invalid parser response / 解析器输出无效'));}});
  p.stdin.end(JSON.stringify({root}));
 });
}
module.exports={parseProject};
