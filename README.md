# Figma Delta

Compare a Figma design with a running web page and turn differences into findings that QA, developers and AI agents can act on. Runs locally through a CLI or MCP server; works with any frontend that renders in Chromium.

- **QA:** inspect expected versus actual values, compare the affected area, assign a review decision/severity, add notes and export reviewed findings.
- **Developers:** locate a finding by selector/Figma node and see differences such as text color, font size, padding, margin and layout gap when design expectations are mapped.
- **AI agents:** read compact JSON with stable finding IDs, expected/actual values, evidence paths and repair limits. Cursor can use these findings to edit application code and recheck within a bounded session.

The toolkit captures, measures and reports. It does not require an AI API key, run its own LLM or change application source. Cursor repair uses the user's existing model and permissions. QA can run checks from the CLI without Cursor.

### Choose the output

| Output | Use it for | Contents |
| --- | --- | --- |
| `--format simple` (default) | Fast triage and agent handoff | Small static HTML listing all findings with each finding's compact JSON; linked evidence |
| `--format html` | Interactive QA review | Searchable findings, property comparisons, affected-area images, review decisions/notes, JSON exports and developer/agent handoffs |
| `--format json` | Automation and agents | Compact differences with no HTML generation |

The interactive workspace omits the full-page comparison, original-checks/run-details section and raw JSON blocks. Images load from adjacent files; keep the report folder together when sharing. Review changes stay in the current browser tab until exported. Every mode saves compact `result.json` and detailed measurements separately. CLI/MCP defaults return compact JSON; reading `fidelity_report` does not recapture the page. Report generation uses local templates, with no LLM call.

Colors from Figma and browser styles are converted to a shared extended sRGB `color(srgb r g b / a)` format before comparison and reporting. Equivalent HEX/RGB/HSL expressions compare consistently, with transparency and converted wide-gamut channels preserved. Original values remain in detailed data.

Exact property checks need a mapping between a unique DOM selector and Figma node or explicit expected styles. A PNG supports visual comparison but cannot establish whether a spacing difference comes from margin, padding or gap. Findings represent failed configured checks; QA decides whether they are defects and assigns severity. See [findings and coverage](docs/findings-format.md).

### Get it and share it

Start with the downloadable source ZIP for a pilot. Extract it to a permanent folder, then follow the quick start below. Node.js 22+ and a local Chromium installation through setup are required. Dependencies and the browser download require internet access.

Maintainers can build a clean ZIP and SHA-256 checksum on Windows:

```powershell
npm run release:zip
```

The archive includes source, templates, locked dependencies, guides, tests and the small supplied demo. It excludes installed dependencies, local projects, benchmark captures and authentication state. Share both files from `dist/`; each recipient installs dependencies on their own machine. The checksum verifies that the archive was transferred unchanged; it does not establish publisher identity.

