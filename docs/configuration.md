# Configuration and command reference

Config files are optional for one-off comparisons. See [per-run comparisons and guarded pages](per-run-comparisons.md) for app URL + Figma/PNG commands, inferred viewport and interactive navigation. Saved screens remain useful for repeatable mapped checks.

Commands below assume an npm installation. From a source checkout, replace `figma-delta` with `node src/cli.js`. Project paths are relative to your current terminal directory.

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

Mapped Figma text also supplies expected copy. Optional region `text` overrides it or supplies expected copy for PNG references. `textMode: "ignore"` explicitly skips copy comparison for dynamic values while retaining style, geometry and visibility checks; ignored regions are listed in coverage. For example:

```json
{"name":"order-number","selector":"[data-testid=order-number]","nodeId":"1:25","textMode":"ignore"}
```

Text comparisons normalize Unicode NFC and line endings, and collapse ordinary whitespace. Preformatted text preserves spaces and newlines. Generated/native/shadow text or text exceeding the inspection limit produces unverified coverage rather than a guessed copy mismatch. CSS letter spacing `normal` and `0px` share a zero-spacing comparison value.

Expected rendered text receives viewport/clipping and sampled obstruction checks. Potentially covering layers produce unverified coverage when paint order cannot be proven; transforms, masks and complex compositing may require visual review. These checks do not certify every visible glyph. Styles-only PNG regions without expected text retain their existing CSS-check behavior.

Chromium font diagnostics inspect actual glyph font families when a font-family expectation exists. Generic families such as `sans-serif` do not prescribe a specific platform font. Custom aliases are accepted only when the available evidence identifies them reliably; ambiguous aliases and mixed fallback glyph fonts require review. These diagnostics do not certify every font weight, glyph shape or variable-font axis. Non-CSS selectors or unsupported browsers can return unverified font coverage. `requiredFonts` remains available for explicit web-font loading checks.

Unmapped Figma vector shapes and image-fill bounds receive local pixel comparisons automatically, clipped to the reference viewport and respecting masks. Their findings include the Figma node ID without inventing a DOM selector or CSS cause. PNG-only references need supplied asset regions for equivalent local checks. Local image comparison does not establish source-file identity.

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

```bash
# All configured screens, exit 1 if any mismatch
figma-delta check --project ../my-app

# Start a session, retain the returned id
figma-delta begin --project ../my-app --screen desktop

# Check within that session
figma-delta check --project ../my-app --screen desktop --session "<returned-id>"
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

