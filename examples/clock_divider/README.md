# 时钟分频

每 3 个输入周期翻转输出，完整周期为 6 拍。tick_pulse 是更适合下游同步逻辑使用的单拍使能。

在 RTL Atlas 中“打开工程”选择本目录。工程配置只解析 RTL，TB 不会出现在模块树中。

时钟周期 10 ns，前两拍同步复位；激励在下降沿后改变，避开 DUT 采样沿。TB 内逐项检查预期结果，失败会 `$fatal`，成功打印 `PASS: clock_divider`。

在 AI 对话中可说：

> 读取这个工程的 README、tb/testbench.sv 和 simulation.json。把 simulation.json 内容写入 .rtl-atlas/sim/teaching/run.json，运行 teaching 场景并打开波形。按上升沿逐拍讲解数据与控制信号。

需先配置支持工具调用的 API，并安装 Icarus Verilog。AI 可修改场景目录里的 TB；仓库提供的 RTL 和 TB 保持原样。要改激励，可让 AI 把 TB 复制到场景目录并更新 run.json 的 sources。

终端运行（从本目录执行）：

```sh
mkdir -p .rtl-atlas/sim/teaching
cp simulation.json .rtl-atlas/sim/teaching/run.json
iverilog -g2012 -s tb -o .rtl-atlas/sim/teaching/simulation.vvp rtl/design.sv tb/testbench.sv
(cd .rtl-atlas/sim/teaching && vvp simulation.vvp)
```

波形文件位于 `.rtl-atlas/sim/teaching/waves.vcd`，可通过“显示选项 → 打开波形…”导入。
