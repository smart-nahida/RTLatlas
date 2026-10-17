`timescale 1ns/1ps
module top(input logic clk,rst_n,start,stall,input logic [3:0] source_base,dest_base,length,probe_addr,output logic busy,done,write_valid,output logic [3:0] transferred,output logic [7:0] probe_data);
 wire read_en;wire [3:0] read_addr,write_addr;wire [7:0] read_data,write_data,unused;
 dma_controller u_controller(.clk,.rst_n,.start,.source_base,.dest_base,.length,.write_ready(!stall),.read_en,.read_addr,.read_data,.write_valid,.write_addr,.write_data,.busy,.done,.transferred);
 teaching_memory #(.INITIAL_SOURCE(1)) u_source(.clk,.rst_n,.read_en,.read_addr,.read_data,.write_en(1'b0),.write_addr(4'b0),.write_data(8'b0),.probe_addr(4'b0),.probe_data(unused));
 teaching_memory #(.INITIAL_SOURCE(0)) u_destination(.clk,.rst_n,.read_en(1'b0),.read_addr(4'b0),.read_data(),.write_en(write_valid && !stall),.write_addr,.write_data,.probe_addr,.probe_data);
endmodule
