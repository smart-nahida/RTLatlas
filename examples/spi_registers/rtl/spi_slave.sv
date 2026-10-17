`timescale 1ns/1ps
module spi_slave(input logic clk,rst_n,sclk,cs_n,mosi,input logic [7:0] bank_rdata,output logic miso,bank_write,output logic [3:0] bank_addr,output logic [7:0] bank_wdata);
 logic prev_sclk;logic [4:0] received;logic [7:0] shift;logic writing;
 assign miso=(!cs_n && !writing && received>=8 && received<16)?bank_rdata[15-received]:1'b0;
 always_ff @(posedge clk)begin
  if(!rst_n)begin prev_sclk<=0;received<=0;shift<=0;writing<=0;bank_write<=0;bank_addr<=0;bank_wdata<=0;end
  else begin prev_sclk<=sclk;bank_write<=0;
   if(cs_n)begin received<=0;shift<=0;writing<=0;end
   else if(sclk && !prev_sclk && received<16)begin
    shift<={shift[6:0],mosi};received<=received+1'b1;
    if(received==7)begin writing<=shift[6];bank_addr<={shift[2:0],mosi};end
    if(received==15 && writing)begin bank_write<=1;bank_wdata<={shift[6:0],mosi};end
   end
  end
 end
endmodule
