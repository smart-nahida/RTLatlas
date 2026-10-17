`timescale 1ns/1ps
module cpu_alu(input logic [15:0] a,b,input logic move,output logic [15:0] result);
 assign result=move?b:a+b;
endmodule