Source repository: [rv-ranbir/figma-delta](https://github.com/rv-ranbir/figma-delta). See the [delivery guide](docs/distribution.md) for pilot rollout and QA report handoff. The npm package remains private; no registry or marketplace listing has been published. A project license has not yet been selected.

## Work with the repository's design system

The installed workflow first reads applicable repository instructions (including nested `AGENTS.md`), relevant rules and existing skills. It inspects nearby screens, shared components, design tokens, themes, icons and styling conventions before implementing changes. Agents reuse available design-system/Figma/browser MCP capabilities rather than replacing the host's setup. The initializer merges its own MCP entry and preserves existing entries, skills and rules.

If the Figma design conflicts with a mandated repo token or component pattern, the agent reports the conflict and keeps the reference intact until the choice is resolved. It must not silently change shared tokens or replace the existing design system to improve a score. Only task-relevant skills and instructions need to be loaded.

This is agent workflow guidance, not a mechanical guarantee of instruction compliance. The measurement server verifies configured properties and pixels; the host agent coordinates other skills and MCPs. Existing installations keep their current skill/rule copies: review and copy the updated `templates/SKILL.md` and `templates/figma-fidelity.mdc` into their corresponding `.cursor` locations to adopt this guidance, preserving local customizations.

The product is **Figma Delta**. Existing `fidelity.config.json`, `.figma-fidelity/`, `/figma-fidelity`, `fidelity_*` tools and MCP server keys retain their names for compatibility. The CLI also provides a `figma-delta` alias.

## Windows quick start

Extract the archive to a permanent folder. The commands below use this example location:

```text
D:\Projects\figma-toolkit\package.json
```

Open PowerShell:

```powershell
Set-Location D:\Projects\figma-toolkit
npm ci
npm run setup
npm run doctor
npm test
npm run demo
```

Requires Node.js 22 or newer. The demo starts and stops its own local fixture server, captures a known reference, verifies a deliberately incorrect layout, applies a known fixture correction, and verifies again. It prints before/after HTML report paths. **The demo is a deterministic test, not evidence of autonomous AI repair or a live Figma integration.**

Native Windows x64 validation is recorded in [VALIDATION.md](VALIDATION.md). Mac installation is described in [START-HERE-MAC.md](START-HERE-MAC.md); native Mac validation remains pending. Never copy `node_modules` between operating systems or CPU architectures.

### Try the supplied real Figma sample

Run `npm run sample` and open `http://127.0.0.1:4177`. This creates a separate app with generated Cursor setup under `.sample-project/Fidelity sample 测试` and preserves its edits between starts.

The [editable test frame](https://www.figma.com/design/G3dChC00CQ0r2OFPUTbtQd/Figma-Fidelity-Integration-Test?node-id=2-2) has a fixed exported reference included in the source. Follow [the sample guide](examples/figma-sample/README.md) to start a bounded session, inspect failures, edit four CSS values and verify through the real MCP connection. On Windows this improved 6.3257% mismatch with 23 failures to 0.8418% with no failures in two captures. That sample's repairs were performed by Codex; subsequent Cursor testing is recorded below.

A subsequent [complex Horizon UI benchmark using installed Cursor](CURSOR-BENCHMARK.md) verified real Cursor source generation and a visible Composer repair loop. Its best measured global mismatch was 1.8804%, but regional gates still failed and the original session stopped at five captures. Build and tested controls passed; this does not establish reliable autonomous visual repair.

## Attach it to an application

Keep the toolkit in its own folder. Run this once for each real project, replacing the example app path and frame dimensions:

```powershell
node D:\Projects\figma-toolkit\src\cli.js init `
  --project "D:\Projects\my-react-app" `
  --url "http://localhost:3000/dashboard" `
  --width 1440 --height 900
```

The installer creates `fidelity.config.json`, a project Cursor skill and rule, and merges a local `figma-fidelity` MCP entry into `.cursor/mcp.json`. It preserves other MCP servers, and refuses to overwrite an existing fidelity setup. The generated MCP command contains the actual Node executable and absolute toolkit path, so it does not depend on Cursor's working directory. Keep the toolkit folder in place; reroute the MCP entry if you move it.

Open the application in Cursor and reload its MCP tools. Start the application with its normal dev command (or let Cursor do so). The toolkit does not guess or run your project shell commands.

### Connect Figma and create a reference

**Recommended: use the official Figma plugin/MCP in Cursor.** Connect it once using Figma's current instructions:

https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/

The official remote endpoint is `https://mcp.figma.com/mcp`. Do not duplicate a server the Figma plugin already installed. It supplies design context, assets, variable information and connected components. This toolkit supplies browser verification. It does not proxy OAuth credentials or call Cursor's other MCP tools directly; Cursor coordinates them.

Choose one reference route:

**A. Local export / official MCP screenshot (no REST token)**

Have Cursor obtain the exact frame screenshot, or export it from Figma as PNG at 1×, using exact frame bounds. Save it inside the application as `design/reference.png`. The initializer already points to that path. Leave `figmaUrl` absent. Cursor can use the official MCP context to fill `regions` with explicit expected `rect`/`styles` values. A bitmap alone does not contain inspectable layer properties.

**B. Automated REST snapshot (optional personal access token)**

Set the frame URL as `figmaUrl` in the configured screen, or pass `--figma "https://www.figma.com/design/FILE_KEY/Name?node-id=1-2"` during initialization. Then set `FIGMA_ACCESS_TOKEN` in your terminal environment and run:

```powershell
node D:\Projects\figma-toolkit\src\cli.js sync `
  --project "D:\Projects\my-react-app" --screen desktop
```

Use a token with `file_content:read` and access to the file. Token creation/scopes:
https://developers.figma.com/docs/rest-api/authentication/

This downloads a 1× PNG and raw node JSON, and builds a flattened manifest with frame-relative bounds, font properties, fills, layout fields, component IDs and variable references. It validates frame/export dimensions before replacing a reference. REST access remains subject to Figma account permissions and rate limits. API failures are reported explicitly.

For `fidelity_sync` inside Cursor, its MCP process must inherit `FIGMA_ACCESS_TOKEN`. Set the environment before launching Cursor, or configure the MCP process environment locally using Cursor's documented settings. Never commit the token to project configuration. Syncing from a terminal is sufficient; Cursor needs no token afterward to verify the saved snapshot. Do not share your token in chat.

Resolved variable values, individual source SVG/image exports, and Code Connect snippets come from the official Figma integration; the REST snapshot keeps references to them but does not claim to download or resolve everything.

### Run the Cursor workflow

In Cursor Agent mode invoke `/figma-fidelity`, or explicitly attach `.cursor/skills/figma-fidelity/SKILL.md` if your version does not expose the slash command:

```text
Use the figma-fidelity skill to implement this Figma frame:
<frame link>

Target route: http://localhost:3000/dashboard
Use the existing components, tokens and real assets. Set up the reference
and region mappings, then implement and verify every configured screen.
Repair using the same bounded session until it passes or the tool says STOP.
Show the visual report and unresolved differences. Do not change the
reference, thresholds or masks to hide failures.
```

Once configured, one request starts the repair workflow; repeated manual prompts are not intended. Cursor may still request tool permission under your existing settings, and missing assets, authentication or ambiguous designs can need input. No local process can promise to bypass those controls. The server itself never edits source code or runs a separate LLM.

## Configuration

`fidelity.config.json` lives in the application root, not the toolkit root. Unknown keys, duplicate screen/region names, invalid limits and unsafe screen names are rejected. Each screen uses a separate frame/PNG and viewport; the toolkit does not invent mobile designs.

```json
{
  "version": 1,
  "maxIterations": 5,
  "screens": [
    {
      "name": "desktop",
      "url": "http://localhost:3000/dashboard",
      "figmaUrl": "https://www.figma.com/design/FILE_KEY/Name?node-id=1-2",
      "viewport": {"width": 1440, "height": 900},
      "readySelector": "[data-testid=dashboard-ready]",
      "requiredFonts": ["Inter"],
      "maxMismatchPercent": 2,
      "pixelThreshold": 0.1,
      "tolerancePx": 2,
      "regions": [
        {
          "name": "header",
          "selector": "[data-testid=header]",
          "nodeId": "1:10",
          "maxMismatchPercent": 1
        },
        {
          "name": "heading",
          "selector": "h1",
          "nodeId": "1:20",
          "styles": {"fontWeight": "600"}
        }
      ],
      "masks": []
    }
  ]
}
```

For local PNG references replace `figmaUrl` with `"reference": "design/reference.png"`. Use explicit region bounds, e.g. `"rect": {"x":48,"y":120,"width":600,"height":48}`, instead of `nodeId`. Bounds are relative to the frame origin, in CSS pixels.

`nodeId` maps a **unique selector** to a node in the synced manifest. From this node we derive x/y/width/height, basic font properties, supported solid text/background fills, corner radius and explicit auto-layout padding/axis gap where available. Explicit `rect` and `styles` override them before a session starts. No DOM-to-Figma matching is guessed. Cursor sets these mappings using design context and source inspection.

Computed style checks cover `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `color`, `backgroundColor`, `borderRadius`, `display`, `visibility`, `opacity`, margins, padding and layout gaps. Additional configured CSS properties are captured too. Use CSS color expressions for colors and computed lengths such as `16px` for spacing. Length style comparison has a fixed 0.5px rounding tolerance. Font-family checks compare the first family; a missing actual web FontFace is a separate check. `requiredFonts` is for web fonts only; omit system fonts such as Arial.

Other screen settings:

| Field | Default | Purpose |
| --- | --- | --- |
| `readySelector` | `body` | Visible selector indicating real data is ready; replace for async apps |
| `captureSelector` | absent | Capture a single element whose exact dimensions equal the reference |
| `colorScheme` | `light` | Browser light/dark preference |
| `locale` | `en-US` | Browser locale |
| `timezoneId` | `UTC` | Browser timezone |
| `storageState` | absent | Project-relative Playwright authentication state JSON |
| `timeoutMs` | `30000` | Navigation, locator and screenshot timeout |
| `masks` | `[]` | Explicit rectangles `{x,y,width,height}` applied to both images |

Use app fixtures for network responses, timestamps and test data. Locale/timezone and reduced motion alone do not freeze arbitrary timers or dynamic content. For long pages, prefer separate reference frames or an explicit capture element, matching the complete reference dimensions. Default captures are viewport-only, not full-page.

Authentication example: generate a state file with your own Playwright login flow, save as `fidelity.auth.json` in the app, and set `storageState` to it. The installer excludes that filename and `.figma-fidelity/` from git. Do not commit auth files under a different name without adding an ignore rule.

## Verification and repair limits

Every run normalizes viewport, device pixel ratio (1), CSS screenshot scale, color scheme, reduced motion, locale and timezone. It waits for the ready selector, fonts and image decode. Motion is disabled before measurement and capture. App fixture readiness is still your responsibility.

Checks include global and configured regional pixel differences, expected region geometry/styles, missing/ambiguous/hidden elements, configured web font loading, broken `<img>` elements and uncaught page errors. Large pixel hotspots help the agent localize discrepancies; they do not determine a CSS root cause automatically.

Reference/actual dimensions must match. Neither image is resized, shifted or warped to improve the score. Transparency is composited onto white. Pixelmatch ignores detected antialiasing noise. Masks are applied equally and excluded from the compared-pixel denominator. Fully masked comparisons/regions fail. Thresholds are starting settings that need calibration, not industry standards.

Each `fidelity_begin` session pins a hash of the screen config, PNG and Figma manifest. Verification refuses a changed reference/config. Sessions stop on:

- Passing all configured checks.
- Reaching `maxIterations` verification captures (including the first capture).
- Two consecutive captures that do not improve the best result.

Improvement first considers the number of non-pixel failed checks, then pixel mismatch (more than 0.01 percentage points). The best **evidence** is retained. The tool does not snapshot or revert source code; Cursor must establish a checkpoint and only revert its own edits. Never restart sessions automatically to evade a stop condition.

The CLI can also do standalone checks for CI; those do not consume a repair session. A visual pass does not certify functionality, accessibility, responsive layouts not supplied, exact source asset identity, or correctness of every font glyph/weight. Run your app's existing checks separately. No blind CSS patch generator is included.

## CLI and MCP reference

```powershell
# All configured screens, exit 1 if any mismatch
node D:\Projects\figma-toolkit\src\cli.js check --project "D:\Projects\my-react-app"

# Start a session, retain the returned id
node D:\Projects\figma-toolkit\src\cli.js begin --project "D:\Projects\my-react-app" --screen desktop

# Check within that session
node D:\Projects\figma-toolkit\src\cli.js check --project "D:\Projects\my-react-app" --screen desktop --session "<returned-id>"
```

Exit codes: 0 = configured checks pass; 1 = visual/check failures; 2 = setup, capture or runtime execution error. Do not treat code 2 as an acceptable visual result.

MCP runs over standard input/output using the official MCP SDK, with a fixed app root from `--project`. It exposes:

| Tool | Function |
| --- | --- |
| `fidelity_project` | Read project config |
| `fidelity_design` | Page/filter flattened node properties |
| `fidelity_sync` | Explicitly refresh the Figma reference |
| `fidelity_begin` | Begin a bounded repair session |
| `fidelity_verify` | Capture, measure, compare and advance session |
| `fidelity_report` | Read the most recent JSON report |
| `fidelity_image` | Return reference/actual/diff/overlay as MCP images |

Report outputs: `.figma-fidelity/runs/<screen>/<run-id>/` contains `result.json`, `findings.json`, `report.json` and reference/actual/diff/overlay PNGs. HTML modes also write `report.html`; interactive HTML runs include regional crops when mapped. The default HTML lists findings with compact JSON. The optional interactive QA workspace keeps per-finding comparisons and review controls, with evidence images loaded from adjacent files. Keep the report folder together when sharing; full diagnostic JSON remains separate. Old evidence is preserved; no automatic retention cleanup is performed. Parallel modifying operations in one app are rejected through a lock. If a crashed process leaves a lock, confirm no operation is running and remove `.figma-fidelity/operation.lock`.

## Tests and development

```powershell
npm test
npm run test:unit
npm run demo
```

Tests cover real image differences, masking/denominators, dimension mismatches, geometry/style gates, Figma API mock success/auth/rate limits, installer preservation, MCP stdio handshake/tool calls, browser regression detection, correction pass, config pinning and stop conditions. Browser tests need Chromium installed. Tests do not access your Figma account or invoke Cursor's model.

`FIDELITY_CHROMIUM_EXECUTABLE_PATH` can point to a preinstalled compatible Chromium if Playwright browser downloads are unavailable. Prefer the browser installed by the pinned Playwright version, and keep a consistent browser/fonts/OS for comparisons. Current Windows validation uses the Playwright-managed browser; see `VALIDATION.md` for exact environments and remaining gaps.

Source files are ESM JavaScript with Zod runtime validation, so there is no TypeScript build step. All dependencies are captured by `package-lock.json`; install with `npm ci`.

## What remains for a production release

This package has no hosted service, marketplace registration, independent vision-model diagnosis or automatic git rollback. The repair agent is Cursor guided by the installed skill, not a second independent judge. A real Figma frame and target app are needed to calibrate thresholds and assess repair quality. Those integrations cannot be certified by synthetic tests.

Official references used for integration details:

- Cursor MCP: https://cursor.com/docs/mcp
- Cursor skills: https://cursor.com/docs/skills
- Figma MCP setup: https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/
- Figma file/image API: https://developers.figma.com/docs/rest-api/file-endpoints/
- Playwright capture API: https://playwright.dev/docs/api/class-page
