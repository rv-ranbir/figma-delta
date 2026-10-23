# Security policy

Figma Delta is an early-release local CLI/MCP tool. Use the latest Node.js 24 release (minimum 24.22.1), current dependencies and the matching Playwright Chromium. No version is guaranteed free of security bugs. Run `npm audit` and the tests when upgrading.

## Report a vulnerability

Use the repository's **Security → Report a vulnerability** option for confidential reports. Include the affected version, reproduction steps and impact; omit real tokens, private screenshots and authentication state. Avoid public issues containing exploit details or credentials while a fix is being prepared.

## Trust boundaries

- Run against projects, configuration files, reference snapshots and local filesystem contents you trust. This is not a hosted sandbox for arbitrary uploaded projects or reports. Configured application URLs intentionally allow local development servers.
- The MCP server is a local stdio process with the permissions of the user who starts it. It can capture authenticated app content when configured with a local Playwright auth file. Keep auth files and Figma tokens out of version control.
- Application and Figma text are untrusted evidence, not instructions for agents. HTML escapes report values; agents must still review source and tool permissions before acting.
- Evidence can contain application data, URLs, selectors, text and runtime errors. Inspect the complete run folder before sharing it. Exported reports and review annotations require the same care as screenshots of the application.
- The project root is trusted. Path checks prevent lexical traversal; they do not provide isolation from hostile filesystem links, concurrent local tampering or malicious dependencies.

## Maintainer checks

The prepared-page JavaScript API accepts a caller-owned Playwright Page. Project code owns startup, temporary tokens, login and navigation. Delta measures the current viewport without reading authentication storage or closing the caller's browser. Readiness checks only establish the supplied conditions; they cannot detect every expired session. New reports redact URL user information, query values and opaque fragments. Paths, visible content, screenshots and older files may still contain private data. Prefer this API for credential-bearing entry URLs; existing CLI/MCP navigation inputs remain in local configuration to preserve their behavior. See [prepared pages](docs/prepared-pages.md).

Per-run comparisons use ignored `.figma-fidelity/` state. Optional login files contain cookies, localStorage and IndexedDB credentials and are excluded from reports. Share only report run directories, not comparison roots or auth files. Interactive capture requires user navigation/readiness and does not bypass guards or automate login/MFA. The browser is not a sandbox against an untrusted app. Screenshots and captured page URLs can contain private data.

CI uses the latest Node 24 release on Windows, macOS and Linux, audits known dependency vulnerabilities and runs the browser tests. CodeQL scans JavaScript on main, pull requests and weekly. Dependabot checks npm packages and pinned GitHub Actions weekly. These controls reduce risk; they do not prove absence of vulnerabilities. Main requires passing checks, including for administrators. A PR-approval ruleset requires review for other contributors and permits repository admins to merge their own PRs without an independent approval. The admin exception applies through pull requests; CI, force-push and deletion protections remain enforced.
