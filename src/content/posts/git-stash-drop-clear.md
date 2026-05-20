---
title: "git stash drop과 clear — 스태시 삭제"
description: "git stash drop으로 특정 스태시를 삭제하고 clear로 전체를 제거하는 방법, drop 후 인덱스 재번호 동작, 실수 방지 팁을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "stash", "drop", "clear", "스태시 삭제"]
featured: false
draft: false
---

[지난 글](/posts/git-stash-pop-apply/)에서 `pop`과 `apply`로 stash를 복원하는 방법을 다뤘다. stash 스택을 관리하다 보면 불필요한 항목을 제거해야 할 때가 온다. 이번에는 `drop`과 `clear`를 통해 stash를 안전하게 삭제하는 방법을 알아본다.

## drop: 특정 항목 삭제

`git stash drop`은 스택에서 특정 stash 하나를 제거한다.

![stash drop vs clear](/assets/posts/git-stash-drop-clear-flow.svg)

```bash
# 가장 최근 stash(stash@{0}) 삭제
git stash drop

# 특정 인덱스 삭제
git stash drop stash@{1}

# 삭제 전 목록 확인
git stash list
# stash@{0}: On main: feature WIP
# stash@{1}: On main: hotfix 시도
# stash@{2}: On main: 실험
git stash drop stash@{1}
git stash list
# stash@{0}: On main: feature WIP
# stash@{1}: On main: 실험  ← 번호 재정렬
```

## 인덱스 재번호 주의

drop 후 스택 인덱스가 자동으로 재번호된다.

![drop 후 인덱스 재번호](/assets/posts/git-stash-drop-clear-renumber.svg)

`stash@{1}`을 삭제하면 `stash@{2}`가 `stash@{1}`이 된다. 쉘 스크립트에서 stash 인덱스를 하드코딩할 때 반드시 고려해야 한다.

```bash
# 위험한 패턴 (인덱스가 변할 수 있음)
for i in 1 2 3; do
  git stash drop stash@{$i}  # 순서가 바뀌며 의도치 않은 항목 삭제
done

# 안전한 패턴: 항상 최신(0)을 삭제하거나 pop 사용
git stash pop   # 복원 + 삭제를 원할 때
git stash drop  # 복원 없이 삭제만 원할 때 (반복 시 인덱스 고정됨)
```

## clear: 전체 삭제

`git stash clear`는 스택에 있는 모든 stash를 한 번에 제거한다.

```bash
git stash list
# stash@{0}: On main: A
# stash@{1}: On main: B
# stash@{2}: On main: C

git stash clear

git stash list
# (아무것도 출력 안 됨)
```

**주의**: `clear`로 삭제한 stash는 즉시 접근할 수 없다. `git reflog`에 dangling commit으로 잠시 남아 있다가 GC 이후 완전히 사라진다.

## stash 복구 가능성

`drop`이나 `clear`로 삭제한 stash는 `git reflog`로 복구를 시도할 수 있다.

```bash
# 삭제된 stash의 SHA 찾기
git fsck --unreachable | grep commit

# 또는 reflog에서
git log --walk-reflogs --oneline | grep "stash"

# SHA로 직접 복원
git stash apply <SHA>
```

GC(`git gc`)가 실행되기 전까지는 dangling commit이 남아 있어 복구 가능성이 있다. 하지만 GC 후에는 완전히 사라지므로 `clear` 전에 반드시 목록을 확인한다.

## 실전 정리 워크플로

작업이 완료된 후 stash를 정리하는 일반적인 흐름이다.

```bash
# 1. 목록 확인
git stash list

# 2. 필요한 항목 복원
git stash pop stash@{0}

# 3. 더 이상 필요 없는 항목 정리
git stash drop stash@{0}   # 하나씩

# 4. 전부 필요 없으면
git stash clear
```

`pop`은 복원 후 자동 삭제이지만, `apply`로 복원한 경우 별도로 `drop`을 호출해야 한다는 점을 기억하자.

---

**지난 글:** [git stash pop과 apply — 복원 방식의 차이](/posts/git-stash-pop-apply/)

**다음 글:** [git stash와 미추적 파일 — untracked 포함 저장](/posts/git-stash-untracked/)

<br>
읽어주셔서 감사합니다. 😊
