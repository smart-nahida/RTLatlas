# UART 收发与背压缓冲

4 个实例：TX、RX、接收缓冲与顶层。UART 8N1，LSB first，每位 8 个系统时钟；发送端与接收端通过内部串行线回环。

教学场景：A5 位序、3C 连续帧、接收背压保持、第三帧导致粘滞 overrun。接收器在起始位中点确认，在数据位中点采样；坏停止位产生 frame_error。

限制：本例使用同一个系统时钟的内部回环，没有异步引脚同步器、奇偶校验、外部时钟误差容限或过采样投票，不是可直接部署的串口 IP。

## 打开与逐拍观察

在 RTL Atlas 中打开本目录。工程配置只包含 RTL，不包含 TB；通过子模块层级对照数据通路与状态机。TB 使用 10 ns 系统时钟，前两拍同步复位，激励在下降沿后改变；每项检查失败会 `$fatal`，成功打印 `PASS: uart_loopback`。

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
