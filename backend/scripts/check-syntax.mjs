import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

function collectJavaScriptFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectJavaScriptFiles(fullPath));
      continue;
    }

    if (extname(entry) === '.js') {
      files.push(fullPath);
    }
  }

  return files;
}

const files = collectJavaScriptFiles('src');

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}