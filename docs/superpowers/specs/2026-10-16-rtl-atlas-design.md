# RTL Atlas desktop design

User-approved direction: a light three-pane UI for understanding unfamiliar RTL; no top-left icon; macOS desktop packaging; on-demand Codex; Chinese/English switching. User explicitly requested starting implementation, so deliver a reviewable working build without another approval loop.

## Reading workflow
A hierarchy tree navigates elaborated instances. A central graph shows immediate child instances, top-level ports and procedural/continuous logic blocks. Clicking selects source; double clicking enters a child instance. Breadcrumbs return to parents. Upstream/downstream tracing follows resolved signals and stops at sequential blocks. Code remains read-only. Signal names are never translated.

## Boundaries
Use pyslang 11 to compile/elaborate real SystemVerilog, including macro/include/top configuration through atlas.project.json. Preserve instance-specific parameters, widths and source ranges. Treat graph connectivity as conservative dependencies, not a bit-accurate equivalence proof. Procedural logic is shown as source-linked blocks; detailed gate synthesis and waveform playback are outside v0.1. Report compiler errors and preserve the last valid project. Config is data, not executable code.

## Desktop and assistant
Electron with isolated context, sandboxed renderer, allowlisted preload IPC and no arbitrary shell or file APIs. Package the Python parser as a PyInstaller sidecar for a standalone Mac app. Codex App Server is optional and installed/authenticated separately. Explicit connect and per-question submission; no automatic cloud calls on selection. Read-only sandbox, no approvals granted. Answers use selected instance plus source and nearby connectivity; source references navigate loaded files. Both local UI and errors have bilingual labels; compiler diagnostics remain original.

## Delivery
Provide source, lockfile, runnable local commands and macOS build script/CI for Apple Silicon and Intel. Linux cannot verify macOS runtime, signing or notarization; never claim a tested Mac installer without one. Include a real synthesizable example and generated demo JSON from the same parser. Tests cover elaboration, connectivity, failures, protocol lifecycle and UI interactions.
