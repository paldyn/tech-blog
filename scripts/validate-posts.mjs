#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const POSTS_DIR = new URL('../src/content/posts/', import.meta.url).pathname;

let ok = 0;
let errors = 0;

const files = readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));

for (const file of files) {
    const content = readFileSync(join(POSTS_DIR, file), 'utf8');
    const issues = [];

    // Check frontmatter exists
    if (!content.startsWith('---')) {
        issues.push('missing frontmatter');
    }

    // Check required frontmatter fields
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
        const fm = fmMatch[1];
        for (const field of ['title', 'description', 'author', 'pubDate', 'archiveOrder', 'type', 'category']) {
            if (!fm.includes(field + ':')) {
                issues.push(`missing frontmatter field: ${field}`);
            }
        }
    }

    // Check code blocks
    const codeBlockMatches = content.match(/```\w+/g);
    if (!codeBlockMatches || codeBlockMatches.length === 0) {
        issues.push('no code blocks with language identifier');
    }

    // Check SVG image references
    const imgMatches = content.match(/!\[.*?\]\(\/assets\/posts\/.*?\.svg\)/g);
    if (!imgMatches || imgMatches.length === 0) {
        issues.push('no SVG image references');
    } else {
        // Check SVG files exist
        for (const img of imgMatches) {
            const svgPath = img.match(/\((.+?)\)/)[1];
const resolvedPath = join(
                new URL('..', import.meta.url).pathname,
                'public',
                svgPath
            );
            try {
                readFileSync(resolvedPath);
            } catch {
                issues.push(`SVG file not found: ${svgPath}`);
            }
        }
    }

    if (issues.length > 0) {
        console.error(`✗ ${file}`);
        for (const issue of issues) {
            console.error(`  - ${issue}`);
        }
        errors++;
    } else {
        console.log(`✓ ${file}`);
        ok++;
    }
}

console.log(`\n${ok} OK, ${errors} errors`);
if (errors > 0) process.exit(1);
