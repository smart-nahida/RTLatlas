`timescale 1ns/1ps
module spi_master(input logic clk,rst_n,start,miso,input logic [15:0] command,output logic busy,done,sclk,cs_n,mosi,output logic [15:0] response);
 logic [15:0] frame;logic [4:0] bit_index;logic divider;
 always_ff @(posedge clk)begin
  if(!rst_n)begin busy<=0;done<=0;sclk<=0;cs_n<=1;mosi<=0;response<=0;frame<=0;bit_index<=15;divider<=0;end
  else begin done<=0;
   if(!busy)begin if(start)begin busy<=1;cs_n<=0;sclk<=0;frame<=command;mosi<=command[15];response<=0;bit_index<=15;divider<=0;end end
   else if(!divider)divider<=1;
   else begin divider<=0;
    if(!sclk)begin sclk<=1;response<={response[14:0],miso};end
    else begin sclk<=0;if(bit_index==0)begin busy<=0;done<=1;cs_n<=1;end else begin bit_index<=bit_index-1'b1;mosi<=frame[bit_index-1'b1];end end
   end
  end
 end
endmodule
