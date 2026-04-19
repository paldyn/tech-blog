# Paldyn.Tech

마크다운으로 쓰는 기술 블로그. Astro + GitHub Pages.

## 개발

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/ 에 정적 빌드
npm run preview  # 빌드 결과 로컬 미리보기
```

## 새 글 쓰기

`src/content/posts/` 아래에 `.md` 또는 `.mdx` 파일 추가.

```markdown
---
title: "제목"
description: "짧은 요약"
author: "작성자 이름"
pubDate: 2026-04-18
type: "record"         # "record" | "knowledge"
category: "Backend"      # 자유 입력 (예: Backend, Infra, Platform, Data-Infra ...)
tags: ["ts", "node"]
featured: false          # 홈 히어로로 띄울지
draft: false             # true면 숨김
thumbVariant: "a"        # a~f 중 그라데이션 색
heroGradient: "..."      # featured 글의 히어로 배경 (선택)
---

본문...
```

`type` 기준 페이지:
- `record` → `/records`
- `knowledge` → `/knowledge`
- 기록형 카테고리/태그 → `/records/categories`, `/records/tags`
- 지식형 카테고리/태그 → `/knowledge/categories`, `/knowledge/tags`
- 통합 아카이브(기록+지식) → `/posts`

## 배포

`main` 브랜치에 푸시하면 `.github/workflows/deploy.yml` 이 자동으로 빌드 후 GitHub Pages에 올립니다.

**저장소 설정**: GitHub 저장소 → Settings → Pages → Source를 **GitHub Actions** 로 변경.

**도메인 설정**:
- `astro.config.mjs` 의 `site`를 실제 운영 도메인으로 설정
- 루트 도메인 경로로 배포할 경우(`https://techblog.paldyn.com`) `base`는 설정하지 않음
- GitHub Pages 커스텀 도메인은 `public/CNAME`에 도메인을 기록

## 구조

```
src/
├── components/   # Header, Footer, PostCard, FeaturedPost, SideItem
├── content/
│   └── posts/    # 마크다운 글
├── layouts/      # BaseLayout, PostLayout
├── pages/
│   ├── index.astro
│   ├── about.astro
│   ├── posts/
│   └── categories/
├── styles/       # global.css
├── utils/        # posts.ts (리딩 타임, URL 등)
└── consts.ts     # 사이트 메타, 네비
```
