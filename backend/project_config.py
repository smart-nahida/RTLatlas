"""Read build metadata without executing project scripts or fetching dependencies."""
import json, os, re, shlex
from pathlib import Path
import xml.etree.ElementTree as ET

class ProjectError(Exception):
    pass

class ProjectChoice(ProjectError):
    def __init__(self, message, choices):
        super().__init__(message)
        self.choices=choices

MAX_FILES=3000
MAX_BYTES=60*1024*1024
SKIP={'.git','node_modules','build','dist','.venv','venv','release','obj_dir'}
HDL={'.v','.sv','.vh','.svh'}
VHDL={'.vhd','.vhdl'}

def read_text(path):
    try:
        if path.stat().st_size>2*1024*1024:raise ProjectError(f'Manifest too large / 清单过大: {path}')
        return path.read_text(encoding='utf-8-sig')
    except OSError as e:raise ProjectError(f'Cannot read / 无法读取 {path}: {e.strerror}') from e

def expand(value,variables=None):
    variables=variables or os.environ
    def sub(m):
        key=m.group(1) or m.group(2)
        if key not in variables:raise ProjectError(f'Undefined path variable / 未定义路径变量: {key}')
        return str(variables[key])
    return re.sub(r'\$\{([^}]+)\}|\$([A-Za-z_][\w]*)',sub,str(value))

def path_at(base,value):
    return (base/expand(value)).expanduser().resolve()

def strings(value,field):
    if not isinstance(value,list) or any(not isinstance(x,str) for x in value):raise ProjectError(f'{field} must be an array of strings')
    return value

def choose_target(names,target,manifest,selection):
    if target:
        if target not in names:raise ProjectError(f'Unknown target {target} in {manifest.name}; available: {", ".join(names)}')
        return target
    if 'default' in names:return 'default'
    if len(names)==1:return names[0]
    if not names:raise ProjectError(f'No targets / 未找到构建目标: {manifest}')
    raise ProjectChoice(f'Choose build target / 选择构建目标: {manifest.name}',[
        {'label':n,'selection':{**selection,'target':n}} for n in names])

