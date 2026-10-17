import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-project-import-ui-'));let app;
async function put(file,text){const p=path.join(tmp,file);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,text);}
try{
 await put('lists/a.f','first.sv');await put('lists/b.f','second.sv');
 await put('lists/first.sv','module first;endmodule');await put('lists/second.sv','module second;endmodule');
 await put('core/demo.core','CAPI=2:\nname: local:demo:example:1.0\nfilesets:\n  rtl: {files: [top.sv], file_type: systemVerilogSource}\ntargets:\n  synth: {filesets: [rtl], toplevel: second}\n  sim: {filesets: [rtl], toplevel: first}\n');
 await put('core/top.sv','module first;endmodule module second;endmodule');
 app=await electron.launch({args:['.'],env:{...process.env,RTL_ATLAS_PYTHON:path.resolve('.venv/bin/python')}});
 await app.evaluate(({app},folder)=>app.setPath('userData',folder),path.join(tmp,'userData'));
 const page=await app.firstWindow();await page.locator('.welcome-screen').waitFor();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await app.evaluate(({dialog},folder)=>{
  globalThis.pick=folder;globalThis.response=1;globalThis.prompts=[];
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[globalThis.pick]});
  dialog.showMessageBox=async(_win,options)=>{globalThis.prompts.push(options);return {response:globalThis.response};};
 },path.join(tmp,'lists'));
 const open=()=>page.locator('.topbar').getByRole('button',{name:/^(打开工程|Open project)$/}).click();
 await open();await expect(page.locator('.tree-target').first()).toHaveText('second');
 assert.deepEqual(await app.evaluate(()=>globalThis.prompts[0].buttons),['a.f','b.f','Cancel / 取消']);
 await page.locator('.sidebar').getByRole('button',{name:/^(重新解析|Re-elaborate)$/}).click();
 await expect(page.locator('.tree-target').first()).toHaveText('second');
 assert.equal(await app.evaluate(()=>globalThis.prompts.length),1,'reload keeps selected filelist');
 await app.evaluate((_e,folder)=>{globalThis.pick=folder;globalThis.response=0;},path.join(tmp,'core'));
 await open();await expect(page.locator('.project-name')).toHaveText('core');
 await expect(page.locator('.tree-target').first()).toHaveText('second');
 assert.deepEqual(await app.evaluate(()=>globalThis.prompts.at(-1).buttons),['synth','sim','Cancel / 取消']);
 await app.evaluate((_e,folder)=>{globalThis.pick=folder;globalThis.response=2;},path.join(tmp,'lists'));
 await open();await expect(page.locator('.project-name')).toHaveText('core');
 await expect(page.locator('.tree-target').first()).toHaveText('second');
 assert.equal(await page.locator('.error-banner').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: native manifest choice, real configured hierarchy, reload retains choice, FuseSoC target choice, cancel preserves previous project.');
}finally{await app?.close();await fs.rm(tmp,{recursive:true,force:true});}
