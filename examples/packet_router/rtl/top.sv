`timescale 1ns/1ps
module top(input logic clk,rst_n,in_valid,in_last,out0_ready,out1_ready,input logic [7:0] in_data,output logic in_ready,out0_valid,out1_valid,out0_last,out1_last,output logic [7:0] out0_data,out1_data);
 wire route,ready0,ready1;wire accept=in_valid && in_ready;
 assign in_ready=route?ready1:ready0;
 packet_classifier u_route(.clk,.rst_n,.accept,.last(in_last),.header(in_data),.route);
 packet_fifo u_port0(.clk,.rst_n,.in_valid(in_valid && !route),.in_ready(ready0),.in_word({in_last,in_data}),.out_ready(out0_ready),.out_valid(out0_valid),.out_word({out0_last,out0_data}));
 packet_fifo u_port1(.clk,.rst_n,.in_valid(in_valid && route),.in_ready(ready1),.in_word({in_last,in_data}),.out_ready(out1_ready),.out_valid(out1_valid),.out_word({out1_last,out1_data}));
endmodule
