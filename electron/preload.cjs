const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('atlas',{
 platform:process.platform,
 openProject:()=>ipcRenderer.invoke('project:open'),
 demo:()=>ipcRenderer.invoke('project:demo'),
 reload:()=>ipcRenderer.invoke('project:reload'),
 assistantSettings:()=>ipcRenderer.invoke('assistant:settings'),
 saveAssistant:input=>ipcRenderer.invoke('assistant:save',input),
 testAssistant:()=>ipcRenderer.invoke('assistant:test'),
 forgetAssistant:()=>ipcRenderer.invoke('assistant:forget'),
 ask:payload=>ipcRenderer.invoke('assistant:ask',payload),
 cancel:()=>ipcRenderer.invoke('assistant:cancel'),
 resetAssistant:()=>ipcRenderer.invoke('assistant:reset'),
 openWaveform:payload=>ipcRenderer.invoke('waveform:open',payload),
 importWaveform:()=>ipcRenderer.invoke('waveform:import'),
 waveformView:payload=>ipcRenderer.invoke('waveform:view',payload),
 onAssistant:callback=>{const listener=(_event,data)=>callback(data);ipcRenderer.on('assistant:event',listener);return()=>{ipcRenderer.removeListener('assistant:event',listener);};}
});
