`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 logic wr_en=0,rd_en=0;logic [7:0] din=0;wire [7:0] dout;wire full,empty;wire [2:0] count;
 top dut(.clk(clk),.rst_n(rst_n),.wr_en(wr_en),.rd_en(rd_en),.din(din),.dout(dout),.full(full),.empty(empty),.count(count));
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
  check(empty && count==0,"empty reset");wr_en=1;
 din=10;tick();din=20;tick();din=30;tick();din=40;tick();check(full && count==4,"full");
 din=99;tick();check(full && count==4,"overflow blocked");wr_en=0;rd_en=1;
 tick();check(dout==10 && count==3,"first in first out");
 wr_en=1;din=50;tick();check(dout==20 && count==3,"simultaneous push pop");wr_en=0;
 tick();check(dout==30,"third value");tick();check(dout==40,"fourth value");tick();check(dout==50 && empty,"wrap pointers");
 tick();check(dout==50 && count==0,"underflow blocked");
  $display("PASS: sync_fifo");$finish;
 end
 initial begin #10000;$fatal(1,"Simulation timeout");end
endmodule
