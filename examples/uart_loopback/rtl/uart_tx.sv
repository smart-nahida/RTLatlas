`timescale 1ns/1ps
module uart_tx(input logic clk,rst_n,valid,input logic [7:0] data,output logic ready,tx);
 logic busy;logic [9:0] frame;logic [3:0] bit_index;logic [2:0] timer;
 assign ready=!busy;
 always_ff @(posedge clk)begin
  if(!rst_n)begin busy<=0;tx<=1;frame<=10'h3ff;bit_index<=0;timer<=0;end
  else if(!busy)begin
   if(valid)begin busy<=1;frame<={1'b1,data,1'b0};tx<=0;bit_index<=0;timer<=7;end
  end else if(timer!=0)timer<=timer-1'b1;
  else begin
   timer<=7;
   if(bit_index==9)begin busy<=0;tx<=1;end
   else begin bit_index<=bit_index+1'b1;tx<=frame[bit_index+1'b1];end
  end
 end
endmodule
