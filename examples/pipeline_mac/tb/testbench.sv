`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 logic valid_in=0;logic signed [7:0] a=0,b=0;logic signed [31:0] c=0;wire valid_out;wire signed [31:0] result;
 top dut(.clk(clk),.rst_n(rst_n),.valid_in(valid_in),.a(a),.b(b),.c(c),.valid_out(valid_out),.result(result));
 always #5 clk=~clk;
 task automatic tick;
  @(posedge clk); #1; @(negedge clk); #1;
 endtask
 task automatic check(input bit ok,input string message);
  if(!ok)$fatal(1,"FAIL: %s",message);
 endtask
 initial begin
  $dumpfile("waves.vcd");$dumpvars(0,tb);
  tick();tick();rst_n=1;
  valid_in=1;a=2;b=3;c=5;tick();check(!valid_out,"pipeline filling");
 a=4;b=5;c=1;tick();check(valid_out && result==11,"2*3+5");
 valid_in=0;tick();check(valid_out && result==21,"4*5+1");tick();check(!valid_out,"bubble");
 valid_in=1;a=-2;b=3;c=4;tick();valid_in=0;tick();check(valid_out && result==-2,"signed arithmetic");
  $display("PASS: pipeline_mac");$finish;
 end
 initial begin #10000;$fatal(1,"Simulation timeout");end
endmodule
