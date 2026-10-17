import {_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import http from 'node:http';

// Use the shipped Electron runtime: its DOM return values can differ from Chromium fixtures.
const testData=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-desktop-api-'));
const requests=[];
const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body);requests.push({input,authorization:req.headers.authorization,url:req.url});
 if(input.messages.at(-1).content.includes('QUESTION: fail')){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":{"message":"test rejected"}}');return;}
 if(input.messages.at(-1).content.includes('QUESTION: scroll regression')){
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  res.write('data: '+JSON.stringify({choices:[{delta:{content:'Long answer\n'+'Explanation line\n'.repeat(80)}}]})+'\n\n');
  for(let i=0;i<12;i++){await new Promise(resolve=>setTimeout(resolve,150));if(res.destroyed)return;res.write('data: '+JSON.stringify({choices:[{delta:{content:`Stream continuation ${i}\n`}}]})+'\n\n');}
  res.end('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');return;
 }
 res.writeHead(200,{'Content-Type':'text/event-stream'});
 res.end('data: '+JSON.stringify({choices:[{delta:{content:'Connected API: design.sv:62'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const app=await electron.launch({args:['.'],env:{...process.env,RTL_ATLAS_PYTHON:process.env.RTL_ATLAS_PYTHON||path.resolve('.venv/bin/python')}});
await app.evaluate(({app},folder)=>app.setPath('userData',folder),testData);
try{
 const page=await app.firstWindow();
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.locator('.app').waitFor();
 assert.equal(await page.locator('.react-flow__node').count(),0,'startup must not automatically load a project');
 await expect(page.locator('.welcome-screen')).toBeVisible();await expect(page.locator('.welcome-screen').getByRole('button',{name:/^(打开工程|Open project)$/})).toBeVisible();
 for(const result of await page.evaluate(async()=>[await window.atlas.reload(),await window.atlas.importWaveform(),await window.atlas.ask({question:'hello',lang:'en',instanceId:'top',nodeId:null})])){assert.equal(result.ok,false);assert.match(result.error,/Open a project first/);}
 await app.evaluate(({dialog})=>{globalThis.originalOpenDialog=dialog.showOpenDialog;dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});
 await page.locator('.topbar').getByRole('button',{name:/^(打开工程|Open project)$/}).click();
 assert.equal(await page.locator('.react-flow__node').count(),0,'cancelling open must leave the workspace empty');
 await app.evaluate(({dialog})=>{dialog.showOpenDialog=globalThis.originalOpenDialog;delete globalThis.originalOpenDialog;});
 await page.reload();await page.locator('.app').waitFor();assert.equal(await page.locator('.react-flow__node').count(),0,'reloading must not open a demo');
 await page.getByRole('button',{name:/^(导入与使用|Import & help)$/}).click();
 await page.getByRole('dialog').getByRole('button',{name:/^(打开示例|Open example)$/}).click();
 assert.ok(await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.some(item=>item.submenu?.items.some(child=>child.role==='paste'))),'native Edit menu must provide Paste');
 await page.locator('.react-flow__node').first().waitFor();
 await page.getByRole('button',{name:/^(显示选项|Display options)$/}).click();
 await page.getByRole('checkbox',{name:/^(时钟 \/ 复位|Clock \/ reset)$/}).check();
 await page.getByRole('button',{name:/^(显示选项|Display options)$/}).click();
 await page.waitForTimeout(500); // Let the initial fit animation finish before measuring gestures.
 const coveredLabels=()=>page.evaluate(()=>{
  const nodes=[...document.querySelectorAll('.react-flow__node')].map(el=>el.getBoundingClientRect());
  return [...document.querySelectorAll('.react-flow__edge-textbg')].filter(el=>{
   const box=el.getBoundingClientRect();
   return nodes.some(node=>box.left<node.right-1&&box.right>node.left+1&&box.top<node.bottom-1&&box.bottom>node.top+1);
  }).map(el=>el.parentElement.textContent);
 });
 assert.deepEqual(await coveredLabels(),[],'signal labels and bit widths stay outside module cards');
 const overlaps=await page.evaluate(()=>{
  const edges=[...document.querySelectorAll('.react-flow__edge')].map(el=>{
   const path=el.querySelector('.react-flow__edge-path');const segments=[];let start=null,axis=null,previous=path.getPointAtLength(0);
   for(let at=3;at<=path.getTotalLength();at+=3){const point=path.getPointAtLength(at);const nextAxis=Math.abs(point.x-previous.x)<.01?'v':Math.abs(point.y-previous.y)<.01?'h':null;
    if(nextAxis!==axis){if(start&&axis&&Math.hypot(previous.x-start.x,previous.y-start.y)>15)segments.push({axis,a:{x:start.x,y:start.y},b:{x:previous.x,y:previous.y}});start=previous;axis=nextAxis;}previous=point;
   }
   if(start&&axis&&Math.hypot(previous.x-start.x,previous.y-start.y)>15)segments.push({axis,a:{x:start.x,y:start.y},b:{x:previous.x,y:previous.y}});
   return {name:el.getAttribute('aria-label').split(':')[0],segments};
  });
  const found=[];
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){if(edges[i].name===edges[j].name)continue;
   for(const a of edges[i].segments)for(const b of edges[j].segments){if(a.axis!==b.axis)continue;const fixed=a.axis==='v'?'x':'y',vary=a.axis==='v'?'y':'x';
    if(Math.abs(a.a[fixed]-b.a[fixed])<.1&&Math.min(Math.max(a.a[vary],a.b[vary]),Math.max(b.a[vary],b.b[vary]))-Math.max(Math.min(a.a[vary],a.b[vary]),Math.min(b.a[vary],b.b[vary]))>15)found.push(edges[i].name+' / '+edges[j].name);
   }
  }return [...new Set(found)];
 });
 assert.deepEqual(overlaps,[],'different signals must not share long routing segments');
 await page.screenshot({path:'artifacts/rtl-atlas-routing.png'});

 const viewport=()=>page.locator('.react-flow__viewport').evaluate(el=>{
  const matrix=new DOMMatrix(getComputedStyle(el).transform);
  return {x:matrix.m41,y:matrix.m42,zoom:matrix.a};
 });
 const canvas=await page.locator('.react-flow__pane').boundingBox();
 const pointer={x:canvas.x+60,y:canvas.y+60};
 await page.mouse.move(pointer.x,pointer.y);
 const initial=await viewport();
 await page.mouse.wheel(0,-240);
 await expect.poll(async()=>(await viewport()).zoom).toBeGreaterThan(initial.zoom);
 await page.waitForTimeout(300);
 const enlarged=await viewport();
 await page.mouse.wheel(0,240);
 await expect.poll(async()=>(await viewport()).zoom).toBeLessThan(enlarged.zoom);
 await page.waitForTimeout(300);
 const beforeDrag=await viewport();
 await page.mouse.move(pointer.x,pointer.y);
 await page.mouse.down({button:'left'});
 await page.mouse.move(pointer.x+90,pointer.y+55,{steps:8});
 await page.mouse.up({button:'left'});
 const afterDrag=await viewport();
 assert.ok(Math.abs(afterDrag.x-beforeDrag.x-90)<2&&Math.abs(afterDrag.y-beforeDrag.y-55)<2,'left drag pans the canvas');
 assert.equal(afterDrag.zoom,beforeDrag.zoom,'dragging keeps the zoom level');
 const accumulator=page.locator('.react-flow__node').filter({has:page.locator('header strong',{hasText:'u_accumulator'})});
 await accumulator.click();
 await expect(page.locator('.inspector')).toHaveAttribute('data-selection','u_accumulator');
 await accumulator.dblclick();
 await expect(page.locator('.breadcrumbs')).toContainText('u_accumulator');
 await page.getByRole('button',{name:'中文',exact:true}).click();
 await page.getByRole('button',{name:'AI 阅读助手',exact:true}).click();
 await page.locator('.assistant-panel').waitFor();
 await page.getByRole('textbox',{name:'模型 ID',exact:true}).fill('test-draft-model');
 assert.equal(await page.evaluate(()=>typeof window.atlas.ask),'function','assistant bridge is available');
 await page.getByRole('button',{name:'EN',exact:true}).click();
 await page.locator('.assistant-header').getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'AI reading assistant',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'Model ID',exact:true}).inputValue(),'test-draft-model');
 if(!await page.locator('.api-settings').isVisible())await page.locator('.assistant-header').getByRole('button',{name:'API settings',exact:true}).click();
 await page.getByRole('button',{name:'Save configuration',exact:true}).waitFor();
 await page.getByRole('combobox',{name:'Provider',exact:true}).selectOption('custom');
 await page.getByRole('textbox',{name:'API base URL',exact:true}).fill(`http://127.0.0.1:${server.address().port}/v1`);
 await page.getByRole('textbox',{name:'Model ID',exact:true}).fill('fixture-model');
 await app.evaluate(async({clipboard,ClipboardItem})=>{
  globalThis.atlasClipboardBackup=await Promise.all((await clipboard.read()).filter(item=>item.types.length>0).map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))));
  await clipboard.writeText('fixture-api-key');
 });
 try{
  await page.getByRole('textbox',{name:'API Key',exact:true}).click();
  await page.keyboard.press(process.platform==='darwin'?'Meta+V':'Control+V');
  await expect(page.getByRole('textbox',{name:'API Key',exact:true})).toHaveValue('fixture-api-key');
 }finally{await app.evaluate(async({clipboard})=>{await clipboard.write(globalThis.atlasClipboardBackup);delete globalThis.atlasClipboardBackup;});}
 await page.getByRole('button',{name:'Save configuration',exact:true}).click();
 await expect(page.locator('.assistant-status')).toContainText('Saved · not verified');
 assert.equal((await page.evaluate(()=>window.atlas.assistantSettings())).value.apiKey,undefined,'saved key never crosses back into renderer');
 const settingsText=await fs.readFile(path.join(testData,'api-settings.json'),'utf8');
 assert.ok(!settingsText.includes('fixture-api-key'),'real OS encryption keeps key out of settings JSON');
 await page.getByRole('textbox',{name:'Ask about this module or data path…'}).fill('Explain the selected module');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.locator('.message.assistant').last()).toContainText('Connected API: design.sv:62');
 assert.equal(requests[0].url,'/v1/chat/completions');assert.equal(requests[0].authorization,'Bearer fixture-api-key');assert.equal(requests[0].input.model,'fixture-model');
 assert.match(requests[0].input.messages.at(-1).content,/accumulator/);
 await page.locator('.citation').last().click();
 await expect(page.locator('.source-table tr.in-range').first()).toHaveAttribute('data-line','62');
 await page.getByRole('textbox',{name:'Ask about this module or data path…'}).fill('Follow up');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.locator('.message.assistant').last()).toContainText('Connected API');
 assert.ok(requests[1].input.messages.some(message=>message.role==='assistant'),'follow-up keeps conversation');
 await page.getByRole('textbox',{name:'Ask about this module or data path…'}).fill('fail');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.locator('.message.assistant').last()).toContainText('401');
 await page.getByRole('textbox',{name:'Ask about this module or data path…'}).fill('Retry');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.locator('.message.assistant').last()).toContainText('Connected API');
 await page.getByRole('textbox',{name:'Ask about this module or data path…'}).fill('scroll regression');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.locator('.message.assistant').last()).toContainText('Long answer');
 const messages=page.locator('.assistant-messages');
 await messages.evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});
 await expect(page.locator('.message.assistant').last()).toContainText('Stream continuation 3');
 assert.ok(await messages.evaluate(el=>el.scrollTop<50),'streaming must preserve position when reading earlier messages');
 await page.getByRole('button',{name:'Jump to latest',exact:true}).click();
 await expect.poll(()=>messages.evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)).toBeLessThan(50);
 await expect(page.getByRole('button',{name:'Send',exact:true})).toBeVisible();
 const splitter=page.getByRole('separator',{name:'Resize source and assistant',exact:true});
 const initialSource=await page.locator('.inspector-main').boundingBox();
 await splitter.press('ArrowUp');
 assert.ok((await page.locator('.inspector-main').boundingBox()).height<initialSource.height-15,'splitter lets assistant expand vertically');
 await splitter.press('ArrowDown');
 await expect.poll(async()=>Math.abs((await page.locator('.inspector-main').boundingBox()).height-initialSource.height)).toBeLessThan(2);
 const grip=await splitter.boundingBox();
 await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);
 await page.mouse.down();await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2+60,{steps:6});await page.mouse.up();
 await expect.poll(async()=>(await page.locator('.inspector-main').boundingBox()).height-initialSource.height).toBeGreaterThan(55);
 await splitter.press('Home');
 await page.locator('.assistant-header').getByRole('button',{name:'API settings',exact:true}).click();
 await page.getByRole('button',{name:'Save configuration',exact:true}).waitFor();

 await page.getByRole('button',{name:'Save and test connection',exact:true}).click();
 await expect(page.locator('.assistant-status')).toContainText('Connection verified');
 assert.equal(requests.at(-1).input.max_tokens,16);
 assert.ok(!JSON.stringify(requests.at(-1).input).includes('module accumulator'),'connection test does not upload project source');
 await page.locator('.assistant-header').getByRole('button',{name:'API settings',exact:true}).click();
 await page.screenshot({path:'artifacts/rtl-atlas-api-settings.png'});
 assert.ok(await page.locator('.react-flow__node').count()>0,'graph remains available');
 assert.deepEqual(errors,[],'local browsing and changing locale must not crash React');
 console.log('PASS: wheel zoom, left drag pan, module selection/drilldown, and API settings/encrypted key/streaming/follow-up/error recovery; no page errors.');
}finally{await app.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fs.rm(testData,{recursive:true,force:true});}
