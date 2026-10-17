`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 logic start=0;logic [15:0] command=0;wire busy,done,sclk,cs_n,mosi,miso;wire [15:0] response;integer n;
 top dut(.clk,.rst_n,.start,.command,.busy,.done,.response,.sclk,.cs_n,.mosi,.miso);
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
  
 command=16'h8300 | 16'h00A5;start=1;tick();start=0;n=0;while(!done && n<100)begin tick();n=n+1;end check(done && !busy && cs_n,"write completes");
 tick();command=16'h0300;start=1;tick();start=0;n=0;while(!done && n<100)begin tick();n=n+1;end check(done && response[7:0]==8'hA5,"read address 3");
 tick();command=16'h843C;start=1;tick();start=0;n=0;while(!done && n<100)begin tick();n=n+1;end check(done,"second write");
 tick();command=16'h0400;start=1;tick();start=0;n=0;while(!done && n<100)begin tick();n=n+1;end check(done && response[7:0]==8'h3C,"read address 4");
 tick();command=16'h0300;start=1;tick();start=0;n=0;while(!done && n<100)begin tick();n=n+1;end check(done && response[7:0]==8'hA5,"register isolation");

  $display("PASS: spi_registers");$finish;
 end
 initial begin #30000;$fatal(1,"Simulation timeout");end
endmodule