class Build:
    def __init__(self,root):
        self.root=root;self.files=[];self.includes=[];self.defines=[];self.units=[];self.libraries=[];self.library_files=[];self.libext=[];self.top=None;self.parameters=[];self.stack=[]
    def enter(self,path):
        if path in self.stack:raise ProjectError(f'Manifest cycle / 清单循环引用: {path}')
        if len(self.stack)>=40:raise ProjectError('Manifest nesting exceeds 40 / 清单嵌套过深')
        self.stack.append(path)
    def source(self,path,includes=None,defines=None):
        path=Path(path).resolve()
        if path.suffix.lower() in VHDL:raise ProjectError(f'VHDL is not supported yet / 暂不支持 VHDL，无法完整导入: {path}')
        if path.suffix.lower() not in HDL:raise ProjectError(f'Not a Verilog/SystemVerilog source / 非 RTL 源文件: {path}; generate IP RTL first / 请先生成 IP 的 RTL')
        if not path.is_file():raise ProjectError(f'Source file not found / 源文件缺失: {path}')
        if len(self.files)>=MAX_FILES:raise ProjectError('Source file limit exceeded (3000)')
        if path in self.files and includes is not None:
            old=next((u for u in self.units if str(path) in u['files']),None)
            if old and (old['includeDirs']!=[str(p) for p in includes] or old['defines']!=list(defines or [])):
                raise ProjectError(f'Conflicting compilation settings / 同一文件编译配置冲突: {path}')
        if path not in self.files:
            self.files.append(path)
            if includes is not None:
                unit={'files':[str(path)],'includeDirs':[str(p) for p in includes],'defines':list(defines or [])}
                if self.units and all(self.units[-1][k]==unit[k] for k in ('includeDirs','defines')):
                    self.units[-1]['files'].append(str(path))
                else:self.units.append(unit)
    def header(self,path,include_path=None):
        if not path.is_file():raise ProjectError(f'Header file not found / 头文件缺失: {path}')
        self.include(include_path or path.parent)
    def include(self,path):
        if not path.is_dir():raise ProjectError(f'Include directory not found / 头文件目录缺失: {path}')
        if path not in self.includes:self.includes.append(path)
    def filelist(self,manifest,base=None):
        base=base or self.root;self.enter(manifest)
        try:
            text=read_text(manifest)
            text=re.sub(r'/\*.*?\*/',' ',text,flags=re.S)
            text=re.sub(r'(?m)(?<!\S)//.*$','',text).replace('\\\n',' ')
            try:tokens=shlex.split(text,comments=True)
            except ValueError as e:raise ProjectError(f'{manifest}: {e}') from e
            i=0
            while i<len(tokens):
                token=tokens[i];i+=1
                def arg():
                    nonlocal i
                    if i>=len(tokens):raise ProjectError(f'{manifest}: missing argument for {token}')
                    val=tokens[i];i+=1;return val
                if token in ('-f','-F'):
                    nested=path_at(base,arg());self.filelist(nested,nested.parent if token=='-F' else self.root)
                elif token.startswith('+incdir+'):
                    for s in token[8:].split('+'):self.include(path_at(base,s))
                elif token.startswith('+define+'):
                    self.defines.extend(token[8:].split('+'))
                elif token=='-I' or token.startswith('-I'):self.include(path_at(base,arg() if token=='-I' else token[2:]))
                elif token=='-D' or token.startswith('-D'):self.defines.append(arg() if token=='-D' else token[2:])
                elif token in ('--top','--top-module','-top','-s'):self.top=arg()
                elif token=='-y':
                    directory=path_at(base,arg());self.include(directory);self.libraries.append(str(directory))
                elif token=='-v':
                    library=path_at(base,arg());self.source(library);self.library_files.append(str(library))
                elif token.startswith('+libext+'):self.libext.extend(token[8:].split('+'))
                elif token in ('-sv','-sverilog','-g2012','-g2005-sv','--timing','--assert','--lint-only','+librescan'):pass
                elif token.startswith(('-','+')):raise ProjectError(f'{manifest}: Unsupported filelist option / 不支持的清单选项: {token}; use atlas.project.json for an explicit file set')
                else:self.source(path_at(base,token))
        finally:self.stack.pop()
    def xpr(self,manifest,target,selection):
        try:xml=ET.fromstring(read_text(manifest))
        except ET.ParseError as e:raise ProjectError(f'Invalid Vivado XPR: {e}') from e
        sets=[s for s in xml.iter('FileSet') if s.get('Type')=='DesignSrcs']
        name=choose_target([s.get('Name','') for s in sets],target,manifest,selection)
        fs=next(s for s in sets if s.get('Name')==name)
        variables={'PPRDIR':str(manifest.parent)}
        def resolve(s):
            s=s.replace('$PSRCDIR',str(manifest.with_suffix('.srcs')))
            return path_at(manifest.parent,expand(s,variables))
        for option in fs.findall('./Config/Option'):
            key=option.get('Name');val=option.get('Val','')
            if key=='TopModule':self.top=val or None
            elif key=='IncludeDirs':
                from project_tcl import list_words
                for item in list_words(val):self.include(resolve(item))
            elif key=='Generic' and val:
                from project_tcl import list_words
                self.parameters.extend(list_words(val))
            elif key=='VerilogDefines':
                from project_tcl import list_words
                self.defines.extend(list_words(val))
        for item in fs.findall('File'):
            info={a.get('Name'):a.get('Val') for a in item.findall('./FileInfo/Attr')}
            used=[a.get('Val') for a in item.findall('./FileInfo/Attr') if a.get('Name')=='UsedIn']
            if info.get('IsEnabled','1') in ('0','false') or (used and not any(x in ('synthesis','implementation') for x in used)):continue
            path=resolve(item.get('Path',''))
            if info.get('IsGlobalInclude','0').lower() in ('1','true'):raise ProjectError(f'Vivado global include / 全局头文件需要导出显式 include 的 RTL 或文件清单: {path}')
            if path.suffix.lower() in ('.xdc','.sdc','.mem','.coe','.hex'):continue
            if path.suffix.lower() in ('.vh','.svh') or info.get('FileType') in ('Verilog Header','SystemVerilog Header'):self.header(path)
            else:self.source(path)
    def yaml(self,path):
        try:
            import yaml
            data=yaml.safe_load(read_text(path))
        except ImportError as e:raise ProjectError('Install backend requirements (PyYAML) / 请更新解析器依赖') from e
        except (ValueError,yaml.YAMLError) as e:raise ProjectError(f'Invalid YAML {path}: {e}') from e
        if not isinstance(data,dict):raise ProjectError(f'Expected YAML object: {path}')
        return data
    def edam(self,path):
        data=self.yaml(path);self.top=data.get('toplevel')
        if data.get('tool_options') or data.get('flow_options'):raise ProjectError(f'{path.name}: Tool-specific compiler options / 工具编译选项需要转换为 atlas.project.json 的 defines/includeDirs 后再导入')
        if isinstance(self.top,list):
            if len(self.top)!=1:raise ProjectError('EDAM with multiple toplevels: select one using atlas.project.json top')
            self.top=self.top[0]
        for item in data.get('files',[]):
            name=path_at(path.parent,item['name']);kind=item.get('file_type','').lower()
            if item.get('is_include_file'):self.header(name,path_at(path.parent,item['include_path']) if item.get('include_path') else None)
            elif 'verilog' in kind or 'vhdl' in kind or name.suffix.lower() in HDL|VHDL:self.source(name)
        for name,p in data.get('parameters',{}).items():
            if p.get('paramtype')=='vlogdefine' and 'default' in p:self.defines.append(define(name,p['default']))
            elif p.get('paramtype')=='vlogparam':raise ProjectError('EDAM parameter overrides require an explicit RTL wrapper / 请提供带参数覆盖的顶层 wrapper')
    def fusesoc(self,path,target,selection):
        self.enter(path)
        try:
            data=self.yaml(path);targets=data.get('targets',{})
            selected=choose_target(list(targets),target,path,selection);t=targets[selected]
            if t.get('tools'):raise ProjectError(f'{path.name}: Tool-specific options / 工具编译选项需要转换为静态文件清单或 atlas.project.json 的 defines/includeDirs 后再导入')
            if any(k in t for k in ('generate','hooks')):raise ProjectError(f'{path.name}: generated sources/hooks need a FuseSoC EDAM export (.eda.yml)')
            top=t.get('toplevel')
            if isinstance(top,list):
                if len(top)!=1:raise ProjectError('Multiple FuseSoC toplevels: export a single target')
                top=top[0]
            for fsname in t.get('filesets',[]):
                if fsname not in data.get('filesets',{}):raise ProjectError(f'Unsupported/unknown FuseSoC fileset {fsname}')
                fs=data['filesets'][fsname]
                for dep in fs.get('depend',[]):
                    candidates=[]
                    for p in self.root.rglob('*.core'):
                        if any(x in SKIP for x in p.relative_to(self.root).parts):continue
                        if self.yaml(p).get('name')==dep:candidates.append(p)
                    if len(candidates)!=1:raise ProjectError(f'Missing or ambiguous FuseSoC dependency / 依赖未解析: {dep}; export .eda.yml with FuseSoC after resolving dependencies')
                    self.fusesoc(candidates[0],'default',selection)
                for entry in fs.get('files',[]):
                    if isinstance(entry,str):name=entry;attrs={}
                    elif isinstance(entry,dict) and len(entry)==1:name,attrs=next(iter(entry.items()));attrs=attrs or {}
                    else:raise ProjectError(f'Invalid FuseSoC file entry in {path}')
                    if '?' in name:raise ProjectError('Conditional FuseSoC files require an EDAM export (.eda.yml)')
                    file=path_at(path.parent,name)
                    if 'vhdl' in attrs.get('file_type',fs.get('file_type','')).lower():raise ProjectError(f'VHDL not supported: {file}')
                    if attrs.get('is_include_file'):self.header(file,path_at(path.parent,attrs['include_path']) if attrs.get('include_path') else None)
                    elif file.suffix.lower() in HDL|VHDL:self.source(file)
                    elif 'verilog' in attrs.get('file_type',fs.get('file_type','')).lower():self.source(file)
            for item in t.get('parameters',[]):
                name,sep,val=item.partition('=');param=data.get('parameters',{}).get(name)
                if not param:raise ProjectError(f'Unknown FuseSoC parameter: {name}')
                if param.get('paramtype')=='vlogdefine':self.defines.append(define(name,val if sep else param.get('default')))
                elif param.get('paramtype')=='vlogparam':raise ProjectError(f'FuseSoC parameter {name} requires a wrapper or an EDAM export with resolved parameters')
            if top:self.top=top
        finally:self.stack.pop()
    def bender(self,path,target,selection):
        self.enter(path)
        try:
            data=self.yaml(path)
            for name,spec in data.get('dependencies',{}).items():
                if not isinstance(spec,dict):raise ProjectError(f'Invalid Bender dependency: {name}')
                if spec.get('path'):dep=path_at(path.parent,spec['path'])/'Bender.yml'
                else:
                    raise ProjectError(f'Bender dependency / 依赖 {name} needs resolution by Bender; export a filelist with bender script verilator')
                self.bender(dep,target,selection)
            def group(entries,includes,defines,ancestors=()):
                if not isinstance(entries,list):raise ProjectError(f'Invalid Bender sources: {path}')
                if id(entries) in ancestors:raise ProjectError('YAML alias cycle / YAML 循环引用')
                for item in entries:
                    if isinstance(item,str):self.source(path_at(path.parent,item),includes,defines)
                    elif isinstance(item,dict):
                        expr=item.get('target')
                        if expr and not target_match(str(expr),set((target or '').split(','))):continue
                        inc=includes+[path_at(path.parent,p) for p in item.get('include_dirs',[])]
                        for p in inc:
                            if not p.is_dir():raise ProjectError(f'Include directory missing: {p}')
                        ds=list(defines)
                        for k,v in item.get('defines',{}).items():
                            if isinstance(v,dict):
                                if not target_match(str(v.get('target','')),set((target or '').split(','))):continue
                                v=v.get('value')
                            ds.append(define(k,v))
                        group(item.get('files',[]),inc,ds,ancestors+(id(entries),))
                    else:raise ProjectError(f'Invalid Bender source entry: {path}')
            inc=[path_at(path.parent,p) for p in data.get('export_include_dirs',[])]
            # Exports are visible to packages depending on this one, unlike source-group includes.
            self.includes.extend(p for p in inc if p not in self.includes)
            group(data.get('sources',[]),inc,[])
        finally:self.stack.pop()

