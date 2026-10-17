`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 logic in_valid=0,in_last=0,out0_ready=0,out1_ready=0;logic [7:0] in_data=0;wire in_ready,out0_valid,out1_valid,out0_last,out1_last;wire [7:0] out0_data,out1_data;
 top dut(.clk,.rst_n,.in_valid,.in_last,.out0_ready,.out1_ready,.in_data,.in_ready,.out0_valid,.out1_valid,.out0_last,.out1_last,.out0_data,.out1_data);
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
  
 in_valid=1;in_data=8'h10;in_last=0;tick();check(out0_valid && out0_data==8'h10 && !out0_last,"header routes to port zero");
 in_data=8'h23;in_last=1;tick(); // odd payload still belongs to port zero.
 in_data=8'h11;in_last=0;tick();check(out1_valid && out1_data==8'h11,"other port independent");
 in_data=8'h44;in_last=1;tick();
 in_data=8'h30;in_last=1;repeat(2)begin tick();check(!in_ready && out0_data==8'h10,"port zero backpressure");end
 out1_ready=1;tick();check(out1_valid && out1_data==8'h44 && out1_last,"route held across packet");tick();check(!out1_valid && !in_ready,"drain port one while zero blocked");
 out0_ready=1;tick();check(out0_data==8'h23 && out0_last && in_ready,"first port pop frees space");
 tick();in_valid=0;check(out0_valid && out0_data==8'h30 && out0_last,"pending single-flit packet");
 tick();check(!out0_valid && !out1_valid,"all queues drained");

  $display("PASS: packet_router");$finish;
 end
 initial begin #30000;$fatal(1,"Simulation timeout");end
endmodule
