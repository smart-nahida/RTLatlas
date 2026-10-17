`timescale 1ns/1ps
module uart_rx(input logic clk,rst_n,rx,output logic [7:0] data,output logic valid,frame_error);
 typedef enum logic [1:0]{IDLE,START,DATA,STOP} state_t;state_t state;logic [2:0] timer,bit_index;logic [7:0] shift;
 always_ff @(posedge clk)begin
  if(!rst_n)begin state<=IDLE;timer<=0;bit_index<=0;shift<=0;data<=0;valid<=0;frame_error<=0;end
  else begin
   valid<=0;frame_error<=0;
   case(state)
    IDLE:if(!rx)begin state<=START;timer<=3;end
    START:if(timer!=0)timer<=timer-1'b1;else if(!rx)begin state<=DATA;timer<=7;bit_index<=0;end else state<=IDLE;
    DATA:if(timer!=0)timer<=timer-1'b1;else begin shift[bit_index]<=rx;timer<=7;if(bit_index==7)state<=STOP;else bit_index<=bit_index+1'b1;end
    STOP:if(timer!=0)timer<=timer-1'b1;else begin state<=IDLE;if(rx)begin data<=shift;valid<=1;end else frame_error<=1;end
    default:state<=IDLE;
   endcase
  end
 end
endmodule
