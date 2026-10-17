`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 logic signal_in=0;wire rising,falling;
 top dut(.clk(clk),.rst_n(rst_n),.signal_in(signal_in),.rising(rising),.falling(falling));
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
  tick();check(!rising && !falling,"steady low");signal_in=1;tick();check(rising && !falling,"rise");
 tick();check(!rising && !falling,"single pulse");signal_in=0;tick();check(!rising && falling,"fall");
 tick();check(!rising && !falling,"steady low again");
  $display("PASS: edge_detector");$finish;
 end
 initial begin #10000;$fatal(1,"Simulation timeout");end
endmodule
