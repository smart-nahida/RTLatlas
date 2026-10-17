`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 logic tx_valid=0,rx_ready=0;logic [7:0] tx_data=0;wire tx_ready,rx_valid,serial_tx,overrun,frame_error;wire [7:0] rx_data;integer n;
 top dut(.clk,.rst_n,.tx_valid,.rx_ready,.tx_data,.tx_ready,.rx_valid,.serial_tx,.overrun,.frame_error,.rx_data);
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

 tx_data=8'hA5;tx_valid=1;check(tx_ready,"TX ready");tick();tx_valid=0;
 n=0;while(!rx_valid && n<120)begin tick();n=n+1;end
 check(rx_valid && rx_data==8'hA5,"8N1 loopback A5");
 repeat(5)begin tick();check(rx_valid && rx_data==8'hA5,"receiver holds under backpressure");end
 rx_ready=1;tick();check(!rx_valid,"consume buffered byte");rx_ready=0;
 while(!tx_ready)tick();tx_data=8'h3C;tx_valid=1;tick();tx_valid=0;
 n=0;while(!rx_valid && n<120)begin tick();n=n+1;end
 check(rx_valid && rx_data==8'h3C,"second frame 3C");check(!overrun && !frame_error,"clean frames");
 // Keep the second byte blocked while a third frame arrives: sticky overrun.
 while(!tx_ready)tick();tx_data=0;tx_valid=1;tick();tx_valid=0;repeat(90)tick();
 check(overrun && rx_data==8'h3C,"overflow preserves unread byte");

  $display("PASS: uart_loopback");$finish;
 end
 initial begin #30000;$fatal(1,"Simulation timeout");end
endmodule
