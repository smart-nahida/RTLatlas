import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {Sparkles,X,ArrowUp,Square,Settings2,Trash2} from 'lucide-react';
import type {Project,Instance,Lang,ApiSettings} from '../model';
type Action={id:string;name:string;status:string;result?:string};
type Message={role:'user'|'assistant';text:string;context?:string;error?:boolean;actions?:Action[]};
const presets={deepseek:{baseUrl:'https://api.deepseek.com',model:'deepseek-flash'},openai:{baseUrl:'https://api.openai.com/v1',model:''},custom:{baseUrl:'',model:''}};
function usable(config:ApiSettings|null){if(!config)return false;try{return config.hasKey||!['api.deepseek.com','api.openai.com'].includes(new URL(config.baseUrl).hostname);}catch{return false;}}
const labels={
 zh:{title:'AI 阅读助手',close:'关闭',settings:'API 设置',reset:'清空对话',configured:'已保存 · 未验证',verified:'连接验证成功',failed:'连接验证失败',missingKey:'缺少 API Key',test:'保存并测试连接',testing:'正在测试连接…',testSuccess:'连接验证成功，地址、密钥和模型可用。',keyHelp:'API Key 创建时无需选择模型；调用时由这里的模型 ID 指定。',unconfigured:'未配置 API',save:'保存配置',saving:'保存中…',saved:'配置已保存，发送问题后验证服务。',question:'询问当前模块或数据通路…',send:'发送',stop:'停止',welcome:'结合当前实例、参数、连线与源码回答。',privacy:'发送时将所选源码交给配置的 API 服务 · 工程只读',browser:'请在桌面版配置 API。预览不会发送模型请求。',answering:'正在生成回答…',user:'你',provider:'服务商',custom:'自定义兼容服务',baseUrl:'API 地址',model:'模型 ID',modelHint:'填写服务商提供的模型名称',key:'API Key',keySaved:'已加密保存；留空保留当前地址的密钥',keyHint:'填写 API Key；本地免认证服务可留空',stream:'流式回答',forget:'删除配置与密钥',format:'支持 OpenAI 兼容的 Chat Completions 接口',billing:'使用 API 服务商额度，与 ChatGPT 订阅分开计费。'},
 en:{title:'AI reading assistant',close:'Close',settings:'API settings',reset:'Clear conversation',configured:'Saved · not verified',verified:'Connection verified',failed:'Connection failed',missingKey:'API Key missing',test:'Save and test connection',testing:'Testing connection…',testSuccess:'Connection verified: URL, key and model accepted.',keyHelp:'API keys are not tied to a model at creation; Model ID selects it per request.',unconfigured:'API not configured',save:'Save configuration',saving:'Saving…',saved:'Configuration saved. Send a question to verify the service.',question:'Ask about this module or data path…',send:'Send',stop:'Stop',welcome:'Answers grounded in the selected instance, parameters, connections and source.',privacy:'Selected source is sent to the configured API provider · Read-only project',browser:'Configure an API in the desktop app. This preview does not send model requests.',answering:'Generating answer…',user:'You',provider:'Provider',custom:'Custom compatible service',baseUrl:'API base URL',model:'Model ID',modelHint:'Enter a model name supported by your provider',key:'API Key',keySaved:'Encrypted key saved; leave blank to keep it for this URL',keyHint:'Enter API key; optional for unauthenticated local services',stream:'Stream response',forget:'Delete configuration and key',format:'OpenAI-compatible Chat Completions APIs',billing:'Uses your API provider billing, separately from ChatGPT subscriptions.'}
};
export default function Assistant({project,instance,nodeId,lang,onClose,onSource,onBusy}:{project:Project;instance:Instance;nodeId:string|null;lang:Lang;onClose:()=>void;onSource:(file:string,line:number)=>void;onBusy:(busy:boolean)=>void}){
 const t=labels[lang];
 const [connection,setConnection]=useState<'unverified'|'verified'|'failed'>('unverified');
 const [saved,setSaved]=useState<ApiSettings|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[busy,setBusy]=useState(false),[settings,setSettings]=useState(true),[question,setQuestion]=useState(''),[messages,setMessages]=useState<Message[]>([]),[notice,setNotice]=useState('');
 const [provider,setProvider]=useState<keyof typeof presets>('deepseek'),[baseUrl,setBaseUrl]=useState(presets.deepseek.baseUrl),[model,setModel]=useState(presets.deepseek.model),[apiKey,setApiKey]=useState(''),[stream,setStream]=useState(true);
 const messageList=useRef<HTMLDivElement>(null),followLatest=useRef(true),busyRef=useRef(false);
 const [readingEarlier,setReadingEarlier]=useState(false);
 useEffect(()=>{onBusy(busy);busyRef.current=busy;},[busy,onBusy]);
 useEffect(()=>()=>{onBusy(false);if(busyRef.current)window.atlas?.cancel();},[onBusy]);
 useEffect(()=>{setMessages([]);setNotice('');},[project.root]);
 useEffect(()=>{let active=true;
  if(!window.atlas){setLoading(false);return;}
  window.atlas.assistantSettings().then(result=>{if(!active)return;if(!result.ok)throw Error(result.error);const config=result.value;if(config){setSaved(config);setBaseUrl(config.baseUrl);setModel(config.model);setStream(config.stream);setProvider(config.baseUrl.includes('api.deepseek.com')?'deepseek':config.baseUrl.includes('api.openai.com')?'openai':'custom');setSettings(!usable(config));}}).catch(error=>{if(active)setNotice(error.message);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);
 useEffect(()=>{const unsubscribe=window.atlas?.onAssistant(event=>{if(!['answer','tool'].includes(event.type))return;setMessages(old=>{const next=[...old],last=next.length-1;if(next[last]?.role!=='assistant')return old;if(event.type==='answer')next[last]={...next[last],text:event.text||''};else{const actions=[...(next[last].actions||[])],action={id:event.id||'',name:event.name||'',status:event.status||'',result:event.result},at=actions.findIndex(a=>a.id===action.id);if(at<0)actions.push(action);else actions[at]=action;next[last]={...next[last],actions};}return next;});});return()=>{unsubscribe?.();};},[]);
 // Scroll only this list, and preserve the reader's position during streaming.
 useLayoutEffect(()=>{const list=messageList.current;if(list&&followLatest.current)list.scrollTop=list.scrollHeight;},[messages,busy,settings]);
 function latest(){followLatest.current=true;setReadingEarlier(false);const list=messageList.current;if(list)list.scrollTop=list.scrollHeight;}
 function preset(value:keyof typeof presets){setProvider(value);setBaseUrl(presets[value].baseUrl);setModel(presets[value].model);setApiKey('');setNotice('');}
 async function save(test=false){
  if(!window.atlas){setNotice(t.browser);return;}setSaving(true);if(test)setBusy(true);setNotice('');
  try{const result=await window.atlas.saveAssistant({baseUrl,model,apiKey,stream});if(!result.ok||!result.value)throw Error(result.error);setSaved(result.value);setApiKey('');setMessages([]);setConnection('unverified');if(test){const check=await window.atlas.testAssistant();if(!check.ok)throw Error(check.error);setConnection('verified');setNotice(t.testSuccess);}else setNotice(t.saved);setSettings(false);}
  catch(error){setNotice((error as Error).message);setConnection('failed');setSettings(true);}finally{setSaving(false);if(test)setBusy(false);}
 }
 async function send(){
  if(busy||!question.trim()||!usable(saved)||!window.atlas)return;
  const value=question.trim();followLatest.current=true;setReadingEarlier(false);setQuestion('');setNotice('');setBusy(true);
  setMessages(old=>[...old,{role:'user',text:value,context:nodeId||instance.id},{role:'assistant',text:''}]);
  try{const result=await window.atlas.ask({instanceId:instance.id,nodeId,question:value,lang});if(!result.ok)throw Error(result.error);setConnection('verified');setMessages(old=>{const next=[...old],last=next.length-1;next[last]={...next[last],text:result.value||next[last].text};return next;});}
  catch(error){setConnection('failed');const text=(error as Error).message;setMessages(old=>{const next=[...old],last=next.length-1;next[last]={...next[last],text:[next[last].text,text].filter(Boolean).join('\n\n'),error:true};return next;});}
  finally{setBusy(false);}
 }
 function answer(value:string):ReactNode{
  const files=Object.keys(project.files).sort((a,b)=>b.length-a.length);if(!files.length)return value;
  const pattern=new RegExp(`(${files.map(file=>file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')}):(\\d+)`,'g');
  const parts:ReactNode[]=[];let last=0;
  for(const match of value.matchAll(pattern)){parts.push(value.slice(last,match.index));parts.push(<button className="citation" key={match.index} onClick={()=>onSource(match[1],Number(match[2]))}>{match[0]}</button>);last=match.index!+match[0].length;}
  parts.push(value.slice(last));return parts;
 }
 function actionName(name:string){const names:Record<string,[string,string]>={list_files:['查看工程文件','List project files'],read_file:['读取文件','Read file'],write_file:['写入场景文件','Write scene file'],simulators:['检测仿真器','Discover simulators'],run_simulation:['运行仿真','Run simulation'],open_waveform:['打开波形','Open waveform'],inspect_waveform:['读取波形数值','Inspect waveform'],read_waveform_view:['读取当前游标','Read waveform cursor']};return names[name]?.[lang==='zh'?0:1]||name;}
 function actions(message:Message){return message.actions?.map(action=><details className={`assistant-tool ${action.status}`} key={action.id}><summary>{actionName(action.name)} · {action.status==='running'?(lang==='zh'?'进行中':'Running'):action.status==='cancelled'?(lang==='zh'?'已取消':'Cancelled'):action.status==='error'?(lang==='zh'?'失败':'Failed'):(lang==='zh'?'完成':'Done')}</summary>{action.result&&<><pre>{action.result}</pre>{(()=>{try{const result=JSON.parse(action.result);const file=result.path||result.file;return file&&project.files[file]!==undefined?<button className="citation" onClick={()=>onSource(file,1)}>{file}</button>:null;}catch{return null;}})()}</>}</details>);}
 return <section className="assistant-panel" aria-label={t.title}>
  <header className="assistant-header"><strong><Sparkles size={15}/>{t.title}</strong><div><button aria-label={t.reset} title={t.reset} disabled={busy} onClick={async()=>{const result=await window.atlas?.resetAssistant();if(result&&!result.ok){setNotice(result.error||'');return;}setMessages([]);}}><Trash2 size={14}/></button><button aria-label={t.settings} title={t.settings} onClick={()=>setSettings(!settings)}><Settings2 size={15}/></button><button aria-label={t.close} title={t.close} onClick={onClose}><X size={16}/></button></div></header>
  <div className="assistant-status"><span><i className={`status-dot ${connection==='verified'?'':'offline'}`}/>{saved?(!usable(saved)?t.missingKey:connection==='verified'?t.verified:connection==='failed'?t.failed:t.configured):t.unconfigured}</span>{saved&&<code title={saved.model}>{saved.model}</code>}</div>
  {settings&&<form className="api-settings" onSubmit={event=>{event.preventDefault();save();}}>
   <fieldset disabled={busy||saving||loading}><label>{t.provider}<select aria-label={t.provider} value={provider} onChange={event=>preset(event.target.value as keyof typeof presets)}><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option><option value="custom">{t.custom}</option></select></label>
   <label>{t.baseUrl}<input aria-label={t.baseUrl} value={baseUrl} onChange={event=>setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" required spellCheck={false}/></label>
   <label>{t.model}<input aria-label={t.model} value={model} onChange={event=>setModel(event.target.value)} placeholder={t.modelHint} required spellCheck={false}/></label>
   <label>{t.key}<input aria-label={t.key} type="password" autoComplete="new-password" value={apiKey} onChange={event=>setApiKey(event.target.value)} placeholder={saved?.hasKey&&saved.baseUrl===baseUrl?t.keySaved:t.keyHint} spellCheck={false}/></label>
   <label className="api-stream"><input type="checkbox" checked={stream} onChange={event=>setStream(event.target.checked)}/>{t.stream}</label>
   <div className="api-settings-actions"><button type="submit" className="api-save">{saving?t.saving:t.save}</button><button type="button" onClick={()=>save(true)}>{saving?t.testing:t.test}</button>{saved&&<button type="button" onClick={async()=>{const result=await window.atlas?.forgetAssistant();if(result?.ok){setSaved(null);setApiKey('');setMessages([]);setNotice('');}else setNotice(result?.error||t.browser);}}>{t.forget}</button>}</div><p>{t.format}</p><p>{t.keyHelp}</p><p>{t.billing}</p></fieldset>
  </form>}
  <div className="assistant-messages" ref={messageList} onScroll={event=>{const list=event.currentTarget;followLatest.current=list.scrollHeight-list.scrollTop-list.clientHeight<48;setReadingEarlier(!followLatest.current);}}>{messages.map((message,index)=><div className={`message ${message.role} ${message.error?'has-error':''}`} key={index}><small>{message.role==='user'?t.user:saved?.model||'AI'}{message.context&&<code title={message.context}>{message.context.split('.').slice(-2).join('.')}</code>}</small><div>{message.text?answer(message.text):message.actions?.length?'':t.answering}</div>{actions(message)}</div>)}</div>
  {readingEarlier&&!settings&&<button className="assistant-latest" onClick={latest}>{lang==='zh'?'回到最新':'Jump to latest'}</button>}
  {notice&&<div className="assistant-notice" role="status">{notice}</div>}
  <div className="assistant-compose"><textarea aria-label={t.question} placeholder={t.question} value={question} onChange={event=>setQuestion(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();send();}}}/><div className="compose-foot">{busy?<button onClick={()=>window.atlas?.cancel()}><Square size={12}/>{t.stop}</button>:<button className="send-button" disabled={!question.trim()||!usable(saved)||saving||loading} onClick={send}>{t.send}<ArrowUp size={13}/></button>}</div></div>
 </section>;
}
