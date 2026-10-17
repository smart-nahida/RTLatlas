import unittest, tempfile, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from parse_rtl import parse_project, ProjectError

class ParserTest(unittest.TestCase):
    def parse(self, code, **config):
        with tempfile.TemporaryDirectory(prefix='rtl test ') as folder:
            root=Path(folder);(root/'design.sv').write_text(code)
            if config:(root/'atlas.project.json').write_text(json.dumps({'files':['design.sv'], **config}))
            return parse_project(str(root))
    def test_parameter_generate_and_connections(self):
        p=self.parse('''module child #(parameter W=8)(input logic [W-1:0] a, output logic [W-1:0] b); assign b=a; endmodule
module top(input logic [15:0] x,output wire [15:0] y); for(genvar k=0;k<2;k++)begin:g child #(.W(16)) u(.a(x),.b(y)); end endmodule''',top='top')
        top=p['instances'][p['roots'][0]]
        self.assertEqual(len(top['children']),2)
        ids=top['children'];self.assertNotEqual(*ids)
        for id in ids:self.assertEqual(p['instances'][id]['ports'][0]['width'],16)
        self.assertTrue(any(e['signal']=='x' for e in top['graph']['edges']))
        self.assertTrue(any(e['signal']=='y' for e in top['graph']['edges']))
    def test_type_parameters_keep_resolved_types_and_value_parameters(self):
        p=self.parse("""module typed #(parameter type T=logic[7:0], parameter W=4)(input T a,output T b);assign b=a;endmodule
module top(input logic[7:0] a,input logic[15:0] wide,output logic[7:0] y,output logic[15:0] z);
 typed u_default(.a(a),.b(y));
 typed #(.T(logic[15:0]),.W(16)) u_wide(.a(wide),.b(z));
endmodule""",top='top')
        small=p['instances']['top.u_default'];wide=p['instances']['top.u_wide']
        self.assertEqual(small['parameters']['T'],'logic[7:0]')
        self.assertEqual(wide['parameters']['T'],'logic[15:0]')
        self.assertEqual(small['parameters']['W'],'4')
        self.assertEqual(wide['parameters']['W'],'16')
        self.assertEqual(small['ports'][0]['width'],8)
        self.assertEqual(wide['ports'][0]['width'],16)

    def test_block_dependencies_sequential_boundary(self):
        p=self.parse('''module top(input logic clk,en,input logic[7:0] a,output logic[7:0] b);
logic[7:0] r; always_ff @(posedge clk) if(en)r<=r+a; assign b=r; endmodule''')
        graph=p['instances'][p['roots'][0]]['graph']
        self.assertTrue(any(n['sequential'] for n in graph['nodes']))
        self.assertTrue(any(e['signal']=='r' for e in graph['edges']))
        self.assertTrue(any(e['signal']=='en' for e in graph['edges']))
    def test_expressions_and_open_ports(self):
        p=self.parse('''module c(input logic a,output logic b);assign b=a;endmodule
module top(input logic x,y);c u(.a(x & y),.b());endmodule''')
        top=p['instances'][p['roots'][0]]
        signals={e['signal'] for e in top['graph']['edges']}
        self.assertTrue({'x','y'}.issubset(signals));self.assertNotIn('',signals)
        child=p['instances'][top['children'][0]]
        self.assertEqual(child['ports'][1]['refs'],[])
    def test_invalid_rtl_reports_error(self):
        with self.assertRaises(ProjectError):self.parse('module top(input logic x) this is broken endmodule')
    def test_missing_config_file_reports_error(self):
        with self.assertRaises(ProjectError):self.parse('module top;endmodule',files=['missing.sv'])
    def test_include_and_define(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'inc').mkdir();(root/'inc'/'width.svh').write_text('`define WIDTH 12\n')
            (root/'design.sv').write_text('`include "width.svh"\nmodule top(input logic [`WIDTH-1:0] a);endmodule')
            (root/'atlas.project.json').write_text(json.dumps({'files':['design.sv'],'includeDirs':['inc'],'top':'top'}))
            p=parse_project(folder);self.assertEqual(p['instances']['top']['ports'][0]['width'],12)
    def test_multidimensional_instance_array(self):
        p=self.parse('module c(input a,output y);assign y=a;endmodule module top(input [3:0] a,output [3:0] y);c u[1:0][1:0](a,y);endmodule')
        self.assertEqual(len(p['instances']['top']['children']),4)
    def test_net_initializer_keeps_upstream_dependency(self):
        p=self.parse('module top(input a,output y);wire x=a;assign y=x;endmodule')
        self.assertEqual({e['signal'] for e in p['instances']['top']['graph']['edges']},{'a','x','y'})
    def test_lvalue_selector_is_read_not_written(self):
        p=self.parse('module top(input logic [1:0] idx,input logic [3:0] a,output logic [3:0] y);always_comb begin y=0;y[idx]=a[0];end endmodule')
        g=p['instances']['top']['graph'];n=next(n for n in g['nodes'] if n['kind']=='logic')
        self.assertEqual({p['name'] for p in n['ports'] if p['direction']=='out'},{'y'})
        self.assertIn('idx',{p['name'] for p in n['ports'] if p['direction']=='in'})
        self.assertTrue(any(e['signal']=='idx' for e in g['edges']))
    def test_source_ranges_are_original_file_lines(self):
        p=self.parse('\n\nmodule top(input logic a,output logic b);\n assign b=a;\nendmodule\n')
        top=p['instances']['top'];self.assertEqual(top['source']['line'],3)
        n=next(n for n in top['graph']['nodes'] if n['kind']=='logic');self.assertEqual(n['source']['line'],4)
        self.assertIn('design.sv',p['files'])

if __name__=='__main__':unittest.main()
