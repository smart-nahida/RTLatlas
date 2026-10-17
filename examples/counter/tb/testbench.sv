`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 logic en=0; wire [3:0] count;
 top dut(.clk(clk),.rst_n(rst_n),.en(en),.count(count));
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
  check(count===0,"reset"); en=1; tick(); check(count===1,"increment");
 tick(); check(count===2,"second increment"); en=0; tick();check(count===2,"hold");
 en=1;repeat(14) tick();check(count===0,"wrap at 16");
 rst_n=0;tick();check(count===0,"reset again");
  $display("PASS: counter");$finish;
 end
 initial begin #10000;$fatal(1,"Simulation timeout");end
endmodule
