---
title: "삭제된 브랜치 복구하기"
description: "git branch -D로 삭제된 브랜치를 reflog, fsck, ORIG_HEAD를 활용해 복구하는 방법을 단계별로 설명한다. 원격 브랜치 활용과 예방 방법도 포함."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "브랜치 복구", "reflog", "fsck", "dangling"]
featured: false
draft: false
---

[지난 글](/posts/git-dangling-objects/)에서 dangling objects의 종류와 처리 방법을 알아봤다. 이번에는 실수로 삭제된 브랜치를 복구하는 전체 과정을 단계별로 살펴본다. 브랜치를 삭제해도 커밋 객체는 바로 사라지지 않기 때문에 빠르게 행동하면 거의 항상 복구할 수 있다.

## 브랜치 삭제가 실제로 하는 일

`git branch -D feature/auth`는 `.git/refs/heads/feature/auth` 파일(SHA-1 포인터)을 삭제한다. 커밋 객체 자체는 `.git/objects/`에 그대로 남아 있다. 브랜치 포인터만 없어진 것이므로 SHA를 알면 언제든지 복구할 수 있다.

![삭제된 브랜치 복구 의사결정 트리](/assets/posts/git-recover-deleted-branch-flow.svg)

## 방법 1: 터미널 출력에서 SHA 확인

`git branch -D` 실행 시 터미널에 삭제된 SHA를 출력한다.

```bash
git branch -D feature/auth
# Deleted branch feature/auth (was abc1234).
#                                  ^^^^^^^^ 이 SHA를 사용!

# 즉시 브랜치 복구
git checkout -b feature/auth abc1234
# 또는
git branch feature/auth abc1234
git checkout feature/auth
```

이것이 가장 빠르고 확실한 방법이다. 터미널 스크롤이 남아 있다면 반드시 먼저 확인한다.

## 방법 2: reflog에서 SHA 찾기

터미널 출력을 놓쳤다면 reflog에서 찾는다.

![브랜치 복구 실전 명령어](/assets/posts/git-recover-deleted-branch-commands.svg)

```bash
# HEAD reflog에서 브랜치 이름으로 검색
git reflog | grep "feature/auth"
# abc1234 HEAD@{1}: commit: feat: 인증 모듈 완성
# def5678 HEAD@{3}: checkout: moving from feature/auth to main

# 최근 checkout 기록으로 마지막 커밋 SHA 확인
git reflog --date=local | head -20

# 브랜치 복구
git checkout -b feature/auth abc1234
```

**팁**: reflog에서 `checkout: moving from feature/auth to main` 패턴의 직전 커밋이 해당 브랜치의 마지막 커밋이다.

## 방법 3: 브랜치 전용 reflog

브랜치 자체의 reflog가 `.git/logs/refs/heads/`에 남아 있을 수 있다.

```bash
# 브랜치 reflog 확인 (파일이 존재하면 출력)
cat .git/logs/refs/heads/feature/auth
# 0000000... abc1234 Kim Dev <kim@...> ... branch: Created from main
# abc1234 def5678 Kim Dev <kim@...> ... commit: feat: 추가

# 마지막 SHA(두 번째 컬럼의 마지막 값) 사용
git checkout -b feature/auth def5678
```

## 방법 4: git fsck로 dangling commit 검색

reflog에도 없다면(만료되었거나) `git fsck`로 저장소 전체에서 dangling commit을 찾는다.

```bash
# dangling commit 목록
git fsck --unreachable 2>/dev/null | grep "unreachable commit"

# 각 커밋 메시지 확인
git fsck --unreachable 2>/dev/null | grep "unreachable commit" | \
  awk '{print $3}' | \
  while read sha; do
    echo "=== $sha ==="
    git show --oneline --no-patch "$sha" 2>/dev/null
  done

# 원하는 커밋 발견 시 복구
git checkout -b feature/auth <sha>
```

## 방법 5: ORIG_HEAD 활용

merge, rebase, reset 같은 명령 직전의 HEAD가 `ORIG_HEAD`에 저장된다.

```bash
# 머지 후 브랜치를 삭제한 경우
git merge feature/auth
git branch -D feature/auth

# ORIG_HEAD가 merge 전 HEAD 상태를 가리킴
cat .git/ORIG_HEAD
git checkout -b feature/auth ORIG_HEAD
```

## 방법 6: 원격 저장소에서 복구

원격에 push된 브랜치라면 원격에서 가져오면 된다.

```bash
# 원격 브랜치 목록 확인
git branch -r | grep "feature/auth"
# origin/feature/auth

# 로컬에 복구
git checkout -b feature/auth origin/feature/auth
# 또는
git fetch origin feature/auth
git checkout -b feature/auth FETCH_HEAD
```

## 복구 후 확인

```bash
# 복구된 브랜치 커밋 이력 확인
git log --oneline feature/auth | head -10

# main 대비 변경사항 확인
git diff main..feature/auth --stat

# 브랜치가 정상적으로 보이면 작업 계속
git checkout feature/auth
```

## 예방: 삭제 전 체크

```bash
# 머지되지 않은 브랜치 삭제 시 에러 (소문자 -d)
git branch -d feature/auth
# error: The branch 'feature/auth' is not fully merged.

# 삭제 전 원격에 push
git push origin feature/auth
git branch -D feature/auth   # 이제 원격에 백업 있음

# 전략적으로 tag를 달아두기
git tag backup/feature/auth feature/auth
git branch -D feature/auth
# tag는 gc로 삭제되지 않음
```

GC의 기본 만료 기간(unreachable: 30일)이 지나기 전에 복구하면 거의 항상 성공한다. 다음 글에서는 브랜치가 아닌 개별 커밋이 고아가 된 경우를 복구하는 방법을 다룬다.

---

**지난 글:** [Git dangling objects 이해와 처리](/posts/git-dangling-objects/)

**다음 글:** [고아 커밋 복구하기](/posts/git-recover-orphan-commit/)

<br>
읽어주셔서 감사합니다. 😊
