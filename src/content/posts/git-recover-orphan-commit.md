---
title: "고아 커밋 복구하기"
description: "git reset, rebase, amend, detached HEAD 작업 후 생긴 고아 커밋을 reflog와 fsck로 찾아 브랜치나 cherry-pick으로 복구하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "고아 커밋", "reflog", "복구", "cherry-pick"]
featured: false
draft: false
---

[지난 글](/posts/git-recover-deleted-branch/)에서 삭제된 브랜치를 복구했다. 이번에는 브랜치가 아닌 **개별 커밋**이 고아 상태(orphan commit)가 된 경우를 복구하는 방법을 알아본다. `git reset`, `git rebase -i`, `git commit --amend` 후 "이전 커밋이 사라졌다"는 상황에서 사용하는 기술이다.

## 고아 커밋이란

어떤 브랜치, 태그, HEAD에서도 도달할 수 없는 커밋을 고아 커밋(orphan commit) 또는 dangling commit이라고 한다. 커밋 자체는 `.git/objects/`에 존재하지만 아무도 참조하지 않는 상태다.

![고아 커밋이 만들어지는 대표 시나리오](/assets/posts/git-recover-orphan-commit-scenarios.svg)

## 복구 도구: reflog가 첫 번째 선택

reflog는 HEAD가 이동한 모든 기록을 최대 90일간 보존한다. 고아 커밋을 만드는 대부분의 작업(`reset`, `rebase`, `amend`, `checkout`)은 HEAD를 이동시키므로 reflog에 이전 위치가 남아 있다.

```bash
# 전체 reflog (최근 순)
git reflog

# 예시 출력
# def5678 HEAD@{0}: reset: moving to HEAD~3
# abc1234 HEAD@{1}: commit: feat: 결제 완료 화면 추가  ← 찾는 커밋
# 111222  HEAD@{2}: commit: feat: 결제 폼 구현
# 333444  HEAD@{3}: commit: feat: 결제 모듈 초기화
```

`reset --hard HEAD~3`으로 3개 커밋이 사라진 상황에서 `HEAD@{1}`, `HEAD@{2}`, `HEAD@{3}`이 고아가 된 커밋들이다.

## 단계별 복구

![고아 커밋 복구 단계별 명령어](/assets/posts/git-recover-orphan-commit-steps.svg)

```bash
# 1. reflog에서 SHA 확인
git reflog | head -20

# 2. 커밋 내용 검증
git show abc1234 --stat
git show abc1234 -p   # 상세 diff

# 3a. 브랜치로 복구 (여러 커밋 묶음)
git checkout -b recover/feature abc1234

# 3b. 현재 브랜치에 cherry-pick (커밋 하나)
git cherry-pick abc1234

# 3c. 현재 HEAD를 해당 커밋으로 이동 (reset)
git reset --hard abc1234
```

## 연속 커밋 범위 복구

3개 커밋이 모두 필요하다면 범위로 cherry-pick한다.

```bash
# HEAD@{3} ~ HEAD@{1} 범위의 3개 커밋을 순서대로 적용
# (오래된 것 먼저 → 최신 순서)
git cherry-pick 333444^..abc1234
# 333444, 111222, abc1234 순서로 적용

# 또는 각각 순서대로 cherry-pick
git cherry-pick 333444
git cherry-pick 111222
git cherry-pick abc1234
```

## amend 후 원본 커밋 복구

`git commit --amend`는 새 커밋을 만들고 원본을 고아로 만든다. 원본이 `ORIG_HEAD`에 저장된다.

```bash
git commit --amend -m "수정된 메시지"

# 원본 커밋 확인
git show ORIG_HEAD

# 원본으로 되돌리기 (amend 취소)
git reset --hard ORIG_HEAD
```

`ORIG_HEAD`는 다음 amend나 reset 명령을 실행하면 덮어써진다. 빠르게 확인해야 한다.

## interactive rebase 후 원본 복구

`git rebase -i`로 squash/drop한 커밋들도 reflog에 남아 있다.

```bash
# rebase 전 상태 찾기
git reflog | grep "rebase-i (finish)\|rebase (start)"
# abc1234 HEAD@{5}: rebase -i (finish): returning to ...
# def5678 HEAD@{6}: rebase -i (start): checkout main

# rebase 시작 직전 HEAD (원본 브랜치 끝)
git show HEAD@{6}   # 또는 def5678

# 원본 브랜치 복구
git checkout -b original-work def5678
```

## detached HEAD에서 만든 커밋 복구

detached HEAD 상태에서 커밋한 후 `git checkout main`으로 이동하면 그 커밋이 고아가 된다.

```bash
# detached HEAD에서 커밋
git checkout abc1234
# HEAD is now at abc1234...
git commit -m "실험적 변경"  # → ghi9012 생성

# 다른 브랜치로 이동 → ghi9012가 고아됨
git checkout main

# reflog에서 찾기
git reflog | grep "commit: 실험적 변경"
# ghi9012 HEAD@{1}: commit: 실험적 변경

# 복구
git checkout -b experiment ghi9012
```

## fsck로 찾기 (reflog 만료 후)

reflog 만료 기간(기본 30일)이 지난 경우 `git fsck`로 찾는다.

```bash
# reflog를 제외한 순수 dangling commit
git fsck --no-reflogs --unreachable 2>/dev/null | grep commit

# 내용 조회 스크립트
git fsck --unreachable 2>/dev/null | \
  grep "unreachable commit" | \
  awk '{print $3}' | \
  while read sha; do
    echo "=== $sha ==="
    git log --oneline -1 "$sha" 2>/dev/null
  done
```

## 복구 성공 여부 확인

```bash
# 복구된 브랜치 확인
git log --oneline recover/feature | head -10

# 복구된 커밋이 원하는 파일 포함 여부
git show recover/feature --name-only

# main에 병합 전 diff 확인
git diff main..recover/feature
```

gc의 `--prune=now`를 실행하지 않는 한 최소 30일은 복구 기회가 있다. 실수를 발견했다면 즉시 `git reflog`를 확인하는 것이 최선이다. 다음 글에서는 저장소 손상(corruption)이 실제로 발생했을 때의 복구 방법을 다룬다.

---

**지난 글:** [삭제된 브랜치 복구하기](/posts/git-recover-deleted-branch/)

**다음 글:** [Git 저장소 손상 복구하기](/posts/git-corruption-recovery/)

<br>
읽어주셔서 감사합니다. 😊
