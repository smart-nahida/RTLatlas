// 同步单端口 RAM
`timescale 1ns/1ps
module top(input logic clk,rst_n,we,input logic [2:0] addr,input logic [7:0] din,output logic [7:0] dout);
 logic [7:0] mem[0:7];
 always_ff @(posedge clk)begin
  if(!rst_n)dout<=0;
  else begin if(we)mem[addr]<=din;dout<=mem[addr];end
 end
endmodule
