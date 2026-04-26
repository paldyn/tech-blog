import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const POSTS_DIR = new URL('../src/content/posts/', import.meta.url).pathname;

async function validatePost(filePath) {
  const content = await readFile(filePath, 'utf8');
  const errors = [];

  // Check for frontmatter
  if (!content.startsWith('---')) {
    errors.push('Missing frontmatter');
  }

  // Check for code block
  if (!content.includes('```')) {
    errors.push('Missing code block (at least one required)');
  }

  // Check for required frontmatter fields
  const required = ['title:', 'description:', 'pubDate:', 'category:', 'tags:'];
  for (const field of required) {
    if (!content.includes(field)) {
      errors.push(`Missing frontmatter field: ${field}`);
    }
  }

  return errors;
}

async function main() {
  const files = await readdir(POSTS_DIR);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  let allOk = true;
  for (const file of mdFiles) {
    const errors = await validatePost(join(POSTS_DIR, file));
    if (errors.length > 0) {
      console.error(`✗ ${file}: ${errors.join(', ')}`);
      allOk = false;
    } else {
      console.log(`✓ ${file}`);
    }
  }

  if (!allOk) process.exit(1);
  console.log('\nOK — all posts valid');
}

main().catch(err => { console.error(err); process.exit(1); });