def define(name,value):
    if not re.fullmatch(r'[A-Za-z_]\w*',name):raise ProjectError(f'Invalid macro name: {name}')
    if value is None:return name
    if isinstance(value,bool):value=int(value)
    return f'{name}={value}'

def target_match(expr,enabled):
    tokens=re.findall(r'[A-Za-z_][\w.-]*|[(),]',expr)
    if ''.join(tokens)!=re.sub(r'\s+','',expr):raise ProjectError(f'Unsupported Bender target expression: {expr}')
    i=0
    def node():
        nonlocal i
        if i>=len(tokens):raise ProjectError(f'Invalid target expression: {expr}')
        word=tokens[i];i+=1
        if i<len(tokens) and tokens[i]=='(':
            i+=1;values=[node()]
            while i<len(tokens) and tokens[i]==',':i+=1;values.append(node())
            if i>=len(tokens) or tokens[i]!=')':raise ProjectError(f'Invalid target expression: {expr}')
            i+=1
            if word=='all':return all(values)
            if word=='any':return any(values)
            if word=='not' and len(values)==1:return not values[0]
            raise ProjectError(f'Unsupported target function: {word}')
        return word in enabled or word=='*'
    result=node()
    if i!=len(tokens):raise ProjectError(f'Invalid target expression: {expr}')
    return result

