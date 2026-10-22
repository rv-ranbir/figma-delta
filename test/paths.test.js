import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

test('project paths expand the home folder and preserve spaces and Unicode', async () => {
  const { resolveProject } = await import('../src/paths.js');
  assert.equal(resolveProject('~/Projects/Fidelity 测试'), path.join(os.homedir(), 'Projects', 'Fidelity 测试'));
  assert.equal(resolveProject('~'), os.homedir());
  assert.equal(resolveProject('fixture app'), path.resolve('fixture app'));
  assert.throws(() => resolveProject(''), /project path/i);
});

test('non-Windows hosts reject Windows paths instead of creating misleading folders', async () => {
  const { resolveProject } = await import('../src/paths.js');
  for (const value of ['D:\\Projects\\app', 'D:/Projects/app', 'D:app', '\\\\server\\share\\app', '\\Projects\\app']) {
    if (process.platform === 'win32') assert.equal(resolveProject(value), path.resolve(value));
    else assert.throws(() => resolveProject(value), /Windows path/);
  }
});
