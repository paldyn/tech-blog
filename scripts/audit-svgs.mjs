#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'public/assets/posts';
const files = readdirSync(dir).filter(f => f.endsWith('.svg'));

const ALLOWED_BG = ['#0a0a0a', '#000000', '#000'];
const RECOMMENDED_WIDTH = 880;
const CODE_HINT_RE = /^[\s]*(function|const|let|var|return|if|for|while|class|def|import|<\w|\{|\}|\(|\)|=>|=\s|;\s*$)/;

const report = [];
for (const f of files) {
  const p = join(dir, f);
  const src = readFileSync(p, 'utf8');
  const issues = [];

  // svg root
  const svgTag = src.match(/<svg[^>]*>/);
  if (!svgTag) { issues.push('svg root tag not found'); report.push({ f, issues }); continue; }
  const tag = svgTag[0];

  // Detect duplicate font-family attrs inside any single tag (XML invalid)
  const dupFf = [...src.matchAll(/<\w+\b([^>]*)>/g)].filter(m => (m[1].match(/font-family\s*=/g) || []).length > 1);
  if (dupFf.length) issues.push(`font-family 중복 ${dupFf.length}건 (XML invalid 가능성)`);

  // Detect unescaped & not part of an entity (e.g., &amp; &lt; &#123;), excluding XML comments
  const noComments = src.replace(/<!--[\s\S]*?-->/g, '');
  const badAmps = (noComments.match(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g) || []).length;
  if (badAmps > 0) issues.push(`이스케이프 안 된 & ${badAmps}건 (→ &amp; 로 교체)`);

  if (!/xmlns=/.test(tag)) issues.push('xmlns 누락');
  if (!/viewBox=/.test(tag)) issues.push('viewBox 누락');

  const widthMatch = tag.match(/\bwidth="(\d+)"/);
  const w = widthMatch ? parseInt(widthMatch[1], 10) : null;
  if (w !== RECOMMENDED_WIDTH) issues.push(`width=${w ?? '없음'} (권장 ${RECOMMENDED_WIDTH})`);

  // background
  const firstRect = src.match(/<rect[^>]*\bfill="([^"]+)"[^>]*\/?>/);
  if (firstRect) {
    const bg = firstRect[1].toLowerCase();
    if (!ALLOWED_BG.includes(bg)) issues.push(`첫 rect 배경 ${bg} (권장 #0a0a0a)`);
  } else {
    issues.push('배경 rect 없음');
  }

  // font-family on root
  const styleAttr = tag.match(/style="([^"]*)"/);
  const hasFontOnRoot = styleAttr && /font-family/i.test(styleAttr[1]);
  const hasFontAnywhere = /font-family\s*=\s*"|font-family\s*:/i.test(src);
  if (!hasFontAnywhere) issues.push('font-family 미지정');

  // text overflow check (rough): find text x positions exceeding width
  if (w) {
    const texts = [...src.matchAll(/<text[^>]*\bx="(\d+(?:\.\d+)?)"[^>]*>([^<]*)<\/text>/g)];
    const overflow = texts.filter(([, x]) => parseFloat(x) > w - 8);
    if (overflow.length) issues.push(`text x좌표 캔버스 초과 ${overflow.length}건`);
  }

  // code-like text using non-mono font
  const texts = [...src.matchAll(/<text\b([^>]*)>([^<]+)<\/text>/g)];
  const codeTexts = texts.filter(([, attrs, content]) => {
    if (!CODE_HINT_RE.test(content)) return false;
    // skip if font-family explicitly set to mono on this text
    if (/font-family\s*=\s*"[^"]*(?:mono|courier|menlo|consolas|jetbrains|fira)/i.test(attrs)) return false;
    // skip if styled mono
    if (/style="[^"]*font-family\s*:[^";]*(?:mono|courier|menlo|consolas|jetbrains|fira)/i.test(attrs)) return false;
    return true;
  });
  if (codeTexts.length) issues.push(`코드형 텍스트 ${codeTexts.length}개에 monospace 미적용`);

  if (issues.length) report.push({ f, issues });
}

if (!report.length) { console.log('✓ 모든 SVG 양호'); process.exit(0); }
console.log(`총 ${report.length}/${files.length}개 SVG 이슈\n`);
for (const { f, issues } of report) {
  console.log(`● ${f}`);
  for (const i of issues) console.log(`  - ${i}`);
}
