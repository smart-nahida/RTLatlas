`timescale 1ns/1ps
module top(input logic clk,rst_n,output logic halted,output logic [7:0] pc,retired,branches,output logic [15:0] accumulator,counter,result);
 wire [15:0] instruction,ir,read_a,read_b,alu_a,alu_b,alu_result;wire [1:0] ra,rb,write_reg;wire reg_write,mem_write,move;wire [3:0] mem_addr;
 program_rom u_rom(.pc,.instruction);
 cpu_control u_control(.clk,.rst_n,.instruction,.read_a,.read_b,.alu_result,.pc,.ir,.ra,.rb,.reg_write,.write_reg,.mem_write,.mem_addr,.alu_a,.alu_b,.move,.halted,.retired,.branches);
 register_file u_registers(.clk,.rst_n,.ra,.rb,.write_en(reg_write),.write_reg,.write_data(alu_result),.read_a,.read_b,.accumulator,.counter);
 cpu_alu u_alu(.a(alu_a),.b(alu_b),.move,.result(alu_result));
 data_memory u_memory(.clk,.rst_n,.write_en(mem_write),.addr(mem_addr),.data(read_a),.result);
endmodule
