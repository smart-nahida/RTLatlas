# API assistant and waveform design

Approved by the user through the original-layout image and explicit “开始实现吧”. Implement directly in the existing non-Git workspace; no new UI approval loop.

Keep existing hierarchy, graph, source-above-chat layout. Add an optional waveform panel underneath the graph. Drag its top separator downward to zero to hide it; retain previous expanded height. API tool open_waveform opens or restores it. No fixed TB generation button, teaching generator sidebar, redundant welcome/privacy captions or success notices.

The configured OpenAI-compatible API model receives named function tools and executes a bounded multi-round tool loop. It can list/read RTL, write editable scene files under .rtl-atlas/sim/<scene>/, run configured Icarus or Verilator jobs, inspect actual waveform samples, and open a waveform. Text alone never executes. No arbitrary shell tool. File operations remain in the opened real project, reject traversal/symlinks and exclude credentials. Existing RTL is not overwritten. Tools are cancelled with the chat request; errors return to the model to allow repairs and remain visible in chat.

run.json contains engine (iverilog or verilator), top, project-relative sources, optional includeDirs/defines, waveform relative to scene, and optional dutPath mapping. A local simulator compiles and runs in the scene directory, with limits on time/logs/trace size. Block shell system tasks and foreign code imports in simulator inputs; this is a controlled local simulator invocation, not a general OS sandbox.

Parse VCD scopes, aliases, widths, timescale, X/Z and value changes; preserve per-signal samples and report limits. Render selected signals, current values, a cursor and edge-based stepping. Allow clock/edge/radix selection, signal addition/removal, scroll zoom, horizontal drag pan, import VCD, previous/next transition, project-scoped view persistence, and context samples for AI explanations. Map recorded hierarchy via an explicit DUT path to project instances without guessing ambiguous suffixes. Show unavailable signals as absent, never fabricate values.

Generated TB should use simple representative input values, explicit reset/clock and bounded termination, reference intended lessons in comments, and derive output only from running simulation. Teach reset, ordinary operation, stall/resume and boundaries when relevant. AI reads sources before generating TB and checks simulator diagnostics; no claims of complete verification.
