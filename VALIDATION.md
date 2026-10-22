# Validation — 22 October 2026

## Structured QA/agent findings — 23 October 2026

Implemented additive version-1 findings exports, stable unique IDs, expected/actual values with effective tolerances, selector/node mappings, occurrence counts, review placeholders and four cropped comparison images. Existing issues/checks and bounded sessions are preserved. The existing MCP image tool accepts an optional findingId; no new tool or external service is required.

`npm test`: **25 passed, 0 failed** after review fixes. Browser tests verify the generated HTML and image loading, JSON persistence, passing reports with no findings, and the original session stop behavior. MCP tests retrieve a real crop and reject unknown IDs while retaining legacy full-reference access. Findings tests cover stable IDs, negative bounds/clipped crops, missing elements, style tolerance/font semantics and duplicate logical failures.

The saved Horizon capture 4/5 was exported separately to `.cursor-benchmark/horizon/evidence/qa-findings-demo/`: **five findings, 20 cropped images**, all loaded in Chromium. Its source report and stopped session were not changed. This is a historical evidence export, not another capture or a pass of the current application. Review metadata is not persisted across runs; semantic causes and severity are not inferred.

One intermediate suite run failed during Windows temporary-directory removal with ENOTEMPTY. Inspection found no remaining files, and the unmodified full rerun passed; no product fix or root-cause claim was made for that unreproduced cleanup failure.

## Visible desktop continuation — 23 October 2026

After the earlier CLI stage below, the open Cursor desktop chat used Grok 4.6 and Composer 2.5 Fast. Its previously disabled project MCP connection was enabled, and Composer called the real verifier through captures 2–5 in the original session. Best global mismatch was 1.8804%; regional checks failed on every capture. The session is stopped at iteration-limit. Final independent build, interaction and 88 fixed-input-hash checks passed. See CURSOR-BENCHMARK.md for exact history.

## Earlier complex Cursor CLI stage — 23 October 2026

Used the installed logged-in Cursor Agent CLI (Auto) to implement Horizon UI's 1920×1732 Main Dashboard from the real duplicated Figma frame (683 descendant nodes, 86 original assets, 21 mapped regions). Cursor wrote the source and semantic table/checkbox fixes. Its account quota then stopped the run before visual verification. Project-only MCP/tool permissions were tested successfully after initial non-interactive rejections; no unrestricted mode was used.

Codex independently verified the resulting source: build passed; table/checkbox/search checks passed; 94 images loaded locally with no errors; all 88 fixed-input hashes stayed unchanged. One MCP visual capture **failed at 2.2588% mismatch with six pixel gates failing**, despite all mapped geometry/styles passing. Text wrapping, bar geometry and image-overlay errors are visible. Codex made no application repairs. Calendar/toolbar controls remain static.

This earlier stage established real Cursor source generation and a useful failing complex-design baseline, **not** successful autonomous repair. The desktop continuation above subsequently used the remaining capture budget; that original session is now stopped. See [CURSOR-BENCHMARK.md](CURSOR-BENCHMARK.md) and `.cursor-benchmark/horizon/CURSOR-RESULT.md` for the complete history.

## Current local checkout: 0.1.2

Validated at `D:\Projects\figma-toolkit` on native Windows x64, Windows build 10.0.26200, Node 24.15.0, npm 12.0.2, Playwright 1.58.2, Playwright-managed Chromium 145.0.7632.6, Sharp 0.35.5. Node executable: `C:\nvm4w\nodejs\node.exe`.

The extracted source was 0.1.0, despite the historical handoff describing 0.1.1. Restored setup/doctor, native project path handling, Mac guide and the unexecuted CI matrix. Advanced to 0.1.2 after adding a real Figma fixture and updating Sharp. This directory is not a Git repository; no branch, commit or executed GitHub Actions run exists.

