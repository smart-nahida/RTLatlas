`timescale 1ns/1ps
module top(input logic clk,rst_n,start,input logic [15:0] command,output logic busy,done,output logic [15:0] response,output logic sclk,cs_n,mosi,miso);
 wire bank_write;wire [3:0] bank_addr;wire [7:0] bank_wdata,bank_rdata;
 spi_master u_master(.clk,.rst_n,.start,.command,.busy,.done,.response,.sclk,.cs_n,.mosi,.miso);
 spi_slave u_slave(.clk,.rst_n,.sclk,.cs_n,.mosi,.miso,.bank_write,.bank_addr,.bank_wdata,.bank_rdata);
 register_bank u_registers(.clk,.rst_n,.write_en(bank_write),.addr(bank_addr),.wdata(bank_wdata),.rdata(bank_rdata));
endmodule
