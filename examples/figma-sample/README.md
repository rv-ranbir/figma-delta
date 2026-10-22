# Real Figma fixture

[Editable Figma frame](https://www.figma.com/design/G3dChC00CQ0r2OFPUTbtQd/Figma-Fidelity-Integration-Test?node-id=2-2)

Created on 22 October 2026. `reference.png` is the 960×640 PNG exported by the connected Figma tools, not a browser capture. The Figma design has 26 editable nodes. `design.json` records measured frame-relative bounds. Inter 400/700 font files come from the pinned development dependency `@fontsource/inter` 5.3.0; its license remains in that package. There are no external image or font requests at runtime.

Run `npm run sample` in the toolkit. It creates a separate app under `.sample-project/Fidelity sample 测试`, installs the Cursor skill, rule and MCP entry, and serves it at `http://127.0.0.1:4177`. Existing files/config/reference are preserved. Only the generated app is served; the toolkit directory and evidence are not exposed by the sample server.

In another terminal, run `npm run sample:check -- begin`. A fresh sample intentionally fails. This uses the generated MCP command, discovers all seven tools, starts one bounded session, verifies, retrieves reference/actual/diff/overlay images, decodes them, and saves source/evidence under the sample's `evidence/` directory. Exit 1 means visual failure; exit 0 means configured checks pass.

Inspect the report, then edit **the generated app's** `styles.css`:

| Rule | Broken value | Figma value |
| --- | --- | --- |
| `header` height | 86px | 64px |
| `main` horizontal padding | 64px | 48px |
| `h1` font size | 36px | 32px |
| `.cards` gap | 28px | 20px |

Run `npm run sample:check -- verify`. This reuses the original session ID. `npm run sample:check -- report` retrieves the latest images/report without another capture. Passed sessions reject further verification; no session is silently reset. To run another experiment, preserve earlier evidence and explicitly start a new session.

Windows result: 23 failures and 6.3257% mismatch before repair; no failures and 0.8418% mismatch after four CSS corrections, iteration 2/5. Fixed budgets: 2% globally, 3% per region, 1px geometry tolerance. Six regions include the header, heading, cards container and each individual metric. The reference hash/config remained pinned. The residual mismatch includes visible text rasterization differences; a pass is not pixel identity.

This was an agent-driven repair through a real local MCP client. Cursor's own UI/tool discovery and model behavior have not been tested. This single desktop fixture is not a production benchmark, a responsive test or an accessibility certification.
