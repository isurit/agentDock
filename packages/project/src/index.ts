import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
export async function registerPath(path: string): Promise<string> {
  if (!isAbsolute(path)) throw new Error('Absolute project path required');
  const canonical = await realpath(path);
  if (!(await stat(canonical)).isDirectory()) throw new Error('Project directory required');
  return canonical;
}
export async function within(root: string, path: string): Promise<string> {
  const [base, target] = await Promise.all([realpath(root), realpath(path)]);
  const rel = relative(base, target);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error('Outside project');
  return target;
}
export async function gitSnapshot(root: string) {
  const options = { cwd: root, timeout: 10000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' } };
  const { stdout: top } = await exec('git', ['rev-parse', '--show-toplevel'], options);
  if (await realpath(top.trim()) !== await realpath(root)) throw new Error('Register the Git root');
  const [{ stdout: status }, { stdout: diff }, { stdout: staged }] = await Promise.all([
    exec('git', ['-c', 'core.fsmonitor=false', 'status', '--porcelain=v1', '--untracked-files=normal'], options),
    exec('git', ['-c', 'core.fsmonitor=false', 'diff', '--no-ext-diff', '--no-textconv', '--'], options),
    exec('git', ['-c', 'core.fsmonitor=false', 'diff', '--cached', '--no-ext-diff', '--no-textconv', '--'], options),
  ]);
  return { status, diff, staged, untrackedContentsIncluded: false };
}
