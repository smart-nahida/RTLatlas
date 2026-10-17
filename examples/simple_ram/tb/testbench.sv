`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 logic we=0;logic [2:0] addr=0;logic [7:0] din=0;wire [7:0] dout;
 top dut(.clk(clk),.rst_n(rst_n),.we(we),.addr(addr),.din(din),.dout(dout));
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
  we=1;addr=0;din=12;tick();addr=1;din=34;tick();we=0;
 addr=0;tick();check(dout==12,"read address zero");addr=1;tick();check(dout==34,"read address one");
 we=1;din=56;tick();check(dout==34,"read-first collision");we=0;tick();check(dout==56,"new word next read");
 rst_n=0;tick();check(dout==0,"reset output only");rst_n=1;addr=0;tick();check(dout==12,"memory survives reset");
  $display("PASS: simple_ram");$finish;
 end
 initial begin #10000;$fatal(1,"Simulation timeout");end
endmodule
