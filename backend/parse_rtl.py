"""Read-only SystemVerilog elaboration -> source-linked conservative dependency graph."""
import json, os, re, shlex, sys
from pathlib import Path
import pyslang as sv

from project_config import ProjectError, ProjectChoice, load_config, MAX_BYTES

MAX_INSTANCES=12000

def parse_project(root: str, selection=None) -> dict:
    root=Path(root).resolve()
    if not root.is_dir():raise ProjectError('Project folder does not exist / 工程目录不存在')
    cfg=load_config(root,selection)
    paths=[Path(p) for p in cfg['files']]
    driver=sv.driver.Driver();driver.addStandardArgs();driver.setTerminalColorsEnabled(False)
    args=['slang']
    if cfg.get('top'):args+=['--top',cfg['top']]
    args += ['-I'+str((root/p).resolve()) for p in cfg.get('includeDirs',[])]
    args += ['-D'+d for d in cfg.get('defines',[])]
    args += ['-G'+p for p in cfg.get('parameters',[])]
    args += ['-y'+p for p in cfg.get('libraryDirs',[])]
    if cfg.get('libraryExtensions'):args += ['+libext+'+'+'.join(cfg['libraryExtensions'])]
    unit_files={p for u in cfg.get('units',[]) for p in u['files']}
    args += [str(p) for p in paths if str(p) not in unit_files and str(p) not in cfg.get('libraryFiles',[])]
    if not driver.parseCommandLine(shlex.join(args)):
        raise ProjectError(driver.textDiagClient.getString() or 'Unable to parse project options / 解析配置失败')
    for unit in cfg.get('units',[]):
        driver.sourceLoader.addSeparateUnit(unit['files'],unit['includeDirs'],unit['defines'],'',[])
    for library in cfg.get('libraryFiles',[]):driver.sourceLoader.addLibraryFiles('',library)
    if not driver.processOptions():raise ProjectError(driver.textDiagClient.getString() or 'Unable to process project options')
    if not driver.parseAllSources():raise ProjectError(driver.textDiagClient.getString() or 'Unable to parse sources')
    compilation=driver.createCompilation(); compiled_root=compilation.getRoot()
    diags=list(compilation.getAllDiagnostics())
    diagnostics=sv.DiagnosticEngine.reportAll(compilation.sourceManager,diags)
    if any(d.isError() for d in diags):raise ProjectError(diagnostics)
    sm=compilation.sourceManager
    files={}
    def relative(path):
        try:return str(Path(path).resolve().relative_to(root))
        except ValueError:return str(Path(path).resolve())
    def source(obj):
        syntax=getattr(obj,'syntax',None)
        if syntax is None:return None
        rng=syntax.sourceRange
        try:
            loc=sm.getFullyOriginalLoc(rng.start)
            end=sm.getFullyOriginalLoc(rng.end)
            path=Path(str(sm.getFullPath(loc.buffer)))
            key=relative(path)
            if key not in files:
                if path.stat().st_size>MAX_BYTES:raise ProjectError('Included file too large')
                files[key]=path.read_text(errors='replace')
            return {'file':key,'line':sm.getLineNumber(loc),'endLine':sm.getLineNumber(end)}
        except (AttributeError,RuntimeError,OSError):return None
    def refs(expr):
        out={}
        if expr is None:return []
        def visit(x):
            if isinstance(x,sv.ast.NamedValueExpression):
                sym=x.symbol
                out[sym.hierarchicalPath]={'id':sym.hierarchicalPath,'name':sym.name,'width':int(sym.type.bitWidth)}
        expr.visit(visit)
        return list(out.values())
    def lvalue(expr):
        # getSymbolReference resolves the base of selects; indices are reads.
        target=expr.getSymbolReference()
        if target is not None and getattr(target,'isValue',False):
            writes=[{'id':target.hierarchicalPath,'name':target.name,'width':int(target.type.bitWidth)}]
            selectors=[]
            def visit(x):
                if isinstance(x,sv.ast.ElementSelectExpression):selectors.extend(refs(x.selector))
                elif isinstance(x,sv.ast.RangeSelectExpression):
                    selectors.extend(refs(x.left));selectors.extend(refs(x.right))
            expr.visit(visit)
            return writes,selectors
        if isinstance(expr,sv.ast.ConcatenationExpression):
            writes=[];reads=[]
            for operand in expr.operands:
                a,b=lvalue(operand);writes.extend(a);reads.extend(b)
            return writes,reads
        return [],refs(expr)
    def members(scope):
        for m in scope:
            if isinstance(m,sv.ast.GenerateBlockSymbol):
                if not m.isUninstantiated:yield from members(m)
            elif isinstance(m,sv.ast.GenerateBlockArraySymbol):
                for entry in m.entries:
                    if not entry.isUninstantiated:yield from members(entry)
            elif isinstance(m,sv.ast.InstanceArraySymbol):
                yield from members(m)
            else:yield m
    instances={}
    def instance(i,parent=None):
        if len(instances)>=MAX_INSTANCES:raise ProjectError('Instance limit exceeded (12000)')
        id=i.hierarchicalPath
        ports=[]
        for p in i.body.portList:
            if not isinstance(p,sv.ast.PortSymbol):
                # Interfaces are kept visible but do not guess modport connectivity.
                ports.append({'name':p.name,'direction':'interface','width':0,'refs':[],'expression':'','source':source(p)})
                continue
            co=i.getPortConnection(p)
            ex=co.expression if co else None
            if isinstance(ex,sv.ast.AssignmentExpression):ex=ex.left
            expr=str(ex.syntax).strip() if ex is not None and ex.syntax else ''
            direction={'In':'in','Out':'out','InOut':'inout','Ref':'inout'}.get(p.direction.name,'inout')
            ports.append({'name':p.name,'direction':direction,'width':int(p.type.bitWidth),'refs':refs(ex),'expression':expr,'source':source(p), 'internalId':p.internalSymbol.hierarchicalPath if p.internalSymbol else ''})
        params={p.name:str(p.targetType.type if isinstance(p,sv.ast.TypeParameterSymbol) else p.value) for p in i.body.parameters}
        inst={'id':id,'name':id.rsplit('.',1)[-1], 'module':i.definition.name,'parent':parent,'children':[],'ports':ports,'parameters':params,'source':source(i.definition),'instanceSource':source(i),'graph':{'nodes':[],'edges':[]}}
        instances[id]=inst
        nodes=inst['graph']['nodes']
        # Every endpoint has a stable pin id. A signal can have multiple drivers/readers.
        drives={};reads={}
        def add(node,inputs,outputs):
            nodes.append(node)
            for port,rs in inputs:
                for r in rs:reads.setdefault(r['id'],[]).append((node['id'],port,r))
            for port,rs in outputs:
                for r in rs:drives.setdefault(r['id'],[]).append((node['id'],port,r))
        for p in ports:
            nid=f'{id}::$port:{p["name"]}'
            internal=[{'id':p['internalId'],'name':p['name'],'width':p['width']}] if p.get('internalId') else []
            is_in=p['direction']=='in'
            node={'id':nid,'label':p['name'],'kind':'input' if is_in else 'output','detail':p['direction'],'source':p['source'],'sequential':False,'ports':[{'name':p['name'],'direction':'out' if is_in else 'in','width':p['width']}]}
            add(node,[] if is_in else [(p['name'],internal)],[(p['name'],internal)] if is_in or p['direction']=='inout' else [])
        count=0
        for m in members(i.body):
            if isinstance(m,sv.ast.InstanceSymbol):
                cid=instance(m,id);inst['children'].append(cid);child=instances[cid]
                node={'id':cid,'label':cid[len(id)+1:],'kind':'instance','detail':child['module'],'source':child['instanceSource'],'sequential':False,'ports':[{'name':p['name'],'direction':p['direction'],'width':p['width']} for p in child['ports']],'parameters':child['parameters']}
                add(node,[(p['name'],p['refs']) for p in child['ports'] if p['direction'] in ['in','inout']],[(p['name'],p['refs']) for p in child['ports'] if p['direction'] in ['out','inout']])
            elif isinstance(m,(sv.ast.ContinuousAssignSymbol,sv.ast.ProceduralBlockSymbol)) or (isinstance(m,sv.ast.NetSymbol) and m.initializer is not None):
                count+=1;writes={};rhs={}
                def collect(x):
                    if isinstance(x,sv.ast.AssignmentExpression):
                        targets,selectors=lvalue(x.left)
                        for r in targets:writes[r['id']]=r
                        for r in [*refs(x.right),*selectors]:rhs[r['id']]=r
                if isinstance(m,sv.ast.NetSymbol):
                    writes[m.hierarchicalPath]={'id':m.hierarchicalPath,'name':m.name,'width':int(m.type.bitWidth)}
                    rhs={r['id']:r for r in refs(m.initializer)}
                else:m.visit(collect)
                allrefs={r['id']:r for r in refs(m)}
                for k,v in allrefs.items():
                    if k not in writes:rhs[k]=v
                if not writes:continue
                sequential=isinstance(m,sv.ast.ProceduralBlockSymbol) and (m.procedureKind.name in ['AlwaysFF','AlwaysLatch'] or bool(re.search(r'\b(posedge|negedge)\b',str(m.syntax))))
                kind=m.procedureKind.name if isinstance(m,sv.ast.ProceduralBlockSymbol) else 'assign'
                label=', '.join(r['name'] for r in writes.values())
                n={'id':f'{id}::$logic:{count}','label':label,'kind':'logic','detail':kind,'source':source(m),'sequential':sequential,'ports':[{'name':r['name'],'direction':'in','width':r['width']} for r in rhs.values()]+[{'name':r['name'],'direction':'out','width':r['width']} for r in writes.values()]}
                add(n,[(r['name'],[r]) for r in rhs.values()],[(r['name'],[r]) for r in writes.values()])
        edges=[];seen=set()
        for signal,targets in reads.items():
            for target,tp,r in targets:
                for src,sp,_ in drives.get(signal,[]):
                    if src==target:continue
                    key=(src,sp,target,tp,signal)
                    if key in seen:continue
                    seen.add(key)
                    edges.append({'id':f'{id}::$edge:{len(edges)}','source':src,'sourceHandle':'out:'+sp,'target':target,'targetHandle':'in:'+tp,'signal':r['name'],'signalId':signal,'width':r['width'],'control':bool(re.search(r'(^|_)(clk|clock|rst|reset|en|enable|valid|ready|empty|full|start|done|we|wr_en|rd_en)(_|$)',r['name'],re.I))})
        inst['graph']['edges']=edges
        return id
    roots=[instance(i) for i in compiled_root.topInstances]
    for p in paths:files.setdefault(relative(p),p.read_text(errors='replace'))
    if not roots:raise ProjectError('No top modules / 未找到顶层模块')
    return {'version':1,'project':cfg.get('name',root.name),'root':str(root),'roots':roots,'instances':instances,'files':files,'diagnostics':diagnostics,'importConfig':{k:cfg[k] for k in ('projectFile','target') if k in cfg},'notes':['Conservative block dependencies; slices share their base signal. Interfaces/modports are shown without inferred edges.']}

if __name__=='__main__':
    try:
        req=json.load(sys.stdin)
        result=parse_project(req['root'],req.get('selection'))
        print(json.dumps({'ok':True,'project':result},ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'ok':False,'error':str(e),**({'choices':e.choices} if isinstance(e,ProjectChoice) else {})},ensure_ascii=False));sys.exit(1)
