# Delivering Figma Delta

## First delivery: a local pilot

Use a versioned source ZIP for the first users. It provides the CLI, Cursor MCP integration, QA report renderer, templates, tests and small demo without requiring a public service or registry account. It remains an early release: Windows x64 has local validation; native macOS/Linux validation and broader real-application pilots still need evidence.

On Windows, maintainers run:

```powershell
npm ci
npm run setup
npm test
npm run release:zip
```

The output is `dist/figma-delta-<version>.zip` and its `.sha256` file. The builder refuses to overwrite an existing archive. Increment the version for a changed release, or move an unreleased archive aside before rebuilding. The release script packages an explicit source allowlist and refuses symbolic links. Review any new files under those allowed directories before shipping; the builder is not a secret scanner or licensing audit.

The archive excludes `node_modules`, `.cursor-benchmark`, `.sample-project`, `.demo-project`, generated evidence, project auth state and the internal project handoff. It includes `package-lock.json`; recipients install dependencies and Chromium on their own machine. Do not copy installed native dependencies between operating systems.

Share through your team's file-delivery channel. The checksum detects transfer changes; distribute it through a trusted channel when publisher authenticity matters. Nothing is uploaded by the release script.

## Recipient onboarding

1. Install the latest Node.js 24 (minimum 24.22.1), extract the archive and keep the toolkit folder in a permanent location.
2. Open a terminal in that folder and run `npm ci`, `npm run setup`, `npm run doctor`, then `npm run demo`.
3. Start the target application using its own development or preview command.
4. Run the initializer with the app folder, URL and exact reference viewport. Follow the README to supply a local reference or sync an accessible Figma frame and map regions.
5. Run a standalone check for QA, or connect Cursor for a bounded development/repair session.

Example from the extracted toolkit folder:

```powershell
node src/cli.js init --project "D:\Projects\my-app" --url "http://localhost:3000/dashboard" --width 1440 --height 900
# Supply the reference and mappings before checking.
node src/cli.js check --project "D:\Projects\my-app" --screen desktop --format html
```

The check prints artifact paths. Open `report.html` in the resulting run folder. Use `--format simple` for the small static report or `--format json` for automation. Exit codes are 0 for configured checks passing, 1 for measured failures and 2 for execution/setup errors. CLI checks work without Cursor; source repair requires a developer or agent.

Exact expected properties require design data or explicit expectations. Agree on mappings, fonts, fixture data, viewport and tolerances during onboarding. A screenshot alone cannot supply expected margin/padding values. Review annotations stay in the browser tab until exported.

## Sharing results with QA and development

Share the complete run folder, including its images, rather than only the HTML file. The interactive workspace references adjacent evidence files and omits the full-page comparison, original-checks/run-details section and raw JSON blocks. It retains the affected-area comparison, property differences, review decisions and handoffs.

For agents, start with `result.json`: compact failed differences and run/session context. Send `findings.json` or specific images when additional detail is needed. For human review, export reviewed JSON before closing the tab and keep it with the evidence. Review decisions do not change the measured result.

Reports may contain screenshots, application URLs, selectors, text and browser errors. Review the run folder for application data before sharing outside the intended audience. Sharing reports does not require sharing Figma tokens, application auth state or source code.

## After the pilot

| Delivery | When to choose it | Preparation |
| --- | --- | --- |
| Versioned ZIP | Small pilot or internal team | Current route; installation and dependency download happen locally |
| Public source repository and release downloads | Community feedback and contributions | Choose license, ownership and repository; review source, sample rights and release contents |
| npm package | Repeatable CLI installation and upgrades | Choose a registry name/scope, licensing and package metadata; replace private package settings and validate the packed contents and clean installation |
| Hosted service | Teams requiring managed uploads, history and collaboration | Separate product work: authentication, storage, retention, access controls and operations |

The npm package remains private (`@local/figma-delta`) and has no declared project license. Source is hosted at [rv-ranbir/figma-delta](https://github.com/rv-ranbir/figma-delta). No npm registry publication is included. The owner still needs to select the project license before describing it as licensed open source. A hosted service is not required for the local CLI/MCP workflow.

For each pilot, collect installation success, mapping effort, useful versus false-positive findings, review time, and whether developers or agents can reproduce and fix the reported differences. Use that evidence to decide the next delivery route.
