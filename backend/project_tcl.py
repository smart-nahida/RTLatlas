"""A deliberately static Tcl reader. Never starts Tcl, shells, or vendor tools."""
import re
from pathlib import Path
from project_config import ProjectError, ProjectChoice, read_text, path_at

def split_tcl(text,commands=False):
    result=[];words=[];buf=[];brace=bracket=0;quoted=False;started=False;i=0
    def word():
        nonlocal buf,started
        if started:words.append(''.join(buf));buf=[];started=False
    def command():
        word()
        if words:result.append(list(words));words.clear()
    while i<len(text):
        c=text[i]
        if c=='\\' and i+1<len(text):
            if text[i+1]=='\n':buf.append(' ');i+=2;continue
            buf.extend((c,text[i+1]));started=True;i+=2;continue
        if commands and c=='#' and not started and not words and not brace and not bracket and not quoted:
            end=text.find('\n',i);i=len(text) if end<0 else end;continue
        if not brace:
            if c=='"' and not bracket:quoted=not quoted
            if not quoted or bracket:
                if c=='[':bracket+=1
                elif c==']':
                    bracket-=1
                    if bracket<0:raise ProjectError('Unbalanced Tcl brackets')
        if not quoted and not bracket:
            if c=='{':brace+=1
            elif c=='}':
                brace-=1
                if brace<0:raise ProjectError('Unbalanced Tcl braces')
        if not brace and not bracket and not quoted and c.isspace():
            if commands and c=='\n':command()
            else:word()
        elif commands and c==';' and not brace and not bracket and not quoted:command()
        else:buf.append(c);started=True
        i+=1
    if brace or bracket or quoted:raise ProjectError('Unbalanced Tcl expression / Tcl 括号或引号不匹配')
    command()
    return result if commands else (result[0] if result else [])

def unquote(s):
    if len(s)>1 and ((s[0]=='{' and s[-1]=='}') or (s[0]=='"' and s[-1]=='"')):return s[1:-1]
    return s

def list_words(s):return [unquote(x) for x in split_tcl(s)]

