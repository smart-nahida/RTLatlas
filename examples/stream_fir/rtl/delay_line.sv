`timescale 1ns/1ps
module delay_line(input logic clk,rst_n,advance,input logic signed [15:0] sample,output logic signed [15:0] h0,h1);
 always_ff @(posedge clk)if(!rst_n)begin h0<=0;h1<=0;end else if(advance)begin h0<=sample;h1<=h0;end
endmodule
