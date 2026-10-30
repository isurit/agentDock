import { realpathSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
export function prepareDataDirectory(path: string): string {
  if (!isAbsolute(path)) throw new Error('App data directory must be absolute');
  // Check ancestors before creating anything; resolve symlinked existing ancestors too.
  let ancestor = path;
  while (!existsSync(ancestor)) { const parent = dirname(ancestor); if (parent === ancestor) break; ancestor = parent; }
  let cursor = realpathSync(ancestor);
  for (;;) {
    if (existsSync(join(cursor, '.git'))) throw new Error('Runtime data must be outside Git repositories');
    const parent = dirname(cursor); if (parent === cursor) break; cursor = parent;
  }
  mkdirSync(path, { recursive: true, mode: 0o700 });
  return realpathSync(path);
}
