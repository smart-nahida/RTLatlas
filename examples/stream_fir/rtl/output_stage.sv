`timescale 1ns/1ps
module output_stage(input logic clk,rst_n,in_valid,out_ready,input logic signed [17:0] sum,output logic in_ready,out_valid,output logic signed [17:0] out_data);
 assign in_ready=!out_valid || out_ready;
 always_ff @(posedge clk)if(!rst_n)begin out_valid<=0;out_data<=0;end else if(in_ready)begin out_valid<=in_valid;if(in_valid)out_data<=sum;end
endmodule
