# Findings for QA and development agents

## Simple JSON option

**Default: lightweight HTML + compact JSON.** `check` (or MCP verification with no format) writes a static `report.html` listing all detected findings and the relevant compact JSON under each finding. It has no scripts or embedded images; screenshot evidence is linked for on-demand inspection. CLI/MCP replies are minified compact JSON, never HTML source. It skips regional crops. Coverage limits and session stop instructions remain visible.

Choose `--format simple` explicitly for this default, `--format json` to skip HTML entirely, or `--format html` for the interactive QA workspace with regional comparisons and review/export controls. This view omits the full-page comparison, run-details/original-checks section and raw JSON blocks. Evidence images load from adjacent files instead of embedded image payloads; keep the report folder together when sharing. Full JSON remains available through downloads. The same values work in MCP `format`. `fidelity_report` reads compact JSON by default without recapturing; explicit `format: "html"` retrieves full diagnostic JSON.

Use `--format json` for a compact result, skipping HTML and region-crop generation:

```powershell
node src/cli.js check --project ../my-app --screen desktop --session "<existing-session-id>" --format json
```

For MCP, add `"format": "json"` to `fidelity_verify` arguments. It retains the same session, measurements, checks and capture limit. JSON-only runs keep full measurements in `report.json` / `findings.json` and four full-page evidence images on disk; these are not sent to the agent automatically. Lightweight HTML (`--format simple`) is the default; the full workspace requires `--format html`.

`result.json` and the compact CLI/MCP response contain only run context, pass/fail, failed differences (selector/property/expected/actual/unit/tolerance/delta), coverage, session state and artifact paths. They omit repeated matching properties and raw DOM measurements. Replies and the file are minified. Generation uses local code, not an LLM; no specific token saving is guaranteed.

To read a compact result from any existing run **without another capture**, call:

```json
{"screen":"desktop","format":"json"}
```

with `fidelity_report`. Older reports are projected from their original checks if no structured findings exist; missing IDs/values are not invented. `format: "html"` on this read tool means the full JSON report response; it does not generate HTML or take a screenshot. Use `fidelity_image` only when visual evidence is needed. Reading a compact report never restarts a stopped budget.

Both HTML modes save `result.json` and provide a **Simple JSON** download. A simple page also links the full measurement JSON and screenshot evidence. Findings are failed checks from the configured coverage, not a claim that every application bug was found.

Full HTML verification writes `findings.json` beside `report.json`, `result.json`, `report.html` and the four full-capture PNGs. The full CLI/MCP response includes the same `findings` array; JSON mode returns its compact `differences` projection. Existing `issues`, exit codes, configured checks and session budgets remain unchanged. A passing run has no findings/differences.

The export has `schemaVersion: 1`, run ID, screen, URL, viewport, capture time, pass result and findings. `report.json` retains its existing version and adds `findingsVersion: 1`. These describe failed configured checks, not every possible defect. Page and regional pixel failures can refer to the same underlying difference; do not count findings as independent bugs.

## Each finding

- `id`: deterministic identity based on screen, URL, region, selector, node ID, check kind/property and resource/error subject. It stays stable when measured values, run IDs or issue order change. Changing a mapping or URL can change the ID. IDs alone do not establish equivalence across changed design baselines.
- `category`: `geometry`, `style`, `region-pixels`, `pixels`, `element`, `font`, `asset`, or `runtime`.
- `occurrences`: number of identical logical failures grouped under this ID, such as repeated runtime errors or multiple broken images sharing one URL. The original `issues` array remains ungrouped.
- `summary`: the failed check's evidence statement.
- `target`: region, CSS selector, Figma node ID and resource, with `null` for unavailable mappings. It does not guess a source file or line.
- `property`, `expected`, `actual`, and signed `delta` for geometry/numeric CSS: measurements and configured comparison values. Geometry uses CSS pixels and its configured tolerance. Pixels use mismatch percentage and the configured maximum; the pixelmatch color threshold and anti-aliasing behavior are unchanged. Numeric CSS lengths use `operator: "within"`, tolerance 0.5px and preserve original strings as `rawValue`. Font families use `operator: "primary-font-family-equals"` (quotes removed, first family only, case-insensitive). Color values use `color-equals` after conversion to extended sRGB, as described below. Unresolved colors use `color-unavailable` and cannot pass through string equality. Other styles also use exact strings.
- `properties`: element-level rows with `property`, readable `label`, `group`, raw `expected` and `actual`, comparison method/tolerance/delta when applicable, and `status`: `match`, `different`, `not-specified` or `unavailable`. Missing reference values are not guessed and are not passes. Rows apply to the configured element, not every descendant.
- `evidenceType`: `pixel-comparison` or `measured-check`. A percentage proves a rendering difference, not its cause, semantic meaning, accessibility impact or severity.
- `evidence`: `scope`, `coordinateSpace: "capture-css-pixels"`, crop `rect`, and relative paths in `images.reference`, `actual`, `diff`, `overlay`. Crops use the union of known expected and actual bounds, rounded outward and clipped to the capture. Missing elements use reference bounds when known; unmapped or wholly offscreen bounds fall back to page evidence. Shared-region findings reuse image files. Images are never scaled. Capture scale is 1 CSS pixel per image pixel. Masks exclude comparison areas; they are not privacy redactions of source screenshots.
- `hypotheses`: initially empty. The deterministic verifier does not invent CSS diagnoses.
- `guidance`: investigation instructions, not a prescribed code change.
- `review`: initially `{ "status": "unreviewed", "severity": null, "comment": null }`. The HTML can edit these fields in the current tab and export a reviewed JSON copy. It does not overwrite measured data or automatically persist annotations on reload. Keep exports/tracker annotations keyed by finding ID and run/reference identity.

