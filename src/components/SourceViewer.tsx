import {useEffect,useMemo,useRef} from 'react';import Prism from 'prismjs';import 'prismjs/components/prism-verilog';import {FileCode2,Copy} from 'lucide-react';import type {Source} from '../model';import type {Text} from '../i18n';
export default function SourceViewer({files,source,t,highlight,showHeader=true}:{files:Record<string,string>;source:Source|null;t:Text;highlight?:string;showHeader?:boolean}){
 const ref=useRef<HTMLDivElement>(null);
 const content=source?files[source.file]:null;
 const rawLines=useMemo(()=>content?.split('\n')||[],[content]);
 const lines=useMemo(()=>content?.split('\n').map(line=>Prism.highlight(line,Prism.languages.verilog,'verilog'))||[],[content]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>{const scroller=ref.current;if(!scroller)return;const row=scroller.querySelector<HTMLElement>(`[data-line="${Math.max(1,(source?.line||1)-2)}"]`);if(row)scroller.scrollTo({top:Math.max(0,row.offsetTop-15),left:0,behavior:'instant'});});return()=>cancelAnimationFrame(frame);},[source?.file,source?.line]);
 if(!source||content===null||content===undefined)return <div className="empty-inspector">{t.noSource}</div>;
 return <div className="source-view">{showHeader&&<div className="file-bar"><FileCode2 size={15}/><span title={source.file}>{source.file}</span><span className="file-range">L{source.line}–{source.endLine}</span><button title={t.copy} onClick={()=>navigator.clipboard.writeText(content)}><Copy size={13}/></button></div>}
 <div className="code-scroll" ref={ref}><table className="source-table"><tbody>{lines.map((line,i)=>{const active=i+1>=source.line&&i+1<=source.endLine;const hit=highlight&&rawLines[i].includes(highlight);return <tr key={i} data-line={i+1} className={`${active?'in-range':''} ${hit?'signal-hit':''}`}><td className="line-number">{i+1}</td><td className="code-text"><code dangerouslySetInnerHTML={{__html:line||' '}}/></td></tr>;})}</tbody></table></div></div>;
}
