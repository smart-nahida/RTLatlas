`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 wire halted;wire [7:0] pc,retired,branches;wire [15:0] accumulator,counter,result;integer n;
 top dut(.clk,.rst_n,.halted,.pc,.retired,.branches,.accumulator,.counter,.result);
 always #5 clk=~clk;
 task automatic tick;
  @(posedge clk);#1;@(negedge clk);#1;
 endtask
 task automatic check(input bit ok,input string message);
  if(!ok)$fatal(1,"FAIL: %s",message);
 endtask
 initial begin
  $dumpfile("waves.vcd");$dumpvars(0,tb);
  tick();tick();rst_n=1;
  
 n=0;while(!halted && n<100)begin tick();n=n+1;end
 check(halted,"program halts");check(accumulator==10 && counter==0 && result==10,"sum 4+3+2+1 stored");
 check(branches==3 && retired==16 && pc==6,"branch and retire counts");
 repeat(3)tick();check(retired==16 && result==10,"HALT freezes architectural state");
 rst_n=0;tick();check(!halted && accumulator==0 && result==0,"reset clears state");rst_n=1;
 n=0;while(!halted && n<100)begin tick();n=n+1;end check(halted && result==10,"program restart");

  $display("PASS: tiny_cpu");$finish;
 end
 initial begin #30000;$fatal(1,"Simulation timeout");end
endmodule
