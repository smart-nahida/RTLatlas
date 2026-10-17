`timescale 1ns/1ps
module cpu_control(input logic clk,rst_n,input logic [15:0] instruction,read_a,read_b,alu_result,output logic [7:0] pc,retired,branches,output logic [15:0] ir,alu_a,alu_b,output logic [1:0] ra,rb,write_reg,output logic reg_write,mem_write,move,halted,output logic [3:0] mem_addr);
 typedef enum logic [1:0]{FETCH,DECODE,EXEC,STOP} state_t;state_t state;wire [3:0] opcode=ir[15:12];
 assign ra=ir[11:10];assign rb=ir[9:8];assign write_reg=ir[11:10];assign mem_addr=ir[3:0];
 assign move=opcode==1;assign alu_a=read_a;assign alu_b=opcode==3?read_b:(opcode==1?{8'b0,ir[7:0]}:{{8{ir[7]}},ir[7:0]});
 assign reg_write=state==EXEC && (opcode==1 || opcode==2 || opcode==3);assign mem_write=state==EXEC && opcode==4;assign halted=state==STOP;
 always_ff @(posedge clk)begin
  if(!rst_n)begin state<=FETCH;pc<=0;ir<=0;retired<=0;branches<=0;end
  else case(state)
   FETCH:begin ir<=instruction;state<=DECODE;end
   DECODE:state<=EXEC;
   EXEC:begin retired<=retired+1'b1;
    if(opcode==15)state<=STOP;
    else begin state<=FETCH;if(opcode==5 && read_a!=0)begin pc<=pc+8'd1+ir[7:0];branches<=branches+1'b1;end else pc<=pc+1'b1;end
   end
   STOP:state<=STOP;
   default:state<=STOP;
  endcase
 end
endmodule
