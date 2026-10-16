async function readCompletion(response,onText){
 let text='',finished=false;const calls=new Map();
 const consume=value=>{
  if(value.error)throw Error(value.error.message||'API response error');const choice=value.choices?.[0];if(!choice)return;
  const message=choice.delta||choice.message||{},content=message.content;
  if(typeof content==='string'){text+=content;if(text.length>2*1024*1024)throw Error('API answer too large / API 回答过大');onText(text);}
  if(message.tool_calls){if(!Array.isArray(message.tool_calls)||message.tool_calls.length>16)throw Error('Too many API tool calls');for(let i=0;i<message.tool_calls.length;i++){
   const delta=message.tool_calls[i],index=delta.index??i;if(!Number.isInteger(index)||index<0||index>=16)throw Error('Invalid tool index');
   const call=calls.get(index)||{id:'',type:'function',function:{name:'',arguments:''}};
   if(delta.id)call.id+=delta.id;if(delta.function?.name)call.function.name+=delta.function.name;if(delta.function?.arguments)call.function.arguments+=delta.function.arguments;
   if(call.function.arguments.length>256*1024||call.id.length>200||call.function.name.length>100)throw Error('API tool arguments too large');calls.set(index,call);
  }}
  if(choice.finish_reason!=null||choice.message)finished=true;
 };
 if(response.headers.get('content-type')?.includes('text/event-stream')){
  if(!response.body)throw Error('Empty API response');const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',event=[],done=false;
  const dispatch=()=>{if(!event.length)return;const data=event.join('\n');event=[];if(data==='[DONE]'){done=true;finished=true;return;}try{consume(JSON.parse(data));}catch(e){if(e instanceof SyntaxError)throw Error('Invalid API stream / API 流格式无效');throw e;}};
  const line=value=>{if(value==='')dispatch();else if(value.startsWith('data:'))event.push(value.slice(5).trimStart());};
  try{while(true){const chunk=await reader.read();pending+=decoder.decode(chunk.value||new Uint8Array(),{stream:!chunk.done});if(pending.length>2*1024*1024)throw Error('API stream packet too large');let at;while(!done&&(at=pending.indexOf('\n'))>=0){line(pending.slice(0,at).replace(/\r$/,''));pending=pending.slice(at+1);}if(done)break;if(chunk.done){if(pending)line(pending.replace(/\r$/,''));dispatch();break;}}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 }else consume(await response.json());
 if(!finished)throw Error('API stream incomplete / API 响应中断，请重试');
 const toolCalls=[...calls.entries()].sort((a,b)=>a[0]-b[0]).map(([,call])=>call);
 if(toolCalls.some(call=>!call.id||!call.function.name))throw Error('Incomplete API tool call / API 工具调用不完整');
 return {role:'assistant',content:text||null,...(toolCalls.length?{tool_calls:toolCalls}:{})};
}
module.exports={readCompletion};
