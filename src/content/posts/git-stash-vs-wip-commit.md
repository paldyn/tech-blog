---
title: "git stash vs WIP 커밋 — 임시 저장 전략 비교"
description: "git stash와 WIP(Work In Progress) 커밋 방식의 차이, 각각 언제 써야 하는지, 협업 시 고려사항을 비교 분석한다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "stash", "WIP", "임시 저장", "워크플로"]
featured: false
draft: false
---

[지난 글](/posts/git-stash-branch/)에서 `stash branch`로 충돌 없이 stash를 새 브랜치로 꺼내는 방법을 다뤘다. 작업 중간에 다른 일을 해야 할 때 두 가지 선택지가 있다 — `git stash`로 임시 저장하거나, 미완성 상태를 **커밋으로 남기는** WIP 커밋 패턴을 쓰는 것이다. 이번에는 두 방법의 차이와 선택 기준을 정리한다.

## 두 방식 한눈에 비교

![stash vs WIP 커밋 비교](/assets/posts/git-stash-vs-wip-commit-compare.svg)

핵심 차이는 **공유 가능성**과 **지속성**이다. stash는 로컬 전용이고 GC 후 사라질 수 있다. WIP 커밋은 push하면 원격에 영구 보존된다.

## git stash 방식

```bash
# 작업 중단
git stash push -u -m "feature: auth modal WIP"

# 다른 브랜치 작업
git checkout hotfix/crash
# ... 작업 후 커밋 ...

# 돌아와서 복원
git checkout feature/auth
git stash pop
```

**적합한 상황**:
- 몇 시간 이내의 단기 전환
- 로컬에서만 작업하는 개인 작업
- stash가 2~3개 이하로 관리 가능한 경우

## WIP 커밋 방식

미완성 상태를 커밋으로 남기고, 나중에 `reset`으로 되돌리는 패턴이다.

![WIP 커밋 패턴](/assets/posts/git-stash-vs-wip-commit-flow.svg)

```bash
# 작업 중단 — 전부 커밋
git add -A
git commit -m "WIP: auth modal — 미완성, reset 예정"

# 다른 작업 후 복귀
git checkout feature/auth
git reset HEAD~1   # 커밋 취소, 변경사항은 unstaged로 복원

# 또는 staged 유지
git reset --soft HEAD~1
```

**적합한 상황**:
- 하루 이상 장기 중단
- 팀원과 공유하거나 백업이 필요할 때
- CI/CD에서 중간 상태를 확인해야 할 때
- 여러 컴퓨터에서 작업 이어가기

## 실전 비교: 같은 시나리오

feature 브랜치에서 작업 중 hotfix가 들어왔다.

```bash
# === stash 방식 ===
git stash push -u -m "feature/auth WIP"
git checkout main
git checkout -b hotfix/login
# ... 수정 후 커밋, push ...
git checkout feature/auth
git stash pop

# === WIP 커밋 방식 ===
git add -A
git commit -m "WIP: do not review — auth modal"
git checkout main
git checkout -b hotfix/login
# ... 수정 후 커밋, push ...
git checkout feature/auth
git reset HEAD~1
```

두 방식 모두 결과는 같다. 차이는 WIP 커밋은 `git log`에 보이고 push할 수 있다는 점이다.

## 주의: WIP 커밋을 push할 때

WIP 커밋을 원격에 push하면 팀원이 볼 수 있다. 관례상 커밋 메시지에 `WIP:` 또는 `[WIP]` 접두사를 붙여 미완성임을 알린다.

```bash
# 좋은 WIP 커밋 메시지
git commit -m "WIP: auth modal — 검증 로직 미구현"
git commit -m "[WIP] refactor: 리팩토링 진행 중"

# PR draft 기능과 함께 사용
git push origin feature/auth
# → GitHub에서 Draft PR로 올리면 리뷰 요청이 없음을 명시
```

## WIP 커밋 정리 방법

feature 작업이 완료되면 WIP 커밋을 정리한다.

```bash
# 방법 1: amend (가장 최근 WIP 커밋일 때)
git add -A
git commit --amend -m "feat: auth modal 구현"

# 방법 2: rebase -i (여러 WIP가 쌓였을 때)
git rebase -i HEAD~3
# WIP 커밋들을 squash 또는 fixup

# 방법 3: 단순 reset 후 재커밋
git reset HEAD~2   # WIP 2개 취소
git add -A
git commit -m "feat: auth modal 구현"
```

## 선택 가이드

| 상황 | 추천 |
|------|------|
| 잠깐 다른 브랜치 확인 | stash |
| 퇴근 전 저장 (재개 필요) | WIP 커밋 + push |
| 팀원에게 중간 상태 공유 | WIP 커밋 + push |
| 여러 컴퓨터 이어 작업 | WIP 커밋 + push |
| stash 2개 이상 쌓임 | WIP 커밋으로 전환 고려 |

stash는 간편하지만 "나중에 pop 안 한 stash"가 쌓이면 관리가 어렵다. 하루 이상 지나거나 팀과 공유가 필요한 경우라면 WIP 커밋이 더 안전하다.

---

**지난 글:** [git stash branch — 스태시를 새 브랜치로 변환](/posts/git-stash-branch/)

**다음 글:** [git stash 주의사항과 함정](/posts/git-stash-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