## Exact colors and spacing

Capture records computed font/color/background/border properties, margin and padding (shorthand and individual sides), and gap/row-gap/column-gap. Additional configured CSS property names are also measured. Explicit expectations go in region `styles`, using computed CSS values or supported CSS color expressions.

For synced Figma node mappings, expectations also derive a single visible solid text/background fill, corner radius, and explicit auto-layout padding. Fixed horizontal item spacing maps to `columnGap`; vertical spacing maps to `rowGap`. Space-between, wrapping, negative spacing, mixed fills and vector paint are not guessed into equivalent CSS. Explicit configured styles override derived values.

Figma positions do not establish CSS margins. A screenshot cannot distinguish margin from padding or gap; supply known expected CSS margins when needed. This is especially relevant to older PNG-only benchmarks: they may have browser color measurements but no expected reference color. Reports show that coverage gap instead of making a color diagnosis from pixels.

Example explicit expectations before starting a session:

```json
{
  "name": "page-title",
  "selector": "#title",
  "styles": {
    "color": "#182238",
    "fontSize": "32px",
    "marginTop": "12px",
    "paddingLeft": "0px"
  }
}
```

## Full QA workspace workflow (`--format html`)

Open `report.html`, search/select a finding, and inspect the property differences and side-by-side reference/browser images. Matching values and missing design values are collapsed; pixel maps are optional advanced evidence. Record a review decision (confirmed issue, not a defect, or ready to retest), severity and note. Use **Export reviewed JSON** to save current-tab annotations; refresh closes that temporary state. **Original JSON** downloads the unmodified findings export.

**Copy developer ticket** includes page/viewport, expected/actual properties, selector, resource/error, evidence paths and review notes. **Copy agent instructions** adds MCP image calls and session/run checks. Clipboard failure opens selectable text for manual copying. Nothing is sent to a tracker or agent automatically. Keep the JSON with its evidence folder when moving/sharing; image paths are relative to that report directory.

The full QA HTML embeds evidence for offline viewing; its download link requires the sibling `findings.json` file. Simple HTML instead links evidence files. Keep the report directory together for complete evidence/download access.

## Agent workflow

Read `fidelity_report` and select a finding. To view its crop, call:

```json
{
  "screen": "desktop",
  "image": "diff",
  "findingId": "<id from the latest report>"
}
```

Use the existing `fidelity_image` tool, repeating with `reference`, `actual` and `overlay`. Omit `findingId` for full-capture images (also supported for older reports). An unknown ID returns an error. Finding images are from the latest report; historical evidence remains available in its saved run directory. Inspect evidence and source before proposing a cause, then verify edits using the same active session. This export does not restart stopped sessions or change their budget.

### Shared color format

Both expected Figma colors and actual browser colors are converted with Culori to `color(srgb r g b / a)` before comparison and report output (`colorFormat: "srgb-css"`). Channels and alpha are rounded to six decimal places. Supported formats include HEX with alpha, RGB, HSL, named colors, Lab/OKLab and Display-P3; see [Culori parsing and conversion](https://culorijs.org/api/). Extended sRGB channels may be negative or greater than one, preserving converted wide-gamut colors without gamut clipping. Alpha is preserved; fully transparent colors use zero RGB channels. Figma solid-fill channels are converted without an intermediate 8-bit rounding step.

Original expressions remain in detailed `rawStyles`, `rawValue`, `expectedRaw` or `actualRaw` fields. A missing reference or unresolved expression such as `var(--unknown)` is a missing input, not a color-space conversion limitation. It is marked unavailable and retains its raw value for review. Browser computed styles normally resolve variables before capture.
