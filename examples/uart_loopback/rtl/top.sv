`timescale 1ns/1ps
module top(input logic clk,rst_n,tx_valid,rx_ready,input logic [7:0] tx_data,output logic tx_ready,rx_valid,serial_tx,overrun,frame_error,output logic [7:0] rx_data);
 wire [7:0] received;wire received_valid;
 uart_tx u_tx(.clk,.rst_n,.valid(tx_valid),.data(tx_data),.ready(tx_ready),.tx(serial_tx));
 uart_rx u_rx(.clk,.rst_n,.rx(serial_tx),.data(received),.valid(received_valid),.frame_error);
 byte_buffer u_buffer(.clk,.rst_n,.in_valid(received_valid),.in_data(received),.ready(rx_ready),.valid(rx_valid),.data(rx_data),.overrun);
endmodule
