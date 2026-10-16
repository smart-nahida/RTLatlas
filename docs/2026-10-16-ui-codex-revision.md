# v0.2: focused reader and reliable Codex lifecycle

User supplied a new reference UI and explicitly requested implementing it, reducing text/clutter and fixing GPT/Codex connection. Scope is the existing desktop application.

UI: retain current fonts and Chinese/English switch. Three clearly separated panes; sidebar contains only hierarchy by default. Breadcrumbs belong to graph; graph controls use compact icons and a display menu. Remove default history, path cards, repeated tips, preview label, and module summary. Source occupies full inspector height. Keep ports/parameters reachable. Codex opens only on demand. Preserve parser semantics, source mapping, and navigation.

Codex investigation: v0.1 used a universal 30s RPC timeout, did not finish cancellation while thread/start was pending, did not preserve final item/completed text, did not carry conversations across questions, and searched only shell PATH plus two system bins. Investigate actual thread startup before making environment claims. Test process cleanup, early cancel, authoritative final messages, scoped conversation reuse, and Mac executable discovery.

Acceptance: original parser tests pass; UI checks cover reduced default chrome, menus, language, selection and trace; protocol fixture explicitly covers failures above; real CLI connection/session checked without exposing auth material. Native Mac packaging remains subject to Mac verification. Ship source update preserving user's local node_modules/.venv/config when applied.
