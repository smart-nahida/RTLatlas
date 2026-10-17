// PWM 占空比
`timescale 1ns/1ps
module top(input logic clk,rst_n,input logic [3:0] duty,output logic pwm_out,output logic [2:0] phase);
 always_ff @(posedge clk) begin if(!rst_n)phase<=0;else phase<=phase+1'b1;end
 assign pwm_out=rst_n && ({1'b0,phase}<duty);
endmodule
