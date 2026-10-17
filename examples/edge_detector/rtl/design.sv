// 同步信号边沿检测
`timescale 1ns/1ps
module top(input logic clk,rst_n,signal_in,output logic rising,falling);
 logic previous;
 always_ff @(posedge clk) begin
  if(!rst_n)begin previous<=0;rising<=0;falling<=0;end
  else begin previous<=signal_in;rising<=signal_in & ~previous;falling<=~signal_in & previous;end
 end
endmodule
