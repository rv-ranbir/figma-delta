# Complex design test with installed Cursor

## Latest: visible desktop Composer run — 23 October 2026

Cursor desktop's open Horizon chat ran **Composer 2.5 Fast**, following a short Grok 4.6 repair pass. The project-local fidelity server was disabled in desktop Customize; enabling that existing connection exposed all seven tools. Composer called the real MCP verifier four times, using the original session without resetting it.

Global mismatch across captures 1–5: **2.2588%, 2.1644%, 1.9488%, 1.8804%, 2.0549%**. Every capture failed regional pixel gates. The session stopped at `iteration-limit`; no new budget was created. Composer reverted its final traffic regression after the last capture, so the current source has no subsequent visual measurement. Best measured global mismatch is **1.8804%**, not a passing result.

Final independent build and functional checks passed after Composer finished: search and checkbox interactions, 94 local images, no browser errors, and all 88 fixed-input hashes unchanged. Evidence: `.cursor-benchmark/horizon/evidence/desktop-functional.json`. Full capture table and remaining defects: `.cursor-benchmark/horizon/CURSOR-RESULT.md`. Desktop chat: `48e9a3e9-56de-4d00-a500-9d6bf1bd0e80`.

## Earlier CLI baseline (historical)

Tested on 22–23 October 2026 using the installed, logged-in Cursor Agent CLI and [Horizon UI Main Dashboard](https://www.figma.com/design/EsqQ6gszGVTV8n9PTlb4uR?node-id=201-1804). The frame has 683 descendant nodes and is 1920×1732.

Cursor created the React implementation, including local Figma assets, semantic tables and native checkboxes. **Its account usage limit stopped the run before the visual repair loop.** Codex then independently built and measured that source, without repairing it:

- Production build passed.
- Checkbox/search checks passed; 94 images loaded locally, no page errors.
- All 21 mapped geometry checks passed.
- Visual baseline **failed** at **2.2588% mismatch**, with six pixel gates failing.
- Reference, config and all 86 original asset hashes remained unchanged.

The failed baseline caught actual defects, including title wrapping, incorrect traffic bars and an image overlay mismatch. A passing geometry check did not establish matching text flow. This test provides useful evidence but does **not** establish successful autonomous repair.

Local app: `http://127.0.0.1:4180` while the server is running.

Detailed result, exact evidence and resume instructions: `.cursor-benchmark/horizon/CURSOR-RESULT.md`.

MCP integration findings: enabling a server does not grant permission for each non-interactive tool call. Project-local `Mcp(server:tool)` entries resolved those rejections. Cursor's [permissions documentation](https://cursor.com/docs/cli/reference/permissions) describes that format. Scope such approval to the intended project/server; the benchmark does not change the toolkit installer to grant permissions automatically. Windows' trusted CA certificates were supplied to the Cursor process through a temporary bundle; TLS validation stayed enabled.

The earlier CLI chat was `d1669109-5aa4-409f-8572-7a063b7afa80`. Its original visual session has now reached capture 5/5 in the desktop run described above. Do not reset its budget.
