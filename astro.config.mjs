import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// GitHub Pages 배포 설정:
// - 사용자/조직 페이지 (username.github.io): site만 설정, base는 제거.
// - 프로젝트 페이지 (username.github.io/repo-name): site + base 둘 다 설정.
export default defineConfig({
  site: 'https://paldyn.github.io',
  base: '/tech-blog',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark-dimmed',
      },
      wrap: true,
    },
  },
});
