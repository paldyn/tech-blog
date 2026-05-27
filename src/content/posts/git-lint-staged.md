---
title: "lint-staged: 변경 파일만 골라서 lint하기"
description: "lint-staged의 동작 원리와 설치, .lintstagedrc.json 및 package.json 설정 형식, glob 패턴 매칭, ESLint·Prettier·Stylelint와의 통합, 수정된 파일 자동 re-staging 동작을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "lint-staged", "ESLint", "Prettier", "hooks", "자동화"]
featured: false
draft: false
---

[지난 글](/posts/git-husky-pre-commit/)에서 Husky로 pre-commit 훅을 팀 전체에 배포하는 방법을 다뤘다. pre-commit에서 `npm run lint`를 실행하면 **전체 파일**을 검사하므로 프로젝트가 커질수록 커밋이 느려진다. **lint-staged**는 스테이징된(staged) 파일만 골라서 lint를 실행하는 도구다.

## lint-staged가 필요한 이유

규모 있는 프로젝트에서 pre-commit마다 `eslint src/` 전체 검사를 실행하면 수십 초가 걸릴 수 있다. lint-staged는 이번 커밋에 포함되는 파일만 lint해서 실행 시간을 대폭 단축한다.

```
커밋 전 스테이징: src/foo.ts, src/bar.tsx, README.md
→ lint-staged: 세 파일에만 lint 실행 (전체 프로젝트 무관)
```

## 설치

```bash
npm install --save-dev lint-staged
```

Husky와 함께 사용하는 것이 일반적이다.

```sh
# .husky/pre-commit
npx lint-staged
```

## 설정 파일

`.lintstagedrc.json` 또는 `package.json`의 `"lint-staged"` 키에 glob 패턴과 명령어를 매핑한다.

![lint-staged 동작 흐름](/assets/posts/git-lint-staged-flow.svg)

### .lintstagedrc.json

```json
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{css,scss}": [
    "stylelint --fix",
    "prettier --write"
  ],
  "*.md": "prettier --write"
}
```

명령어 배열로 여러 도구를 순서대로 실행한다. 단일 명령은 문자열로 축약할 수 있다.

### package.json 방식

```json
{
  "lint-staged": {
    "src/**/*.ts": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

`src/` 하위 파일만 대상으로 제한할 수도 있다.

![lint-staged 설정 형식](/assets/posts/git-lint-staged-config.svg)

## 자동 re-staging

lint-staged는 도구가 파일을 수정하면(`--fix`, `--write`) **수정된 파일을 자동으로 다시 `git add`** 한다. 개발자가 수동으로 재스테이징할 필요 없이 포맷팅된 결과가 커밋에 포함된다.

```
git add src/foo.ts    ← 수동 스테이징
git commit            ← lint-staged 실행
  → eslint --fix src/foo.ts  ← 자동 수정
  → git add src/foo.ts       ← 자동 re-staging
  → 커밋에 수정본 포함
```

## TypeScript 타입 검사 통합

ESLint는 파일 단위로 실행할 수 있지만, TypeScript의 전체 타입 검사(`tsc --noEmit`)는 프로젝트 전체를 봐야 한다. lint-staged와 분리해서 처리한다.

```sh
# .husky/pre-commit
#!/bin/sh

# 변경 파일만 lint
npx lint-staged

# 전체 타입 검사 (느리지만 필요)
npx tsc --noEmit
```

또는 타입 검사를 pre-push 훅으로 분리해 커밋은 빠르게, push 시에만 전체 검사를 실행한다.

## 단순화된 설정 예시

```json
{
  "*.{js,jsx,ts,tsx}": "eslint --fix --max-warnings 0",
  "*.{json,md,yml,yaml}": "prettier --write --no-semi"
}
```

`--max-warnings 0`은 경고도 에러로 처리해 스테이징 파일에서 경고가 있으면 커밋을 막는다.

## 흔한 문제 해결

### glob이 매칭되지 않는 경우

lint-staged의 glob은 파일명(basename)만 매칭하는 것이 아니라 전체 경로를 기준으로 한다.

```json
{
  "src/**/*.ts": "eslint --fix",
  "*.ts": "eslint --fix"
}
```

두 패턴 모두 `src/foo.ts`에 매칭되면 ESLint가 두 번 실행될 수 있다. 패턴이 중복되지 않도록 설계한다.

### ESLint가 `--fix`로 파일을 변경했는데 커밋이 실패하는 경우

ESLint `--fix`가 파일을 수정하면 lint-staged가 자동 re-staging한다. 하지만 ESLint가 수정 불가능한 오류를 발견하면 비제로 종료 코드를 반환해 커밋이 취소된다. 이것이 의도된 동작이다.

---

**지난 글:** [Husky: Node.js 프로젝트의 Git 훅 관리](/posts/git-husky-pre-commit/)

**다음 글:** [Conventional Commits: 커밋 메시지 표준 형식](/posts/git-conventional-commits/)

<br>
읽어주셔서 감사합니다. 😊
