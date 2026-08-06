#!/usr/bin/env node
// Cross-platform syntax check for all backend source files.
//
// Replaces the previous `find src -name '*.js' | xargs node --check` build
// step, which relied on POSIX tools and did not run on Windows shells. Walks
// src/ and runs `node --check` on each .js/.mjs file.

import { readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '..', 'src');

function listJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listJsFiles(full));
    } else if (full.endsWith('.js') || full.endsWith('.mjs')) {
      out.push(full);
    }
  }
  return out;
}

const files = listJsFiles(SRC_DIR);
let failed = 0;

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    failed += 1;
    console.error(`✖ Syntax error in ${file}`);
    if (error.stderr) {
      console.error(error.stderr.toString().trim());
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} file(s) failed the syntax check.`);
  process.exit(1);
}

console.log(`✔ Syntax check passed for ${files.length} file(s).`);
