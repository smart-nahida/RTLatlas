`timescale 1ns/1ps
module data_memory(input logic clk,rst_n,write_en,input logic [3:0] addr,input logic [15:0] data,output logic [15:0] result);
 logic [15:0] mem[0:15];integer i;assign result=mem[3];
 always_ff @(posedge clk)if(!rst_n)begin for(i=0;i<16;i=i+1)mem[i]<=0;end else if(write_en)mem[addr]<=data;
endmodule
