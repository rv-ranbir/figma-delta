# Validation

## Automated coverage

Native GitHub Actions jobs validate Windows, macOS and Ubuntu using the latest Node.js 24 release. The current minimum is 24.22.1; Playwright is pinned to 1.64.1 with its matching Chromium.

| Check | Coverage |
| --- | --- |
| Runtime health | Launch Chromium, capture a screenshot and decode it with Sharp |
| Regression suite | 37 tests covering image differences, masks, dimensions, geometry, styles, Figma API handling, installation, MCP and repair-session limits |
| Packaged consumer | Install the npm tarball into a fresh project; verify CLI resolution, browser setup, templates, generated MCP startup, report generation, mismatch detection and correction |
| Dependency security | Audit both the development checkout and the fresh consumer installation |
| Source analysis | CodeQL JavaScript security analysis |

Windows, macOS and Linux checks passed for the npm-distribution implementation. Check [Actions](https://github.com/rv-ranbir/figma-delta/actions) for the result of a particular commit; historical success does not establish that a later change passes.

## Deterministic demonstrations

`npm run demo` starts its own local fixture, captures a reference, detects deliberate layout errors, applies a known correction and verifies again. It does not call an AI model or require a Figma account.

The [Figma-backed sample](https://github.com/rv-ranbir/figma-delta/tree/main/examples/figma-sample) includes a fixed exported frame and an intentionally incorrect application. A recorded Windows run improved from 23 failed checks and 6.3257% global mismatch to no configured failures and 0.8418% mismatch after four CSS corrections. Its reference and comparison settings remained fixed.

These demonstrations verify the measurement workflow; they are not evidence of universal autonomous repair or pixel identity.

## Complex-design benchmark

A recorded Cursor implementation and repair run used a 1920×1732 dashboard frame with 683 descendant nodes. Five captures measured global mismatches of 2.2588%, 2.1644%, 1.9488%, 1.8804% and 2.0549%. Regional checks still failed, and the original session stopped at its five-capture limit.

Independent build and tested search/checkbox behavior passed. A final source revert was not visually remeasured. See the [benchmark summary](https://github.com/rv-ranbir/figma-delta/blob/main/CURSOR-BENCHMARK.md) for interpretation; private application captures and local agent sessions are not part of the distributed package.

## Security interpretation

The recorded Node 24.22.1 checks reported zero known dependency vulnerabilities. A focused source review found no actionable issue under the trusted-local-project threat model. CodeQL's intentional reference-download finding was reviewed and dismissed as a false positive; the query remains enabled.

Audits and analysis are time-dependent and do not guarantee absence of vulnerabilities. See [SECURITY.md](SECURITY.md) for trust boundaries and reporting.

## Limits

Visual checks cover only configured screens and mapped properties. They do not certify functional behavior, accessibility, asset identity or unsupplied responsive layouts. Font rendering, fixtures and capture conditions can affect results. A stopped repair session is not restarted automatically, and a visual pass cannot replace the application's own test suite.
