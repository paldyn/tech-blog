---
title: "Git Hooks 개요: 자동화의 시작점"
description: "Git이 제공하는 클라이언트·서버 훅의 전체 목록과 실행 시점, 훅 파일 작성 방법과 exit code 규칙, .git/hooks/의 팀 공유 문제를 core.hooksPath로 해결하는 방법, Husky로 npm 프로젝트에서 훅을 공유하는 패턴을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "hooks", "pre-commit", "commit-msg", "pre-push", "Husky", "자동화"]
featured: false
draft: false
---

[지난 글](/posts/git-supply-chain-security/)에서 공급망 보안을 다뤘다. Git Hook은 그 보안 레이어의 핵심 중 하나다. 이번에는 훅 시스템 전체를 조망한다. 어떤 훅이 어느 시점에 실행되는지, 어떻게 작성하고 팀과 공유하는지를 다룬다.

## Git Hook이란

Git이 특정 이벤트(커밋, push, merge 등) 발생 시 자동으로 실행하는 스크립트다. `.git/hooks/` 디렉터리에 실행 가능한 파일로 저장된다. 언어는 제한 없다 — bash, python, node.js, ruby 모두 사용할 수 있다 (shebang 라인으로 지정).

훅은 **클라이언트 훅**과 **서버 훅**으로 나뉜다. 클라이언트 훅은 로컬 머신에서 실행되고, 서버 훅은 원격 레포 서버(GitHub Enterprise 등)에서 실행된다.

## 훅 실행 시점 전체

![Git Hook 실행 시점](/assets/posts/git-hooks-overview-lifecycle.svg)

### 커밋 관련 훅

| 훅 이름 | 실행 시점 | 중단 가능 |
|------|------|------|
| `pre-commit` | `git commit` 실행 직후, 커밋 메시지 편집기 열리기 전 | 예 (exit 1) |
| `prepare-commit-msg` | 커밋 메시지 편집기가 열리기 전, 기본 메시지 설정 후 | 예 |
| `commit-msg` | 사용자가 메시지를 입력한 후 | 예 (exit 1) |
| `post-commit` | 커밋 완료 후 | 아니오 |

### Push 관련 훅

| 훅 이름 | 실행 시점 | 중단 가능 |
|------|------|------|
| `pre-push` | `git push` 실행 후, 원격 전송 전 | 예 (exit 1) |
| `post-push` | push 완료 후 (Git 2.x 미지원, 서드파티) | - |

### 기타 클라이언트 훅

| 훅 이름 | 실행 시점 |
|------|------|
| `post-checkout` | `git checkout` 완료 후 |
| `post-merge` | `git merge` 완료 후 |
| `post-rewrite` | `git commit --amend` 또는 `git rebase` 완료 후 |
| `pre-rebase` | rebase 시작 전 |

### 서버 훅

| 훅 이름 | 설명 |
|------|------|
| `pre-receive` | push 수신 전 (전체 거부 가능) |
| `update` | 브랜치별 push 검증 |
| `post-receive` | push 완료 후 (배포 트리거 등) |

## 훅 파일 작성

```bash
#!/bin/sh
# .git/hooks/pre-commit

# 린트 실행
npm run lint
if [ $? -ne 0 ]; then
  echo "Lint 실패 — 커밋 취소"
  exit 1
fi

exit 0
```

**exit 0**: 훅 성공 → Git이 다음 단계 진행  
**exit 1** (또는 임의의 비제로 값): 훅 실패 → Git이 작업 중단

```bash
# 실행 권한 부여 (필수)
chmod +x .git/hooks/pre-commit
```

## 훅 건너뛰기

긴급 상황이나 CI에서 훅을 건너뛰어야 할 때:

```bash
# pre-commit, commit-msg 건너뛰기
git commit --no-verify -m "긴급 수정"

# pre-push 건너뛰기
git push --no-verify
```

`--no-verify`는 남용하면 훅의 의미가 없어진다. 팀 정책으로 사용을 제한하거나 로그를 남기도록 한다.

## 팀 공유 문제와 해결

![팀 훅 공유 방법](/assets/posts/git-hooks-overview-sharing.svg)

`.git/hooks/`는 git이 추적하지 않는다. 원격 레포에 push해도 다른 팀원에게 전달되지 않는다. 두 가지 방법으로 해결한다.

### 방법 1: .githooks/ + core.hooksPath

```bash
# 프로젝트 루트에 .githooks/ 생성 후 커밋
mkdir .githooks
touch .githooks/pre-commit
chmod +x .githooks/pre-commit
git add .githooks/
git commit -m "add: pre-commit hook"

# 팀원이 clone 후 실행
git config core.hooksPath .githooks
```

`package.json`의 `postinstall` 스크립트에 `git config core.hooksPath .githooks`를 넣으면 `npm install` 후 자동으로 설정된다.

### 방법 2: Husky (npm 프로젝트)

```bash
# 설치 및 초기화
npm install --save-dev husky
npx husky init

# pre-commit 훅 추가
echo "npm run lint" > .husky/pre-commit
```

Husky는 `npm install` 시 자동으로 훅을 설치하고, `prepare` 스크립트를 통해 팀 전체에 일관되게 배포된다.

## 언제 무엇을 쓸까

- **pre-commit**: 코드 포맷·린트 검사
- **commit-msg**: 커밋 메시지 형식 검증 (Conventional Commits 등)
- **pre-push**: 테스트 전체 실행, 비밀 정보 스캔
- **post-merge**: `npm install` 자동 실행 (package.json 변경 감지)
- **post-checkout**: 브랜치 변경 후 환경 정리

다음 글에서 가장 많이 사용되는 `pre-commit` 훅 구현을 상세히 다룬다.

---

**지난 글:** [Git 공급망 보안(Supply Chain Security)](/posts/git-supply-chain-security/)

**다음 글:** [pre-commit 훅: 커밋 전 품질 게이트 구축](/posts/git-pre-commit-hook/)

<br>
읽어주셔서 감사합니다. 😊
