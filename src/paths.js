import os from 'node:os';
import path from 'node:path';

export function resolveProject(value) {
  if (typeof value !== 'string' || !value.trim()) throw Error('Provide a non-empty project path');
  if (process.platform !== 'win32' && (/^[a-z]:/i.test(value) || value.startsWith('\\'))) {
    throw Error('Windows path supplied on this host. Use a native project path, for example ~/Projects/my-app.');
  }
  if (value === '~') return os.homedir();
  if (value.startsWith('~/') || (process.platform === 'win32' && value.startsWith('~\\'))) {
    return path.resolve(os.homedir(), value.slice(2));
  }
  return path.resolve(value);
}
