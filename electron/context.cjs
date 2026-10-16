function buildContext(project,instanceId,nodeId,lang){
 const scope=project.instances[instanceId];if(!scope)throw Error('Unknown instance / 无效实例');
 const node=scope.graph.nodes.find(n=>n.id===nodeId),chosen=node?.kind==='instance'?project.instances[node.id]:scope;
 const excerpt=source=>{
  if(!source||project.files[source.file]===undefined)return null;
  const lines=project.files[source.file].split('\n'),start=Math.max(1,source.line-2),end=Math.min(lines.length,source.endLine+2,start+499);
  return {file:source.file,startLine:start,endLine:end,text:lines.slice(start-1,end).map((line,index)=>`${start+index}: ${line}`).join('\n')};
 };
 return JSON.stringify({language:lang,instance:chosen.id,module:chosen.module,parameters:chosen.parameters,ports:chosen.ports,selectedNode:node||null,source:excerpt(node?.source||chosen.source),moduleSource:excerpt(chosen.source),projectFiles:Object.keys(project.files).slice(0,400),connections:scope.graph.edges.slice(0,400),limitations:project.notes},null,2).slice(0,100000);
}
module.exports={buildContext};