def load_config(root,selection=None):
    selection=selection or {};config_path=root/'atlas.project.json'
    try:cfg=json.loads(read_text(config_path)) if config_path.exists() else {}
    except ValueError as e:raise ProjectError(f'Invalid atlas.project.json: {e}') from e
    if not isinstance(cfg,dict):raise ProjectError('atlas.project.json must be an object')
    for key in ('files','includeDirs','defines'):
        if key in cfg:strings(cfg[key],key)
    for key in ('top','projectFile','target'):
        if key in cfg and not isinstance(cfg[key],str):raise ProjectError(f'{key} must be a string')
    for key in ('projectFile','target'):
        if key in selection:
            if not isinstance(selection[key],str):raise ProjectError(f'{key} must be a string')
            cfg[key]=selection[key]
    b=Build(root);target=cfg.get('target');manifest=cfg.get('projectFile')
    if 'files' in cfg:
        for p in cfg['files']:b.source(path_at(root,p))
    else:
        if not manifest:
            paths=[p for p in root.iterdir() if p.is_file()]
            # A QPF selects its revision QSF; don't ask for both representations.
            candidates=[p for p in paths if p.suffix.lower() in ('.f','.flist','.qpf','.xpr','.core') or p.name=='Bender.yml' or p.name.endswith('.eda.yml')]
            if not any(p.suffix.lower()=='.qpf' for p in candidates):candidates += [p for p in paths if p.suffix.lower()=='.qsf']
            if not candidates:candidates=[p for p in paths if p.name.lower() in ('project.tcl','sources.tcl','files.tcl')]
            candidates=sorted(set(candidates))
            if len(candidates)>1:raise ProjectChoice('Choose project manifest / 选择工程清单',[
                {'label':p.name,'selection':{'projectFile':p.name}} for p in candidates])
            if candidates:manifest=candidates[0].name
        if manifest:
            path=path_at(root,manifest);selection={**selection,'projectFile':str(path.relative_to(root)) if path.is_relative_to(root) else str(path)}
            try:
                if path.suffix.lower() in ('.f','.flist'):b.filelist(path)
                elif path.suffix.lower()=='.xpr':b.xpr(path,target,selection)
                elif path.suffix.lower() in ('.qpf','.qsf','.qip','.tcl'):
                    from project_tcl import read_tcl_project
                    read_tcl_project(b,path,target,selection)
                elif path.name.endswith('.eda.yml'):b.edam(path)
                elif path.suffix.lower()=='.core':b.fusesoc(path,target,selection)
                elif path.name=='Bender.yml':
                    if target is None:
                        # Untargeted files always participate. Let the user select named variants.
                        data=b.yaml(path)
                        exprs=re.findall(r'(?m)^\s*(?:-\s*)?target:\s*([^#\n]+)',read_text(path))
                        atoms=sorted(set(re.findall(r'[A-Za-z_][\w.-]*',' '.join(exprs)))-{'all','any','not'})
                        if atoms:raise ProjectChoice('Choose Bender target / 选择 Bender 构建目标',[
                            {'label':n or '(no target / 无目标)','selection':{**selection,'target':n}} for n in ['']+atoms])
                    b.bender(path,target,selection)
                else:raise ProjectError(f'Unsupported project manifest: {path}')
            except (KeyError,TypeError,AttributeError,RecursionError) as e:raise ProjectError(f'Invalid project manifest / 工程清单格式不支持: {path}: {e}') from e
        else:
            for base,dirs,files in os.walk(root):
                dirs[:]=sorted(d for d in dirs if d not in SKIP and not d.startswith('.'))
                for name in sorted(files):
                    p=Path(base)/name
                    if p.suffix.lower() in ('.v','.sv'):b.source(p)
                    elif p.suffix.lower() in VHDL:raise ProjectError(f'VHDL not supported / 暂不支持 VHDL: {p}')
    for p in cfg.get('includeDirs',[]):b.include(path_at(root,p))
    b.defines.extend(cfg.get('defines',[]))
    if not b.files:raise ProjectError('No .v/.sv files found / 未找到 RTL 文件')
    if sum(p.stat().st_size for p in b.files)>MAX_BYTES:raise ProjectError('Source size limit exceeded (60 MiB)')
    result={**cfg,'files':[str(p) for p in b.files],'includeDirs':[str(p) for p in b.includes],'defines':b.defines,'top':cfg.get('top') or b.top,'units':b.units,'libraryDirs':b.libraries,'libraryFiles':b.library_files,'libraryExtensions':b.libext,'parameters':b.parameters}
    if manifest:result['projectFile']=selection['projectFile']
    return result
