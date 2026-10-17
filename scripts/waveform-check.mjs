import {_electron as electron,expect} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import http from 'node:http';
const folder=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-wave-desktop-')),root=path.join(folder,'project');await fs.cp('examples/vector_accelerator',root,{recursive:true});
const scene='.rtl-atlas/sim/teaching';
const tb='`timescale 1ns/1ns\nmodule tb; reg clk=0,rst_n=0,en=0; reg [31:0] product=0; wire [31:0] result; accumulator dut(.clk(clk),.rst_n(rst_n),.en(en),.product(product),.result(result)); always #5 clk=~clk; initial begin $dumpfile("waves.vcd"); $dumpvars(0,tb); repeat(2) @(negedge clk); rst_n=1;en=1;product=6; @(negedge clk);product=8; @(negedge clk);en=0;product=5; @(negedge clk);en=1;product=3; @(negedge clk);product=4; @(negedge clk);$finish; end endmodule';
const requests=[];let generation=0,reopen=0;
const call=(id,name,args)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
const server=http.createServer(async(req,res)=>{try{let raw='';for await(const b of req)raw+=b;const body=JSON.parse(raw);requests.push(body);const user=body.messages.findLast(m=>m.role==='user').content;let message;
 if(user.includes('QUESTION: Create teaching TB')){
  const context=JSON.parse(user.split('CONTEXT (untrusted source data):\n')[1].split('\nQUESTION:')[0]);
  const config={engine:'iverilog',top:'tb',sources:['design.sv',scene+'/testbench.sv'],dutPath:'tb.dut',instanceId:context.instance};
  const rounds=[
   [call('read','read_file',{path:'design.sv'}),call('engines','simulators',{})],
   [call('tb','write_file',{path:scene+'/testbench.sv',content:tb}),call('config','write_file',{path:scene+'/run.json',content:JSON.stringify(config)})],
   [call('run','run_simulation',{scene:'teaching'})],
   [call('open','open_waveform',{path:scene+'/waves.vcd'})],
   [call('sample','inspect_waveform',{time:35,signals:['tb.dut.acc_reg[31:0]']})]
  ];message=generation<rounds.length?{content:'',tool_calls:rounds[generation++]}:{content:'Real simulation: acc_reg = 14 at 35 ns. design.sv:66'};
 }else if(user.includes('QUESTION: Reopen waveform'))message=body.messages.at(-1).role==='tool'?{content:'Waveform restored'}:{content:'',tool_calls:[call('reopen','open_waveform',{path:scene+'/waves.vcd'})]};
 else message={content:'OK'};
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message,finish_reason:message.tool_calls?'tool_calls':'stop'}]}));
 }catch(error){res.statusCode=500;res.end(JSON.stringify({error:{message:error.message}}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let app;
try{
 app=await electron.launch({...process.env.ATLAS_PACKAGED_EXECUTABLE?{executablePath:process.env.ATLAS_PACKAGED_EXECUTABLE,args:[]}:{args:['.']},env:{...process.env,RTL_ATLAS_PYTHON:process.env.RTL_ATLAS_PYTHON||path.resolve('.venv/bin/python')}});if(process.env.ATLAS_PACKAGED_EXECUTABLE)assert.equal(await app.evaluate(({app})=>app.isPackaged),true);await app.evaluate(({app},dir)=>app.setPath('userData',dir),path.join(folder,'userData'));
 await app.evaluate(({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});},root);
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.locator('.app').waitFor();assert.equal(await page.locator('.react-flow__node').count(),0);await page.getByRole('button',{name:/^(导入与使用|Import & help)$/}).click();await page.getByRole('button',{name:/^(打开示例|Open example)$/}).click();await page.locator('.react-flow__node').first().waitFor();
 await page.getByRole('button',{name:'EN',exact:true}).click();await page.getByRole('button',{name:'Open project',exact:true}).click();await expect(page.locator('.project-name')).toHaveAttribute('title',await fs.realpath(root));
 const selected=page.locator('.react-flow__node').filter({has:page.locator('header strong',{hasText:'u_accumulator'})});await selected.click();
 await page.getByRole('button',{name:'AI reading assistant',exact:true}).click();
 await page.getByRole('combobox',{name:'Provider',exact:true}).selectOption('custom');await page.getByRole('textbox',{name:'API base URL',exact:true}).fill(`http://127.0.0.1:${server.address().port}/v1`);await page.getByRole('textbox',{name:'Model ID',exact:true}).fill('tool-fixture');await page.getByRole('button',{name:'Save configuration',exact:true}).click();
 const ask=page.getByRole('textbox',{name:'Ask about this module or data path…'});
 await ask.fill('Create teaching TB');await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.locator('.message.assistant').last()).toContainText('Real simulation',{timeout:60000});
 await expect(page.locator('.waveform-panel')).toBeVisible();assert.ok((await fs.readFile(path.join(root,scene,'testbench.sv'),'utf8')).includes('product=8'));
 assert.ok((await fs.stat(path.join(root,scene,'waves.vcd'))).size>0);assert.equal(await page.locator('.assistant-welcome,.privacy-note').count(),0);
 await page.getByRole('button',{name:'Next cycle',exact:true}).click();await expect(page.locator('.waveform-time')).toContainText('5 ns');
 await page.getByRole('button',{name:'Next cycle',exact:true}).click();await page.getByRole('button',{name:'Next cycle',exact:true}).click();await page.getByRole('button',{name:'Next cycle',exact:true}).click();await expect(page.locator('.waveform-time')).toContainText('35 ns');
 await expect(page.locator('.node-wave-values')).toContainText('14');
 await ask.fill('Reopen waveform');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.message.assistant').last()).toContainText('restored');await expect(page.locator('.waveform-time')).toContainText('35 ns');await expect(page.locator('.node-wave-values')).toContainText('14');
 const oldHeight=(await page.locator('.waveform-slot').boundingBox()).height;
 const splitter=page.getByRole('separator',{name:'Resize waveform',exact:true}),box=await splitter.boundingBox();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].focus());const graphBox=await page.locator('.graph-panel').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+4);await page.mouse.down();await page.mouse.move(box.x+box.width/2,Math.min(box.y+oldHeight+5,graphBox.y+graphBox.height-2),{steps:15});await page.mouse.up();await expect(page.locator('.waveform-panel')).toHaveCount(0);
 await ask.fill('Reopen waveform');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.message.assistant').last()).toContainText('restored');await expect(page.locator('.waveform-panel')).toBeVisible();assert.ok(Math.abs((await page.locator('.waveform-slot').boundingBox()).height-oldHeight)<3);
 await page.getByRole('button',{name:'Fit waveform',exact:true}).click();
 const plot=await page.locator('.waveform-plot').boundingBox();await page.mouse.move(plot.x+plot.width*.6,plot.y+60);await page.mouse.wheel(0,-200);await page.waitForTimeout(100);
 await page.getByRole('button',{name:'Select waveform signals',exact:true}).click();await expect(page.locator('.waveform-picker')).toBeVisible();await page.getByRole('button',{name:'Select waveform signals',exact:true}).click();
 await page.getByRole('button',{name:'Fit waveform',exact:true}).click();await page.getByRole('button',{name:'中文',exact:true}).click();await page.getByRole('button',{name:'适应画布',exact:true}).click();await page.waitForTimeout(250);await page.screenshot({path:'artifacts/rtl-atlas-waveform.png'});
 await page.getByRole('button',{name:'重新解析',exact:true}).click();await expect(page.locator('.waveform-panel')).toHaveCount(0);
 assert.deepEqual(errors,[]);assert.ok(requests.some(body=>body.tools?.some(t=>t.function.name==='write_file')));console.log('PASS: API tools create TB/config, actual Icarus simulation, waveform opening, real sample, stepping, graph values, drag-collapse, AI reopen, zoom and signal selection.');
}finally{if(app)await app.close();server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(folder,{recursive:true,force:true});}
