`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 wire red,green,yellow;
 top dut(.clk(clk),.rst_n(rst_n),.red(red),.green(green),.yellow(yellow));
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
  check({red,green,yellow}===3'b100,"reset red");tick();check(red,"red first cycle");
 tick();check(green && !red && !yellow,"green begins");tick();check(green,"green second");tick();check(green,"green third");
 tick();check(yellow && !green && !red,"yellow begins");tick();check(red && !green && !yellow,"red repeats");
 rst_n=0;tick();check(red && !green && !yellow,"reset returns red");
  $display("PASS: traffic_light");$finish;
 end
 initial begin #10000;$fatal(1,"Simulation timeout");end
endmodule
