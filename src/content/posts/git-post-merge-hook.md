---
title: "post-merge 훅: 머지 후 자동화 작업 구성"
description: "post-merge 훅의 실행 시점과 squash 머지 판별 인수($1), ORIG_HEAD를 이용한 lockfile 변경 감지로 npm install 자동화, 마이그레이션 실행, 캐시 무효화 패턴을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "post-merge", "hooks", "자동화", "npm", "ORIG_HEAD"]
featured: false
draft: false
---

[지난 글](/posts/git-pre-push-hook/)에서 push 전 테스트 게이트를 구성하는 pre-push 훅을 다뤘다. 이번에는 머지가 **완료된 직후** 실행되는 `post-merge` 훅으로 자동화 작업을 연결하는 방법을 살펴본다.

## post-merge 훅 기본

`post-merge` 훅은 `git merge`(또는 `git pull`)가 성공적으로 완료된 직후 실행된다. `pre-merge-commit`과 달리, 이 훅이 실패(`exit 1`)해도 이미 완료된 **머지는 되돌려지지 않는다**. 따라서 post-merge는 머지 차단이 아닌 **자동화·알림 용도**로만 사용한다.

훅에는 인수 하나가 전달된다.

```
$1 = 0  # 일반 머지
$1 = 1  # squash 머지 (--squash 옵션)
```

![post-merge 훅 실행 흐름](/assets/posts/git-post-merge-hook-flow.svg)

## 기본 훅 파일

```bash
#!/bin/sh
# .git/hooks/post-merge (또는 .githooks/post-merge)

SQUASH_MERGE=$1

echo "post-merge 실행 (squash=$SQUASH_MERGE)"

# 의존성 변경 감지 후 재설치
if git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD \
    | grep -q "package-lock.json\|yarn.lock\|pnpm-lock"; then
  echo "lockfile 변경 감지 → npm install 실행"
  npm install
fi
```

핵심은 `ORIG_HEAD`다. Git은 머지가 시작될 때 현재 HEAD를 `ORIG_HEAD`에 저장한다. `git diff-tree ORIG_HEAD HEAD`로 **이번 머지에서 바뀐 파일 목록**을 얻을 수 있다.

## lockfile 변경 감지 패턴

가장 흔한 post-merge 활용은 의존성 파일 변경 감지다.

```bash
#!/bin/sh
# .git/hooks/post-merge

changed_files() {
  git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD
}

needs_install() {
  changed_files | grep -qE "^(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$"
}

if needs_install; then
  echo "📦 의존성 변경 감지 — npm install 실행"
  npm install --prefer-offline
fi
```

![lockfile 변경 감지 패턴](/assets/posts/git-post-merge-hook-lockfile.svg)

`git diff-tree` 옵션 설명:

| 옵션 | 의미 |
|------|------|
| `-r` | 재귀적으로 하위 파일까지 |
| `--name-only` | 파일명만 출력 |
| `--no-commit-id` | 커밋 SHA 출력 안 함 |
| `ORIG_HEAD HEAD` | 머지 전·후 비교 범위 |

## 마이그레이션 자동 실행

DB 스키마 마이그레이션 파일이 머지됐을 때 자동으로 실행하는 패턴이다.

```bash
#!/bin/sh
# .git/hooks/post-merge

changed_files() {
  git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD
}

# 마이그레이션 파일 변경 여부 확인
if changed_files | grep -q "^migrations/"; then
  echo "🗄  마이그레이션 변경 감지"
  npm run db:migrate
fi

# 환경 변수 샘플 변경 확인
if changed_files | grep -q "\.env\.example$"; then
  echo "⚠  .env.example이 변경됐습니다. .env 파일을 확인하세요."
fi
```

## squash 머지 구분

`git merge --squash` 사용 시 `$1=1`이 전달된다. squash 머지는 단일 커밋으로 합쳐지므로 diff 범위 계산이 다를 수 있다.

```bash
#!/bin/sh
SQUASH=$1

if [ "$SQUASH" = "1" ]; then
  # squash 머지: 하나의 새 커밋만 추가됨
  CHANGED=$(git diff-tree -r --name-only --no-commit-id HEAD~1 HEAD)
else
  # 일반 머지: ORIG_HEAD ~ HEAD 비교
  CHANGED=$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD)
fi

echo "$CHANGED" | grep -q "package-lock.json" && npm install
```

## Husky에서 설정

```bash
# .husky/post-merge
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

if git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD \
    | grep -q "package-lock.json"; then
  echo "npm install 실행 중..."
  npm install --prefer-offline
fi
```

Husky 4.x 이하 방식(`package.json` 내 `"hooks"` 키)에서는 `post-merge`를 직접 등록한다.

```json
{
  "husky": {
    "hooks": {
      "post-merge": "if git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD | grep -q 'package-lock.json'; then npm install; fi"
    }
  }
}
```

## 주의: exit 1의 의미

`pre-commit`이나 `commit-msg`와 달리, post-merge에서 `exit 1`을 반환해도 **이미 완료된 머지가 취소되지 않는다**. 훅이 실패하면 터미널에 에러가 출력될 뿐이다.

머지 자체를 차단하려면 `pre-merge-commit` 훅을 사용한다. post-merge는 순수하게 "머지 후 해야 할 일"을 자동화하는 용도다.

---

**지난 글:** [pre-push 훅: push 전 테스트와 브랜치 보호](/posts/git-pre-push-hook/)

**다음 글:** [서버 사이드 훅: pre-receive, update, post-receive](/posts/git-server-side-hooks/)

<br>
읽어주셔서 감사합니다. 😊
