---
title: "git stash 주의사항과 함정"
description: "git stash 사용 시 자주 마주치는 함정들 — untracked 미포함, pop 충돌 후 이중 적용, GC에 의한 소실, 브랜치 공유 stash, 서브모듈 등을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "stash", "pitfalls", "주의사항", "함정"]
featured: false
draft: false
---

[지난 글](/posts/git-stash-vs-wip-commit/)에서 stash와 WIP 커밋을 비교했다. stash는 편리하지만 예상과 다르게 동작하는 몇 가지 함정이 있다. 이번에는 실무에서 자주 마주치는 stash의 주의사항을 모아 정리한다.

## 함정 총정리

![stash 주요 함정 5가지](/assets/posts/git-stash-pitfalls-list.svg)

## 함정 1: untracked 파일이 저장 안 됨

가장 흔한 실수다. `git status`에서 "Untracked files:"로 표시되는 새 파일은 기본 stash에서 제외된다.

```bash
# 새 파일 생성
touch src/new-component.js

git stash
# stash 후 확인
git status
# Untracked files:
#   src/new-component.js   ← 남아 있음!

# 해결: -u 옵션
git stash push -u
```

브랜치를 바꿨을 때 untracked 파일이 남아 있으면 다른 브랜치의 작업 공간을 오염시킬 수 있다.

## 함정 2: pop 충돌 후 이중 적용

`pop` 시 충돌이 나면 stash는 **삭제되지 않는다**. 여기서 주의할 점이 생긴다.

```bash
git stash pop
# CONFLICT — stash는 스택에 남아 있음

# 충돌 해결 후 자동으로 drop 안 됨
git add -A
# 실수: stash를 또 pop하면 이중 적용!
git stash pop   # ← 잘못된 동작

# 올바른 순서
git add src/conflict-file.js
git stash drop   # 수동으로 삭제
```

충돌 해결 후에는 반드시 `git stash drop`으로 수동 삭제해야 한다.

## 함정 3: clear는 복구 안 된다 (사실상)

`git stash clear`는 확인 메시지 없이 즉시 전체를 삭제한다.

![stash 수명과 GC](/assets/posts/git-stash-pitfalls-gc.svg)

삭제된 stash는 GC 실행 전까지 `git fsck --unreachable`로 dangling commit을 찾아 복구 시도할 수 있다. 하지만 `git gc`가 실행된 이후에는 완전히 사라진다.

```bash
# 실수로 clear 했을 때 즉시 시도
git fsck --unreachable 2>/dev/null | grep commit | awk '{print $3}' | while read sha; do
  git show --oneline "$sha" 2>/dev/null | head -1
done

# 찾은 SHA로 복원 시도
git stash apply <SHA>
```

GC 주기는 기본값이 2주다 (`gc.pruneExpire = 2.weeks.ago`). 이 기간 내에 시도하면 복구 가능성이 있다.

## 함정 4: stash는 브랜치를 구분하지 않는다

stash 스택은 전체 레포에서 공유된다. 어떤 브랜치에서 stash하든 같은 스택에 쌓인다.

```bash
# feature/a에서 stash
git checkout feature/a
git stash push -m "feature A WIP"

# feature/b에서 stash
git checkout feature/b
git stash push -m "feature B WIP"

# 어느 브랜치에서든 전체 목록 보임
git stash list
# stash@{0}: On feature/b: feature B WIP
# stash@{1}: On feature/a: feature A WIP

# feature/a에서 잘못된 stash pop 주의
git checkout feature/a
git stash pop   # stash@{0} = feature B WIP가 적용됨!
```

항상 `git stash list`로 확인 후 `stash@{N}`을 명시해서 적용하거나, `-m` 옵션으로 이름을 붙여두자.

```bash
# 안전하게 이름 붙이기
git stash push -m "feat/auth: 로그인 모달 WIP"

# 복원 시 명시적으로 지정
git stash list
git stash pop stash@{1}  # 정확한 인덱스 지정
```

## 함정 5: 서브모듈 변경은 저장 안 됨

서브모듈이 있는 프로젝트에서 서브모듈 내부의 변경은 상위 레포의 stash에 포함되지 않는다.

```bash
# 상위 레포에서 stash
git stash push -u

# 서브모듈 내부 변경은 그대로 남아 있음
cd submodule-dir
git status   # 변경사항 여전히 있음
```

서브모듈 변경을 저장하려면 각 서브모듈에서 별도로 stash해야 한다.

## 함정 6: --index 없이 apply 후 충돌

stash를 저장할 때 일부 파일이 staged 상태였는데, 복원 시 `--index` 없이 `apply`하면 staged 구분이 사라진다. 이후 `--index`로 다시 적용하면 이미 적용된 내용과 충돌이 생긴다.

```bash
# 저장 당시: api.js staged, ui.js unstaged
git stash push

# --index 없이 복원 → 둘 다 unstaged
git stash apply

# 이미 적용된 상태에서 --index 재적용 → 충돌
git stash apply --index   # CONFLICT!

# 올바른 순서: 처음부터 --index 사용
git checkout .   # 먼저 초기화
git stash apply --index
```

## 예방 체크리스트

```bash
# stash 전 확인
git status            # untracked 있으면 -u 옵션
git stash list        # 스택 현황 파악

# stash 저장 시
git stash push -u -m "브랜치명: 작업 내용"  # 이름 명시

# stash 복원 전
git stash list        # 대상 인덱스 확인
git stash show <ref>  # 내용 미리 확인
git stash apply stash@{N}  # 명시적 지정
```

---

**지난 글:** [git stash vs WIP 커밋 — 임시 저장 전략 비교](/posts/git-stash-vs-wip-commit/)

**다음 글:** [git reflog — 되돌린 이력까지 모두 기록](/posts/git-reflog-essence/)

<br>
읽어주셔서 감사합니다. 😊
