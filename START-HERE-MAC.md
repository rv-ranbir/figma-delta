# macOS setup

Native Mac execution is still unverified. This checkout was validated on Windows x64; the CI matrix has been prepared but has not run.

Install the latest Node.js 24 (minimum 24.22.1) for your Mac architecture. Put the toolkit at `~/Projects/figma-toolkit`, with `package.json` directly inside it. Copy source files, not Windows `node_modules` or browser binaries.

```sh
cd "$HOME/Projects/figma-toolkit"
npm ci
npm run setup
npm run doctor
npm test
npm run demo
```

Doctor must launch Chromium and decode a 320×200 screenshot. All 19 tests should pass; the demo should detect the broken layout and pass its corrected layout. Record actual results in VALIDATION.md, including macOS version and Apple Silicon or Intel architecture.

To run the supplied live-Figma fixture:

```sh
npm run sample
```

Open `http://127.0.0.1:4177`. In another terminal in the toolkit directory:

```sh
npm run sample:check -- begin
```

The fresh fixture intentionally has four CSS errors, so this command should return visual failure (exit 1). Follow `examples/figma-sample/README.md` to repair the generated sample, then verify with the same session. A previously repaired sample is preserved between starts.

For a real app, use a native Mac path:

```sh
node src/cli.js init --project "$HOME/Projects/my-app" --url "http://localhost:3000" --width 1440 --height 900
```

Open that application in Cursor and reload MCP tools. The generated command uses your Mac's Node and local toolkit path. If moving an initialized app from Windows, edit only its `figma-fidelity` entry in `.cursor/mcp.json` to use the Mac paths; rerunning init intentionally refuses to overwrite existing setup.

Keep Figma PNG dimensions and the configured viewport identical. Cross-platform font rasterization can produce residual pixel differences; never replace the reference or loosen checks during repair to force a pass.
