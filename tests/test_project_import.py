"""Import fixtures must produce the configured real hierarchy, not just scan RTL."""
import json, os, sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from parse_rtl import parse_project, ProjectError

class ImportFixture:
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='atlas import ');self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
    def put(self,name,text):
        p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text);return p
    def design(self):
        self.put('inc/width.svh','`define WIDTH 13\n')
        self.put('rtl/pkg.sv','package sizes;parameter W=`CFG;endpackage')
        self.put('rtl/child.sv','`include "width.svh"\nmodule child(input logic [`WIDTH-1:0] a,output logic [`WIDTH-1:0] y);assign y=a;endmodule')
        self.put('rtl/top.sv','module top(input logic [sizes::W-1:0] a,output logic [12:0] y);child u(.a(a),.y(y));endmodule')
        self.put('tb/broken.sv','intentionally invalid unused testbench')
    def check_design(self,p):
        self.assertEqual(p['roots'],['top']);self.assertEqual(p['instances']['top']['ports'][0]['width'],13)
        self.assertEqual(p['instances']['top']['children'],['top.u'])
        self.assertEqual(p['instances']['top.u']['ports'][0]['width'],13)
        self.assertNotIn('tb/broken.sv',p['files'])

class ProjectImportTest(ImportFixture,unittest.TestCase):
    def test_filelist_preserves_order_macros_and_relative_nested_F(self):
        self.design();self.put('files.f','// source order matters\n+define+CFG=13\n+incdir+inc\nrtl/pkg.sv\n-F lists/rtl.f\n--top-module top\n')
        self.put('lists/rtl.f','../rtl/child.sv\n../rtl/top.sv\n')
        self.check_design(parse_project(str(self.root)))
    def test_nested_lowercase_f_uses_project_working_directory(self):
        self.put('rtl/top.sv','module top;endmodule')
        self.put('files.f','-f lists/rtl.f');self.put('lists/rtl.f','rtl/top.sv')
        self.assertEqual(parse_project(str(self.root))['roots'],['top'])
    def test_quoted_path_and_environment_variable(self):
        self.put('rtl with spaces/top.sv','module top;endmodule');self.put('sources.f','"${ATLAS_IMPORT_TEST}/rtl with spaces/top.sv"')
        old=os.environ.get('ATLAS_IMPORT_TEST');os.environ['ATLAS_IMPORT_TEST']=str(self.root)
        try:self.assertEqual(parse_project(str(self.root))['roots'],['top'])
        finally:
            if old is None:os.environ.pop('ATLAS_IMPORT_TEST',None)
            else:os.environ['ATLAS_IMPORT_TEST']=old
    def test_missing_file_reports_manifest_instead_of_scanning_fallback(self):
        self.put('top.sv','module top;endmodule');self.put('files.f','missing.sv')
        with self.assertRaisesRegex(ProjectError,'missing.sv'):parse_project(str(self.root))
    def test_recursive_filelist_reports_cycle(self):
        self.put('top.sv','module top;endmodule');self.put('files.f','-F lists/a.f');self.put('lists/a.f','-F ../files.f')
        with self.assertRaisesRegex(ProjectError,'[Cc]ycl|循环'):parse_project(str(self.root))
    def test_unknown_compilation_option_is_not_silently_ignored(self):
        self.put('top.sv','module top;endmodule');self.put('files.f','-made-up-switch top.sv')
        with self.assertRaisesRegex(ProjectError,'made-up-switch'):parse_project(str(self.root))
    def test_multiple_manifests_require_selection(self):
        self.put('top.sv','module top;endmodule');self.put('a.f','top.sv');self.put('b.f','top.sv')
        with self.assertRaises(ProjectError) as cm:parse_project(str(self.root))
        self.assertEqual({x['selection']['projectFile'] for x in cm.exception.choices},{'a.f','b.f'})
    def test_atlas_config_can_choose_manifest_and_override_top(self):
        self.put('top.sv','module first;endmodule module second;endmodule');self.put('a.f','top.sv');self.put('b.f','missing.sv')
        self.put('atlas.project.json',json.dumps({'projectFile':'a.f','top':'second'}))
        self.assertEqual(parse_project(str(self.root))['roots'],['second'])
    def test_explicit_atlas_files_keep_precedence(self):
        self.put('top.sv','module top;endmodule');self.put('files.f','missing.sv')
        self.put('atlas.project.json',json.dumps({'files':['top.sv']}))
        self.assertEqual(parse_project(str(self.root))['roots'],['top'])
    def test_quartus_qpf_revision_qsf_qip_and_search_paths(self):
        self.design();self.put('design.qpf','PROJECT_REVISION = "rev"\n')
        self.put('rev.qsf','''set_global_assignment -name TOP_LEVEL_ENTITY top
set_global_assignment -name SEARCH_PATH inc
set_global_assignment -name VERILOG_MACRO "CFG=13"
set_global_assignment -name SYSTEMVERILOG_FILE rtl/pkg.sv
set_global_assignment -name QIP_FILE ip/child.qip
set_global_assignment -name SYSTEMVERILOG_FILE rtl/top.sv
set_global_assignment -name DEVICE ignored_device
''')
        self.put('ip/child.qip','set_global_assignment -name SYSTEMVERILOG_FILE [file join $::quartus(qip_path) ../rtl/child.sv]')
        self.check_design(parse_project(str(self.root)))
    def test_vivado_xpr_uses_design_fileset_and_excludes_simulation(self):
        self.design();self.put('design.xpr','''<Project><FileSets>
<FileSet Name="sources_1" Type="DesignSrcs"><File Path="$PPRDIR/rtl/pkg.sv"/><File Path="$PPRDIR/rtl/child.sv"/><File Path="$PPRDIR/rtl/top.sv"/>
<Config><Option Name="TopModule" Val="top"/><Option Name="IncludeDirs" Val="$PPRDIR/inc"/><Option Name="VerilogDefines" Val="CFG=13"/></Config></FileSet>
<FileSet Name="sim_1" Type="SimulationSrcs"><File Path="$PPRDIR/tb/broken.sv"/></FileSet>
</FileSets></Project>''')
        self.check_design(parse_project(str(self.root)))
    def test_vivado_static_tcl_sources_include_dirs_and_defines(self):
        self.design();self.put('project.tcl','''set origin_dir .
read_verilog -sv [list $origin_dir/rtl/pkg.sv $origin_dir/rtl/child.sv]
add_files -norecurse {rtl/top.sv}
set_property include_dirs [list inc] [current_fileset]
set_property verilog_define {CFG=13} [current_fileset]
set_property top top [current_fileset]
''');self.check_design(parse_project(str(self.root)))
    def test_tcl_does_not_execute_commands(self):
        self.put('top.sv','module top;endmodule');self.put('project.tcl','exec touch SHOULD_NOT_EXIST\nread_verilog top.sv')
        with self.assertRaisesRegex(ProjectError,'exec'):parse_project(str(self.root))
        self.assertFalse((self.root/'SHOULD_NOT_EXIST').exists())
    def test_vhdl_is_reported_instead_of_partial_import(self):
        self.put('top.sv','module top;endmodule');self.put('files.f','top.sv\nchild.vhd')
        with self.assertRaisesRegex(ProjectError,'VHDL'):parse_project(str(self.root))
    def test_edam_export_reads_order_includes_defines_and_top(self):
        self.design();self.put('design.eda.yml','''name: demo
toplevel: top
files:
  - {name: inc/width.svh, file_type: systemVerilogSource, is_include_file: true, include_path: inc}
  - {name: rtl/pkg.sv, file_type: systemVerilogSource}
  - {name: rtl/child.sv, file_type: systemVerilogSource}
  - {name: rtl/top.sv, file_type: systemVerilogSource}
parameters:
  CFG: {datatype: int, paramtype: vlogdefine, default: 13}
''');self.check_design(parse_project(str(self.root)))
    def test_fusesoc_local_fileset_target(self):
        self.design();self.put('demo.core','''CAPI=2:
name: local:demo:example:1.0
filesets:
  rtl:
    files: [rtl/pkg.sv, {inc/width.svh: {is_include_file: true}}, rtl/child.sv, rtl/top.sv]
    file_type: systemVerilogSource
parameters:
  CFG: {datatype: int, paramtype: vlogdefine, default: 13}
targets:
  default: {filesets: [rtl], parameters: [CFG], toplevel: top}
''');self.check_design(parse_project(str(self.root)))
    def test_fusesoc_missing_dependency_is_not_ignored(self):
        self.put('top.sv','module top;endmodule');self.put('demo.core','''CAPI=2:
name: local:demo:example:1.0
filesets:
  rtl: {files: [top.sv], depend: [vendor:missing:ip:1.0], file_type: systemVerilogSource}
targets:
  default: {filesets: [rtl], toplevel: top}
''')
        with self.assertRaisesRegex(ProjectError,'vendor:missing:ip'):parse_project(str(self.root))
    def test_bender_local_dependency_target_and_sources(self):
        self.design();self.put('Bender.yml','''package: {name: demo}
dependencies:
  sizes: {path: deps/sizes}
sources:
  - include_dirs: [inc]
    files: [rtl/child.sv, rtl/top.sv]
''')
        self.put('deps/sizes/Bender.yml','''package: {name: sizes}
sources:
  - defines: {CFG: 13}
    files: [../../rtl/pkg.sv]
''')
        self.check_design(parse_project(str(self.root)))
    def test_bender_target_filters_unused_tb(self):
        self.put('rtl/top.sv','module top;endmodule');self.put('tb/broken.sv','invalid')
        self.put('Bender.yml','''package: {name: demo}
sources:
  - rtl/top.sv
  - target: test
    files: [tb/broken.sv]
''')
        self.put('atlas.project.json',json.dumps({'target':'synthesis'}))
        self.assertEqual(parse_project(str(self.root))['roots'],['top'])


