import {useEffect,useMemo,useRef} from 'react';
import {ReactFlow,ReactFlowProvider,BaseEdge,getSmoothStepPath,Handle,Position,Background,MarkerType,useReactFlow,type NodeProps,type Node,type Edge,type EdgeProps} from '@xyflow/react';
import dagre from '@dagrejs/dagre';import {Maximize,Minus,Plus,Cpu,ArrowRight,Square,Layers} from 'lucide-react';
import type {Instance,GraphNode,GraphEdge} from '../model';import type {Text} from '../i18n';
type CircuitData={item:GraphNode;selected:boolean;dimmed:boolean;label:string;values?:Record<string,string>;[key:string]:unknown};
function CircuitNode({data}:NodeProps<Node<CircuitData>>){
 const n=data.item;const inputs=n.ports.filter(p=>p.direction!=='out'),outputs=n.ports.filter(p=>p.direction==='out'||p.direction==='inout');
 if(n.kind==='input'||n.kind==='output')return <div className={`io-node ${data.selected?'selected':''} ${data.dimmed?'dimmed':''}`}><ArrowRight size={13}/><strong>{n.label}</strong><small>{n.ports[0]?.width}b</small><Handle type={n.kind==='input'?'source':'target'} position={n.kind==='input'?Position.Right:Position.Left} id={`${n.kind==='input'?'out':'in'}:${n.label}`}/></div>;
 return <div className={`circuit-node ${data.selected?'selected':''} ${data.dimmed?'dimmed':''} ${n.sequential?'is-register':''} ${n.kind==='instance'?'is-module':''}`} >
  <header>{n.kind==='instance'?<Cpu size={16}/>:n.sequential?<Layers size={16}/>:<Square size={15}/>}<strong title={n.label}>{n.label}</strong>{n.kind==='instance'&&<span className="node-enter">↗</span>}</header>
  <div className="node-type">{n.detail}{n.sequential&&<i>REG</i>}</div>
  {n.parameters&&Object.keys(n.parameters).length>0&&<div className="node-parameters">{Object.entries(n.parameters).slice(0,3).map(([k,v])=><span key={k}>{k}={v}</span>)}</div>}
  <div className="pins">{Array.from({length:Math.max(inputs.length,outputs.length,1)},(_,index)=>{const a=inputs[index],b=outputs[index];return <div className="pin-row" key={index}>
   <span className="pin-left">{a&&<><Handle type="target" position={Position.Left} id={`in:${a.name}`} style={{top:12}}/><span title={a.name}>{a.name}</span><small>{a.width>1?`${a.width}`:''}</small></>}</span>
   <span className="pin-right">{b&&<><small>{b.width>1?`${b.width}`:''}</small><span title={b.name}>{b.name}</span><Handle type="source" position={Position.Right} id={`out:${b.name}`} style={{top:12}}/></>}</span>
  </div>})}</div>
  {data.values&&<div className="node-wave-values">{Object.entries(data.values).sort(([a],[b])=>Number(!/^(result|acc_reg|product|en)$/.test(a))-Number(!/^(result|acc_reg|product|en)$/.test(b))).slice(0,3).map(([name,value])=><span key={name} title={name+' = '+value}>{name} = {value}</span>)}</div>}
 </div>;
}
type RoutedEdgeType=Edge<{laneOffset?:number;routeY?:number;portOffset?:number}>;
function RoutedEdge(props:EdgeProps<RoutedEdgeType>){
 const {sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition,data,style}=props;
 const forward=targetX-sourceX>40;
 const centerX=forward?Math.max(sourceX+24,Math.min(targetX-24,(sourceX+targetX)/2+(data?.laneOffset||0))):undefined;
 const [path,labelX,labelY]=getSmoothStepPath({sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition,centerX,centerY:forward?undefined:data?.routeY,offset:forward?20:data?.portOffset||24,borderRadius:6});
 return <><path className="edge-crossing-clearance" d={path} fill="none" stroke="#fff" strokeWidth={Number(style?.strokeWidth||1.65)+4} opacity={style?.opacity??1} pointerEvents="none"/><BaseEdge id={props.id} path={path} style={style} markerEnd={props.markerEnd} markerStart={props.markerStart} label={props.label} labelX={labelX} labelY={labelY} labelStyle={props.labelStyle} labelBgStyle={props.labelBgStyle} interactionWidth={props.interactionWidth}/></>;
}
const nodeTypes={circuit:CircuitNode},edgeTypes={routed:RoutedEdge};
function signalLabel(edge:GraphEdge){return `${edge.signal}${edge.width>1?` [${edge.width-1}:0]`:''}`;}
export function traceNodes(nodes:GraphNode[],edges:GraphEdge[],start:string,direction:'up'|'down'){
 const seen=new Set([start]),queue=[start];while(queue.length){const id=queue.shift()!;
  if(id!==start&&nodes.find(n=>n.id===id)?.sequential)continue;
  for(const edge of edges){const next=direction==='up'?(edge.target===id?edge.source:null):(edge.source===id?edge.target:null);if(next&&!seen.has(next)){seen.add(next);queue.push(next);}}
 }return seen;
}
function Inner({instance,selectedNode,selectedEdge,onNode,onEdge,onEnter,t,clock,control,boundary,mode,trace,values={}}:{instance:Instance;selectedNode:string|null;selectedEdge:string|null;onNode:(id:string)=>void;onEdge:(id:string)=>void;onEnter:(id:string)=>void;t:Text;clock:boolean;control:boolean;boundary:boolean;mode:string;trace:Set<string>|null;values?:Record<string,Record<string,string>>}){
 const flow=useReactFlow();
 const canvas=useRef<HTMLDivElement>(null);
 useEffect(()=>{const parent=canvas.current?.parentElement;if(!parent)return;let timer:ReturnType<typeof setTimeout>;const observer=new ResizeObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>flow.fitView({padding:.13,duration:120,maxZoom:1}),100);});observer.observe(parent);return()=>{clearTimeout(timer);observer.disconnect();};},[flow]);
 const {nodes,edges}=useMemo(()=>{
  let raw=instance.graph.nodes.filter(n=>(boundary||(clock&&/(^|_)(clk|clock|rst|reset)(_|$)/i.test(n.label))||!['input','output'].includes(n.kind))&&(clock||!['clk','rst_n','reset','clock','rst'].includes(n.label)));
  const ids=new Set(raw.map(n=>n.id));let visible=instance.graph.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)&&(clock||!/(^|_)(clk|clock|rst|reset)(_|$)/i.test(e.signal))&&(/(^|_)(clk|clock|rst|reset)(_|$)/i.test(e.signal)||control||!e.control));
  if(mode==='structure'&&instance.children.length){const involved=new Set(visible.filter(e=>!e.control).flatMap(e=>[e.source,e.target]));raw=raw.filter(n=>n.kind!=='logic'||involved.has(n.id));const retained=new Set(raw.map(n=>n.id));visible=visible.filter(e=>retained.has(e.source)&&retained.has(e.target));}
  // Reserve the full label plus clear space at both ends instead of a fixed narrow gap.
  // Seven pixels per character conservatively covers our 11px monospace labels.
  const outgoing=new Map<string,number>();for(const edge of visible)outgoing.set(edge.source,(outgoing.get(edge.source)||0)+1);
  const ranksep=Math.max(96,...visible.map(e=>signalLabel(e).length*7+48),...Array.from(outgoing.values(),count=>count*12+64));
  const g=new dagre.graphlib.Graph().setDefaultEdgeLabel(()=>({}));g.setGraph({rankdir:'LR',ranksep,nodesep:52,marginx:35,marginy:40,acyclicer:'greedy'});
  for(const n of raw){const io=n.kind==='input'||n.kind==='output';const rows=Math.max(n.ports.filter(p=>p.direction!=='out').length,n.ports.filter(p=>p.direction!=='in').length);g.setNode(n.id,{width:io?150:192,height:io?40:(n.kind==='instance'?54:83)+Math.max(rows,1)*24+(values[n.id]?44:0)});}
  const controlOnly=raw.filter(n=>n.kind==='instance'&&visible.some(e=>e.control&&(e.source===n.id||e.target===n.id))&&!visible.some(e=>!e.control&&(e.source===n.id||e.target===n.id)));
  const floating=new Set(controlOnly.length<=4&&raw.length>controlOnly.length?controlOnly.map(n=>n.id):[]);
  const sizes=new Map(raw.map(n=>[n.id,g.node(n.id)]));for(const id of floating)g.removeNode(id);
  visible.filter(e=>!e.control&&!floating.has(e.source)&&!floating.has(e.target)).forEach(e=>g.setEdge(e.source,e.target));dagre.layout(g);
  if(floating.size){const placed=g.nodes().map(id=>g.node(id));const left=Math.min(...placed.map(p=>p.x-p.width/2)),right=Math.max(...placed.map(p=>p.x+p.width/2));const top=Math.min(...placed.map(p=>p.y-p.height/2));[...floating].forEach((id,index)=>{const size=sizes.get(id)!;g.setNode(id,{...size,x:(left+right)/2+(index-(floating.size-1)/2)*240,y:top-size.height/2-100});});}
  const nodes:Node<CircuitData>[]=raw.map(n=>{const pos=g.node(n.id);return {id:n.id,type:'circuit',position:{x:pos.x-pos.width/2,y:pos.y-pos.height/2},data:{item:n,selected:n.id===selectedNode,dimmed:trace!==null&&!trace.has(n.id),label:n.label,values:values[n.id]},style:{width:pos.width},selected:n.id===selectedNode};});
  // Separate parallel channels in the same rank gap. Backward edges use separate outer lanes.
  const laneGroups=new Map<string,GraphEdge[]>();
  for(const edge of [...visible].sort((a,b)=>a.id.localeCompare(b.id))){const a=g.node(edge.source),b=g.node(edge.target),right=a.x+a.width/2,left=b.x-b.width/2;
   const key=left-right>40?`${Math.round(right)}:${Math.round(left)}`:'return';const group=laneGroups.get(key)||[];group.push(edge);laneGroups.set(key,group);
  }
  const routes=new Map<string,{laneOffset:number;routeY?:number;portOffset:number}>();
  const top=Math.min(...raw.map(node=>{const pos=g.node(node.id);return pos.y-pos.height/2;}));
  for(const [key,group]of laneGroups)group.forEach((edge,index)=>{routes.set(edge.id,{laneOffset:(index-(group.length-1)/2)*12,routeY:key==='return'?top-40-index*16:undefined,portOffset:24+index*12});});
  const edges:Edge[]=visible.map(e=>{const active=e.id===selectedEdge;const faded=trace!==null&&(!trace.has(e.source)||!trace.has(e.target));const color=active?'#005dff':e.control?'#ef8a20':'#2979e8';return {...e,ariaLabel:`${e.signal}: ${e.source} → ${e.target}`,type:'routed',data:routes.get(e.id),label:e.control?(active?e.signal:undefined):signalLabel(e),style:{stroke:color,strokeWidth:active?2.6:1.65,opacity:faded?.12:1},labelStyle:{fill:color,fontSize:11,fontFamily:'ui-monospace, monospace'},labelBgStyle:{fill:'#f7f9fc',fillOpacity:faded?.1:1},markerEnd:{type:MarkerType.ArrowClosed,color},selected:active,interactionWidth:18};});
  return {nodes,edges};
 },[instance,selectedNode,selectedEdge,clock,control,boundary,trace,mode,values]);
 useEffect(()=>{const id=setTimeout(()=>flow.fitView({padding:.13,duration:250,maxZoom:1}),80);return()=>clearTimeout(id);},[instance.id,clock,control,boundary,mode]);
 return <><div ref={canvas} hidden/><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodeClick={(_,n)=>onNode(n.id)} onNodeDoubleClick={(_,n)=>onEnter(n.id)} onEdgeClick={(_,e)=>onEdge(e.id)} nodesConnectable={false} nodesDraggable={false} minZoom={.15} maxZoom={1.8} fitView fitViewOptions={{padding:.13,maxZoom:1}} onlyRenderVisibleElements zoomOnScroll zoomOnDoubleClick={false} panOnScroll={false} panOnDrag={[0]} selectionOnDrag={false} proOptions={{hideAttribution:true}}>
  <Background color="#e8ecf2" gap={24} size={.65}/>
 </ReactFlow><div className="graph-zoom"><button aria-label="Zoom out" onClick={()=>flow.zoomOut()}><Minus size={15}/></button><button aria-label="Zoom in" onClick={()=>flow.zoomIn()}><Plus size={15}/></button><i/><button aria-label={t.fit} onClick={()=>flow.fitView({padding:.13,duration:250,maxZoom:1})}><Maximize size={15}/></button></div>
 <div className="graph-legend"><span><i className="blue"/>{t.data}</span><span><i className="amber"/>{t.control}</span></div>
 {nodes.length===0&&<div className="graph-empty">{t.noGraph}</div>}</>;
}
export default function CircuitGraph(props:Parameters<typeof Inner>[0]){return <ReactFlowProvider><Inner {...props}/></ReactFlowProvider>}
