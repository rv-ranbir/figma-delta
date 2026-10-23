# Per-run comparisons and guarded pages

Supply an app URL and exact Figma frame for each comparison. No `init` or hand-written configuration is required for pixel checks. Start the app separately.

```bash
figma-delta check --url "http://localhost:3000/settings" --figma "https://www.figma.com/design/FILE/Design?node-id=123-456"
figma-delta check --url "http://localhost:3000/settings" --reference "design/settings.png" --format html
```

REST needs `FIGMA_ACCESS_TOKEN` inherited by the process. Tokens never belong in config or prompts. A local 1× PNG needs no Figma credential and can be exported through an existing official Figma MCP. Use `--project <application-folder>` outside the app folder. Reference, mapping and storage-state paths must stay inside that project.

Dimensions are inferred without resizing. Fractional/out-of-range frame dimensions fail explicitly; optional `--width` and `--height` must match. A PNG takes precedence when both `--reference` and `--figma` are supplied: the link is recorded, but the Figma version is unknown.

Preparations create separate UUID comparisons under `.figma-fidelity/comparisons/`, preserving host config and other frames. This state directory has a private ignore rule. Repair sessions pin reference/config; select or refresh a frame by preparing another comparison explicitly, not replacing its reference mid-repair. Share the report's run directory, not the whole comparison directory, which can contain credentials.

## Exact properties

A frame or PNG alone does not establish DOM-to-Figma correspondence. Pixel differences do not identify CSS causes. Supply known mappings as a JSON array with `--mappings design/regions.json`:

```json
[
  {"name":"title","selector":"h1","styles":{"color":"#182238","fontSize":"32px","marginTop":"0px"}},
  {"name":"content","selector":"main","styles":{"paddingLeft":"48px"}}
]
```

With a REST snapshot, `nodeId` mappings derive supported Figma properties. With a PNG, provide explicit `styles` and optional `rect`; a node ID alone has no structured snapshot. Agents should establish mappings through design context and source inspection. Existing repository rules/components/tokens still apply; report conflicts rather than weaken checks.

## Login, guards, modals and wizards

```bash
figma-delta check --url "http://localhost:3000" --reference "design/review.png" --interactive --ready "#review-screen" --format html
```

Navigate the visible browser through normal application flows. Confirm readiness with Enter in the terminal. Capture uses the same page without navigating or reloading; reports identify the final URL separately from the entry URL. `--ready` optionally waits for a selector marking the target view. The reference viewport must stay unchanged.

The browser is isolated from your regular profile. Log in and complete MFA yourself; the tool does not bypass guards or submit business transactions. Use authorized test accounts/data. `--interactive` needs a real terminal; piped execution fails before browser/filesystem effects. Agents should use the MCP workflow below.

Run `figma-delta setup` if the managed browser is missing. If it cannot launch on your machine, `FIDELITY_CHROMIUM_EXECUTABLE_PATH` can explicitly select an existing compatible Chrome/Chromium executable. Do not disable TLS verification or operating-system security controls. Record the browser version when comparing results across environments.

The CLI closes its browser after a check; navigate again for a later CLI capture. Cursor's MCP process keeps its browser alive between captures until disconnect. If edits do not update the app automatically, manually return to the intended state before confirming again. Closing the browser fails clearly; reopening a saved comparison does not reset its repair budget.

### Optional reusable login

Add `--save-login` to save cookies, localStorage and IndexedDB as `.figma-fidelity/auth.json`. Reuse with `--storage-state .figma-fidelity/auth.json` on a new comparison. This does not preserve sessionStorage, in-memory state, wizard history or open dialogs. Sessions can expire, require MFA again, or use SSO that cannot be restored this way.

Saved state is a credential, stays local/ignored and is excluded from report exports. Share only report run directories and review exports. Screenshots and URLs can also contain private data. Delete auth files when no longer needed.

## Development and QA

One-off `check` is QA: capture/report without a repair session. Formats: `simple` (default static HTML), `html` (QA workspace), `json` (compact output without HTML).

For development, prepare once and reuse the printed comparison ID:

```bash
figma-delta prepare --url "http://localhost:3000/settings" --reference "design/settings.png"
figma-delta begin --comparison COMPARISON_ID
figma-delta check --comparison COMPARISON_ID --session SESSION_ID
```

Add `--interactive` on checks needing manual navigation. Use the same comparison/session IDs for repairs. Stop on pass or the tool's stop instruction; never restart a stopped budget to hide failures.

## Cursor / MCP

One-time Cursor integration still uses `figma-delta init --project .` to install the skill/rule/MCP entry. New comparisons need no config edits. Reload the MCP after package updates and enable its source in Cursor if disabled.

1. Read applicable repository instructions, relevant skills, components and tokens.
2. Call `fidelity_prepare` with `url`, `figmaUrl` or local `reference`, optional `regions`, `readySelector`, `storageState`, and `interactive:true` for manual navigation. It returns `comparisonId`, viewport and frame/version. It does not begin a repair session.
3. Ask the human to navigate and confirm the target view. Never assume readiness or automate authentication. Reopen a closed browser with `fidelity_prepare` using the SAME `comparisonId` and `interactive:true`.
4. QA: call `fidelity_verify` with `comparisonId`, `confirmReady:true` for interactive capture, and `format:"html"`. No session or source edits required.
5. Development: checkpoint source, call `fidelity_begin` with `comparisonId`, then baseline and repairs with that comparison ID and the SAME `sessionId`. Ask readiness before each interactive capture. `saveLogin:true` is only for an explicit request to save local credentials.
6. Include `comparisonId` on `fidelity_project`, `fidelity_design`, `fidelity_report` and `fidelity_image` calls. Copied agent handoffs include it.

`fidelity_sync` cannot replace a comparison's pinned reference; prepare a new comparison when the design changes. Existing configured-screen tools remain compatible when `comparisonId` is omitted.
