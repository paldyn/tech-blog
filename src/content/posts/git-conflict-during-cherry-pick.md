---
title: "Cherry-pick 충돌 심화: 연속 픽과 범위 픽 처리"
description: "범위 cherry-pick 중 충돌 발생 시 --continue, --skip, --abort 처리 흐름, -n 옵션으로 충돌 최소화, --quit 활용법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "cherry-pick", "충돌", "범위", "--continue"]
featured: false
draft: false
---

[지난 글](/posts/git-conflict-during-rebase/)에서 rebase 중 충돌을 커밋 단위로 처리하는 방법을 배웠다. cherry-pick도 범위나 여러 커밋을 지정하면 rebase와 비슷하게 충돌이 순차적으로 발생한다. 이번 글에서는 **여러 커밋을 픽할 때의 충돌 처리**를 심화 정리한다.

## 범위 cherry-pick의 충돌 구조

단일 커밋 cherry-pick과 달리, 범위나 여러 커밋을 지정하면 Git이 순서대로 각 커밋을 적용한다.

```bash
# abc1234 다음 커밋부터 def5678까지 순서대로 적용
git cherry-pick abc1234^..def5678

# 비연속 커밋 여러 개
git cherry-pick abc1234 def5678 ghi9012
```

중간 커밋에서 충돌이 나면 그 지점에서 작업이 중단된다. 이전에 이미 적용된 커밋들은 커밋된 상태로 남는다.

## 충돌 발생 시 세 가지 선택

![범위 Cherry-pick 중 충돌 처리](/assets/posts/git-conflict-during-cherry-pick-multi.svg)

### 1. 해결 후 계속

충돌 파일을 수정하고 `--continue`로 나머지 커밋을 이어서 적용한다.

```bash
# 충돌 파일 확인
git status

# 파일 수정 (마커 제거)
vim src/auth.py

# 스테이지에 올리기
git add src/auth.py

# 다음 커밋으로 진행
git cherry-pick --continue
```

### 2. 이 커밋 건너뛰기

해당 커밋의 변경이 불필요하거나 이미 다른 방식으로 반영됐을 때 사용한다.

```bash
git cherry-pick --skip
```

`--skip` 이후 나머지 커밋들은 계속 적용된다. 단, 건너뛴 커밋의 변경사항은 영구적으로 포기된다.

### 3. 전체 취소

```bash
git cherry-pick --abort
```

이미 적용된 커밋들(cherry-pick이 시작하기 전의 상태)로 롤백된다.

## -n 옵션: 충돌 횟수 줄이기

여러 커밋을 하나의 커밋으로 합치면서 충돌을 한 번에 처리하고 싶을 때 `-n`(no-commit)을 사용한다.

```bash
git cherry-pick -n abc1234 def5678 ghi9012
# 세 커밋의 변경사항이 모두 스테이지에 합산됨
# 충돌이 있다면 한 번에 처리 가능

# 충돌 해결 후 직접 커밋
git add .
git commit -m "apply three commits as one"
```

범위 픽의 경우에도 동일하게 사용할 수 있다.

```bash
git cherry-pick -n abc1234^..def5678
git commit -m "backport: fix auth and logging"
```

## --quit: 상태만 초기화하고 변경 유지

`--abort`와 달리 `--quit`는 cherry-pick 상태 파일(`.git/CHERRY_PICK_HEAD` 등)만 제거하고 워킹 트리와 스테이지의 변경사항은 유지한다.

```bash
git cherry-pick --quit
```

충돌 해결 중 잠시 다른 브랜치를 확인하거나 stash를 써야 할 때 유용하다.

```bash
# cherry-pick 상태를 벗어나 stash
git cherry-pick --quit
git stash

# 다른 작업 후 복귀
git stash pop
# 이제 수동으로 마저 처리
```

## 자주 충돌 나는 경우 예방 팁

cherry-pick 충돌이 잦다면 다음을 확인한다.

- **공백/개행 차이**: `-Xignore-all-space` 또는 `-Xignore-space-change`로 무시
- **이미 반영된 내용**: `git log --all --oneline --grep "키워드"`로 중복 확인
- **파일이 많이 달라진 경우**: cherry-pick 대신 직접 변경사항을 수동으로 작성

```bash
# 공백 차이 무시
git cherry-pick -Xignore-all-space abc1234

# 이미 적용됐는지 확인
git log --oneline --all | grep "fix: auth token"
```

![Cherry-pick 충돌 관련 옵션 정리](/assets/posts/git-conflict-during-cherry-pick-options.svg)

---

**지난 글:** [Rebase 중 충돌 처리: 커밋별 해결 전략](/posts/git-conflict-during-rebase/)

**다음 글:** [git stash 적용 중 충돌 처리](/posts/git-conflict-with-stash/)

<br>
읽어주셔서 감사합니다. 😊
