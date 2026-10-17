// 单级握手缓冲
`timescale 1ns/1ps
module top(input logic clk,rst_n,in_valid,out_ready,input logic [7:0] in_data,output logic in_ready,out_valid,output logic [7:0] out_data);
 assign in_ready=!out_valid || out_ready;
 always_ff @(posedge clk)begin
  if(!rst_n)begin out_valid<=0;out_data<=0;end
  else if(in_ready)begin out_valid<=in_valid;if(in_valid)out_data<=in_data;end
 end
endmodule
