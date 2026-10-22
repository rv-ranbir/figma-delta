# Start here

Extract the archive so the toolkit is at **D:\Projects\figma-toolkit**.

In PowerShell:

```powershell
Set-Location D:\Projects\figma-toolkit
npm ci
npm run setup
npm run doctor
npm test
npm run demo
```

The demo prints HTML report paths. Open the before/after reports to see deliberate layout errors detected and the corrected fixture pass.

To attach to your real application, replace the example path below:

```powershell
node .\src\cli.js init --project "D:\Projects\my-react-app" --url "http://localhost:3000" --width 1440 --height 900
```

Open that application in Cursor. Connect the official Figma plugin/MCP once, then invoke `/figma-fidelity` with a frame link and target route. Cursor can fill the config, obtain the reference, implement and run the bounded repair loop. Read README.md for the two reference routes and exact node-to-selector checks.

The toolkit captures, compares and reports; Cursor edits your source code. It needs access to the Figma reference and the running app. Your existing Cursor tool permissions still apply.

The local checkout at this path has been validated on Windows x64. Run `npm run sample` to start the supplied Figma-backed test application at `http://127.0.0.1:4177`; see `examples/figma-sample/README.md` for the edit/verify exercise. Validation details and remaining Mac/Cursor checks are in VALIDATION.md.
