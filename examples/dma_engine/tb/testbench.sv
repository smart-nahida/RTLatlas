`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 logic start=0,stall=0;logic [3:0] source_base=2,dest_base=5,length=4,probe_addr=0;wire busy,done,write_valid;wire [3:0] transferred;wire [7:0] probe_data;integer n;
 top dut(.clk,.rst_n,.start,.stall,.source_base,.dest_base,.length,.probe_addr,.busy,.done,.write_valid,.transferred,.probe_data);
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

 start=1;tick();start=0;check(busy,"start accepted");stall=1;n=0;
 while(!write_valid && n<10)begin tick();n=n+1;end check(write_valid,"read latency reached write stage");
 repeat(3)begin tick();check(busy && transferred==0,"write stalls do not count");end
 stall=0;n=0;while(!done && n<30)begin tick();n=n+1;end check(done && !busy && transferred==4,"four transfers complete");
 probe_addr=5;#1;check(probe_data==7,"word 0");probe_addr=6;#1;check(probe_data==10,"word 1");probe_addr=7;#1;check(probe_data==13,"word 2");probe_addr=8;#1;check(probe_data==16,"word 3");
 probe_addr=9;#1;check(probe_data==0,"no out-of-range write");tick();check(!done,"done single cycle");
 length=0;start=1;tick();start=0;check(done && !busy && transferred==0,"zero length completes without writes");

  $display("PASS: dma_engine");$finish;
 end
 initial begin #30000;$fatal(1,"Simulation timeout");end
endmodule
