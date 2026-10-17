`timescale 1ns/1ps
module dma_controller(input logic clk,rst_n,start,write_ready,input logic [3:0] source_base,dest_base,length,input logic [7:0] read_data,output logic read_en,write_valid,busy,done,output logic [3:0] read_addr,write_addr,transferred,output logic [7:0] write_data);
 typedef enum logic [1:0]{IDLE,READ,WAIT_DATA,WRITE} state_t;state_t state;
 logic [3:0] src,dst,total,offset;logic [7:0] held;
 assign busy=state!=IDLE;assign read_en=state==READ;assign write_valid=state==WRITE;
 assign read_addr=src+offset;assign write_addr=dst+offset;assign write_data=held;
 always_ff @(posedge clk)begin
  if(!rst_n)begin state<=IDLE;done<=0;transferred<=0;src<=0;dst<=0;total<=0;offset<=0;held<=0;end
  else begin done<=0;
   case(state)
    IDLE:if(start)begin transferred<=0;offset<=0;src<=source_base;dst<=dest_base;total<=length;if(length==0)done<=1;else state<=READ;end
    READ:state<=WAIT_DATA;
    WAIT_DATA:begin held<=read_data;state<=WRITE;end
    WRITE:if(write_ready)begin transferred<=transferred+1'b1;if(offset==total-1'b1)begin state<=IDLE;done<=1;end else begin offset<=offset+1'b1;state<=READ;end end
    default:state<=IDLE;
   endcase
  end
 end
endmodule
