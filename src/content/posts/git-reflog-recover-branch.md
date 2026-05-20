---
title: "git reflog로 브랜치 복구하기"
description: "git branch -D로 삭제된 브랜치를 reflog에서 SHA를 찾아 재생성하는 방법, git fsck로 dangling commit을 조회하는 방법을 단계별로 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "reflog", "브랜치 복구", "fsck", "dangling commit"]
featured: false
draft: false
---

[지난 글](/posts/git-reflog-recover-commit/)에서 잃어버린 커밋을 reflog로 복구했다. 이번에는 `git branch -D`로 **브랜치 자체를 삭제한 경우** 복구하는 방법을 알아본다. 브랜치를 삭제해도 커밋 객체는 즉시 사라지지 않으므로 빠르게 행동하면 복구할 수 있다.

## 브랜치 삭제가 실제로 하는 일

`git branch -D feature/auth`는 `.git/refs/heads/feature/auth` 파일을 삭제한다. 브랜치는 커밋을 가리키는 포인터일 뿐이고, 커밋 객체는 여전히 `.git/objects/`에 남아 있다. GC가 실행되기 전까지 커밋은 **dangling object**로 존재한다.

![삭제된 브랜치 복구 흐름](/assets/posts/git-reflog-recover-branch-flow.svg)

## 복구 방법 1: reflog에서 SHA 찾기

브랜치가 존재했을 때 그 브랜치에서 checkout하거나 커밋한 기록이 HEAD reflog에 남아 있다.

```bash
# 실수: 브랜치 삭제
git branch -D feature/auth
# Deleted branch feature/auth (was abc1234).   ← SHA 메모!

# 즉시 reflog 확인
git reflog
# abc1234 HEAD@{1}: commit: feat: 인증 모듈 완성
# def5678 HEAD@{2}: commit: feat: 토큰 갱신
# ghi9012 HEAD@{3}: checkout: feature/auth → main

# grep으로 브랜치 관련 기록 검색
git reflog | grep "feature/auth"
# abc1234 HEAD@{1}: commit: ...
# ghi9012 HEAD@{3}: checkout: feature/auth → main

# 브랜치 마지막 커밋 = checkout 직전 HEAD = HEAD@{1}의 SHA
git checkout -b feature/auth abc1234
```

**팁**: `git branch -D` 실행 시 터미널이 `(was abc1234)` 형태로 SHA를 출력한다. 이 값을 바로 사용하면 reflog를 뒤질 필요가 없다.

## 복구 방법 2: 브랜치 전용 reflog

브랜치 자체의 reflog가 `.git/logs/refs/heads/`에 남아 있을 수 있다. 브랜치 파일(`.git/refs/heads/feature/auth`)은 삭제됐지만 로그 파일은 남는 경우가 있다.

```bash
# 브랜치 전용 reflog 확인
git reflog show feature/auth
# (브랜치 reflog 파일이 남아 있으면 출력됨)

# 마지막 커밋 SHA로 복구
git checkout -b feature/auth <SHA>
```

![브랜치 복구 추가 방법](/assets/posts/git-reflog-recover-branch-tips.svg)

## 복구 방법 3: git fsck

reflog에서 찾을 수 없다면 `git fsck`로 도달 불가 커밋(dangling commit) 전체를 조회한다.

```bash
# dangling commit 목록 출력
git fsck --unreachable 2>/dev/null | grep commit
# unreachable commit abc1234
# unreachable commit def5678
# ...

# 각 커밋 메시지 확인
git show --oneline --no-patch abc1234
# abc1234 feat: 인증 모듈 완성

# 원하는 SHA로 브랜치 복구
git checkout -b feature/auth abc1234
```

커밋이 많으면 메시지로 하나씩 확인하기 어렵다. 스크립트로 한 번에 보는 방법이다.

```bash
# 모든 dangling commit의 메시지 출력
git fsck --unreachable 2>/dev/null | grep commit | awk '{print $3}' | \
  while read sha; do
    echo "--- $sha"
    git show --oneline --no-patch "$sha" 2>/dev/null
  done
```

## 복구 방법 4: ORIG_HEAD 활용

`git merge`, `git rebase`, `git reset` 같은 위험한 동작 직전의 HEAD가 `ORIG_HEAD`에 저장된다. 머지하면서 브랜치가 사라진 경우에 유용하다.

```bash
# merge 후 브랜치 삭제
git merge feature/auth
git branch -D feature/auth

# ORIG_HEAD = merge 전 HEAD (feature/auth의 마지막 커밋일 수 있음)
git show ORIG_HEAD
git checkout -b feature/auth ORIG_HEAD
```

## 원격 브랜치에서 복구

`git push`로 원격에 올라간 브랜치라면 원격에서 가져오면 된다.

```bash
# 원격에 있으면 간단히 복구
git fetch origin feature/auth
git checkout -b feature/auth origin/feature/auth

# 또는
git checkout --track origin/feature/auth
```

원격에 올라간 브랜치는 로컬 reflog가 없어도 항상 복구할 수 있다. 중요한 브랜치는 `push`를 습관화하자.

## 복구 성공 확인

```bash
# 브랜치 복구 후 확인
git log --oneline feature/auth   # 커밋 이력 확인
git diff main feature/auth       # 변경사항 확인
git branch -v                    # 브랜치 목록 확인
```

## 예방: 실수 방지 설정

```bash
# -D 대신 -d 사용 → 머지되지 않은 브랜치는 삭제 거부
git branch -d feature/auth
# error: The branch 'feature/auth' is not fully merged.

# 브랜치 삭제 전 항상 push
git push origin feature/auth
git branch -D feature/auth   # 이제 안전하게 삭제
```

GC는 기본적으로 30일간 unreachable commit을 보존한다(`gc.reflogExpireUnreachable`). 삭제 직후 바로 시도하면 거의 항상 복구된다.

---

**지난 글:** [git reflog로 커밋 복구하기](/posts/git-reflog-recover-commit/)

<br>
읽어주셔서 감사합니다. 😊
