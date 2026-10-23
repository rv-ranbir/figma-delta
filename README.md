# Figma Delta

**From design differences to actionable fixes.**

Compare Figma designs with a running web application. Review exact property differences, inspect visual evidence, and hand structured findings to developers or AI agents.

[![Native validation](https://github.com/rv-ranbir/figma-delta/actions/workflows/ci.yml/badge.svg)](https://github.com/rv-ranbir/figma-delta/actions/workflows/ci.yml)
[![CodeQL](https://github.com/rv-ranbir/figma-delta/actions/workflows/codeql.yml/badge.svg)](https://github.com/rv-ranbir/figma-delta/actions/workflows/codeql.yml)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-417E38?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Installation](#installation) · [Quick start](#quick-start) · [Reports](#reports) · [AI workflows](#ai-workflows) · [Documentation](#documentation)

## Built for the design-to-development loop

| For | What you get |
| --- | --- |
| **QA** | Expected-versus-actual values, affected-area comparisons, review decisions, severity, notes and reviewed JSON exports |
| **Developers** | Element selectors, Figma node mappings and measured differences in color, typography, geometry and spacing |
| **AI agents** | Compact JSON, stable finding IDs, evidence paths and bounded verification sessions |

- **Measure properties.** Compare mapped text colors, backgrounds, fonts, padding, margins and layout gaps.
- **Normalize colors.** Convert supported CSS color formats to shared extended sRGB, preserving alpha and converted wide-gamut channels.
- **Work with existing projects.** The agent workflow follows applicable repository instructions, relevant skills and available MCP tools, and reuses existing components and design tokens.
- **Keep repair bounded.** Pin the reference and configuration, verify changes against the same session, and stop at the configured limit.
- **Run locally.** CLI and report generation require no AI API key. The toolkit measures; your developer or connected agent makes source changes.

## Installation

Requires the latest **Node.js 24**, minimum **24.22.1**. Chromium is installed explicitly during setup. Windows, macOS and Linux are covered by native CI.

### From source

```bash
git clone https://github.com/rv-ranbir/figma-delta.git
cd figma-delta
npm ci
npm run setup
npm run doctor
```

Try the self-contained demonstration:

```bash
npm run demo
```

The demo detects deliberate layout errors, applies a known fixture correction and prints before/after report locations. It does not call an AI model or require a Figma account.

### From npm

The npm release pipeline is prepared; these commands become available after the first package publication:

```bash
npm install -g figma-delta
figma-delta setup
figma-delta doctor
```

Use a persistent installation for Cursor integrations. The generated MCP configuration references the installed package and Node executable; update those paths if you move the installation or change Node installations.

## Quick start

The following commands run from the source checkout. Replace `../my-app` with your application's folder and use its actual route and reference dimensions. Start the application using its own development or preview command.

**1. Initialize the application**

```bash
node src/cli.js init --project ../my-app --url http://localhost:3000/dashboard --width 1440 --height 900
```

This creates `fidelity.config.json`, a Cursor skill and rule, and an MCP entry. Existing integrations are preserved; an existing fidelity setup is never overwritten silently.

**2. Supply a reference**

Export the exact Figma frame as a **1× PNG** to `design/reference.png` inside the application. Its dimensions must match the configured viewport. Alternatively, configure a Figma frame URL and use the [REST snapshot workflow](docs/figma-reference.md).

**3. Map the elements you want to check**

Add selectors and expected properties to the screen's `regions` in `fidelity.config.json`. For example:

```json
{
  "name": "page-title",
  "selector": "[data-testid=page-title]",
  "styles": {
    "color": "#182238",
    "fontSize": "32px",
    "marginTop": "12px"
  }
}
```

A synced Figma `nodeId` can provide supported design properties. A PNG provides visual evidence; exact property comparisons need structured design values or explicit expectations.

**4. Run a comparison**

```bash
node src/cli.js check --project ../my-app --screen desktop --format html
```

Open the printed `report.html` location to review findings. For an npm installation, use `figma-delta` in place of `node src/cli.js`.

## Reports

| Format | Best for | Output |
| --- | --- | --- |
| `simple` — default | Fast triage and agent handoff | Lightweight static HTML with every finding, its relevant JSON and linked screenshots |
| `html` | Interactive QA review | Searchable findings, property tables, affected-area evidence, decisions, notes and handoff actions |
| `json` | Automation | Compact machine-readable differences without generating HTML |

Every run saves `result.json` plus detailed measurements and screenshot evidence. Interactive review changes stay in the browser tab until exported. Share the **complete run folder** so evidence images remain available.

An illustrative finding from compact JSON:

```json
{
  "category": "style",
  "region": "page-title",
  "selector": "[data-testid=page-title]",
  "property": "marginTop",
  "expected": 12,
  "actual": 24,
  "unit": "px",
  "delta": 12
}
```

See the [findings format](docs/findings-format.md) for comparison rules, coverage and review exports.

## AI workflows

After initialization, open the application in Cursor, reload MCP tools and invoke `/figma-fidelity` with a frame link and target route. The workflow directs the agent to:

1. Read applicable repository instructions, scoped rules and relevant existing skills.
2. Reuse connected MCP capabilities, shared components, tokens, icons and styling patterns.
3. Set up the reference and element mappings, then implement and verify changes.
4. Surface conflicts between the design and repository conventions rather than silently overriding either.
5. Keep the same verification session and report unresolved differences when its budget stops.

Figma Delta does not call another MCP server or edit source itself; the host agent coordinates those actions. Instruction compliance still depends on the host agent. QA can use the CLI independently of Cursor.

Existing names—`fidelity.config.json`, `.figma-fidelity/`, `/figma-fidelity` and the `fidelity_*` MCP tools—remain for compatibility.

## Scope and limits

A pass means the **configured checks passed**. Pixel differences do not establish root cause or severity, and exact style checks cover mapped elements. Functional behavior, accessibility and unsupplied responsive designs require their own tests.

Capture conditions, reference dimensions and fixture data must be consistent. Font rasterization may vary across platforms. References, masks and thresholds stay fixed during a repair session; stopped budgets are not silently reset.

## Documentation

| Guide | Contents |
| --- | --- |
| [Configuration and CLI/MCP reference](docs/configuration.md) | Screens, selectors, styles, capture settings, commands and repair limits |
| [Figma references](docs/figma-reference.md) | Local PNG exports, official Figma MCP and optional REST snapshots |
| [Findings and JSON](docs/findings-format.md) | Expected/actual values, evidence, color normalization and QA review |
| [Validation](VALIDATION.md) | Platform coverage, packaged-consumer checks and benchmark limitations |
| [Contributing](CONTRIBUTING.md) | Development setup, checks and pull requests |
| [Distribution and releases](docs/distribution.md) | Package delivery and maintainer release setup |
| [Security policy](SECURITY.md) | Trust boundaries and confidential vulnerability reports |

## License

[MIT](LICENSE) © rv-ranbir
