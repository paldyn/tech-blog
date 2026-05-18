---
title: "Husky + lint-staged — 커밋 훅으로 품질 게이트 구축"
description: "Husky로 Git pre-commit 훅을 설정하고 lint-staged로 스테이징 파일만 린트·포맷하는 방법, commit-msg 훅으로 커밋 메시지 검증, CI 비교, 팀 세팅 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Husky", "lint-staged", "Git훅", "pre-commit", "코드품질", "자동화"]
featured: false
draft: false
---

[지난 글](/posts/lint-typescript-eslint/)에서 TypeScript ESLint로 타입 인식 린팅을 설정하는 방법을 살펴봤습니다. 린팅 규칙이 아무리 훌륭해도 개발자가 `git commit` 전에 `npm run lint`를 실행하지 않으면 의미가 없습니다. **Husky**와 **lint-staged**는 이 문제를 Git 훅으로 자동화합니다. 커밋 순간에 품질 검사를 실행해, 오류가 있는 코드가 저장소에 들어오지 못하도록 막는 **품질 게이트(Quality Gate)**를 구성합니다.

---

## 커밋 훅 흐름

![Husky + lint-staged 커밋 흐름](/assets/posts/lint-husky-lintstaged-flow.svg)

핵심 원리는 **"스테이징된 파일만"** 검사한다는 것입니다. 전체 프로젝트를 린팅하면 커밋마다 수십 초가 걸릴 수 있습니다. lint-staged는 `git diff --cached --name-only`로 스테이징 파일 목록을 가져와 해당 파일만 처리합니다. 이를 통해 커밋 속도를 유지하면서 품질 게이트를 지킵니다.

---

## 설치 및 초기화

![Husky + lint-staged 설치 단계](/assets/posts/lint-husky-lintstaged-setup.svg)

```bash
# 패키지 설치
npm install -D husky lint-staged

# Husky 초기화 (v9+)
npx husky init
```

`npx husky init`은 `.husky/` 디렉토리를 만들고 `package.json`의 `scripts.prepare`에 `husky`를 추가합니다. `prepare`는 `npm install` 시 자동으로 실행되므로 팀원이 설치하면 훅이 자동으로 활성화됩니다.

---

## pre-commit 훅 설정

`npx husky init`이 생성한 `.husky/pre-commit`을 편집합니다.

```bash
# .husky/pre-commit
npx lint-staged
```

이 한 줄이 전부입니다. lint-staged가 나머지를 담당합니다.

---

## lint-staged 설정

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{js,mjs,cjs}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml,css,scss}": [
      "prettier --write"
    ]
  }
}
```

또는 `lint-staged.config.mjs`로 분리할 수 있습니다.

```javascript
// lint-staged.config.mjs
export default {
  '*.{ts,tsx}': (files) => [
    `eslint --fix ${files.join(' ')}`,
    `prettier --write ${files.join(' ')}`,
  ],
}
```

함수 형태를 쓰면 파일 목록을 직접 조작할 수 있습니다. 예를 들어 파일 수가 너무 많을 때 배치로 나누거나, 특정 조건에서 명령을 건너뛸 수 있습니다.

---

## commit-msg 훅 — 커밋 메시지 검증

[Conventional Commits](https://www.conventionalcommits.org/) 형식을 강제하려면 `commitlint`를 추가합니다.

```bash
npm install -D @commitlint/cli @commitlint/config-conventional
```

```javascript
// commitlint.config.mjs
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style',
      'refactor', 'test', 'chore', 'ci',
    ]],
  },
}
```

```bash
# .husky/commit-msg
npx --no -- commitlint --edit "$1"
```

이제 `git commit -m "wip"` 같은 형식은 차단되고, `git commit -m "feat: 로그인 기능 추가"`만 허용됩니다.

---

## CI와 로컬 훅의 차이

| 항목 | 로컬 훅 (Husky) | CI |
|---|---|---|
| 실행 시점 | 커밋 순간 | PR 병합 전 |
| 검사 범위 | 스테이징 파일만 | 전체 코드베이스 |
| 건너뛰기 | `git commit --no-verify` | 불가 (PR 차단) |
| 목적 | 빠른 피드백 | 최종 품질 보장 |

로컬 훅은 `git commit --no-verify`로 건너뛸 수 있기 때문에, **CI에서도 전체 린팅을 반드시 실행**해야 합니다. 로컬 훅은 편의를 위한 빠른 피드백, CI는 강제적인 게이트입니다.

---

## 팀 환경에서 주의사항

```json
// package.json — prepare 스크립트
{
  "scripts": {
    "prepare": "husky"
  }
}
```

- `npm install` 후 자동으로 `husky`가 실행되어 Git 훅이 설치됩니다.
- **Windows**에서는 `.husky/pre-commit`이 sh 스크립트이므로 Git Bash 또는 WSL 환경이 필요합니다.
- **CI 환경**에서 `prepare`가 실행되면 `.git` 디렉토리가 없어 오류가 날 수 있습니다.

```json
// CI에서 prepare 스킵
{
  "scripts": {
    "prepare": "node -e \"process.env.CI || require('husky').install()\""
  }
}
```

Husky v9에서는 이 문제가 개선되어 `.git`이 없으면 자동으로 스킵합니다.

---

## 성능 최적화

lint-staged의 처리 속도가 느리다면 ESLint 대신 `tsc --noEmit`로 타입 검사만 하거나, 병렬 실행을 구성할 수 있습니다.

```javascript
// lint-staged.config.mjs — 느린 tsc는 별도 처리
export default {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
  ],
  // tsc는 전체 프로젝트를 검사해야 하므로 파일 인수 없이 실행
  '**/*.ts?(x)': () => 'tsc --noEmit',
}
```

`() =>` 함수로 반환하면 lint-staged가 파일 목록을 인수로 붙이지 않습니다. `tsc`는 파일 경로를 직접 받으면 `tsconfig.json`을 무시하기 때문에 이 패턴이 필요합니다.

---

**지난 글:** [TypeScript ESLint — 타입 인식 린팅 완전 가이드](/posts/lint-typescript-eslint/)

**다음 글:** [ESLint 커스텀 규칙 — AST 기반 규칙 작성](/posts/lint-custom-rules/)

<br>
읽어주셔서 감사합니다. 😊
