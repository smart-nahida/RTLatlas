// 两级流水乘加
`timescale 1ns/1ps
module top(input logic clk,rst_n,valid_in,input logic signed [7:0] a,b,input logic signed [31:0] c,output logic valid_out,output logic signed [31:0] result);
 logic valid_stage;logic signed [15:0] product;logic signed [31:0] addend;
 always_ff @(posedge clk) begin
  if(!rst_n)begin valid_stage<=0;valid_out<=0;product<=0;addend<=0;result<=0;end
  else begin
   valid_stage<=valid_in;valid_out<=valid_stage;
   if(valid_in)begin product<=a*b;addend<=c;end
   if(valid_stage)result<=product+addend;
  end
 end
endmodule
