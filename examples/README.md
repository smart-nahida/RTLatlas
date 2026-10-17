# RTL 教学示例

10 个独立小工程由浅入深。每个包含 RTL、独立工程配置、自检 TB、仿真配置和使用说明。打开具体子目录，不要把整个 examples 作为一个工程打开。

| 示例 | 目录 | 重点 |
| --- | --- | --- |
| [使能计数器](./counter/) | `counter` | 4 位计数器。观察使能暂停和 15→0 回绕。复位为同步低有效。 |
| [时钟分频](./clock_divider/) | `clock_divider` | 每 3 个输入周期翻转输出，完整周期为 6 拍。tick_pulse 是更适合下游同步逻辑使用的单拍使能。 |
| [并行装载移位寄存器](./shift_register/) | `shift_register` | 8 位右移寄存器；串行输入进入最高位，并行装载优先于移位。 |
| [PWM 占空比](./pwm/) | `pwm` | 周期为 8 拍，duty=0…8 对应 0%…100%。教学输入依次为 3/8、0 和 100%；运行中改变 duty 会立即影响比较输出。 |
| [同步信号边沿检测](./edge_detector/) | `edge_detector` | 对已同步到 clk 的输入产生单拍上升/下降脉冲。本例不是异步输入同步器，不用于消除亚稳态。 |
| [四深度同步 FIFO](./sync_fifo/) | `sync_fifo` | 8 位数据、深度 4，读数据在成功读出的时钟沿更新。满时拒绝写、空时拒绝读；满/空边界无旁路，同拍读写仅在各自条件满足时接受。 |
| [两级流水乘加](./pipeline_mac/) | `pipeline_mac` | 第一拍保存乘积和加数，下一拍输出 a×b+c。通过 valid 展示连续流水、空拍和负数；结果按 32 位截断，不含饱和逻辑。 |
| [单级握手缓冲](./ready_valid_buffer/) | `ready_valid_buffer` | ready/valid 单级缓冲。背压时保持数据；消费旧数据的同一拍可接受新数据。没有组合数据旁路。 |
| [交通灯状态机](./traffic_light/) | `traffic_light` | 红灯 2 拍、绿灯 3 拍、黄灯 1 拍的 Moore 状态机。观察状态、计时器和输出的一一对应；仅用于教学。 |
| [同步单端口 RAM](./simple_ram/) | `simple_ram` | 8×8 同步单端口 RAM。同址读写采用 read-first：该拍输出旧值，下次读到新值。复位只清 dout，不清存储器，未写地址可为 X。 |

原有的 [vector_accelerator](./vector_accelerator/) 保留，用于多层次模块与连线探索；新增 10 个示例共计 11 个工程。

所有 TB 使用 10 ns 时钟，逐项自检并产生真实 VCD，不需要 API 即可在终端运行。API 助手可根据对话创建或修改 `.rtl-atlas/sim/<场景>/` 中的教学激励与仿真配置，执行真实仿真后逐拍讲解。

从仓库根目录运行 `source .venv/bin/activate && python -m unittest discover -s tests -p test_examples.py`，检查工程解析、自检仿真和 VCD 读取。
