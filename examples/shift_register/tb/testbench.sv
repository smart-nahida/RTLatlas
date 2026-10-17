`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 logic load=0,shift_en=0,serial_in=0;logic [7:0] parallel_in=0;wire [7:0] q;
 top dut(.clk(clk),.rst_n(rst_n),.load(load),.shift_en(shift_en),.serial_in(serial_in),.parallel_in(parallel_in),.q(q));
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
  load=1;parallel_in=8'hA5;tick();check(q===8'hA5,"parallel load");
 load=0;shift_en=1;serial_in=1;tick();check(q===8'hD2,"shift in one");
 serial_in=0;tick();check(q===8'h69,"shift in zero");shift_en=0;tick();check(q===8'h69,"hold");
 load=1;shift_en=1;parallel_in=8'h3C;tick();check(q===8'h3C,"load priority");
  $display("PASS: shift_register");$finish;
 end
 initial begin #10000;$fatal(1,"Simulation timeout");end
endmodule
