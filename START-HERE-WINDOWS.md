# Windows setup

Install the latest Node.js 24 release (minimum 24.22.1) and Git. Open PowerShell in the folder where you want to keep the toolkit:

```powershell
git clone https://github.com/rv-ranbir/figma-delta.git
cd figma-delta
npm ci
npm run setup
npm run doctor
npm run demo
```

The demo prints before/after report locations. Its deliberate layout errors should fail, and the known fixture correction should pass.

From the toolkit folder, initialize a running application. Replace `../my-app`, the route and dimensions with your own:

```powershell
node src/cli.js init --project ../my-app --url http://localhost:3000 --width 1440 --height 900
```

Supply the reference and mappings described in the [quick start](README.md#quick-start). Open the application in Cursor and reload MCP tools if you want agent-assisted implementation. CLI verification works without Cursor.

Windows is covered by native CI. See [validation](VALIDATION.md) and [configuration](docs/configuration.md) for coverage and options.
