`timescale 1ns/1ps
module top(input logic clk,rst_n,in_valid,out_ready,input logic signed [15:0] in_data,output logic in_ready,out_valid,output logic signed [17:0] out_data);
 wire signed [15:0] h0,h1;wire signed [17:0] sum;wire advance=in_valid && in_ready;
 delay_line u_history(.clk,.rst_n,.advance,.sample(in_data),.h0,.h1);
 fir_dot u_mac(.sample(in_data),.h0,.h1,.sum);
 output_stage u_output(.clk,.rst_n,.in_valid,.out_ready,.sum,.in_ready,.out_valid,.out_data);
endmodule
