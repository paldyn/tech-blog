#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/content/posts';
const files = readdirSync(dir).filter(f => f.endsWith('.md'));

const LANG_INDENT = { javascript: 2, typescript: 2, json: 2, ts: 2, js: 2, tsx: 2, jsx: 2, python: 4, py: 4, java: 4 };
const issues = [];

for (const file of files) {
  const path = join(dir, file);
  const lines = readFileSync(path, 'utf8').split('\n');
  let inBlock = false;
  let lang = '';
  let blockStart = 0;
  let blockLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      if (!inBlock) {
        inBlock = true;
        lang = fence[1];
        blockStart = i + 1;
        blockLines = [];
      } else {
        // close block — analyze
        const fileIssues = [];
        if (!lang) fileIssues.push(`L${blockStart}: 언어 미지정`);

        // trailing whitespace
        const trailing = blockLines.filter(l => /\s+$/.test(l)).length;
        if (trailing > 0) fileIssues.push(`L${blockStart}: 후행 공백 ${trailing}줄`);

        // consecutive blank lines >2
        let consecutiveBlanks = 0, maxBlanks = 0;
        for (const l of blockLines) {
          if (l.trim() === '') { consecutiveBlanks++; maxBlanks = Math.max(maxBlanks, consecutiveBlanks); }
          else consecutiveBlanks = 0;
        }
        if (maxBlanks >= 2) fileIssues.push(`L${blockStart}: 연속 빈줄 ${maxBlanks}`);

        // long lines
        const longLines = blockLines.filter(l => l.length > 100).length;
        if (longLines > 0) fileIssues.push(`L${blockStart}: 100자 초과 ${longLines}줄`);

        // tab vs space mix
        const hasTabs = blockLines.some(l => /^\t/.test(l));
        const hasSpaceIndent = blockLines.some(l => /^  +\S/.test(l));
        if (hasTabs && hasSpaceIndent) fileIssues.push(`L${blockStart}: 탭/스페이스 혼용`);

        // indent consistency for known langs
        if (lang && LANG_INDENT[lang.toLowerCase()]) {
          const expected = LANG_INDENT[lang.toLowerCase()];
          const indentSizes = new Set();
          for (const l of blockLines) {
            const m = l.match(/^( +)\S/);
            if (m) indentSizes.add(m[1].length);
          }
          // detect indent unit (smallest non-zero)
          if (indentSizes.size > 0) {
            const sizes = [...indentSizes].sort((a,b)=>a-b);
            const unit = sizes[0];
            if (unit && unit !== expected && unit !== expected * 2) {
              fileIssues.push(`L${blockStart}: 들여쓰기 ${unit}칸 (예상 ${expected}칸, lang=${lang})`);
            }
          }
        }

        if (fileIssues.length) issues.push({ file, lang, fileIssues });
        inBlock = false;
        lang = '';
      }
      continue;
    }
    if (inBlock) blockLines.push(line);
  }
}

if (issues.length === 0) {
  console.log('✓ 모든 코드 블록 양호');
} else {
  console.log(`총 ${issues.length}개 블록 이슈 (${new Set(issues.map(i=>i.file)).size}개 파일)\n`);
  let lastFile = '';
  for (const { file, lang, fileIssues } of issues) {
    if (file !== lastFile) { console.log(`\n● ${file}`); lastFile = file; }
    for (const msg of fileIssues) console.log(`  [${lang||'?'}] ${msg}`);
  }
}
