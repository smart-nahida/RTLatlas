`timescale 1ns/1ps
module program_rom(input logic [7:0] pc,output logic [15:0] instruction);
 always_comb case(pc)
  0:instruction=16'h1000; // MOVI r0,0
  1:instruction=16'h1404; // MOVI r1,4
  2:instruction=16'h3100; // ADD r0,r1
  3:instruction=16'h24ff; // ADDI r1,-1
  4:instruction=16'h54fd; // BNEZ r1,-3
  5:instruction=16'h4003; // STORE r0,[3]
  default:instruction=16'hf000; // HALT
 endcase
endmodule
