`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 logic in_valid=0,out_ready=0;logic [7:0] in_data=0;wire in_ready,out_valid;wire [7:0] out_data;
 top dut(.clk(clk),.rst_n(rst_n),.in_valid(in_valid),.out_ready(out_ready),.in_data(in_data),.in_ready(in_ready),.out_valid(out_valid),.out_data(out_data));
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
  check(in_ready && !out_valid,"empty accepts");in_valid=1;in_data=10;tick();check(out_valid && out_data==10 && !in_ready,"buffer full");
 in_data=20;tick();check(out_data==10,"backpressure holds data");
 out_ready=1;tick();check(out_valid && out_data==20,"simultaneous replace");
 in_valid=0;tick();check(!out_valid && in_ready,"drain");
 in_valid=1;in_data=30;tick();check(out_valid && out_data==30,"resume");
  $display("PASS: ready_valid_buffer");$finish;
 end
 initial begin #10000;$fatal(1,"Simulation timeout");end
endmodule