class ImportEdgeCasesTest(ImportFixture,unittest.TestCase):
    # Each fixture protects a compilation distinction that a directory scan loses.
    def test_filelist_library_files_do_not_create_extra_roots(self):
        self.put('top.sv','module top;used u();endmodule')
        self.put('cells.v','module used;endmodule module unused;endmodule')
        self.put('files.f','-v cells.v\ntop.sv')
        self.assertEqual(parse_project(str(self.root))['roots'],['top'])
    def test_filelist_library_search_directory(self):
        self.put('top.sv','module top;cell1 u();endmodule');self.put('lib/cell1.sv','module cell1;endmodule')
        self.put('files.f','-y lib\n+libext+.sv\ntop.sv')
        p=parse_project(str(self.root));self.assertEqual(p['roots'],['top']);self.assertIn('top.u',p['instances'])
    def test_bender_group_macro_does_not_leak_to_sibling(self):
        self.put('one.sv','module one(output logic [3:0] a);assign a=`N;endmodule')
        self.put('top.sv','''`ifdef N
invalid_macro_leaked
`endif
module top(output logic [3:0] a);one u(a);endmodule''')
        self.put('Bender.yml','''package: {name: demo}
sources:
  - defines: {N: 4}
    files: [one.sv]
  - top.sv
''')
        self.assertEqual(parse_project(str(self.root))['roots'],['top'])
    def test_bender_conditional_define_is_evaluated(self):
        self.put('top.sv','''`ifdef FOO
invalid_macro_should_be_disabled
`endif
module top;endmodule''')
        self.put('Bender.yml','''package: {name: demo}
sources:
  - defines: {FOO: {target: test}}
    files: [top.sv]
''');self.put('atlas.project.json',json.dumps({'target':'synthesis'}))
        self.assertEqual(parse_project(str(self.root))['roots'],['top'])
    def test_fusesoc_file_type_vhdl_cannot_be_misclassified_by_extension(self):
        self.put('top.sv','module top;endmodule')
        self.put('demo.core','''CAPI=2:
name: local:demo:example:1.0
filesets:
  rtl: {files: [top.sv], file_type: vhdlSource}
targets:
  default: {filesets: [rtl], toplevel: top}
''')
        with self.assertRaisesRegex(ProjectError,'VHDL'):parse_project(str(self.root))
    def test_bender_repeated_file_with_different_macros_is_not_silently_dropped(self):
        self.put('top.sv','module top;endmodule')
        self.put('Bender.yml','''package: {name: demo}
sources:
  - defines: {N: 1}
    files: [top.sv]
  - defines: {N: 2}
    files: [top.sv]
''')
        with self.assertRaisesRegex(ProjectError,'[Cc]onflict|冲突'):parse_project(str(self.root))
    def test_tcl_set_property_dict_cannot_silently_lose_macros(self):
        self.put('top.sv','module top;endmodule')
        self.put('project.tcl','read_verilog top.sv\nset_property -dict [list top top verilog_define FOO] [current_fileset]')
        with self.assertRaisesRegex(ProjectError,'dict|static|静态'):parse_project(str(self.root))

