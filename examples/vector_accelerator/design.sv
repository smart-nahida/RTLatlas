// RTL Atlas example: source-linked, elaborated RTL, not a hand-drawn graph.
module sync_fifo #(parameter W=32, DEPTH=16)(
  input logic clk, rst_n,
  input logic [W-1:0] din,
  input logic wr_en, rd_en,
  output logic [W-1:0] dout,
  output logic empty, full
);
  localparam AW = $clog2(DEPTH);
  logic [W-1:0] mem [DEPTH];
  logic [AW-1:0] wr_ptr, rd_ptr;
  logic [AW:0] count;
  assign empty = (count == 0);
  assign full = (count == DEPTH);
  assign dout = mem[rd_ptr];
  always_ff @(posedge clk) begin
    if (!rst_n) begin
      wr_ptr <= '0;
      rd_ptr <= '0;
      count <= '0;
    end else begin
      if (wr_en && !full) begin
        mem[wr_ptr] <= din;
        wr_ptr <= wr_ptr + 1'b1;
      end
      if (rd_en && !empty) rd_ptr <= rd_ptr + 1'b1;
      case ({wr_en && !full, rd_en && !empty})
        2'b10: count <= count + 1'b1;
        2'b01: count <= count - 1'b1;
        default: ;
      endcase
    end
  end
endmodule

module controller(input logic input_empty, output_full, output logic en);
  assign en = !input_empty && !output_full;
endmodule

module weight_buffer(input logic [3:0] addr, output logic [15:0] weight);
  // Small combinational lookup table.
  always_comb begin
    case(addr)
      4'd0: weight = 16'd3;
      4'd1: weight = 16'd5;
      4'd2: weight = 16'd7;
      default: weight = 16'd1;
    endcase
  end
endmodule

module mac_array(input logic [15:0] data, weight, output logic [31:0] product);
  assign product = data * weight;
endmodule

module accumulator #(parameter W=32)(
  input logic clk, rst_n, en,
  input logic [W-1:0] product,
  output logic [W-1:0] result
);
  logic [W-1:0] acc_reg;
  always_ff @(posedge clk) begin
    if (!rst_n)
      acc_reg <= '0;
    else if (en)
      acc_reg <= acc_reg + product;
  end
  assign result = acc_reg;
endmodule

module core(input logic clk, rst_n, in_valid, out_ready,
  input logic [15:0] in_data,
  output logic in_ready, out_valid,
  output logic [31:0] out_data);
  logic [15:0] data, weight;
  logic [31:0] product, result;
  logic input_empty, input_full, output_empty, output_full, en, result_valid;
  assign in_ready = !input_full;
  assign out_valid = !output_empty;
  controller u_controller(.input_empty(input_empty), .output_full(output_full), .en(en));
  sync_fifo #(.W(16), .DEPTH(16)) u_input_fifo(
    .clk(clk), .rst_n(rst_n), .din(in_data), .wr_en(in_valid), .rd_en(en),
    .dout(data), .empty(input_empty), .full(input_full));
  weight_buffer u_weight_buffer(.addr(data[3:0]), .weight(weight));
  mac_array u_mac_array(.data(data), .weight(weight), .product(product));
  accumulator #(.W(32)) u_accumulator(
    .clk(clk), .rst_n(rst_n), .en(en), .product(product), .result(result));
  always_ff @(posedge clk) begin
    if (!rst_n) result_valid <= 1'b0;
    else result_valid <= en;
  end
  sync_fifo #(.W(32), .DEPTH(16)) u_output_fifo(
    .clk(clk), .rst_n(rst_n), .din(result), .wr_en(result_valid), .rd_en(out_ready),
    .dout(out_data), .empty(output_empty), .full(output_full));
endmodule

module accelerator(input logic clk, rst_n, in_valid, out_ready,
  input logic [15:0] in_data,
  output logic [3:0] in_ready, out_valid,
  output wire [127:0] out_data);
  for(genvar k=0; k<4; k++) begin: g_core
    core u_core(.clk(clk), .rst_n(rst_n), .in_valid(in_valid), .out_ready(out_ready),
      .in_data(in_data), .in_ready(in_ready[k]), .out_valid(out_valid[k]), .out_data(out_data[k*32+:32]));
  end
endmodule

module top(input logic clk, rst_n, in_valid, out_ready,
  input logic [15:0] in_data,
  output wire [3:0] in_ready, out_valid,
  output wire [127:0] out_data);
  accelerator u_accelerator(.*);
endmodule
