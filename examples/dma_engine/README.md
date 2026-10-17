# 多周期 DMA 搬运

控制器、源存储器、目标存储器共 4 个实例。源 RAM 初始化为 mem[i]=3i+1；控制器按 READ→WAIT_DATA→WRITE 处理同步读延迟，并在写背压时保持地址、数据和计数。

搬运 src[2…5] 到 dst[5…8]，预期 7、10、13、16。插入 3 拍写停顿，再检查 done 单拍脉冲、实际写入次数、目标外地址未被覆盖，以及零长度传输。

教学接口不是 AXI/AHB。最多搬运 15 字节，地址按 4 位回绕；无总线错误、缓存一致性或重叠内存处理。两块 RAM 独立，复位初始化用于教学。

## 打开与逐拍观察

在 RTL Atlas 中打开本目录。工程配置只包含 RTL，不包含 TB；通过子模块层级对照数据通路与状态机。TB 使用 10 ns 系统时钟，前两拍同步复位，激励在下降沿后改变；每项检查失败会 `$fatal`，成功打印 `PASS: dma_engine`。

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
