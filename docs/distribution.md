# Delivering Figma Delta

## Source archive and local pilot

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
| npm package | Repeatable CLI installation and upgrades | Configure release secrets; automated CI validates the packed installation before publishing |
| Hosted service | Teams requiring managed uploads, history and collaboration | Separate product work: authentication, storage, retention, access controls and operations |

The public npm package name is `figma-delta`, licensed MIT. Source is hosted at [rv-ranbir/figma-delta](https://github.com/rv-ranbir/figma-delta). Package availability depends on the first successful npm publish. A hosted service is not required for the local CLI/MCP workflow.

For each pilot, collect installation success, mapping effort, useful versus false-positive findings, review time, and whether developers or agents can reproduce and fix the reported differences. Use that evidence to decide the next delivery route.

## npm release setup

This follows the release pattern from secondpair. The package uses an explicit `files` allowlist; browser downloads are an explicit CLI setup command. Dependencies are not copied from the maintainer's installed node_modules. The consumer test verifies a real packed installation with no install scripts, its dependency audit, both npm CLI resolution and direct CLI execution, browser setup/health, template installation, generated MCP startup and an end-to-end visual regression/correction.

Configure these repository Actions secrets before merging the first npm release PR:

- `NPM_TOKEN`: an npm publishing credential authorized for `figma-delta`. For the first release it must be able to create the package. Use the narrowest available permissions and the npm-required publishing/2FA policy. Secrets from another repository cannot be read or automatically copied.
- `RELEASE_TOKEN`: a fine-grained GitHub token for this repository with Contents write access to push version tags. It deliberately triggers the separate tag workflow; tags pushed with the default GITHUB_TOKEN do not start a new workflow. Keep its scope restricted and monitor expiration.

Add them in the repository's Settings → Secrets and variables → Actions. Never put either value in source, PR comments, workflow files or chat. The release workflow checks for missing credentials and fails explicitly.

To release:

1. Bump package.json and package-lock.json together in a PR; update displayed CLI/MCP versions when changing the release version.
2. Let native CI, packed-consumer tests and CodeQL pass, then obtain the independent approval required by main protection and merge the PR.
3. Successful main push validation creates `v<version>` when absent. The release pipeline accepts tags only for commits already on main, validates the tag/version, audits and tests, and saves the validated tarball as an artifact.
4. Publication downloads that same artifact and uses npm provenance. Stable versions go to `latest`; prereleases go to `next`. A matching already-published tarball is skipped; a different artifact at the same version fails instead of overwriting. A GitHub Release includes the tarball after successful publication.

The first release prepared by this change is **0.1.3**. Do not advertise npm installation as working until the registry confirms the publish. A failed tag publication can be rerun from Actions after correcting credentials; do not reuse a version for changed package contents. The workflow does not bypass main's required approval.
