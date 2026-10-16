import {useState,useEffect} from 'react';
import {ChevronRight,Folder,FolderOpen,Cpu,ArrowUpRight,PanelLeftClose,RefreshCw} from 'lucide-react';
import type {Project} from '../model';import type {Text} from '../i18n';
export interface Reading {scope:string;node:string|null;label:string}
export default function Hierarchy({project,current,selected,onNavigate,onSelect,onCollapse,onReload,disabled,t}:{project:Project;current:string;selected:string|null;onNavigate:(id:string)=>void;onSelect:(id:string)=>void;onCollapse:()=>void;onReload:()=>void;disabled:boolean;t:Text}){
 const collapsed=()=>new Set(Object.values(project.instances).filter(i=>i.children.length&&!current.startsWith(i.id)).map(i=>i.id));
 const [closed,setClosed]=useState<Set<string>>(collapsed);
 useEffect(()=>setClosed(collapsed()),[project]);
 useEffect(()=>setClosed(old=>new Set([...old].filter(id=>!current.startsWith(id)))),[current]);
 function render(id:string,depth:number){
  const instance=project.instances[id],hasChildren=!!instance.children.length,expanded=!closed.has(id),active=current===id||selected===id;
  return <div key={id}><div className={`tree-row ${active?'active':''} ${current===id?'current':''}`} style={{paddingLeft:12+depth*15}}>
   <button className={`tree-toggle ${!hasChildren?'invisible':''}`} title={id} onClick={()=>setClosed(old=>{const next=new Set(old);next.has(id)?next.delete(id):next.add(id);return next;})}><ChevronRight size={13} style={{transform:expanded?'rotate(90deg)':''}}/></button>
   <button className="tree-target" title={`${id}\n${instance.module}`} onClick={()=>onSelect(id)} onDoubleClick={()=>onNavigate(id)}>{hasChildren?(expanded?<FolderOpen size={15}/>:<Folder size={15}/>):<Cpu size={14}/>}<span>{instance.parent?id.slice(instance.parent.length+1):instance.name}</span></button>
   <button className="tree-enter" title={t.structure} aria-label={`${t.structure} ${instance.name}`} onClick={()=>onNavigate(id)}><ArrowUpRight size={12}/></button>
  </div>{hasChildren&&expanded&&instance.children.map(child=>render(child,depth+1))}</div>;
 }
 return <aside className="sidebar"><div className="section-label"><span>{t.modules}</span><div><button title={t.reload} aria-label={t.reload} disabled={disabled} onClick={onReload}><RefreshCw size={13}/></button><button title={t.collapseSidebar} aria-label={t.collapseSidebar} onClick={onCollapse}><PanelLeftClose size={14}/></button></div></div><div className="tree-scroll">{project.roots.map(id=>render(id,0))}</div></aside>;
}
