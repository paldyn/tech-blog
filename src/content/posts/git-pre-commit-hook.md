---
title: "pre-commit 훅: 커밋 전 품질 게이트 구축하기"
description: "pre-commit 훅의 실행 시점과 exit code 규칙, 셸로 직접 작성하는 방법, staged 파일만 검사하는 패턴, lint-staged와 Husky를 결합해 빠른 pre-commit 파이프라인을 구성하는 방법, gitleaks로 비밀 정보 유출을 차단하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "pre-commit", "lint-staged", "Husky", "ESLint", "Prettier", "hooks"]
featured: false
draft: false
---

[지난 글](/posts/git-hooks-overview/)에서 Git 훅 전체를 개관했다. 이번에는 가장 널리 쓰이는 **pre-commit** 훅에 집중한다. 코드 린트·포맷·비밀 스캔을 커밋 전에 자동으로 실행하는 품질 게이트를 만드는 방법이다.

## pre-commit 훅의 동작

`git commit` 명령이 실행되면, 커밋 메시지 편집기가 열리기 전에 `.git/hooks/pre-commit`(또는 `core.hooksPath`에 지정된 경로)이 실행된다. 스크립트가 `exit 0`을 반환하면 커밋이 진행되고, 임의의 비제로 코드로 종료하면 커밋이 중단된다.

![pre-commit 훅 실행 흐름](/assets/posts/git-pre-commit-hook-flow.svg)

## 기본 훅 작성

```bash
#!/bin/sh
# .githooks/pre-commit

set -e   # 명령 실패 시 즉시 종료 (exit 1 효과)

echo "Running pre-commit checks..."

# 린트
npm run lint

# 포맷 검사
npm run format:check

echo "All checks passed."
exit 0
```

`set -e`를 쓰면 `npm run lint`가 실패할 경우 이후 명령을 실행하지 않고 즉시 종료한다. 이 동작이 pre-commit 훅의 "실패 → 커밋 중단"과 자동으로 연결된다.

```bash
# 실행 권한 부여 (반드시)
chmod +x .githooks/pre-commit

# hooksPath 설정
git config core.hooksPath .githooks
```

## staged 파일만 검사하기

전체 프로젝트에 린트를 실행하면 파일이 많을수록 느리다. **staged 파일만** 검사하면 훨씬 빠르다.

![staged 파일 검사 패턴](/assets/posts/git-pre-commit-hook-staged.svg)

```bash
#!/bin/sh
# staged된 JS/TS 파일만 추출해서 린트
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(js|ts|jsx|tsx)$')

if [ -n "$STAGED_FILES" ]; then
  echo "$STAGED_FILES" | xargs npx eslint
fi
```

`--diff-filter=ACMR`은 Added, Copied, Modified, Renamed 파일만 포함하고 Deleted 파일은 제외한다. 삭제된 파일에 린트를 실행하면 오류가 나기 때문이다.

## lint-staged로 더 편리하게

`lint-staged`는 staged 파일 추출, 도구 실행, 수정 후 re-staging까지 자동으로 처리한다.

```bash
npm install --save-dev lint-staged
```

`package.json`에 설정 추가:

```json
{
  "lint-staged": {
    "*.{js,ts,jsx,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{css,scss}": ["stylelint --fix"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

`.husky/pre-commit`:

```bash
#!/bin/sh
npx lint-staged
```

`lint-staged`는 `eslint --fix`로 자동 수정한 뒤 수정된 파일을 자동으로 다시 stage한다. 개발자가 별도로 `git add`를 다시 할 필요가 없다.

## Husky + lint-staged 전체 설정

```bash
# 설치
npm install --save-dev husky lint-staged

# Husky 초기화
npx husky init

# pre-commit 훅 내용 작성
echo "npx lint-staged" > .husky/pre-commit
```

`npm install` 시 자동으로 Husky가 설정되도록 `package.json`의 `prepare` 스크립트를 확인한다.

```json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

팀원이 `npm install`만 실행하면 훅이 자동으로 설치된다.

## 비밀 정보 스캔 추가

```bash
#!/bin/sh
# .husky/pre-commit

# 비밀 정보 스캔
gitleaks protect --staged --verbose
if [ $? -ne 0 ]; then
  echo "Secret detected! Commit blocked."
  exit 1
fi

# lint-staged
npx lint-staged
```

`gitleaks protect --staged`는 staged 파일에서 API 키, 패스워드 등 민감한 패턴을 찾아낸다. 탐지되면 커밋이 차단된다.

## Python 프로젝트 (pre-commit 프레임워크)

Python 생태계에서는 `pre-commit` 패키지가 훅 관리 도구로 널리 쓰인다.

```bash
pip install pre-commit
```

`.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/psf/black
    rev: 23.11.0
    hooks:
      - id: black
  - repo: https://github.com/pycqa/flake8
    rev: 6.1.0
    hooks:
      - id: flake8
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
```

```bash
pre-commit install    # .git/hooks/pre-commit에 설치
pre-commit run --all-files    # 수동 실행
```

## 훅이 느릴 때 진단

```bash
# 훅 실행 시간 측정
time git commit --allow-empty -m "test"

# 특정 명령 시간 측정
time npm run lint
```

5초 이상 걸린다면 staged 파일만 검사하거나, 병렬 실행을 검토한다. lint-staged는 내부적으로 병렬 실행을 지원한다.

---

**지난 글:** [Git Hooks 개요: 자동화의 시작점](/posts/git-hooks-overview/)

**다음 글:** [commit-msg 훅: 커밋 메시지 형식 자동 검증](/posts/git-commit-msg-hook/)

<br>
읽어주셔서 감사합니다. 😊