| Check | Result |
| --- | --- |
| `npm ci --fetch-retries=0` | Initial clean installation passed with native access |
| `npm run setup` | Downloaded pinned Windows Chromium/headless shell and supporting tools |
| `npm run doctor` | Launched Chromium, captured and decoded a 320×200 RGBA PNG |
| `npm test` | 19 passed, 0 failed, 0 skipped, after Sharp update |
| `npm run demo` | Broken fixture: eight issues, 7.3405% mismatch; known correction: 0%, pass |
| Generated MCP command | All seven tools discovered; real stdio handshake/project reads/errors passed |
| MCP images | Reference/actual/diff/overlay retrieved and decoded as 960×640 PNGs |
| Offline HTML report | Opened in Chromium: four images, one comparison slider, zero page errors; preview visually inspected |
| Spaces and Unicode | Installer/MCP ran in `Fidelity sample 测试`; automated stdio test also uses Unicode/spaces |
| Paths | Home expansion tested; foreign Windows path rejection added for non-Windows execution |
| `npm audit --omit=dev` | Zero vulnerabilities after Sharp update |

The sandbox's first install attempt failed with registry DNS restrictions. Sandboxed tests rejected temporary-file renames. Native-access installation/tests passed; atomic writes were preserved. Browser tests initially failed because Chromium was not installed, then passed after setup. npm 12 blocked Sharp's optional install hook; the platform's prebuilt native package loaded and passed doctor/image/browser tests.

## Live Figma-to-app repair

