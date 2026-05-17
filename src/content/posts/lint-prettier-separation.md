---
title: "Prettier와 ESLint 역할 분리 — 포맷터와 린터 공존"
description: "Prettier와 ESLint의 근본적 역할 차이, eslint-config-prettier로 충돌 해소, Husky+lint-staged 커밋 훅, Biome·dprint 대안, 팀 표준 설정 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Prettier", "ESLint", "코드포맷", "Biome", "lintstaged", "Husky", "코드스타일"]
featured: false
draft: false
---

[지난 글](/posts/lint-eslint-basics/)에서 ESLint의 파이프라인과 Flat Config를 살펴봤습니다. 이번에는 **Prettier와 ESLint의 역할 분리**를 다룹니다. 두 도구를 처음 함께 사용할 때 가장 혼란스러운 부분은 "둘 다 코드 스타일을 다루는 것 같은데, 어디서 겹치고 어떻게 공존시키는가"입니다.

---

## 근본적 역할 차이

ESLint는 **의미 분석기**입니다. `no-unused-vars`, `no-undef`, `eqeqeq` 같은 규칙은 코드가 무엇을 하는지를 분석합니다. 일부 포맷 규칙(`indent`, `quotes`, `semi`)도 있지만, 이것들이 Prettier와 충돌합니다.

Prettier는 **의견 있는 포맷터(Opinionated Formatter)**입니다. 코드를 파싱한 뒤 자체 규칙으로 재출력합니다. 설정 옵션이 의도적으로 적어서 팀 내 스타일 논쟁을 없앱니다. 줄 바꿈, 들여쓰기, 세미콜론, 따옴표, 후행 쉼표는 Prettier에 맡깁니다.

![ESLint vs Prettier — 역할 분리](/assets/posts/lint-prettier-separation-roles.svg)

---

## 설치 및 기본 설정

```bash
npm install -D prettier eslint-config-prettier
# editor integration (VS Code)
# Extensions: "Prettier - Code formatter", "ESLint"
```

`.prettierrc.json` 또는 `prettier.config.js`로 설정합니다.

```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "trailingComma": "all",
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

`.prettierignore`로 포맷에서 제외할 파일을 지정합니다.

```
node_modules/
dist/
*.min.js
public/
```

---

## eslint-config-prettier로 충돌 해소

ESLint와 Prettier를 함께 사용하면 포맷 규칙에서 충돌이 발생합니다. `eslint-config-prettier`는 ESLint의 포맷 관련 규칙을 모두 `off`로 설정해 Prettier에 포맷을 완전히 위임합니다.

```javascript
// eslint.config.js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // 프로젝트 규칙...
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // 반드시 마지막에! prettier가 ESLint 포맷 규칙을 덮어씀
  prettier,
]
```

`prettier`를 배열 마지막에 배치해야 이전 설정의 포맷 규칙을 모두 비활성화합니다.

---

![Prettier + ESLint 공존 설정](/assets/posts/lint-prettier-separation-config.svg)

---

## VS Code 통합

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

저장 시 Prettier 포맷 → ESLint autofix 순서로 실행됩니다.

---

## Husky + lint-staged — 커밋 훅

커밋 시점에 자동으로 포맷과 린트를 실행해 저장소에 일관된 코드만 들어오도록 합니다.

```bash
npm install -D husky lint-staged
npx husky init
# .husky/pre-commit 파일 생성됨
```

```bash
# .husky/pre-commit
npx lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "**/*.{ts,tsx,js,jsx}": [
      "prettier --write",
      "eslint --fix --max-warnings 0"
    ],
    "**/*.{json,css,md}": [
      "prettier --write"
    ]
  }
}
```

`lint-staged`는 `git add`된 파일(스테이지된 파일)만 처리하므로 전체 프로젝트를 실행하는 것보다 훨씬 빠릅니다.

---

## Prettier 플러그인 생태계

```bash
# Tailwind CSS 클래스 정렬
npm install -D prettier-plugin-tailwindcss

# import 정렬
npm install -D @trivago/prettier-plugin-sort-imports

# astro / svelte / vue 지원
npm install -D prettier-plugin-astro
```

```json
{
  "plugins": ["prettier-plugin-tailwindcss", "@trivago/prettier-plugin-sort-imports"],
  "importOrder": ["^@core/(.*)$", "^@server/(.*)$", "^[./]"],
  "importOrderSeparation": true
}
```

---

## Biome — 통합 대안

[Biome](https://biomejs.dev)은 ESLint + Prettier를 하나의 Rust 도구로 대체합니다. 속도가 100배 이상 빠르고, ESLint 규칙의 대부분을 포함합니다.

```bash
npm install -D @biomejs/biome
npx biome init
```

```json
// biome.json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "error" }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "lineWidth": 100
  }
}
```

```bash
npx biome check --write src/  # 린트 + 포맷 동시에
```

Biome은 2024년부터 빠르게 채택되고 있습니다. ESLint 플러그인 생태계(react-hooks, import 등)가 아직 Biome에 완전히 마이그레이션되지 않은 부분이 있어, React 프로젝트에서는 확인이 필요합니다.

---

## 팀 표준 설정 체크리스트

```
□ .prettierrc.json 버전 관리에 포함
□ .prettierignore 설정
□ eslint.config.js 마지막에 eslint-config-prettier 적용
□ .vscode/settings.json 팀 공유 (.gitignore 제외)
□ .vscode/extensions.json으로 권장 확장 명시
□ Husky pre-commit 훅 설정
□ CI에서 prettier --check + eslint 실행
□ README에 로컬 설정 방법 문서화
```

---

**지난 글:** [ESLint 기초 — 파서·규칙·플러그인·Flat Config](/posts/lint-eslint-basics/)

<br>
읽어주셔서 감사합니다. 😊
