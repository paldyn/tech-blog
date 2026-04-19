import { promises as fs } from 'node:fs';
import path from 'node:path';

const POSTS_DIR = path.resolve(process.cwd(), 'src/content/posts');
const POST_EXTS = new Set(['.md', '.mdx']);

const IMAGE_PATTERN = /!\[[^\]]*]\(([^)]+)\)|<img\s+[^>]*src=/i;
const CODE_OR_DIAGRAM_PATTERN = /```[\s\S]*?```/;
const FRONTMATTER_PATTERN = /^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*/;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (entry.isFile() && POST_EXTS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function stripFrontmatter(content) {
  return content.replace(FRONTMATTER_PATTERN, '');
}

function relative(filePath) {
  return path.relative(process.cwd(), filePath);
}

async function main() {
  const files = await walk(POSTS_DIR);
  const violations = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const body = stripFrontmatter(content);

    const hasImage = IMAGE_PATTERN.test(body);
    const hasCodeOrDiagram = CODE_OR_DIAGRAM_PATTERN.test(body);

    if (!hasImage || !hasCodeOrDiagram) {
      violations.push({
        file: relative(file),
        missingImage: !hasImage,
        missingCodeOrDiagram: !hasCodeOrDiagram,
      });
    }
  }

  if (violations.length === 0) {
    console.log(`validate:posts OK (${files.length}개 글 검사 완료)`);
    return;
  }

  console.error('validate:posts 실패');
  console.error('모든 글은 이미지 1개 이상 + 코드/도식 블록 1개 이상을 포함해야 합니다.');

  for (const violation of violations) {
    const missing = [];
    if (violation.missingImage) missing.push('이미지');
    if (violation.missingCodeOrDiagram) missing.push('코드/도식 블록');
    console.error(`- ${violation.file}: ${missing.join(', ')} 누락`);
  }

  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
