# Compare a project-prepared page

Install locally with `npm install figma-delta`, then run `npx figma-delta setup` to install Chromium when needed. Your project owns app startup, temporary tokens, authentication, workspace selection and navigation. Once it has a ready Playwright `Page`, hand that page to Delta:

```js
import { checkPreparedPage } from 'figma-delta';

// `page` comes from your project's existing Playwright setup.
// Start the app and reach the intended view before this call.
const result = await checkPreparedPage({
  project: process.cwd(),
  page,
  reference: 'design/review.png', // 1× PNG, relative to project
  // Or use figmaUrl: 'https://www.figma.com/design/FILE/Design?node-id=123-456'
  readiness: { confirmed: true, selector: '[data-testid=review-screen]' },
  regions: [
    { name: 'title', selector: 'h1', styles: { color: '#182238', fontSize: '32px' } }
  ],
  format: 'html' // interactive QA; default: simple; json: no HTML
});

if (result.status === 'blocked') {
  console.log(result.reason); // Return to your project's preparation flow.
} else {
  console.log(result.report.pass, result.report.artifacts);
}
// Your project retains the page, context and browser and closes them when done.
```

For direct Figma REST snapshots, supply `FIGMA_ACCESS_TOKEN` through the environment. A PNG needs no Figma credential. Element mappings are needed for exact property checks; pixels alone cannot identify a CSS cause.

## Readiness and ownership

Set `confirmed: true` only after the intended view is ready. A unique visible selector is recommended. Optional `expectedUrl` must match the page's full current URL exactly; the comparison happens in memory. Do not put temporary tokens in checked-in code.

Delta does not start, navigate, reload, resize or close your page, change its browser settings, inject CSS, or read cookies/storage. It captures the current viewport and scroll position, preserving focus, selection and open dialogs. The viewport must match the reference dimensions; `viewport: null` uses the actual browser window dimensions. Reports record the observed locale, timezone, color scheme and device scale factor. Your project must settle animations and data before capture.

Blocked results have `status: 'blocked'`, `preparationRequired: true` and a reason: `PAGE_NOT_READY`, `PAGE_CLOSED`, `PAGE_CHANGED_DURING_CAPTURE`, `VIEWPORT_MISMATCH`, `UNSUPPORTED_PAGE` or `CAPTURE_UNAVAILABLE`. They are not defect reports and do not update the latest report or consume a repair iteration. A capture can leave an incomplete local run directory. Invalid inputs, missing references or stopped repair sessions throw an error.

Expired login is detected only when it changes the supplied readiness selector/URL or the page during capture. Delta cannot infer every application's authentication state. Return to your existing preparation flow, refresh the token or login there, and call again with the same comparison. An optional `signal: AbortSignal` is checked before and after capture; it does not forcibly interrupt an active Playwright operation.

## QA and development

QA needs only the call above. The completed report includes `report.comparison.id`. For repeat checks, pass `comparisonId` instead of supplying `reference`, `figmaUrl` or `regions` again. Each new reference/frame needs a new comparison.

For bounded developer repairs, begin a session using the existing CLI:

```bash
figma-delta begin --project . --comparison COMPARISON_ID
```

Then call `checkPreparedPage({ project, page, comparisonId, sessionId, readiness })` with those same IDs after each repair. Follow the returned session stop instruction. The project prepares the page before every call.

## URL privacy and compatibility

Prepared-page metadata stores URLs with user information, query values and opaque fragments redacted. Figma node IDs remain available. New report projections also redact URL values found in measurements and runtime messages. Raw live URLs are used only in memory for readiness checks. Existing navigation configurations are preserved, so older configurations and artifacts are not retroactively scrubbed.

This is URL redaction, not general secret detection: URL paths, visible text, screenshots and arbitrary application messages can contain sensitive data. Explicit region expectations are persisted to pin comparisons; do not supply secrets in mappings. Review artifacts before sharing.

Configured CLI checks, per-run comparisons and Delta-owned interactive navigation continue to work. This API accepts a real in-process Playwright Page; it does not attach to arbitrary Cursor, MCP or browser tabs.
