`timescale 1ns/1ps
module register_bank(input logic clk,rst_n,write_en,input logic [3:0] addr,input logic [7:0] wdata,output logic [7:0] rdata);
 logic [7:0] regs[0:15];integer i;assign rdata=regs[addr];
 always_ff @(posedge clk)if(!rst_n)begin for(i=0;i<16;i=i+1)regs[i]<=0;end else if(write_en)regs[addr]<=wdata;
endmodule