class StaticTcl:
    def __init__(self,build,path,cwd=None):
        self.build=build;self.path=path;self.cwd=cwd or (path.parent if path.suffix.lower() in ('.qsf','.qip') else build.root);self.variables={'origin_dir':'.','::quartus(qip_path)':str(path.parent),'::quartus(qsf_path)':str(path.parent)}
    def value(self,word):
        if word.startswith('{') and word.endswith('}'):return word[1:-1]
        word=unquote(word)
        if word.startswith('[') and word.endswith(']'):
            w=split_tcl(word[1:-1]);cmd=w[0] if w else ''
            if cmd=='list':
                vals=[self.value(s) for s in w[1:]]
                if any(isinstance(v,list) for v in vals):raise ProjectError('Nested Tcl lists need an exported filelist')
                return vals
            if cmd=='file' and len(w)>2:
                op=w[1];vals=[self.scalar(s) for s in w[2:]]
                if op=='join':return str(Path(vals[0]).joinpath(*vals[1:]))
                if op=='normalize' and len(vals)==1:return str(path_at(self.cwd,vals[0]))
                if op=='dirname' and len(vals)==1:return str(Path(vals[0]).parent)
            if cmd=='info' and w[1:]==['script']:return str(self.path)
            if cmd in ('current_fileset','get_filesets'):
                return 'sim_1' if any('sim' in x for x in w[1:]) else (self.scalar(w[-1]) if cmd=='get_filesets' and len(w)>1 else 'sources_1')
            if cmd in ('current_project','get_projects'):return '__project__'
            raise ProjectError(f'{self.path}: Unsupported Tcl expression [{cmd}]; export a static filelist / 请导出静态文件清单')
        if '[' in word or ']' in word:raise ProjectError(f'{self.path}: Embedded Tcl expressions need an exported filelist: {word}')
        def sub(m):
            key=m.group(1) or m.group(2)
            if key.startswith('::env('):
                from project_config import expand
                return expand('${'+key[6:-1]+'}')
            if key not in self.variables:raise ProjectError(f'{self.path}: Undefined Tcl variable ${key}')
            value=self.variables[key]
            if isinstance(value,list):raise ProjectError(f'{self.path}: Tcl list expansion needs an exported filelist')
            return value
        word=re.sub(r'\$\{([^}]+)\}|\$([:\w]+(?:\([^)]*\))?)',sub,word)
        return re.sub(r'\\([\\ {}";$])',r'\1',word)
    def scalar(self,word):
        v=self.value(word)
        if isinstance(v,list):
            if len(v)!=1:raise ProjectError(f'{self.path}: expected single value: {word}')
            v=v[0]
        return v
    def items(self,word):
        v=self.value(word)
        return v if isinstance(v,list) else list_words(v)
    def pathval(self,word):return path_at(self.cwd,self.scalar(word))
    def read(self):
        b=self.build;b.enter(self.path)
        try:
            for w in split_tcl(read_text(self.path),commands=True):
                cmd=w[0]
                if cmd=='set' and len(w)==3:self.variables[w[1]]=self.value(w[2]);continue
                if cmd=='set_global_assignment':
                    if '-name' not in w:raise ProjectError(f'Invalid assignment in {self.path}')
                    i=w.index('-name');key=w[i+1]
                    if len(w)<=i+2:raise ProjectError(f'Missing {key} value in {self.path}')
                    val=w[i+2]
                    if key in ('SYSTEMVERILOG_FILE','VERILOG_FILE','VHDL_FILE'):b.source(self.pathval(val))
                    elif key in ('QIP_FILE','SOURCE_TCL_SCRIPT_FILE'):
                        StaticTcl(b,self.pathval(val)).read()
                    elif key in ('QSYS_FILE','IP_FILE'):raise ProjectError(f'Generate vendor IP RTL first / 请先生成厂商 IP 的 RTL: {self.scalar(val)}')
                    elif key=='SEARCH_PATH':b.include(self.pathval(val))
                    elif key=='VERILOG_MACRO':b.defines.append(self.scalar(val))
                    elif key=='TOP_LEVEL_ENTITY':b.top=self.scalar(val)
                    continue
                if cmd in ('read_verilog','read_vhdl','add_files'):
                    if '-fileset' in w:
                        name=self.scalar(w[w.index('-fileset')+1])
                        if name.startswith('sim'):continue
                    i=1
                    while i<len(w):
                        token=w[i];i+=1
                        if token in ('-sv','-norecurse','-quiet','-verbose','-scan_for_includes'):continue
                        if token in ('-fileset','-library'):i+=1;continue
                        if token.startswith('-'):raise ProjectError(f'{self.path}: Unsupported {cmd} option: {token}')
                        for item in self.items(token):
                            if cmd=='read_vhdl':raise ProjectError(f'VHDL not supported / 暂不支持 VHDL: {item}')
                            b.source(path_at(self.cwd,item))
                    continue
                if cmd=='set_property' and len(w)==4:
                    if w[1].startswith('-'):raise ProjectError(f'{self.path}: set_property {w[1]} requires a static filelist / 请导出静态文件清单')
                    key=w[1].lower()
                    if key in ('include_dirs','verilog_define','top','generic'):
                        target=self.scalar(w[3])
                        if target.startswith('sim'):continue
                        if key=='include_dirs':
                            for p in self.items(w[2]):b.include(path_at(self.cwd,p))
                        elif key=='verilog_define':b.defines.extend(self.items(w[2]))
                        elif key=='generic':b.parameters.extend(self.items(w[2]))
                        else:b.top=self.scalar(w[2])
                    elif key=='file_type' and 'VHDL' in self.scalar(w[2]):raise ProjectError('VHDL not supported / 暂不支持 VHDL')
                    # Other Vivado properties concern part, board, constraints, or UI.
                    continue
                if cmd=='source' and len(w)==2:
                    child=StaticTcl(b,self.pathval(w[1]),self.cwd);child.variables.update(self.variables)
                    child.variables['::quartus(qip_path)']=str(child.path.parent)
                    child.read();self.variables.update(child.variables);continue
                if cmd in ('create_project','read_xdc','set_param','update_compile_order','puts','project_open','project_close','set_location_assignment','set_instance_assignment','export_assignments'):continue
                raise ProjectError(f'{self.path}: Unsupported Tcl command {cmd}; export a static filelist / 请导出静态文件清单')
        finally:b.stack.pop()

def read_tcl_project(build,path,target,selection):
    if path.suffix.lower()=='.qpf':
        revisions=re.findall(r'(?m)^\s*PROJECT_REVISION\s*=\s*"?([^"\r\n]+)',read_text(path))
        revisions=[x.strip() for x in revisions]
        if not revisions:revisions=[path.stem]
        from project_config import choose_target
        revision=choose_target(revisions,target,path,selection)
        path=path.with_name(revision+'.qsf')
    StaticTcl(build,path).read()
