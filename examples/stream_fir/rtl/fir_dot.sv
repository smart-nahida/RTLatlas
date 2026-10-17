`timescale 1ns/1ps
module fir_dot(input logic signed [15:0] sample,h0,h1,output logic signed [17:0] sum);
 wire signed [17:0] x={{2{sample[15]}},sample},d0={{2{h0[15]}},h0},d1={{2{h1[15]}},h1};
 assign sum=x+d0+d0+d1;
endmodule