class ImportMetadataTest(ImportFixture,unittest.TestCase):
    def test_sourced_tcl_keeps_project_working_directory(self):
        self.put('rtl/top.sv','module top;endmodule');self.put('project.tcl','source scripts/rtl.tcl')
        self.put('scripts/rtl.tcl','read_verilog rtl/top.sv')
        self.assertEqual(parse_project(str(self.root))['roots'],['top'])
    def test_tcl_parameter_override_changes_elaborated_port_width(self):
        self.put('top.sv','module top #(parameter W=4)(input [W-1:0] x);endmodule')
        self.put('project.tcl','read_verilog top.sv\nset_property generic W=8 [current_fileset]')
        self.assertEqual(parse_project(str(self.root))['instances']['top']['ports'][0]['width'],8)
    def test_xpr_parameter_override_changes_elaborated_port_width(self):
        self.put('top.sv','module top #(parameter W=4)(input [W-1:0] x);endmodule')
        self.put('demo.xpr','''<Project><FileSets><FileSet Name="sources_1" Type="DesignSrcs"><File Path="$PPRDIR/top.sv"/><Config><Option Name="TopModule" Val="top"/><Option Name="Generic" Val="W=8"/></Config></FileSet></FileSets></Project>''')
        self.assertEqual(parse_project(str(self.root))['instances']['top']['ports'][0]['width'],8)

    def test_xpr_global_include_is_not_silently_ignored(self):
        self.put('defs.vh','`define W 8')
        self.put('top.sv','module top;endmodule')
        self.put('demo.xpr','''<Project><FileSets><FileSet Name="sources_1" Type="DesignSrcs"><File Path="$PPRDIR/defs.vh"><FileInfo><Attr Name="IsGlobalInclude" Val="1"/></FileInfo></File><File Path="$PPRDIR/top.sv"/></FileSet></FileSets></Project>''')
        with self.assertRaisesRegex(ProjectError,'[Gg]lobal|全局'):parse_project(str(self.root))
    def test_fusesoc_compiler_options_are_not_silently_ignored(self):
        self.put('top.sv','module top;endmodule')
        self.put('demo.core','''CAPI=2:
name: local:demo:example:1.0
filesets:
  rtl: {files: [top.sv], file_type: systemVerilogSource}
targets:
  default:
    filesets: [rtl]
    toplevel: top
    tools: {verilator: {verilator_options: ["-DW=8"]}}
''')
        with self.assertRaisesRegex(ProjectError,'[Tt]ool|工具'):parse_project(str(self.root))
    def test_edam_compiler_options_are_not_silently_ignored(self):
        self.put('top.sv','module top;endmodule')
        self.put('demo.eda.yml','''name: demo
toplevel: top
files: [{name: top.sv, file_type: systemVerilogSource}]
tool_options: {verilator: {verilator_options: ["-DW=8"]}}
''')
        with self.assertRaisesRegex(ProjectError,'[Tt]ool|工具'):parse_project(str(self.root))

class ImportUnitTest(ImportFixture,unittest.TestCase):
    def test_bender_adjacent_sources_with_same_settings_share_macros_in_order(self):
        self.put('defs.sv','`define W 8\n');self.put('top.sv','module top(input logic [`W-1:0] a);endmodule')
        self.put('Bender.yml','package: {name: demo}\nsources: [defs.sv, top.sv]')
        self.assertEqual(parse_project(str(self.root))['instances']['top']['ports'][0]['width'],8)
    def test_fusesoc_missing_explicit_header_is_reported_even_if_not_used(self):
        self.put('top.sv','module top;endmodule')
        self.put('demo.core','''CAPI=2:
name: local:demo:example:1.0
filesets:
  rtl:
    files: [{missing.svh: {is_include_file: true}}, top.sv]
    file_type: systemVerilogSource
targets:
  default: {filesets: [rtl], toplevel: top}
''')
        with self.assertRaisesRegex(ProjectError,'missing.svh'):parse_project(str(self.root))

if __name__=='__main__':unittest.main()
