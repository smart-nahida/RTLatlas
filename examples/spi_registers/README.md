# SPI 主从寄存器事务

主机、从机、16×8 寄存器组组成一次真实的串行寄存器访问。Mode 0：上升沿采样、下降沿切换 MOSI，每个 SCLK 半周期为 2 个系统时钟。

16 位命令：bit15=1 写/0 读，bit14:8 为地址（本例仅支持 0…15），bit7:0 为写数据；读返回值位于 response[7:0]。场景依次写/读地址 3 和 4，验证寄存器隔离。

限制：主从共用系统时钟，SCLK 作为被采样信号处理；这不是异步外部 SPI 从机实现，也不支持其他 SPI mode、突发或非法地址报错。

## 打开与逐拍观察

在 RTL Atlas 中打开本目录。工程配置只包含 RTL，不包含 TB；通过子模块层级对照数据通路与状态机。TB 使用 10 ns 系统时钟，前两拍同步复位，激励在下降沿后改变；每项检查失败会 `$fatal`，成功打印 `PASS: spi_registers`。

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
