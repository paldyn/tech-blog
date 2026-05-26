---
title: "pre-push 훅: push 전 테스트와 브랜치 보호"
description: "pre-push 훅의 실행 시점과 stdin으로 전달되는 push 정보(local-ref, remote-sha) 파싱 방법, 테스트 게이트 구성, main 브랜치 직접 push 차단 패턴, --no-verify 우회와 서버 정책의 관계를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "pre-push", "hooks", "브랜치보호", "테스트", "CI", "Husky"]
featured: false
draft: false
---

[지난 글](/posts/git-commit-msg-hook/)에서 commit-msg 훅으로 메시지 형식을 검증하는 방법을 다뤘다. 이번에는 커밋이 완료된 후 원격으로 **push하기 직전**에 실행되는 **pre-push** 훅을 살펴본다.

## pre-push 훅의 특징

`pre-push` 훅은 `git push`가 실행되고, 원격 서버로 데이터를 전송하기 전에 실행된다. `exit 0`이면 push가 진행되고, 비제로면 push가 취소된다.

`pre-commit`·`commit-msg`와 다른 가장 큰 특징: **stdin으로 push 정보가 전달된다**.

```
<local-ref> <local-sha1> <remote-ref> <remote-sha1>
```

예를 들어 `git push origin main`을 실행하면:

```
refs/heads/main abc1234 refs/heads/main def5678
```

형태로 훅에 전달된다. 여러 브랜치를 동시에 push할 경우 여러 줄이 온다.

![pre-push 훅 실행 흐름](/assets/posts/git-pre-push-hook-flow.svg)

## 기본 훅 작성

```bash
#!/bin/sh
# .githooks/pre-push

REMOTE="$1"
URL="$2"

echo "Pushing to $REMOTE ($URL)..."

# stdin에서 push 정보 읽기
while read local_ref local_sha remote_ref remote_sha; do

  # 빈 sha = 브랜치 삭제 push — 테스트 스킵
  if [ "$local_sha" = "0000000000000000000000000000000000000000" ]; then
    continue
  fi

  # 테스트 실행
  npm test
  if [ $? -ne 0 ]; then
    echo "Tests failed. Push cancelled."
    exit 1
  fi

done

exit 0
```

`0000...000` SHA는 삭제 push(원격 브랜치 제거)를 의미한다. 이 경우 테스트 실행이 불필요하므로 건너뛴다.

## main 브랜치 직접 push 차단

팀에서 PR을 통해서만 main에 머지하도록 강제할 때, 로컬에서 1차 방어선으로 pre-push 훅을 활용한다.

```bash
#!/bin/sh
# main과 master 직접 push 차단

PROTECTED_BRANCHES="^(refs/heads/main|refs/heads/master)$"

while read local_ref local_sha remote_ref remote_sha; do
  if echo "$remote_ref" | grep -qE "$PROTECTED_BRANCHES"; then
    echo ""
    echo "! 보호된 브랜치에 직접 push할 수 없습니다: $remote_ref"
    echo "  PR을 통해 머지하세요."
    echo ""
    exit 1
  fi
done

exit 0
```

![브랜치 보호와 테스트 게이트](/assets/posts/git-pre-push-hook-protect.svg)

## 새 커밋에만 테스트 실행

원격에 이미 있는 커밋은 테스트할 필요가 없다. 새로 추가되는 커밋만 검사한다.

```bash
#!/bin/sh
while read local_ref local_sha remote_ref remote_sha; do

  # remote_sha가 00...0이면 새 브랜치 — 모든 커밋이 새것
  if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
    RANGE="$local_sha"
  else
    RANGE="$remote_sha..$local_sha"
  fi

  # 새 커밋이 있을 때만 테스트
  if git log "$RANGE" --oneline | grep -q .; then
    npm test
    [ $? -ne 0 ] && exit 1
  fi

done

exit 0
```

이미 CI에서 통과한 커밋은 다시 테스트하지 않아도 되므로 전략적으로 범위를 제한할 수 있다.

## Husky와 함께 설정

```bash
# .husky/pre-push
#!/bin/sh

# main/master 직접 push 차단
REMOTE="$1"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo "main/master 브랜치는 직접 push가 불가합니다. PR을 이용하세요."
  exit 1
fi

# 스모크 테스트 (빠른 것만)
npm run test:smoke
```

## --no-verify와 서버 정책

`git push --no-verify`로 pre-push 훅을 우회할 수 있다. 이 때문에 pre-push 훅은 **로컬 1차 방어선**일 뿐, 완전한 보안 정책이 될 수 없다.

진정한 강제는 **GitHub Branch protection rules**로 서버 측에서 설정한다.

```
Settings → Branches → Branch protection rules → main
☑ Require a pull request before merging
☑ Require status checks to pass before merging
☑ Require signed commits (선택)
☑ Restrict who can push to matching branches
```

이 설정을 하면 PR 없이, 또는 CI가 실패한 상태로는 main에 push가 불가능하다. `--no-verify`로 로컬 훅을 우회해도 서버에서 차단된다.

## 훅 체인 정리

| 훅 | 시점 | 우선 순위 |
|------|------|------|
| `pre-commit` | 커밋 직전 | 빠른 lint/format |
| `commit-msg` | 메시지 확정 직전 | 메시지 형식 |
| `pre-push` | push 직전 | 테스트/브랜치 정책 |
| 서버 `pre-receive` | 서버 수신 직전 | 최종 강제 |

이 세 훅(`pre-commit` → `commit-msg` → `pre-push`)을 함께 구성하면 코드 품질, 메시지 표준, push 정책을 로컬에서 자동으로 검증하는 완전한 파이프라인이 완성된다.

---

**지난 글:** [commit-msg 훅: 커밋 메시지 형식 자동 검증](/posts/git-commit-msg-hook/)

<br>
읽어주셔서 감사합니다. 😊
