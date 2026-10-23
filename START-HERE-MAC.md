# macOS setup

Install the latest Node.js 24 release (minimum 24.22.1) and Git for your architecture. Open a terminal in the folder where you want to keep the toolkit:

```bash
git clone https://github.com/rv-ranbir/figma-delta.git
cd figma-delta
npm ci
npm run setup
npm run doctor
npm run demo
```

Install dependencies and Chromium on the Mac itself; do not copy another machine's node_modules or browser binaries. Doctor must launch Chromium and decode a screenshot. The demo should detect the deliberately broken fixture and pass its correction.

From the toolkit folder, initialize a running application. Replace `../my-app`, the route and dimensions with your own:

```bash
node src/cli.js init --project ../my-app --url http://localhost:3000 --width 1440 --height 900
```

Follow the [quick start](README.md#quick-start) to provide a reference and element mappings. For Cursor, open the application and reload MCP tools. If you move an initialized project between machines, update its generated MCP command and installation path; init intentionally refuses to overwrite an existing setup.

macOS is covered by native CI. Platform-specific font rasterization can still affect pixel comparisons. Keep the reference and configured checks fixed during repair. See [validation](VALIDATION.md) for scope.
