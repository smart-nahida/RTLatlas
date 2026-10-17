// 使能计数器
`timescale 1ns/1ps
module top(input logic clk, rst_n, en, output logic [3:0] count);
 always_ff @(posedge clk) begin
  if (!rst_n) count <= 0;
  else if (en) count <= count + 1'b1;
 end
endmodule
