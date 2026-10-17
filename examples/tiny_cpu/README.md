# 简易多周期 CPU

6 个实例：控制器、指令 ROM、寄存器堆、ALU、数据 RAM 和顶层。每条指令按 FETCH→DECODE→EXEC 执行，波形可对照 PC、IR、写回使能和条件跳转。

16 位教学 ISA：opcode[15:12]、rd[11:10]、rs[9:8]、imm[7:0]。

| opcode | 指令 | 行为 |
| --- | --- | --- |
| 1 | MOVI rd,imm | 零扩展立即数写寄存器 |
| 2 | ADDI rd,imm | 加有符号立即数 |
| 3 | ADD rd,rs | rd=rd+rs |
| 4 | STORE rd,addr | 写入数据 RAM，地址取低 4 位 |
| 5 | BNEZ rd,offset | 非零时 PC=PC+1+有符号 offset |
| F | HALT | 停止执行 |

内置程序计算 4+3+2+1=10，存入 mem[3]，执行 16 条指令（含 HALT），跳转成功 3 次。TB 验证结果、计数、停止后状态保持和复位重跑。

这是自定义教学 ISA，不兼容 RISC-V，不含流水线、异常、中断、乘除或数据加载指令。未定义 opcode 视为空操作并推进 PC；ROM 越界返回 HALT。

## 打开与逐拍观察

在 RTL Atlas 中打开本目录。工程配置只包含 RTL，不包含 TB；通过子模块层级对照数据通路与状态机。TB 使用 10 ns 系统时钟，前两拍同步复位，激励在下降沿后改变；每项检查失败会 `$fatal`，成功打印 `PASS: tiny_cpu`。

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
