---
title: "Husky: Node.js 프로젝트의 Git 훅 관리"
description: "Husky v9 설치와 초기화, .husky/ 디렉터리 구조, pre-commit·commit-msg·pre-push 훅 등록, v8과 v9의 설정 방식 차이, CI 환경에서의 비활성화 패턴을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "Husky", "hooks", "pre-commit", "Node.js", "자동화"]
featured: false
draft: false
---

[지난 글](/posts/git-server-side-hooks/)에서 서버 사이드 훅으로 팀 정책을 강제하는 방법을 다뤘다. 클라이언트 훅은 팀원 모두가 일관되게 적용해야 효과가 있다. **Husky**는 `.git/hooks/`를 직접 편집하지 않고, 버전 관리되는 `.husky/` 디렉터리로 훅을 팀 전체에 공유하는 도구다.

## Husky가 필요한 이유

`.git/hooks/`는 Git이 자동으로 생성하는 디렉터리로, `.gitignore`에 의해 추적되지 않는다. 훅 스크립트를 직접 만들어도 다른 팀원에게 배포하려면 별도 설치 안내가 필요하다.

Husky는 훅 파일을 `.husky/` 폴더에 저장해 **커밋에 포함**시키고, `npm install` 시 자동으로 Git 훅 경로를 연결해 준다.

## Husky v9 설치

```bash
# 1. Husky 설치
npm install --save-dev husky

# 2. 초기화 (.husky/ 디렉터리 생성 + prepare 스크립트 자동 추가)
npx husky init
```

`npx husky init`은 두 가지 작업을 한다.

1. `.husky/pre-commit` 파일 생성 (기본 내용: `npm test`)
2. `package.json`에 `"prepare": "husky"` 스크립트 추가

이후 팀원이 `npm install`을 실행하면 `prepare` 스크립트가 자동 실행되어 `.husky/`의 훅이 활성화된다.

![Husky 설치 및 훅 등록 흐름](/assets/posts/git-husky-pre-commit-setup.svg)

## pre-commit 훅 설정

```sh
#!/bin/sh
# .husky/pre-commit

# lint-staged로 변경 파일만 lint
npx lint-staged

# TypeScript 타입 검사
npm run type-check
```

파일을 편집한 후 실행 권한을 부여한다.

```bash
chmod +x .husky/pre-commit
```

Husky v9에서는 파일을 직접 생성하거나 편집해서 훅을 추가한다. v8에서 사용하던 `husky add` 명령어는 v9에서 삭제됐다.

## commit-msg 훅 설정

```sh
#!/bin/sh
# .husky/commit-msg

npx --no -- commitlint --edit "$1"
```

`$1`은 커밋 메시지가 담긴 임시 파일 경로다. `commitlint`는 이 파일을 읽어 메시지 형식을 검증한다.

## pre-push 훅 설정

```sh
#!/bin/sh
# .husky/pre-push

npm run test:unit
```

## v8과 v9 비교

![Husky v8과 v9 설정 비교](/assets/posts/git-husky-pre-commit-versions.svg)

주요 변경 사항:
- `husky install` → `husky` (prepare 스크립트)
- `husky add` 명령어 삭제 → 파일 직접 편집
- `.husky/_/husky.sh` 소스 구문 불필요 (v9에서 제거)

## CI 환경에서 비활성화

CI 환경에서는 Git 훅을 실행하지 않아야 한다. CI는 코드를 체크아웃한 후 테스트를 직접 실행하기 때문이다.

```json
{
  "scripts": {
    "prepare": "husky || true"
  }
}
```

`|| true`를 붙이면 CI처럼 `.git`이 없는 환경에서도 `prepare` 스크립트가 실패하지 않는다.

또는 환경 변수로 명시적으로 비활성화한다.

```bash
# CI 환경에서
HUSKY=0 npm install
```

`HUSKY=0`이 설정되면 Husky가 훅 설정을 건너뛴다.

## 훅 임시 건너뛰기

개발 중 특정 커밋에서 훅을 건너뛰어야 할 때는 `--no-verify`를 사용한다.

```bash
git commit --no-verify -m "WIP: 임시 저장"
```

이는 어디까지나 로컬 우회이므로 서버 사이드 정책은 여전히 적용된다.

## 프로젝트 구조 예시

```
my-project/
├── .husky/
│   ├── pre-commit       ← lint-staged 실행
│   ├── commit-msg       ← commitlint 실행
│   └── pre-push         ← 단위 테스트 실행
├── package.json
│   └── "prepare": "husky"
└── .lintstagedrc.json
```

`.husky/` 디렉터리는 Git에 커밋해서 팀원 모두 동일한 훅을 사용하도록 한다.

---

**지난 글:** [서버 사이드 훅: pre-receive, update, post-receive](/posts/git-server-side-hooks/)

**다음 글:** [lint-staged: 변경 파일만 골라서 lint하기](/posts/git-lint-staged/)

<br>
읽어주셔서 감사합니다. 😊
