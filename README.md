# RTL Atlas · RTL 阅读与波形工作台 v0.3.0

A local bilingual SystemVerilog explorer with API-assisted teaching simulation.
面向阅读陌生 RTL 的本地桌面软件，中英文切换；RTL 源码只读，AI 可创建和修改独立仿真场景。

## 当前交付 / Delivery status

v0.3.0 contains real elaboration, a focused three-pane reader, configurable API assistance, and dialogue-driven waveform simulation.
- 已实现：真实 RTL 展开、实例层级、模块 / 逻辑块依赖图、源码定位、端口和实际参数、同层信号追踪、搜索、中英文切换。
- 内置工程由同一个 pyslang 解析器生成：30 个展开实例，包含 generate、FIFO、乘法器与累加器。
- 离线 HTML 预览不随源码目录保留；如有需要可运行 `npm run preview:export` 重新生成。本地工程导入使用桌面版。
- 0.3.0 已在 Apple Silicon / macOS 26.5 本机构建 DMG/ZIP，验证镜像校验和、应用签名及打包后的 API→TB→真实仿真→波形链路。Intel 和其他 macOS 版本没有本机实测。

## 在 Mac 上启动 / Run on Mac

开发运行需要 Node.js 22.12+（或 24）和 Python 3.12。下载解压后打开 Terminal：

```bash
cd /path/to/rtl-atlas
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
npm ci
npm run desktop
```

也可以运行根目录 `Start-Mac.command`。它自动创建虚拟环境、安装依赖、构建界面并启动 Electron；第一次安装需要联网。不自动安装 Node/Python 或修改你的 RTL。

For development, `npm run dev` starts the browser interface. For the production desktop app, use `npm run desktop`. `npm run desktop:dev` connects Electron to the existing development server on 127.0.0.1:5173.

## 打包 Mac 软件 / Build a Mac application

在 Mac 上运行：

```bash
bash scripts/build-mac.command
```

或在已激活的 Python 虚拟环境中：

```bash
npm run dist:mac
```

该命令会把 pyslang 和 Python 打包为本地解析器，再生成 `release/` 下的 `.dmg` 和 `.zip`。安装后的应用不需要用户安装 Python 或 Node。RTL 解析在本机执行；可选 AI 助手通过用户配置的 API 提问。

