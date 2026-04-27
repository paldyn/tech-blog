#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = join(__dirname, '../src/content/posts');
const ASSETS_DIR = join(__dirname, '../public/assets/posts');

let errors = 0;
let warnings = 0;

function error(file, msg) {
  console.error(`  ERROR [${file}]: ${msg}`);
  errors++;
}

function warn(file, msg) {
  console.warn(`  WARN  [${file}]: ${msg}`);
  warnings++;
}

function checkFrontmatter(file, content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) { error(file, 'frontmatter missing'); return null; }
  const fm = fmMatch[1];
  const required = ['title', 'description', 'author', 'pubDate',
                    'archiveOrder', 'type', 'category', 'tags'];
  for (const field of required) {
    if (!fm.includes(`${field}:`)) error(file, `missing frontmatter field: ${field}`);
  }
  return fm;
}

function checkCodeBlock(file, content) {
  if (!/```\w/.test(content)) {
    error(file, 'no fenced code block with language identifier found');
  }
}

function checkSvgImages(file, content) {
  const svgRefs = [...content.matchAll(/!\[.*?\]\((\/assets\/posts\/[^)]+\.svg)\)/g)];
  for (const m of svgRefs) {
    const svgPath = join(__dirname, '../public', m[1]);
    if (!existsSync(svgPath)) {
      error(file, `SVG not found: ${m[1]}`);
    }
  }
}

const files = readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
if (files.length === 0) {
  console.error('No markdown files found in', POSTS_DIR);
  process.exit(1);
}

console.log(`\nValidating ${files.length} post(s) in ${POSTS_DIR}\n`);

for (const filename of files) {
  const filepath = join(POSTS_DIR, filename);
  const content = readFileSync(filepath, 'utf-8');
  console.log(`  Checking: ${filename}`);
  checkFrontmatter(filename, content);
  checkCodeBlock(filename, content);
  checkSvgImages(filename, content);
}

console.log(`\n${'─'.repeat(50)}`);
if (errors === 0) {
  console.log(`\n✅  OK — ${files.length} post(s) validated, 0 errors, ${warnings} warnings\n`);
} else {
  console.log(`\n❌  FAIL — ${errors} error(s), ${warnings} warning(s)\n`);
  process.exit(1);
}
