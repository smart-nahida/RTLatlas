`timescale 1ns/1ps
module packet_fifo(input logic clk,rst_n,in_valid,out_ready,input logic [8:0] in_word,output logic in_ready,out_valid,output logic [8:0] out_word);
 logic [8:0] mem[0:1];logic wp,rp;logic [1:0] count;wire push=in_valid && in_ready,pop=out_valid && out_ready;
 assign in_ready=count<2;assign out_valid=count!=0;assign out_word=mem[rp];
 always_ff @(posedge clk)if(!rst_n)begin wp<=0;rp<=0;count<=0;end else begin
  if(push)begin mem[wp]<=in_word;wp<=~wp;end
  if(pop)rp<=~rp;
  case({push,pop})2'b10:count<=count+1'b1;2'b01:count<=count-1'b1;default:;endcase
 end
endmodule