默认按当前机器架构构建。Apple Silicon 和 Intel 必须分别在相应架构的 Mac 上构建，不能把 ARM 解析器放进 x64 应用。提供 `.github/workflows/mac.yml` 分别使用 ARM64 和 Intel Mac runner。可手动构建；推送与 package.json 版本一致的 v* 标签会构建双架构 DMG/ZIP，校验后生成 GitHub Release 草稿。确认草稿后发布即可供下载；已发布的同版本资产不会被工作流自动覆盖。源码已公开到 [smart-nahida/RTLatlas](https://github.com/smart-nahida/RTLatlas)，目前未发布安装包或触发云端构建。

The build uses ad-hoc signing, not an Apple Developer ID or notarization. Public distribution requires your own signing/notarization setup. macOS runtime, native dialogs and Gatekeeper behavior still require testing on actual Macs. Requires macOS 13 Ventura or later (Electron 44); ARM64 and x64 builds are separate.

## 导入 RTL / Import a project

点击“打开工程”，选择包含 `.v` / `.sv` 的文件夹。默认扫描源码并让编译器发现顶层；跳过 `.git`、node_modules、build、dist、release 和虚拟环境。

复杂工程请在所选目录放置 `atlas.project.json`：

```json
{
  "name": "my_design",
  "top": "top",
  "files": ["rtl/pkg.sv", "rtl/core.sv", "rtl/top.sv"],
  "includeDirs": ["rtl/include"],
  "defines": ["SYNTHESIS", "WIDTH=32"]
}
```

`files` 保留顺序；路径相对工程目录，也支持绝对路径。头文件通过 include 引用，不需要重复列入 files。配置不是 shell 脚本。当前不直接读取厂商工程文件、Tcl 构建脚本或 `.f` filelist。编译失败时展示原始诊断，并保留之前的有效工程。修复源码 / 配置后点“重新解析”。

Large projects: v0.1 limits source inputs to 3,000 files / 60 MiB, elaborated instances to 12,000, parser execution to 90 seconds. A graph scope above 250 nodes is not rendered; navigate into a smaller module.

## 怎么读 / Reading workflow

- 左侧单击实例定位其模块卡片和定义，双击或点 ↗ 进入内部；模块栏可以收起。
- 中央单击节点看源码，双击实例进入。滚轮缩放、按住左键拖动画布、适应画布。
- 点击信号连线查看驱动、接收端、位宽和源码位置。
- “内部逻辑”进入已选子模块；对当前层级展示过程块与连续赋值，包括时序边界。它不是门级综合原理图。
- “追踪来源 / 去向”只遍历同一层级，遇时序过程块停止。实例内部的时序边界需要进入实例查看；不会假装已经跨层推导周期级路径。
- 图形工具栏的“显示选项”按钮包含控制、时钟 / 复位、顶层端口开关。控制分类使用信号名启发式，不构成协议识别。
- 拖动右侧分隔条调整源码宽度，或点击右上角展开。端口和参数标签显示所选实例的展开后数值。
- ⌘K 搜索，Esc 关闭弹窗。语言切换保留当前位置并在本机记住偏好；源码标识符和编译器诊断保持原样。

## 精度边界 / Accuracy boundaries

slang 负责语法、类型、名字解析、参数求值和 elaboration；图形提取层仍是 v0.1：

- 连接是保守的信号依赖，位选 / part select 共享基信号，可能产生看起来较宽的扇入 / 扇出。
- `always_*` 按整个过程块展示，保留条件依赖，不对每个 mux 或寄存器综合化简。
- 时序标记用于阅读，不是形式验证、CDC 检查或精确时序分析。
- Interface / modport 端口保留，但暂不推断连接；支持 VCD 波形阅读；暂不支持门级综合或 FSM 自动提取。
- 不完整、无法展开的 RTL 会给出编译诊断；不使用 AI 猜出连接。

## Tests and architecture

```bash
npm test                 # Node process tests + real pyslang tests
npm run test:ui          # TypeScript production build + headless browser interaction checks
npm run parser:bundle    # Standalone native parser for the current host
npm run preview:export   # Export one self-contained offline HTML preview
```

For UI checks, first install a matching browser with `npx playwright install chromium --only-shell`.

- `backend/parse_rtl.py`: read-only compiler front end and neutral graph extraction.
- `electron/project.cjs`: bounded parser subprocess bridge.
- `electron/main.cjs`, `preload.cjs`: isolated Electron window and narrow IPC API.
- `src/components`: graph, hierarchy and source viewer.
- `src/i18n.ts`: Chinese / English UI strings.
- `examples/`: [10 个基础工程、6 个进阶工程与原有加速器示例](examples/README.md)，包含工程配置、自检 TB、仿真配置与运行说明。

UI build uses local fonts and assets; no CDN dependency. React Flow, React, Electron, pyslang/slang and other dependencies retain their respective licenses. Noto Sans SC is distributed under SIL Open Font License; its license is included by the font package. The application code is MIT licensed.

Reference documentation: [slang](https://sv-lang.com/user-manual.html), [Electron 44 platform support](https://www.electronjs.org/blog/electron-44-0), [macOS runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).


## 从 v0.1 更新

解压 `RTL-Atlas-v0.2-Update.zip`，先关闭旧软件，再运行外层的 `Apply-Update-Mac.command`。默认更新 `~/Desktop/rtl-atlas`，会备份被替换的源码，保留 `node_modules`、`.venv`、用户工程配置，完成后启动新版。可把工程目录作为第一个参数传入。原文件位于工程内的 `update-backups/时间戳/`。

v0.2 UI changes: remove default history, path cards, repetitive hints and summary cards; clearly separated sidebar / graph / source panes; display options moved to a menu; full-height source with ports and parameters tabs; unchanged font families.


## AI 阅读助手 / Configurable API assistant

点右上角四角星 → API 设置，选择 DeepSeek、OpenAI 或自定义兼容服务，填写 API 地址、模型 ID 和 API Key，保存后发送问题。

- 支持 OpenAI 兼容的 Chat Completions 接口；可以填写 base URL 或完整 `/chat/completions` 地址。非兼容协议需要适配，当前不直接支持 Anthropic 原生 Messages API。
- DeepSeek 预设为 `https://api.deepseek.com`、`deepseek-flash`；OpenAI 预设为 `https://api.openai.com/v1`，模型由用户填写。兼容网关和本地服务也可自定义。HTTP 仅允许本机回环地址，远程服务使用 HTTPS。
- API Key 由 Electron safeStorage 使用系统密钥存储加密，保存到应用用户数据目录的 `api-settings.json`，不会回传明文密钥；系统加密不可用时不保存明文密钥。留空仅保留同一地址已保存的密钥；切换地址不会携带旧密钥。
- 支持流式与非流式回答、连续追问、停止、清空对话及源码引用跳转。AI 回答按 Markdown 显示标题、加粗、列表、引用、表格与代码块；源码引用（含行内代码和 Markdown 链接）可点击定位。代码块保持原文，原始 HTML 不执行，远程图片不自动加载。保存配置和切换工程会重置上下文。保存配置不发模型请求；实际提问使用 API 服务商额度，独立于 ChatGPT 订阅。
- 用户发送时才将所选实例、参数、相关连接和源码片段发往配置的服务。主进程通过 Electron 网络层发送请求，界面不直接访问 API。支持标准 function/tool calls 的模型可使用受限工程工具读取文件、写入场景、运行本地仿真和打开波形；不提供任意 shell 工具。
- 本版不需要 Codex CLI，也不使用 Codex 登录或额度。

验证：本地兼容 HTTP 服务覆盖 SSE 分包、UTF-8、JSON 回答、鉴权失败、取消、会话隔离和异常恢复；真实 Electron 测试覆盖配置保存、系统加密、流式问答、追问及源码引用。外部服务的密钥、模型可用性与额度需要在配置后实际提问验证。

API 连接验证：官方 DeepSeek/OpenAI 地址必须填写 API Key。保存配置仅显示未验证状态；“保存并测试连接”发送固定短文本验证服务，不发送工程源码。密钥创建时无需选择模型，模型 ID 在请求时指定。401 会明确提示鉴权失败并显示脱敏后的服务端详情。

图形走线：同层级通道按信号错开，回路线使用外侧通道，交叉位置留空隙以区别于连接。


## 波形与对话式仿真 / Waveform and dialogue-driven simulation

界面沿用原有模块树、结构图、源码和 AI 对话。波形仅在打开时出现在结构图下方，没有固定的“生成 TB”按钮或教学生成侧栏。

在 API 对话中直接要求，例如：

> 给当前累加器写 TB，覆盖复位、连续累加、暂停和恢复。使用方便逐拍计算的整数，运行仿真并打开波形。

配置的服务需要兼容 Chat Completions 的 `tools` / `tool_calls`。AI 会读取 RTL 与端口、检测本地仿真器、创建 `.rtl-atlas/sim/<场景>/testbench.sv` 和 `run.json`，读取编译/运行诊断并尝试修复。对话中的操作项可展开查看结果，生成的文本文件可从操作项跳转到源码区。也可在后续对话中要求修改 TB 或激励再运行。教学场景不等于完整验证覆盖。

- 仿真器支持 Icarus Verilog (`iverilog` + `vvp`) 和 Verilator (`verilator` + 本地 C++ 工具链)。它们是独立工具；DMG 不内置仿真器。本机安装可用 `brew install icarus-verilog verilator`。仅导入 VCD 无需仿真器。
- 场景文件、构建产物和 VCD 均位于当前工程 `.rtl-atlas/sim/<场景>/`。安装版内置演示工程会复制到应用用户数据目录，使场景可写并在重启后保留。
- 波形顶部边界可上下拖动；向下拉至底部会完全收起，结构图回收空间。在对话中说“重新打开刚才的波形”，AI 调用工具恢复面板及上次高度。
- 波形支持时钟与边沿选择、沿前/沿后取值、逐拍跳转、十进制/十六进制/二进制、信号筛选、滚轮缩放、左键横向拖动和适应范围。信号名称可定位关联 DUT 定义；显式 DUT 映射后结构图显示记录值。
- 导入已有 VCD：结构图“显示选项”中选择“打开波形…”。选择的文件复制到当前工程的 imported 场景。AI 可以用 `open_waveform` 的 dutPath/instanceId 设置准确层级映射；不会凭模糊同名信号猜测连接。
- 数值来自实际 VCD，保留 X/Z、别名和 timescale；沿前取值是严格早于该时间戳的记录，沿后是该时间戳的最终记录，无法从普通 VCD 恢复未记录的 delta-cycle 过程。波形游标和所选信号供 AI 读取，无自动 API 请求。
- 文件工具拒绝越界、符号链接和凭据文件，写入仅限场景目录。仿真采用固定参数、无 shell 的进程调用；预处理展开后的 HDL 也检查 shell system task / DPI 和 include 路径。运行可停止，有超时与日志上限。这是受控的本地 HDL 执行，不是通用操作系统沙箱。
- 单个场景文本文件上限 256 KiB，VCD 上限 32 MiB / 4096 信号 / 100 万次变化，界面最多同时选 64 个信号。超限给出错误，避免默默丢弃实际数据。

场景配置例子：

```json
{
  "engine": "iverilog",
  "top": "accumulator_tb",
  "sources": ["rtl/design.sv", ".rtl-atlas/sim/lesson/testbench.sv"],
  "includeDirs": ["rtl"],
  "defines": [],
  "waveform": "waves.vcd",
  "timeoutSeconds": 30,
  "dutPath": "accumulator_tb.dut",
  "instanceId": "top.u_accumulator"
}
```

`top` 是测试平台模块名；sources/includeDirs 相对当前工程，运行工作目录为场景目录。TB 中应使用 `$dumpfile("waves.vcd")`、`$dumpvars`、明确时钟/复位及有界 `$finish`。让激励避开采样沿，防止竞态。

验证命令：`npm test`、`npm run test:desktop`、`npm run test:waveform`。波形桌面测试使用临时工程和本地 API 服务，实际调用 Icarus，不消耗个人 API 额度；单元测试也实际验证 Verilator 输出。


## GitHub 分发

公开仓库：[smart-nahida/RTLatlas](https://github.com/smart-nahida/RTLatlas)。项目根目录即仓库根目录（package.json 与 .github/ 在同一级）。未来发布先更新 package.json/package-lock.json 版本，提交后推送同名标签，例如 v0.3.1；GitHub Actions 自动构建 ARM64/Intel 安装包并创建 Release 草稿。手动 workflow_dispatch 仅生成 Actions 构建产物，不发布 Release。

自动构建不等于应用内自动更新。目前应用未接入更新器，也没有 Apple Developer ID / 公证；未来要自动下载安装，需配置 GitHub 更新源、正式签名/公证和 electron-updater。API 设置与工程生成目录被排除在源码仓库之外。

应用启动时显示简洁欢迎页，提供“打开工程”和“打开示例”入口，不自动加载工程。工程选择框记住上次选择的目录，重启后仍保留；目录被删除时退回最近存在的父目录。波形选择框单独记忆上次目录，第一次从当前工程目录开始。目录偏好只存于应用用户数据目录。

启动页与目录记忆回归：`npm run test:startup`。测试验证手动打开、取消、工程选择框位置、跨应用重启保留和波形目录回退。
