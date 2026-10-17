`timescale 1ns/1ps
module packet_classifier(input logic clk,rst_n,accept,last,input logic [7:0] header,output logic route);
 logic active,saved_route;assign route=active?saved_route:header[0];
 always_ff @(posedge clk)if(!rst_n)begin active<=0;saved_route<=0;end else if(accept)begin
  if(last)active<=0;else begin active<=1;if(!active)saved_route<=header[0];end
 end
endmodule
