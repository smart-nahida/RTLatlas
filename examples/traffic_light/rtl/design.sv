// 交通灯状态机
`timescale 1ns/1ps
module top(input logic clk,rst_n,output logic red,green,yellow);
 typedef enum logic [1:0]{RED,GREEN,YELLOW} state_t;state_t state;logic [1:0] timer;
 assign red=(state==RED);assign green=(state==GREEN);assign yellow=(state==YELLOW);
 always_ff @(posedge clk)begin
  if(!rst_n)begin state<=RED;timer<=0;end
  else case(state)
   RED:if(timer==1)begin state<=GREEN;timer<=0;end else timer<=timer+1'b1;
   GREEN:if(timer==2)begin state<=YELLOW;timer<=0;end else timer<=timer+1'b1;
   YELLOW:begin state<=RED;timer<=0;end
   default:begin state<=RED;timer<=0;end
  endcase
 end
endmodule
