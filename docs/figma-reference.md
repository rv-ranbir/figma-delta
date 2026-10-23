# Set up a Figma reference

Figma Delta compares a running application with a fixed design reference. Configure the exact route, viewport and ready selector before starting a repair session.

## Local PNG export

1. Export the exact Figma frame at **1×** with its full bounds.
2. Save it as `design/reference.png` inside the target application.
3. Set the screen's `reference` to that project-relative path and leave `figmaUrl` absent.
4. Supply known expected bounds/styles in `regions` for element-level checks.

The PNG dimensions must equal the configured viewport. A screenshot does not provide inspectable layer properties; exact CSS comparisons need structured design values or explicit expectations.

## Official Figma MCP

Connect the [official Figma integration](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/) in the host agent. Reuse an existing connection instead of installing a duplicate.

The host agent can obtain design context, screenshots, assets, variables and Code Connect mappings through that integration. Figma Delta supplies browser measurements and comparison tools. The host agent coordinates them; this server does not proxy Figma OAuth credentials or call another MCP server directly.

Use the same local PNG workflow when saving a screenshot supplied by the host. Use structured context to populate selector mappings and known expected properties.

## REST snapshots

Set the screen's `figmaUrl` to a frame link containing a node ID. Set `FIGMA_ACCESS_TOKEN` in the terminal environment with `file_content:read` and access to that file, then run from the toolkit source checkout:

```bash
node src/cli.js sync --project ../my-app --screen desktop
```

For an npm installation, use `figma-delta sync` with the same arguments. See [Figma token documentation](https://developers.figma.com/docs/rest-api/authentication/) for credential setup.

Sync downloads a 1× reference, raw node data and a flattened manifest containing supported geometry, font, fill and layout properties. Exact frame dimensions are validated before replacing the reference. Figma account permissions and rate limits still apply.

The MCP process must inherit `FIGMA_ACCESS_TOKEN` to run `fidelity_sync`. Terminal sync is sufficient if you want verification to use the saved snapshot without passing a token to the agent. Never store tokens in project configuration or version control.

The REST snapshot preserves variable and asset references; use the official Figma integration for resolved variables, source asset exports and Code Connect context when needed.

## Map design nodes to elements

A region's `nodeId` maps a unique DOM selector to a node in the synced manifest. Explicit `rect` and `styles` override derived values before a session starts. Missing and ambiguous selectors fail rather than being guessed.

Figma positions do not establish CSS margins. Supply expected margins explicitly when known, and do not infer padding or gap from screenshots. If a design value conflicts with a required repository token or component pattern, report the conflict and retain the original reference until it is resolved.

## Keep comparisons reproducible

Use application fixtures for asynchronous data, timestamps and dynamic content. Keep fonts, theme, locale, timezone and viewport consistent. Provide separate reference frames for responsive layouts you want checked. Authentication state belongs in a local file excluded from version control.

Once a session starts, its reference and configuration are pinned. Do not resync, alter masks or weaken thresholds to improve a failing score. See [configuration](configuration.md) for session limits and capture options.
