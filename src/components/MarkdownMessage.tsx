import {useMemo} from 'react';
import Markdown,{defaultUrlTransform} from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MdNode={type:string;value?:string;url?:string;children?:MdNode[]};
const sourcePrefix='#atlas-source/';
function sourceUrl(file:string,line:number){return `${sourcePrefix}${encodeURIComponent(file)}/${line}`;}
function sourceTarget(url:string,files:Set<string>):{file:string;line:number}|null{
 try{
  if(url.startsWith(sourcePrefix)){
   const match=url.slice(sourcePrefix.length).match(/^(.*)\/(\d+)$/);
   if(match){const file=decodeURIComponent(match[1]),line=Number(match[2]);if(files.has(file)&&Number.isSafeInteger(line)&&line>0)return {file,line};}
  }
  const decoded=decodeURIComponent(url),match=decoded.match(/^(.*?)(?::(\d+)(?:[-–]\d+)?|#L(\d+)(?:-L?\d+)?)$/);
  if(match){const file=match[1].replace(/^\.\//,''),line=Number(match[2]||match[3]);if(files.has(file)&&Number.isSafeInteger(line)&&line>0)return {file,line};}
 }catch{ /* Invalid percent escapes are ordinary text, not source links. */ }
 return null;
}
// Turn only known project references into links. Fenced code and existing links
// are left intact so examples remain copyable and anchors cannot nest.
function sourceReferences(files:string[]){
 const escaped=files.sort((a,b)=>b.length-a.length).map(file=>file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const pattern=escaped.length?new RegExp(`(?<![\\w./\\\\-])(${escaped.join('|')}):(\\d+)(?:[-–]\\d+)?`,'g'):null;
 return ()=> (tree:MdNode)=>{
  if(!pattern)return;
  function walk(parent:MdNode){
   if(!pattern||!parent.children||['link','linkReference','code'].includes(parent.type))return;
   parent.children=parent.children.flatMap(child=>{
    if(!['text','inlineCode'].includes(child.type)||!child.value){walk(child);return [child];}
    const parts:MdNode[]=[];let last=0;
    for(const match of child.value.matchAll(pattern)){
     const line=Number(match[2]);if(!Number.isSafeInteger(line)||line<1)continue;
     if(match.index!>last)parts.push({type:child.type,value:child.value.slice(last,match.index)});
     parts.push({type:'link',url:sourceUrl(match[1],line),children:[{type:child.type,value:match[0]}]});last=match.index!+match[0].length;
    }
    if(!parts.length)return [child];
    if(last<child.value.length)parts.push({type:child.type,value:child.value.slice(last)});return parts;
   });
  }
  walk(tree);
 };
}
export default function MarkdownMessage({value,files,onSource}:{value:string;files:string[];onSource:(file:string,line:number)=>void}){
 const key=JSON.stringify(files),known=useMemo(()=>new Set(files),[key]);
 const citations=useMemo(()=>sourceReferences([...files]),[key]);
 return <div className="markdown-message"><Markdown remarkPlugins={[remarkGfm,citations]} skipHtml
  urlTransform={url=>{const source=sourceTarget(url,known);return source?sourceUrl(source.file,source.line):defaultUrlTransform(url);}}
  components={{
   a:({href,children})=>{const source=sourceTarget(href||'',known);return source?<button type="button" className="citation" onClick={()=>onSource(source.file,source.line)}>{children}</button>:href?<a href={href} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>;},
   img:({alt})=><span>{alt}</span>,
   table:({children})=><div className="markdown-table-scroll"><table>{children}</table></div>
  }}>{value}</Markdown></div>;
}
