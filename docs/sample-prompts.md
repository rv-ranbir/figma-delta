# Sample prompts

Copy a prompt into Cursor or your coding agent and replace the `<PLACEHOLDERS>`. Supply the exact Figma frame for the page and state you want to check. Keep credentials and temporary tokens out of prompts.

For Cursor, [install Figma Delta](../README.md#installation), run `figma-delta init --project .` once in the application, then reload and enable its MCP tools. The installed `/figma-fidelity` skill supplies the repository and verification rules. Other agents need the equivalent tool integration or access to the CLI.

These prompts ask the host agent to coordinate the work. Delta measures differences; the host agent prepares mappings and makes any requested source edits. Direct Figma REST access needs `FIGMA_ACCESS_TOKEN` in the environment; an exported 1× PNG is an alternative. Exact CSS checks need known selector/property or selector/Figma-node mappings. A screenshot alone cannot establish expected CSS values.

## Choose a scenario

| Scenario | Output or behavior |
| --- | --- |
| [Quick QA check](#quick-qa-check) | Simple HTML and compact JSON; no source edits |
| [QA review workspace](#qa-review-workspace) | Interactive HTML for human review and handoff |
| [Implement or fix a screen](#implement-or-fix-a-screen) | Source changes with a bounded repair session |
| [Login, workspace selection or wizard](#login-workspace-selection-or-wizard) | Human navigation in Delta's visible browser |
| [Project startup or temporary tokens](#project-startup-or-temporary-tokens) | Existing project code hands over a prepared page |
| [Local PNG instead of Figma access](#local-png-instead-of-figma-access) | Pixel comparison plus explicit property expectations |
| [Recheck an existing repair](#recheck-an-existing-repair) | Same pinned comparison and repair budget |
| [Compare a different page or frame](#compare-a-different-page-or-frame) | New comparison without changing the earlier reference |

## Quick QA check

```text
Use Figma Delta to compare <APP_URL> with this exact Figma frame:
<FIGMA_FRAME_URL>.

QA only: do not edit application source or begin a repair session. Follow this
repository's instructions and use existing design mappings when available.
Report measured expected-versus-actual differences in color, typography,
spacing and geometry for mapped elements; identify unmapped coverage honestly.
Use the default simple report and provide its HTML path and result.json path.
Do not infer a CSS cause from pixel differences alone.
```

## QA review workspace

```text
Compare <APP_URL> with <FIGMA_FRAME_URL> using Figma Delta in QA-only mode.
Use format html so I can review findings, affected-area evidence and property
differences. Do not edit source or start a repair session. Give me the report
path, comparison ID and coverage limits. Leave severity and acceptance decisions
for my review, and explain how to export reviewed JSON for developers.
```

Review decisions stay in the report's browser tab until exported. Share the complete run folder with its evidence, together with the reviewed JSON. For automation with no HTML, replace the format request with `Use format json and return compact differences and artifact paths.`

## Implement or fix a screen

```text
Use Figma Delta to implement or fix <APP_URL> against <FIGMA_FRAME_URL>.
First follow applicable repository rules and skills and reuse its components,
design tokens, assets and existing MCP tools. Establish verified element
mappings; do not invent expected values or silently override design-system rules.

Prepare one pinned comparison, establish a checkpoint and begin one bounded
repair session. Capture a baseline, make the smallest evidenced fixes and
recheck with the same comparisonId and sessionId. Preserve functionality and
user edits. Stop on pass or the session's stop instruction; do not change the
reference, thresholds or masks to hide failures. Run relevant project checks
and return the report, source-change summary and unresolved coverage.
```

## Login, workspace selection or wizard

```text
Use Figma Delta to compare the screen I reach from <ENTRY_URL> with
<FIGMA_FRAME_URL>. It is behind login/workspace selection/a multi-step flow.

Prepare an interactive comparison and open its visible browser. Let me navigate
and ask me to confirm when the intended screen is ready before capture.
Use <READY_SELECTOR> as the target-view marker. Capture that same live page
without navigating back to the entry URL. Do not automate authentication or
save login state. QA only, format html. If another capture is needed, ask for
readiness again and retain the same comparison ID.
```

Replace `<READY_SELECTOR>` with a known selector that identifies the target state, or remove that sentence and let the agent inspect the page to establish one. Delta's interactive browser is separate from your regular browser profile. The CLI closes its browser after a check; the MCP process can keep it alive between captures.

## Project startup or temporary tokens

```text
Compare our <TARGET_SCREEN> with <FIGMA_FRAME_URL> using Figma Delta.
This project has a custom startup/login flow and short-lived tokens. Read its
existing setup instructions and use its approved Playwright preparation code.
Keep startup, credentials, token refresh and navigation in project code;
do not add project-specific automation to Delta or put secrets in prompts,
source, mappings or reports.

Once that code has a ready in-process Playwright Page, call checkPreparedPage()
with that same page, the frame and an explicit readiness condition. Keep the
project in control of the browser. QA only, format simple. If Delta returns
blocked, report the reason and return to the project's preparation flow;
do not count it as a visual defect or reset an existing repair budget.
```

This uses the [prepared-page JavaScript API](prepared-pages.md). It cannot attach to an arbitrary open Cursor, MCP or browser tab. If the project has no preparation code, the agent should identify the missing setup and agree on a project-owned approach before capture. For development, replace QA-only with the bounded repair instructions above and reuse the same comparison/session IDs.

## Local PNG instead of Figma access

```text
Use Figma Delta to compare <APP_URL> with the 1× PNG at
<PROJECT_RELATIVE_REFERENCE_PNG>. No Figma credential is available.
Use known selector/property expectations from <PROJECT_RELATIVE_MAPPING_JSON>.
Do not infer expected CSS values from the PNG. Keep capture dimensions equal
to the reference without resizing it. QA only; return simple HTML, compact JSON
and any pixel-only or unmapped coverage limits.
```

If no mapping file exists, remove that sentence. The agent can report pixel differences and missing property coverage; it should not manufacture exact expectations. Reference and mapping files must stay within the application project.

## Recheck an existing repair

```text
Recheck Figma Delta comparison <COMPARISON_ID> using the existing repair
session <SESSION_ID>. Keep its pinned reference, mappings and original budget.
Prepare the intended page state using the existing workflow; if interactive,
wait for my readiness confirmation. Do not supply a new Figma frame or replace
the reference. Report changes since the previous check and remaining findings.
If the session has stopped, report that outcome rather than starting another.
```

For QA without a repair session, omit the session ID and request a recheck of the same comparison without source edits. An expired login or changed page must be prepared again before comparison; saved login state may not restore wizard or sessionStorage state.

## Compare a different page or frame

```text
Create a new Figma Delta comparison for <NEW_APP_URL> and
<NEW_FIGMA_FRAME_URL>. Keep earlier comparisons and their references unchanged.
Use the new frame's dimensions and establish mappings for this page.
QA only, format simple. Return the new comparison ID and report paths.
```

See [per-run comparisons](per-run-comparisons.md) for commands and [findings and JSON](findings-format.md) for report fields. A pass covers configured checks; functional behavior, accessibility and unsupplied responsive designs still need their own tests.
