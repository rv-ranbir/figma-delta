import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { sampleRoot } from './prepare-sample.js';

const action = process.argv[2];
if (!['begin', 'verify', 'report'].includes(action)) throw Error('Use npm run sample:check -- begin, then npm run sample:check -- verify after editing sample CSS. Use report to retrieve existing evidence without a new capture.');
const config = JSON.parse(await fs.readFile(path.join(sampleRoot, '.cursor', 'mcp.json'), 'utf8')).mcpServers['figma-fidelity'];
const transport = new StdioClientTransport({ ...config, stderr: 'pipe' });
const client = new Client({ name: 'fidelity-sample-validation', version: '1.0.0' });
const evidence = path.join(sampleRoot, 'evidence');
await fs.mkdir(evidence, { recursive: true });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 7);
  async function call(name, args) {
    const response = await client.callTool({ name, arguments: args });
    if (response.isError) throw Error(response.content[0].text);
    return response;
  }
  const project = JSON.parse((await call('fidelity_project', {})).content[0].text);
  assert.equal(project.project, sampleRoot);
  const sessionFile = path.join(evidence, 'session.json');
  const session = action === 'begin'
    ? JSON.parse((await call('fidelity_begin', { screen: 'desktop' })).content[0].text)
    : JSON.parse(await fs.readFile(sessionFile, 'utf8'));
  if (action === 'begin') await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
  const result = JSON.parse((await call(action === 'report' ? 'fidelity_report' : 'fidelity_verify', action === 'report' ? { screen: 'desktop' } : { screen: 'desktop', sessionId: session.id })).content[0].text);
  const stage = `iteration-${result.session.iteration}`;
  await fs.writeFile(path.join(evidence, `${stage}.json`), JSON.stringify(result, null, 2));
  await fs.copyFile(path.join(sampleRoot, 'styles.css'), path.join(evidence, `${stage}.css`));
  for (const image of ['reference', 'actual', 'diff', 'overlay']) {
    const response = await call('fidelity_image', { screen: 'desktop', image });
    const block = response.content.find(c => c.type === 'image');
    assert.ok(block, `Missing ${image} image`);
    const bytes = Buffer.from(block.data, 'base64');
    const info = await sharp(bytes).metadata();
    assert.equal(info.width, 960); assert.equal(info.height, 640);
    await fs.writeFile(path.join(evidence, `${stage}-${image}.png`), bytes);
  }
  const latest = JSON.parse((await call('fidelity_report', { screen: 'desktop' })).content[0].text);
  assert.equal(latest.pass, result.pass);
  if (result.session.status === 'passed') await assert.rejects(() => call('fidelity_verify', { screen: 'desktop', sessionId: session.id }), /Session has stopped/);
  console.log(JSON.stringify({ tools: tools.length, session: result.session, pass: result.pass,
    mismatchPercent: result.pixels.mismatchPercent, issues: result.issues, stoppedSessionRejected: result.session.status === 'passed', report: result.artifacts?.report ?? path.join(sampleRoot, '.figma-fidelity', 'runs', 'desktop', result.runId, 'report.html'), evidence }, null, 2));
  process.exitCode = result.pass ? 0 : 1;
} finally { await client.close(); }
