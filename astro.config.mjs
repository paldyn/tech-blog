import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://techblog.paldyn.com',
  integrations: [mdx(), sitemap()],
  markdown: {
    // 수식은 $$...$$ 만 인정한다. 단일 $를 켜면 기존 글의 가격 표기($15~30)나
    // MongoDB 연산자($where, $ne)가 수식으로 잘못 해석된다.
    remarkPlugins: [[remarkMath, { singleDollarTextMath: false }]],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark-dimmed',
      },
      wrap: true,
    },
  },
});
