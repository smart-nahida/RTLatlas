const {app,BrowserWindow,dialog,ipcMain,Menu,net,safeStorage}=require('electron');
const path=require('node:path');
const {AssistantClient}=require('./assistant.cjs');const {AssistantSettings}=require('./assistant-settings.cjs');const {buildContext}=require('./context.cjs');
const {parseProject}=require('./project.cjs');
const fs=require('node:fs/promises');const {ProjectTools,projectPath}=require('./project-tools.cjs');
let win,project=null,projectTools=null,projectBusy=false;
function sendEvent(event){if(win&&!win.isDestroyed())win.webContents.send('assistant:event',event);}
const dev=process.argv.includes('--dev');
const assistant=new AssistantClient(event=>{if(win&&!win.isDestroyed())win.webContents.send('assistant:event',event);},{fetchImpl:(url,options)=>net.fetch(url,options)});
const settings=()=>new AssistantSettings(path.join(app.getPath('userData'),'api-settings.json'),safeStorage);
async function demoRoot(){const source=path.join(app.isPackaged?process.resourcesPath:path.join(__dirname,'..'),'examples','vector_accelerator');return app.isPackaged?require('./demo-project.cjs').writableDemo(source,path.join(app.getPath('userData'),'demo-project')):source;}
async function load(root){
 if(projectBusy||assistant.busy)throw Error('Please finish the active operation / 请先完成当前操作');
 projectBusy=true;try{const candidate=await parseProject(root,{packaged:app.isPackaged,resourcesPath:process.resourcesPath});project=candidate;projectTools=new ProjectTools(project,{onWaveform:waveform=>sendEvent({type:'waveform',waveform}),onFile:({file,content})=>{project.files[file]=content;sendEvent({type:'file',file,content});}});assistant.resetConversation();return project;}finally{projectBusy=false;}
}
function handle(channel,fn){ipcMain.handle(channel,async(event,...args)=>{
 if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Invalid IPC sender');
 try{return {ok:true,value:await fn(...args)};}catch(e){return {ok:false,error:e.message};}
});}
handle('project:open',async()=>{const selected=await dialog.showOpenDialog(win,{title:'Open RTL project / 打开 RTL 工程',properties:['openDirectory']});return selected.canceled?null:load(selected.filePaths[0]);});
handle('project:demo',async()=>load(await demoRoot()));
handle('project:reload',async()=>load(project?.root||await demoRoot()));
function idle(){if(assistant.busy)throw Error('Stop the current question first / 请先停止问答');}
handle('assistant:settings',()=>settings().public());
handle('assistant:save',input=>{idle();const config=settings().save(input);assistant.configure(config);return settings().public();});
handle('assistant:test',async()=>{idle();if(!assistant.config){const config=settings().load();if(!config)throw Error('Configure an API first / 请先配置 API');assistant.configure(config);}return assistant.testConnection();});
handle('assistant:forget',()=>{idle();settings().clear();assistant.config=null;assistant.resetConversation();return true;});
handle('assistant:ask',async payload=>{
 if(!payload||typeof payload.question!=='string'||!payload.question.trim()||payload.question.length>16000||!['zh','en'].includes(payload.lang))throw Error('Invalid question / 问题无效');
 if(projectBusy)throw Error('Project is loading / 工程正在载入');if(!project)await load(await demoRoot());
 if(!assistant.config){const config=settings().load();if(!config)throw Error('Configure an API first / 请先配置 API');assistant.configure(config);}
 return assistant.ask({scope:project.root,context:buildContext(project,payload.instanceId,payload.nodeId,payload.lang),question:payload.question,lang:payload.lang,tools:projectTools});
});
handle('waveform:open',async payload=>{idle();if(!project)await load(await demoRoot());return projectTools.open(payload.path,payload.binding);});
handle('waveform:view',payload=>{projectTools?.setView(payload);return true;});
handle('waveform:import',async()=>{
 idle();if(!project)await load(await demoRoot());
 const selected=await dialog.showOpenDialog(win,{title:'Open waveform / 打开波形',properties:['openFile'],filters:[{name:'VCD',extensions:['vcd']}]});if(selected.canceled)return null;
 const source=selected.filePaths[0],stat=await fs.stat(source);if(!stat.isFile()||stat.size>32*1024*1024)throw Error('VCD size limit (32 MiB)');
 const text=await fs.readFile(source,'utf8');const {parseVcd}=await import('../shared/waveform.mjs');parseVcd(text);
 const relative=`.rtl-atlas/sim/imported/wave-${Date.now()}.vcd`,target=await projectPath(project.root,relative,{create:true});await fs.writeFile(target,text,{flag:'wx',mode:0o600});return projectTools.open(relative);
});
handle('assistant:cancel',()=>assistant.cancel());
handle('assistant:reset',()=>assistant.resetConversation());
function createWindow(){
 win=new BrowserWindow({width:1560,height:980,minWidth:1100,minHeight:720,title:'RTL Atlas',backgroundColor:'#f5f7fa',titleBarStyle:'hiddenInset',trafficLightPosition:{x:16,y:17},webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',event=>event.preventDefault());
 win.webContents.on('context-menu',(_event,params)=>{
  if(!params.isEditable)return;
  Menu.buildFromTemplate([{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{type:'separator'},{role:'selectAll'}]).popup({window:win});
 });
 win.webContents.session.setPermissionRequestHandler((_w,_permission,callback)=>callback(false));
 if(dev)win.loadURL('http://127.0.0.1:5173');else win.loadFile(path.join(__dirname,'..','dist','index.html'));
 const template=[{label:app.name,submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{type:'separator'},{role:'quit'}]},{role:'editMenu'},{label:'View',submenu:[{role:'togglefullscreen'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},...(dev?[{role:'toggleDevTools'}]:[])]},{role:'windowMenu'}];
 Menu.setApplicationMenu(Menu.buildFromTemplate(template));
 if(process.env.RTL_ATLAS_SMOKE==='1')win.webContents.once('did-finish-load',()=>setTimeout(async()=>{
  const info=await win.webContents.executeJavaScript('({title:document.title,bridge:typeof window.atlas,body:document.body.innerText.slice(0,100)})');
  console.log('ATLAS_SMOKE',JSON.stringify(info));app.quit();
 },1500));
}
app.whenReady().then(createWindow);app.on('window-all-closed',()=>{assistant.cancel();if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});

app.on('before-quit',()=>assistant.cancel());
