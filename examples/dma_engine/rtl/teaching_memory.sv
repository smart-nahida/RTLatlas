`timescale 1ns/1ps
module teaching_memory #(parameter INITIAL_SOURCE=0)(input logic clk,rst_n,read_en,write_en,input logic [3:0] read_addr,write_addr,probe_addr,input logic [7:0] write_data,output logic [7:0] read_data,probe_data);
 logic [7:0] mem[0:15];integer i;assign probe_data=mem[probe_addr];
 always_ff @(posedge clk)if(!rst_n)begin read_data<=0;for(i=0;i<16;i=i+1)mem[i]<=INITIAL_SOURCE?8'(i*3+1):8'b0;end
 else begin if(read_en)read_data<=mem[read_addr];if(write_en)mem[write_addr]<=write_data;end
endmodule
