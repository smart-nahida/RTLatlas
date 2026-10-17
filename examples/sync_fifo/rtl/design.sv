// 四深度同步 FIFO
`timescale 1ns/1ps
module top(input logic clk,rst_n,wr_en,rd_en,input logic [7:0] din,output logic [7:0] dout,output logic full,empty,output logic [2:0] count);
 logic [7:0] mem[0:3];logic [1:0] wp,rp;wire push=wr_en && !full;wire pop=rd_en && !empty;
 assign full=(count==4);assign empty=(count==0);
 always_ff @(posedge clk) begin
  if(!rst_n)begin wp<=0;rp<=0;count<=0;dout<=0;end
  else begin
   if(push)begin mem[wp]<=din;wp<=wp+1'b1;end
   if(pop)begin dout<=mem[rp];rp<=rp+1'b1;end
   case({push,pop}) 2'b10:count<=count+1'b1;2'b01:count<=count-1'b1;default:;endcase
  end
 end
endmodule
