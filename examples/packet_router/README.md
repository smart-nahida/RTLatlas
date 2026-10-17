# 双输出数据包路由

首 flit 的 bit0 选择输出口；同一包后续 flit 沿用首 flit 路由，直到 last 握手。两个输出各有深度 2 的独立 FIFO。

场景：输出 0 被阻塞时仍可向输出 1 发包；奇数 payload 仍沿用偶数首 flit 的输出口；随后验证 FIFO 回绕、last 保持、阻塞期间输入不得被重复接受。

单输入、按包路由，无仲裁或虚通道。FIFO 满时即使同拍读取也要等下一拍重新接受，因此满边界可能有一拍气泡。

## 打开与逐拍观察

在 RTL Atlas 中打开本目录。工程配置只包含 RTL，不包含 TB；通过子模块层级对照数据通路与状态机。TB 使用 10 ns 系统时钟，前两拍同步复位，激励在下降沿后改变；每项检查失败会 `$fatal`，成功打印 `PASS: packet_router`。

在 API 助手对话中输入：

> 读取 README.md、tb/testbench.sv 和 simulation.json，把仿真配置写到 .rtl-atlas/sim/teaching/run.json，运行 teaching 场景并打开波形。按上升沿逐拍解释握手、状态与数据流，说明每条断言的预期值。

所有数值来自实际仿真。要调整激励，让 AI 把 TB 复制到场景目录并修改 run.json 的 sources；写入仅限 `.rtl-atlas/sim/<场景>/`。

## 不使用 API 的运行方式

安装 Icarus Verilog 后，在本目录执行：

```sh
mkdir -p .rtl-atlas/sim/teaching
cp simulation.json .rtl-atlas/sim/teaching/run.json
iverilog -g2012 -s tb -o .rtl-atlas/sim/teaching/simulation.vvp rtl/*.sv tb/testbench.sv
(cd .rtl-atlas/sim/teaching && vvp simulation.vvp)
```

通过“显示选项 → 打开波形…”导入 `.rtl-atlas/sim/teaching/waves.vcd`；API 工具打开时按配置将 `tb.dut` 映射到 `top`，可在结构图同步显示实际信号值。
