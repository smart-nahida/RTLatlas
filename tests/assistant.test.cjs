const {test}=require('node:test');const assert=require('node:assert/strict');const http=require('node:http');
const {AssistantClient,normalizeConfig}=require('../electron/assistant.cjs');
async function fixture(handler){const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;handler(req,res,JSON.parse(body||'{}'));});await new Promise(r=>server.listen(0,'127.0.0.1',r));return {baseUrl:`http://127.0.0.1:${server.address().port}/v1`,close:()=>new Promise(r=>{server.closeAllConnections();server.close(r);})};}
const question={scope:'project-a',context:'module accumulator; endmodule',question:'Explain',lang:'en'};
test('normalizes compatible base URLs and accepts explicit endpoints',()=>{
 assert.equal(normalizeConfig({baseUrl:'https://api.deepseek.com/',model:'custom-model',apiKey:'secret'}).endpoint,'https://api.deepseek.com/chat/completions');
 assert.equal(normalizeConfig({baseUrl:'https://example.com/v1/chat/completions',model:'m',apiKey:''}).endpoint,'https://example.com/v1/chat/completions');
 assert.throws(()=>normalizeConfig({baseUrl:'file:///tmp/key',model:'m'}),/URL|https/i);
 assert.throws(()=>normalizeConfig({baseUrl:'https://user:secret@example.com',model:'m'}),/URL|credentials/i);
});
test('streams split UTF-8/SSE packets to final answer and sends selected source without tools',async()=>{
 let body,authorization;const events=[];
 const server=await fixture((req,res,input)=>{body=input;authorization=req.headers.authorization;res.writeHead(200,{'Content-Type':'text/event-stream'});const bytes=Buffer.from('data: {"choices":[{"delta":{"reasoning_content":"hidden reasoning"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":" RTL"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');res.write(bytes.subarray(0,132));res.end(bytes.subarray(132));});
 const c=new AssistantClient(e=>events.push(e));c.configure({baseUrl:server.baseUrl,apiKey:'secret',model:'custom-model'});
 try{assert.equal(await c.ask(question),'你好 RTL');assert.equal(body.model,'custom-model');assert.equal(body.stream,true);assert.equal(body.tools,undefined);assert.match(body.messages.at(-1).content,/module accumulator/);assert.equal(authorization,'Bearer secret');assert.equal(c.busy,false);assert.ok(events.some(e=>e.text==='你好 RTL'));assert.ok(!events.some(e=>e.text?.includes('hidden reasoning')));}finally{await server.close();}
});
test('JSON-only providers work and conversation resets on project change',async()=>{
 const requests=[];const server=await fixture((_req,res,body)=>{requests.push(body);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'answer'},finish_reason:'stop'}]}));});
 const c=new AssistantClient(()=>{});c.configure({baseUrl:server.baseUrl,model:'local-model',apiKey:''});
 try{await c.ask(question);await c.ask({...question,question:'Follow up'});assert.ok(requests[1].messages.some(m=>m.role==='assistant'&&m.content==='answer'));await c.ask({...question,scope:'project-b'});assert.equal(requests[2].messages.filter(m=>m.role==='user').length,1);c.resetConversation();await c.ask(question);assert.equal(requests[3].messages.filter(m=>m.role==='user').length,1);}finally{await server.close();}
});
test('HTTP failures redact keys and permit a retry',async()=>{
 let count=0;const server=await fixture((_req,res)=>{if(!count++){res.writeHead(401);res.end('{"error":{"message":"bad key secret-value"}}');}else res.end('{"choices":[{"message":{"content":"OK"}}]}');});
 const c=new AssistantClient(()=>{});c.configure({baseUrl:server.baseUrl,model:'m',apiKey:'secret-value'});
 try{await assert.rejects(c.ask(question),e=>/401/.test(e.message)&&!e.message.includes('secret-value'));assert.equal(c.busy,false);assert.equal(await c.ask(question),'OK');}finally{await server.close();}
});
test('a truncated stream is rejected instead of reported as a complete answer',async()=>{
 const server=await fixture((_req,res)=>{res.setHeader('Content-Type','text/event-stream');res.end('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');});
 const c=new AssistantClient(()=>{});c.configure({baseUrl:server.baseUrl,model:'m'});try{await assert.rejects(c.ask(question),/incomplete|中断/i);assert.equal(c.busy,false);}finally{await server.close();}
});
test('stop aborts a pending response and configuration cannot change mid-question',async()=>{
 let started;const ready=new Promise(r=>started=r);const server=await fixture((_req,res)=>{res.writeHead(200,{'Content-Type':'text/event-stream'});res.write(': keep-alive\n\n');started();});
 const c=new AssistantClient(()=>{});c.configure({baseUrl:server.baseUrl,model:'m'});
 try{const answer=c.ask(question);const rejected=assert.rejects(answer,/cancel|取消/i);await ready;assert.throws(()=>c.configure({baseUrl:server.baseUrl,model:'other'}),/running|进行中/i);c.cancel();await rejected;assert.equal(c.busy,false);}finally{await server.close();}
});
test('DONE completes the answer even when a provider keeps the connection open',async()=>{
 const server=await fixture((_req,res)=>{res.writeHead(200,{'Content-Type':'text/event-stream'});res.write('data: {"choices":[{"delta":{"content":"finished"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');});
 const c=new AssistantClient(()=>{},{timeout:120});c.configure({baseUrl:server.baseUrl,model:'m'});try{assert.equal(await c.ask(question),'finished');}finally{await server.close();}
});
test('plain-text 401 response explains authentication failure and redacts the key',async()=>{
 const server=await fixture((_req,res)=>{res.writeHead(401,{'Content-Type':'text/plain'});res.end('Authentication Fails private-token');});
 const c=new AssistantClient(()=>{});c.configure({baseUrl:server.baseUrl,model:'m',apiKey:'private-token'});
 try{await assert.rejects(c.ask(question),error=>/401/.test(error.message)&&/Authentication Fails/.test(error.message)&&/API Key/.test(error.message)&&!error.message.includes('private-token'));}finally{await server.close();}
});
test('connection test sends a bounded probe without project source or conversation history',async()=>{
 const requests=[];const server=await fixture((_req,res,input)=>{requests.push(input);res.setHeader('Content-Type','application/json');res.end('{"choices":[{"message":{"content":"OK"}}]}');});
 const c=new AssistantClient(()=>{});c.configure({baseUrl:server.baseUrl,model:'m'});
 try{await c.ask({...question,context:'private project source'});assert.deepEqual(await c.testConnection(),{model:'m'});assert.equal(requests[1].stream,false);assert.equal(requests[1].max_tokens,16);assert.ok(!JSON.stringify(requests[1]).includes('private project source'));await c.ask({...question,question:'Follow up'});assert.ok(requests[2].messages.some(m=>m.content.includes('private project source')));}finally{await server.close();}
});
test('API function tools execute and feed results back before final answer',async()=>{
 let count=0;const requests=[],executed=[],events=[];const server=await fixture((_req,res,body)=>{requests.push(body);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:count++?{content:'TB created and simulated'}:{content:'Creating TB',tool_calls:[{id:'call_1',type:'function',function:{name:'write_file',arguments:'{"path":".rtl-atlas/sim/lesson/tb.sv","content":"module tb; endmodule"}'}}]},finish_reason:count===1?'tool_calls':'stop'}]}));});
 const tools={definitions:[{type:'function',function:{name:'write_file',parameters:{type:'object'}}}],execute:async(name,args)=>{executed.push({name,args});return {path:args.path};}};
 const c=new AssistantClient(e=>events.push(e));c.configure({baseUrl:server.baseUrl,model:'m'});
 try{const result=await c.ask({...question,tools});assert.match(result,/simulated/);assert.equal(executed[0].name,'write_file');assert.equal(requests[1].messages.at(-1).role,'tool');assert.equal(requests[1].messages.at(-1).tool_call_id,'call_1');assert.ok(events.some(e=>e.type==='tool'&&e.status==='done'));assert.ok(requests[0].tools.length);await c.ask({...question,tools,question:'Follow up'});assert.ok(requests[2].messages.some(m=>m.role==='tool'));}finally{await server.close();}
});
test('streamed tool arguments are assembled and errors return to model for repair',async()=>{
 let count=0;const calls=[];const server=await fixture((_req,res,body)=>{calls.push(body);if(!count++){res.setHeader('Content-Type','text/event-stream');res.end('data: '+JSON.stringify({choices:[{delta:{tool_calls:[{index:0,id:'c',type:'function',function:{name:'run_simulation',arguments:'{"scene":'}}]}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{tool_calls:[{index:0,function:{arguments:'"lesson"}'}}]},finish_reason:'tool_calls'}]})+'\n\ndata: [DONE]\n\n');}else res.end('{"choices":[{"message":{"content":"I will fix the compile error"}}]}');});
 const tools={definitions:[{type:'function',function:{name:'run_simulation'}}],execute:async(name,args)=>{assert.equal(args.scene,'lesson');throw Error('compile failed');}};const c=new AssistantClient(()=>{});c.configure({baseUrl:server.baseUrl,model:'m'});try{assert.match(await c.ask({...question,tools}),/fix/);assert.match(calls[1].messages.at(-1).content,/compile failed/);}finally{await server.close();}
});
test('cancelling an executing project tool marks its action cancelled',async()=>{const events=[];let running;const ready=new Promise(r=>running=r);const server=await fixture((_req,res)=>res.end(JSON.stringify({choices:[{message:{content:'',tool_calls:[{id:'cancel-tool',type:'function',function:{name:'run_simulation',arguments:'{}'}}]}}]})));const c=new AssistantClient(e=>events.push(e));c.configure({baseUrl:server.baseUrl,model:'m'});const tools={definitions:[{function:{name:'run_simulation'}}],execute:(_name,_args,{signal})=>new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});running();})};try{const result=c.ask({...question,tools}),rejected=assert.rejects(result,/cancel/i);await ready;c.cancel();await rejected;assert.ok(events.some(e=>e.type==='tool'&&e.status==='cancelled'));}finally{await server.close();}});
