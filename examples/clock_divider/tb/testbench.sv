`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 wire divided_clk,tick_pulse;
 top dut(.clk(clk),.rst_n(rst_n),.divided_clk(divided_clk),.tick_pulse(tick_pulse));
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
  tick();check(divided_clk===0 && tick_pulse===0,"first cycle");tick();check(divided_clk===0,"second cycle");
 tick();check(divided_clk===1 && tick_pulse===1,"third cycle toggles");
 tick();check(tick_pulse===0,"one-cycle pulse");tick();tick();check(divided_clk===0 && tick_pulse===1,"six-cycle period");
  $display("PASS: clock_divider");$finish;
 end
 initial begin #10000;$fatal(1,"Simulation timeout");end
endmodule
