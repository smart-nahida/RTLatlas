`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 logic [3:0] duty=3;wire pwm_out;wire [2:0] phase;integer highs;
 top dut(.clk(clk),.rst_n(rst_n),.duty(duty),.pwm_out(pwm_out),.phase(phase));
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
  highs=0;repeat(8)begin tick();if(pwm_out)highs=highs+1;end check(highs==3,"3/8 duty");
 duty=0;repeat(8)begin tick();check(pwm_out===0,"0 percent");end
 duty=8;repeat(8)begin tick();check(pwm_out===1,"100 percent");end
  $display("PASS: pwm");$finish;
 end
 initial begin #10000;$fatal(1,"Simulation timeout");end
endmodule
