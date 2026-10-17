`timescale 1ns/1ps
module tb;
 logic clk=0,rst_n=0;
 logic in_valid=0,out_ready=1;logic signed [15:0] in_data=0;wire in_ready,out_valid;wire signed [17:0] out_data;
 top dut(.clk,.rst_n,.in_valid,.out_ready,.in_data,.in_ready,.out_valid,.out_data);
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
  
 in_valid=1;in_data=1;tick();check(out_valid && out_data==1,"FIR sample 1");in_data=2;tick();check(out_data==4,"FIR sample 2");
 out_ready=0;in_data=3;repeat(3)begin tick();check(!in_ready && out_valid && out_data==4,"stall preserves output and history");end
 out_ready=1;tick();check(out_data==8,"resume FIR sample 3");in_data=4;tick();check(out_data==12,"FIR sample 4");
 in_valid=0;tick();check(!out_valid,"bubble does not add a sample");in_valid=1;in_data=-1;tick();check(out_data==10,"signed sample after bubble");
 in_valid=0;tick();check(!out_valid,"drained");

  $display("PASS: stream_fir");$finish;
 end
 initial begin #30000;$fatal(1,"Simulation timeout");end
endmodule
