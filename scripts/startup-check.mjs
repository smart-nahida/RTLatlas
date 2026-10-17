import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-startup-')),root=path.join(tmp,'my-project'),userData=path.join(tmp,'userData');
await fs.cp('examples/counter',root,{recursive:true});let app;
async function launch(){
 app=await electron.launch({args:['.'],env:{...process.env,RTL_ATLAS_PYTHON:path.resolve('.venv/bin/python')}});
 await app.evaluate(({app},folder)=>app.setPath('userData',folder),userData);
 const page=await app.firstWindow();await page.locator('.welcome-screen').waitFor();
 await app.evaluate(({dialog})=>{globalThis.dialogOptions=[];dialog.showOpenDialog=async(_win,options)=>{globalThis.dialogOptions.push(options);return globalThis.nextSelection||{canceled:true,filePaths:[]};};});
 return page;
}
try{
 let page=await launch();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.screenshot({path:'/private/tmp/rtl-atlas-welcome.png'});
 await page.locator('.welcome-screen').getByRole('button',{name:/^(打开工程|Open project)$/}).click();
 await expect(page.locator('.welcome-screen')).toBeVisible();
 assert.equal(await app.evaluate(()=>globalThis.dialogOptions[0].defaultPath),undefined);
 await app.evaluate((_electron,folder)=>{globalThis.nextSelection={canceled:false,filePaths:[folder]};},root);
 await page.locator('.welcome-screen').getByRole('button',{name:/^(打开工程|Open project)$/}).click();
 await page.locator('.react-flow__node').first().waitFor();
 await app.evaluate(()=>{globalThis.nextSelection=null;});
 await page.locator('.topbar').getByRole('button',{name:/^(打开工程|Open project)$/}).click();
 await expect.poll(()=>app.evaluate(()=>globalThis.dialogOptions.length)).toBe(3);
 assert.equal(await app.evaluate(()=>globalThis.dialogOptions.at(-1).defaultPath),root);
 const imported=await page.evaluate(()=>window.atlas.importWaveform());assert.equal(imported.ok,true);
 assert.equal(await app.evaluate(()=>globalThis.dialogOptions.at(-1).defaultPath),await fs.realpath(root),'waveform import starts in current project when no waveform history');
 const waveFolder=path.join(tmp,'saved-waveforms'),waveFile=path.join(waveFolder,'trace.vcd');await fs.mkdir(waveFolder);
 await fs.writeFile(waveFile,'$timescale 1ns $end\n$scope module tb $end\n$var wire 1 ! clk $end\n$upscope $end\n$enddefinitions $end\n#0\n0!\n#5\n1!\n#10\n0!\n');
 await app.evaluate((_electron,file)=>{globalThis.nextSelection={canceled:false,filePaths:[file]};},waveFile);
 assert.equal((await page.evaluate(()=>window.atlas.importWaveform())).ok,true,'real waveform import succeeds');
 await app.evaluate(()=>{globalThis.nextSelection=null;});await page.evaluate(()=>window.atlas.importWaveform());
 assert.equal(await app.evaluate(()=>globalThis.dialogOptions.at(-1).defaultPath),waveFolder,'waveform chooser remembers its own location');
 assert.deepEqual(errors,[]);await app.close();app=null;
 page=await launch();
 await page.locator('.welcome-screen').getByRole('button',{name:/^(打开工程|Open project)$/}).click();
 await expect.poll(()=>app.evaluate(()=>globalThis.dialogOptions.length)).toBe(1);
 assert.equal(await app.evaluate(()=>globalThis.dialogOptions[0].defaultPath),root,'last project location survives an application restart');
 assert.equal(await page.locator('.react-flow__node').count(),0,'remembering location must not auto-open a project');
 await app.evaluate((_electron,folder)=>{globalThis.nextSelection={canceled:false,filePaths:[folder]};},root);
 await page.locator('.welcome-screen').getByRole('button',{name:/^(打开工程|Open project)$/}).click();await page.locator('.react-flow__node').first().waitFor();
 await app.evaluate(()=>{globalThis.nextSelection=null;});await page.evaluate(()=>window.atlas.importWaveform());
 assert.equal(await app.evaluate(()=>globalThis.dialogOptions.at(-1).defaultPath),waveFolder,'waveform directory also survives restart');
 console.log('PASS: welcome screen, cancelled picker, successful project load, picker location, restart persistence, waveform fallback; no automatic project load.');
}finally{await app?.close();await fs.rm(tmp,{recursive:true,force:true});}
