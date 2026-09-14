import type { Root } from 'hast';
import rehypeSanitize, { type Options as SanitizeSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/*
 * AI output is untrusted. Raw HTML never enters HAST, and the generated tree is
 * filtered through this allowlist before it can reach innerHTML. Images are
 * deliberately excluded so an answer cannot make an unsolicited tracking request.
 */
const ANSWER_SCHEMA: SanitizeSchema = {
  ancestors: {
    tbody: ['table'],
    td: ['table'],
    th: ['table'],
    thead: ['table'],
    tr: ['table'],
  },
  attributes: {
    a: ['href', 'title'],
    code: [['className', /^language-./]],
    input: [['type', 'checkbox'], ['disabled', true], 'checked'],
    li: [['className', 'task-list-item']],
    ol: ['start', ['className', 'contains-task-list']],
    td: ['align'],
    th: ['align'],
    ul: [['className', 'contains-task-list']],
  },
  protocols: {
    href: ['http', 'https', 'mailto'],
  },
  required: {
    input: { disabled: true, type: 'checkbox' },
  },
  strip: ['script', 'style'],
  tagNames: [
    'a',
    'blockquote',
    'br',
    'code',
    'del',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'input',
    'li',
    'ol',
    'p',
    'pre',
    'strong',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'ul',
  ],
};

/** Add new-tab protections only after the URL has passed the sanitizer. */
function rehypeSafeLinkTargets() {
  return (tree: Root) => {
    const visit = (node: Root['children'][number] | Root) => {
      if (node.type === 'element') {
        if (node.tagName === 'a' && typeof node.properties.href === 'string') {
          node.properties.target = '_blank';
          node.properties.rel = ['noopener', 'noreferrer'];
        }
        for (const child of node.children) visit(child);
        return;
      }

      if ('children' in node) {
        for (const child of node.children) visit(child);
      }
    };

    visit(tree);
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  // allowDangerousHtml remains false: raw HTML from the model is discarded.
  .use(remarkRehype)
  .use(rehypeSanitize, ANSWER_SCHEMA)
  .use(rehypeSafeLinkTargets)
  .use(rehypeStringify);

export function renderAiMarkdown(markdown: string): string {
  return String(processor.processSync(markdown));
}
