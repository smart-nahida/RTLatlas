`timescale 1ns/1ps
module byte_buffer(input logic clk,rst_n,in_valid,ready,input logic [7:0] in_data,output logic valid,overrun,output logic [7:0] data);
 always_ff @(posedge clk)begin
  if(!rst_n)begin valid<=0;data<=0;overrun<=0;end
  else begin
   if(ready)valid<=0;
   if(in_valid)begin if(!valid || ready)begin valid<=1;data<=in_data;end else overrun<=1;end
  end
 end
endmodule
