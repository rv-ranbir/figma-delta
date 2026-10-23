# Contributing

## Development setup

Use the latest Node.js 24 release, minimum 24.22.1. Install dependencies and Chromium from a source checkout:

```bash
git clone https://github.com/rv-ranbir/figma-delta.git
cd figma-delta
npm ci
npm run setup
npm run doctor
```

The source is ESM JavaScript with runtime schema validation; no compilation step is required. Install dependencies for your own operating system and architecture.

## Verify changes

```bash
npm test
npm run test:package
npm run demo
```

The regression suite uses browser fixtures and mocked Figma API responses. It does not invoke an AI model or access your Figma account. The package check installs a real tarball into a temporary consumer, audits its dependencies and verifies the installed CLI, templates, MCP and browser/report workflow. It requires network access for package installation and security auditing.

## Pull requests

Keep changes focused and describe the resulting behavior and relevant verification. Preserve existing user code and repository integrations. Include a regression check when it proves a meaningful behavior change.

Main requires native Windows, macOS and Linux validation plus CodeQL. Other contributors need approval; repository admins have the configured PR-review exception. The exception does not remove required checks or permit force pushes and branch deletion.

Do not commit credentials, authentication state, application captures or machine-specific paths in public documentation. Use relative example paths and fictional fixture data.

For package releases, see the [maintainer guide](docs/distribution.md#npm-release-setup). Report vulnerabilities through the [security policy](SECURITY.md).
