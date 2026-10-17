// 并行装载移位寄存器
`timescale 1ns/1ps
module top(input logic clk,rst_n,load,shift_en,serial_in,input logic [7:0] parallel_in,output logic [7:0] q);
 always_ff @(posedge clk) begin
  if(!rst_n)q<=0;
  else if(load)q<=parallel_in;
  else if(shift_en)q<={serial_in,q[7:1]};
 end
endmodule
