// 时钟分频
`timescale 1ns/1ps
module top(input logic clk, rst_n, output logic divided_clk, output logic tick_pulse);
 logic [1:0] count;
 always_ff @(posedge clk) begin
  if (!rst_n) begin count<=0; divided_clk<=0; tick_pulse<=0; end
  else begin
   tick_pulse<=0;
   if(count==2) begin count<=0;divided_clk<=~divided_clk;tick_pulse<=1;end
   else count<=count+1'b1;
  end
 end
endmodule
