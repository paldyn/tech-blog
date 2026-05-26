---
title: "commit-msg 훅: 커밋 메시지 형식 자동 검증"
description: "commit-msg 훅의 실행 시점과 인자 처리, 셸 스크립트로 Conventional Commits 패턴을 검증하는 방법, commitlint와 Husky를 결합한 팀 표준화, prepare-commit-msg로 메시지 템플릿을 자동 삽입하는 패턴을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "commit-msg", "commitlint", "Conventional-Commits", "Husky", "hooks"]
featured: false
draft: false
---

[지난 글](/posts/git-pre-commit-hook/)에서 pre-commit 훅으로 코드 품질을 검증하는 방법을 다뤘다. 이번에는 커밋 메시지 자체를 검증하는 **commit-msg** 훅을 살펴본다. 팀 전체의 메시지 형식을 일관되게 유지하면 CHANGELOG 자동 생성과 버전 추적이 가능해진다.

## commit-msg 훅의 특징

`commit-msg` 훅은 사용자가 커밋 메시지를 입력한 직후, 커밋이 실제로 완료되기 전에 실행된다. 다른 훅과 한 가지 다른 점이 있다. **$1 인자로 커밋 메시지가 저장된 임시 파일 경로를 받는다**.

```bash
#!/bin/sh
# $1 = 커밋 메시지 파일 경로 (예: .git/COMMIT_EDITMSG)
MSG=$(cat "$1")
echo "검증할 메시지: $MSG"
```

훅은 메시지를 이 파일에서 읽어 검증한다. `exit 0`이면 커밋 완료, 비제로 exit이면 커밋 취소다.

![commit-msg 훅 실행 흐름](/assets/posts/git-commit-msg-hook-flow.svg)

## Conventional Commits 형식

커밋 메시지 형식 표준으로 **Conventional Commits**가 널리 사용된다.

```
type(scope): subject

body (선택)

footer (선택)
```

![Conventional Commits 타입](/assets/posts/git-commit-msg-hook-conventional.svg)

`type`은 변경 종류를 나타낸다. `scope`는 변경 영역(선택). `subject`는 한 줄 요약이다.

예시:

```
feat(auth): add Google OAuth2 login
fix(api): handle null payment gateway response
docs(readme): update installation guide
refactor(db): extract query builder to separate module
chore(deps): upgrade eslint to v8.50.0
```

## 셸로 직접 작성하기

```bash
#!/bin/sh
# .githooks/commit-msg

MSG=$(cat "$1")

# Merge commit, revert commit은 검증 제외
echo "$MSG" | grep -qE '^(Merge|Revert)' && exit 0

PATTERN='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?(!)?: .{1,72}$'

if ! echo "$MSG" | grep -qP "$PATTERN"; then
  echo ""
  echo "커밋 메시지 형식 오류:"
  echo "  현재: $MSG"
  echo "  기대: type(scope): subject"
  echo "  타입: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert"
  echo "  예시: feat(auth): add login page"
  echo ""
  exit 1
fi

exit 0
```

`grep -P`는 PCRE(Perl Compatible Regular Expression)를 지원하는 GNU grep이 필요하다. macOS 기본 grep은 `-P` 미지원이므로 `brew install grep`으로 GNU grep을 설치하거나 awk 기반으로 작성한다.

## commitlint 사용 (권장)

직접 정규표현식을 관리하는 대신 `commitlint` 패키지를 쓰면 편하다.

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional
```

`commitlint.config.js`:

```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'scope-empty': [0],   // scope 선택 사항
  }
};
```

`.husky/commit-msg`:

```bash
#!/bin/sh
npx --no -- commitlint --edit "$1"
```

commitlint는 `$1` 인자를 그대로 받아 메시지 파일을 검증한다. `--edit`은 파일 경로를 의미한다.

## prepare-commit-msg: 메시지 템플릿 자동 삽입

`commit-msg`의 형제 훅인 `prepare-commit-msg`는 편집기가 열리기 전에 실행된다. 브랜치 이름에서 이슈 번호를 추출해 메시지에 자동으로 삽입할 때 유용하다.

```bash
#!/bin/sh
# .githooks/prepare-commit-msg

COMMIT_MSG_FILE="$1"
COMMIT_SOURCE="$2"

# -m 옵션으로 직접 메시지 입력한 경우 템플릿 주입 생략
[ "$COMMIT_SOURCE" = "message" ] && exit 0

# 브랜치 이름에서 이슈 번호 추출
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)
ISSUE=$(echo "$BRANCH" | grep -oE '[A-Z]+-[0-9]+|#[0-9]+' | head -1)

if [ -n "$ISSUE" ]; then
  # 메시지 파일 첫 줄 뒤에 이슈 번호 추가
  sed -i.bak "1s/$/\n\nRef: $ISSUE/" "$COMMIT_MSG_FILE"
fi
```

`feature/JIRA-123-user-profile` 브랜치라면 커밋 메시지에 자동으로 `Ref: JIRA-123`이 추가된다.

## Merge/Revert 커밋 예외 처리

Merge 커밋은 "Merge branch 'feat/xxx' into main"처럼 자동 생성되는 메시지를 사용하므로, Conventional Commits 규칙에서 제외해야 한다.

```bash
#!/bin/sh
MSG=$(cat "$1")

# Merge, Revert, Initial commit 제외
case "$MSG" in
  Merge*|Revert*|"Initial commit"*) exit 0 ;;
esac

# 검증 로직
```

## Git hook 우회 방지

`--no-verify`로 훅을 우회할 수 있다. 완전히 막을 수는 없지만, 서버 훅 또는 GitHub의 **Protected branch + required PR check**를 함께 사용하면 push 단계에서 추가로 검증할 수 있다.

다음 글에서는 push 직전에 실행되는 **pre-push** 훅을 다룬다.

---

**지난 글:** [pre-commit 훅: 커밋 전 품질 게이트 구축하기](/posts/git-pre-commit-hook/)

**다음 글:** [pre-push 훅: push 전 테스트와 보호 정책](/posts/git-pre-push-hook/)

<br>
읽어주셔서 감사합니다. 😊
