`timescale 1ns/1ps
module register_file(input logic clk,rst_n,write_en,input logic [1:0] ra,rb,write_reg,input logic [15:0] write_data,output logic [15:0] read_a,read_b,accumulator,counter);
 logic [15:0] regs[0:3];integer i;assign read_a=regs[ra];assign read_b=regs[rb];assign accumulator=regs[0];assign counter=regs[1];
 always_ff @(posedge clk)if(!rst_n)begin for(i=0;i<4;i=i+1)regs[i]<=0;end else if(write_en)regs[write_reg]<=write_data;
endmodule
