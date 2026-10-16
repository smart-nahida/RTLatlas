# Validation — v0.2

- `npm test`: 16 Node tests and 12 Python tests pass, including parser/process tests, final-only agent messages, immediate startup cancellation, conversation reuse/reset, scoped MCP overrides, terminal errors, auth diagnostics, Mac executable discovery, and updater preservation/backups.
- `npm run test:ui`: production build and headless Chromium interaction checks pass. Covers bilingual persistence, reduced default chrome, source/ports/parameters, display menu, independent clock switch, tracing, drilldown, search, sidebar collapse, optional assistant and valid signed-in account state. No simulated model answers ship in the app.
- Standalone HTML preview is generated from the same production assets; tested via file://.
- Independent review found no new Important or Critical issues in the transport/runtime/UI changes.
- Live Codex CLI 0.163.0: handshake, account/read and model/list succeed. thread/start still times out in this environment; server logs contain a login token verification 401. This remains a live-service limitation, not a verified successful model answer. New settings allow re-login and session checking; errors do not silently hang or drop final text.
- Native macOS v0.2 runtime, native dialogs, signed distribution and real Mac login still require Mac verification. Source-only updater preserves dependencies and makes per-file backups before replacing source.
- Parser code and conservative dependency semantics are unchanged in this UI revision. Control-only blocks are hidden in module Structure mode and available in Internal logic mode; source and instance data remain intact.