The user had no application or Figma frame and authorized creating test inputs. Created [Figma Fidelity — Integration Test](https://www.figma.com/design/G3dChC00CQ0r2OFPUTbtQd/Figma-Fidelity-Integration-Test?node-id=2-2), containing 26 editable nodes and one 960×640 desktop frame. Exported its actual PNG through connected Figma tools. Inspected the export and browser before/after images visually.

Created `.sample-project/Fidelity sample 测试`, served at `http://127.0.0.1:4177` via `npm run sample`. The app uses local Inter 400/700 from `@fontsource/inter` 5.3.0, with no runtime external fonts/images. Installed the actual Cursor skill/rule/config and launched MCP using the generated command/arguments.

One session, `b60deefb-bd5b-43cc-b8f8-69344d998d26`, with a five-capture budget:

| Capture | Result | Global mismatch | Issues |
| --- | --- | --- | --- |
| 1 | Needs repair | 6.32568359375% | 23 |
| 2 | Passed | 0.841796875% | 0 |

Four agent-applied CSS corrections: header height 86→64px, horizontal main padding 64→48px, heading font size 36→32px, grid gap 28→20px. Six regions have fixed 3% regional budgets, 1px geometry tolerance and a 2% global budget. Reference/config remained pinned. This is an exported Figma reference, not a browser reference regenerated to match the app. All four image outputs and report readback were exercised over MCP. A further MCP verification after pass was correctly rejected without a new capture.

Evidence in `.sample-project/Fidelity sample 测试/evidence/`: `iteration-1.json`, `iteration-2.json`, before/after source checkpoints `iteration-1.css`/`iteration-2.css`, all four PNGs for each iteration, and the original `session.json`.

Reports:

- Before: `.sample-project/Fidelity sample 测试/.figma-fidelity/runs/desktop/2026-10-22T17-59-34-755Z-ec6fe5b5/report.html`
- After: `.sample-project/Fidelity sample 测试/.figma-fidelity/runs/desktop/2026-10-22T18-00-01-912Z-bfd1b45a/report.html`

Reusable source, reference, design measurements and instructions: `examples/figma-sample/`. Shipped source CSS retains the initial errors; the generated app retains the corrected CSS. Startup preserves existing source/config/reference. `sample:check -- report` retrieves evidence without another capture. No automatic CSS repair is embedded in the helper; the agent inspected and edited CSS between captures.

## Dependency update

Initial audit flagged Sharp 0.34.5's bundled native libraries. Updated Sharp to pinned 0.35.5 after checking its [official release notes](https://sharp.pixelplumbing.com/changelog/v0.35.5/). Existing image/mask/browser tests passed before and after; synthetic demo results remained unchanged. Live-Figma repair captures preceded this update; afterward its images/report were retrieved and decoded again, and all native browser tests reran. The original repair captures did not use 0.35.5.

Pre-update package and lockfile backups are in the native temporary directory as `figma-toolkit-pre-sharp-package.json` and `figma-toolkit-pre-sharp-package-lock.json`. Restoring both and running `npm ci` rolls back the dependency but reintroduces the vulnerability. No config/session format changed.

## Still unverified

- Native macOS, Apple Silicon and Intel; follow START-HERE-MAC.md on actual hardware.
- Node 22 and other CI matrix environments; workflow creation does not establish successful CI.
- Cursor UI discovery/image display/model repair. A real MCP SDK client ran from Codex; no Cursor session was controlled.
- Live REST sync with `FIGMA_ACCESS_TOKEN`; mocked tests pass, while actual export used official connected Figma tools.
- Production app integration, responsive/state frames, accessibility/functionality and the five-screen benchmark.

The pass certifies configured checks only. Visible font rasterization differences remain. The dashboard is read-only fixture data with no product interaction flow.

## Historical hosted 0.1.0 evidence

The following records describe the earlier hosted environment, not the current Windows checkout. Current results above supersede its outstanding Windows claims.

17 tests passed; none skipped.

Environment: Linux, Node 24.19.0, Playwright 1.58.2, Chromium 133.0.6943.0 through an explicit executable override. Standard Playwright browser downloads were unavailable in this hosted environment. An npm-distributed Chromium binary was used solely for local verification and is not shipped with the toolkit. Windows and the Playwright-managed browser must still be checked on the user's machine.

Verified:

- Complete browser capture → DOM measurement → pixel/region comparison → self-contained HTML/JSON report flow.
- Known CSS regression: 7.7962% pixel mismatch, eight failed checks; restoring the fixture CSS: 0% mismatch and passing checks.
- Session stop on pass, iteration cap, two non-improving captures, and changed config/reference rejection.
- Missing/ambiguous selectors and missing required web fonts fail even when pixels match.
- Real MCP stdio client/server handshake, seven tool registrations, project reads and tool errors.
- Image-size rejection; mask denominator handling including fractional masks; regional bounds rejection.
- Figma API success, credential isolation, missing token and rate limit behavior using mocked responses.
- Installer merges existing MCP config and refuses to overwrite the generated setup.
- HTML report opened in Chromium and visually inspected.

Not verified:

- A live authenticated Figma file. No Figma link or credential was supplied for this task.
- Cursor's model following the skill and autonomously repairing a real app.
- Windows installation, user's app architecture or project-specific fonts/assets.
- Accessibility or functional correctness of a generated application; those remain separate checks.

The demo deliberately restores a known fixture; it does not invoke an AI and is not presented as an autonomous design implementation benchmark.

## Property-first QA review — 23 October 2026

The HTML report now has searchable/selectable findings, a property comparison table, side-by-side images, optional advanced pixel maps, current-tab review fields, reviewed-JSON export, and copyable developer/agent handoffs with a manual clipboard fallback. Captures include margin/padding/gap and configured styles. Figma snapshots can supply conservative solid color, radius and auto-layout padding/axis-gap expectations; margins are never inferred from positions. Equivalent opaque hex/RGB colors match. Exact values and status rows are included in findings.properties.

Native suite: 29/29 passed, including actual Chromium review/export/copy/mobile tests and conservative Figma spacing/color cases. Separate review found and fixed axis-gap false positives and omitted font/image resources in handoffs, with red-to-green regression tests. Recurrent Windows temporary-directory cleanup timing was addressed only in test teardown using bounded fs.rm retries.

The isolated property demonstration intentionally changes text color #182238 to #C43224, font size32px to36px, top margin12px to24px and left padding0px to16px. It is a deterministic local fixture, not a real Figma benchmark. See .cursor-benchmark/horizon/evidence/property-findings-demo/report.html. Both this and the historical Horizon report were inspected on desktop/mobile with no page errors or mobile overflow. The original stopped Horizon session was not advanced or reset.


## Compact JSON option — 23 October 2026

Added CLI --format json and MCP format=json on fidelity_verify/fidelity_report. JSON-only verification skips HTML and region crops while retaining full report/findings/full-page images on disk. Compact result.json and minified responses contain only failed differences, coverage, session/stop state and artifact references. Full HTML remains default and includes a Simple JSON download. No extra capture is needed to project an existing saved report. Existing checks, signatures, exit codes and session limits are unchanged.

Suite33/33 passed, including real CLI and MCP JSON requests sharing the same two-capture session, then refusing further verification; HTML/crop omission; full raw evidence retention; compact legacy reads; and browser download link. Focused review found no material issues. Saved Horizon example: full pretty JSON response81,407bytes vs compact2,412bytes (5findings); property fixture60,168bytes vs2,477bytes (7findings). These are serialized byte sizes, not measured model token counts. The original Horizon session was unchanged when exporting these examples.


## Lightweight HTML default — 23 October 2026

Default format is now simple: a static report.html with every detected finding, plain-language/expected/actual/location text and the matching compact JSON for each. Screenshot evidence is linked, not embedded; no client scripts or regional crops are generated. CLI/MCP default replies are minified compact JSON. Explicit format html retains the interactive QA workspace/full data; format json skips HTML. Measurements, stop rules, exit codes and raw evidence remain unchanged.

34/34 tests passed, including each HTML finding JSON matching result.json, no embedded images/scripts, mobile overflow, explicit full QA, JSON-only mode, and default MCP compact responses. Focused review found no material bugs. Saved Horizon derived example: simple HTML8,961bytes vs full workspace3,604,923bytes; compact response2,520bytes. Property demo: simple HTML10,759bytes vs full workspace809,157bytes. These are byte sizes, not token counts. Existing full example workspace saved as review.html; original session unchanged.


## Shared color conversion � 23 October 2026

Implemented common extended sRGB `color(srgb r g b / a)` conversion before comparing Figma expectations and browser computed styles, and before emitting HTML/compact JSON. Values use six decimal places, preserve alpha and converted wide-gamut channels without clipping. CSS-bounded RGB/HSL/HWB input functions follow browser bounds; explicit extended color() channels remain intact. Equivalent HEX/RGB/HSL/named colors match; Display-P3 converts through Culori 4.0.2. Detailed data preserves original expressions. Missing/unresolved inputs are unavailable, never passed through string equality. Figma fill conversion avoids intermediate 8-bit rounding.

Validation: 37 tests passed, including native Playwright captures, persisted JSON/HTML agreement, equivalent formats, alpha differences, extended gamut and CSS bounds. Updated the controlled property demo and derived Horizon report; original Horizon session remained at iteration-limit 5/5.

## Shared color conversion - 23 October 2026

Implemented common extended sRGB color(srgb r g b / a) conversion before comparison and HTML/JSON output. Six decimal precision preserves alpha and converted wide-gamut channels without clipping; original values remain in detailed raw fields. RGB/HSL/HWB functions follow CSS bounds. Culori 4.0.2 supports conversions including Display-P3. Unresolved or missing inputs are unavailable, never passed by string equality. Figma fill conversion avoids intermediate 8-bit rounding.

Validation: 37 tests passed, including native Playwright captures, persisted JSON/HTML agreement, equivalent formats, alpha differences, extended gamut and CSS bounds. Refreshed controlled property demo and derived Horizon report. Original Horizon repair session remains stopped at 5/5.

## Lean interactive QA workspace - 23 October 2026

Removed full-page comparison, Run details & original checks, raw report JSON and repeated per-finding raw JSON from interactive HTML. Kept property differences, regional evidence, QA decisions/notes, JSON downloads and developer/agent handoffs. Images now reference adjacent evidence files instead of embedding base64; keep the evidence folder with HTML when sharing. Coverage and session-stop guidance remain visible. Refreshed both demos without new captures or changes to the stopped Horizon repair session. Property review HTML is 133,909 bytes. All 37 tests pass, including image loading, review exports, copying and mobile layout.

## Node 24 and publication security baseline - 23 October 2026

Updated supported engine to >=24.22.1 <25, engine-strict installation, .nvmrc 24 and CI latest Node 24 on Windows/macOS/Linux. Official Node release metadata reported 24.22.1 (security release, 20 October); local portable runtime verified against official SHA-256. Updated Playwright to 1.64.1 / Chromium 156.0.8078.4. All 37 tests and doctor passed on Windows x64 with Node 24.22.1. npm audit reports zero known vulnerabilities. Focused source review found no actionable security issues within the trusted local-project threat model; this does not guarantee absence of bugs. Added SECURITY.md, weekly Dependabot and CodeQL, pinned GitHub Actions and read-only default CI permissions. Historical benchmark measurements retain their original runtime/browser versions.
