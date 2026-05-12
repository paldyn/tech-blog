---
title: "rebase --onto: 특정 범위 커밋만 옮기기"
description: "git rebase --onto의 세 인자 구조를 이해하고, 서브 브랜치 이동, 중간 커밋 제거, 다른 베이스로 재배치 등 실전 활용 패턴을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "rebase", "--onto", "브랜치", "히스토리"]
featured: false
draft: false
---

[지난 글](/posts/git-rebase-interactive/)에서 인터랙티브 rebase로 커밋을 편집하는 방법을 살펴봤다. `git rebase --onto`는 좀 더 정밀한 제어가 필요할 때 사용한다. 단순히 베이스를 바꾸는 것이 아니라 **이동할 커밋의 범위를 직접 지정**할 수 있다.

## 기본 rebase의 한계

`git rebase main`은 현재 브랜치가 `main`에서 분기한 이후의 **모든** 커밋을 재적용한다. 하지만 서브 브랜치(`feature2`가 `feature1` 위에 분기한 경우)에서 `feature2`의 커밋만 다른 곳으로 옮기고 싶다면 기본 `rebase`로는 안 된다.

## --onto 문법

```
git rebase --onto <new-base> <exclude-from> [<branch>]
```

- `<new-base>`: 커밋들을 붙일 새 베이스
- `<exclude-from>`: 이 커밋(포함) 이후부터 `<branch>` 사이의 커밋을 선택
- `<branch>`: 이동할 커밋의 끝 (생략 시 HEAD)

![--onto 동작 원리](/assets/posts/git-rebase-onto-concept.svg)

## 시나리오 1: 서브 브랜치를 main으로 이동

`feature2`가 `feature1` 위에서 작업되었는데, `feature1`은 아직 미완성이고 `feature2`는 독립적으로 main에 합치고 싶은 경우다.

```bash
# feature2의 커밋(G1, G2)만 main 위로 이동
git rebase --onto main feature1 feature2
#            ↑         ↑        ↑
#          새 베이스  제외 기준  이동 대상
```

`feature1`에서 `feature2`의 끝까지의 커밋(G1, G2)이 `main` 위로 이동한다.

## 시나리오 2: 중간 커밋 범위 삭제

커밋 이력에서 C3~C5 사이의 커밋을 제거하고 싶을 때:

```bash
# C5 다음 커밋부터를 C2에 붙이기 (C3, C4, C5 제거 효과)
git rebase --onto C2 C5 main
```

`--onto`에 커밋 해시를 직접 쓸 수도 있다.

## 시나리오 3: 브랜치를 다른 원격으로 재배치

`feature`를 `origin/main` 기준이 아닌 `origin/staging` 위에 재배치:

```bash
git rebase --onto origin/staging origin/main feature
```

![--onto 활용 패턴](/assets/posts/git-rebase-onto-usecases.svg)

## 커밋 범위 지정 트릭

```bash
# HEAD~3 부터 HEAD까지만 이동 (최근 3개)
git rebase --onto main HEAD~3

# 특정 해시 기반
git rebase --onto abc123 def456 feature
```

## --onto 후 처리

```bash
# 재배치 후 main을 fast-forward
git switch main
git merge --ff-only feature2

# 원래 feature1은 영향 없음 (커밋 그대로 존재)
git log --oneline feature1
```

## 실수 복구

`--onto` 후 원 상태로 돌아가려면:

```bash
# rebase 중이라면
git rebase --abort

# rebase 완료 후 되돌리기
git reflog
git reset --hard HEAD@{N}  # 이전 상태로
```

`--onto`는 `reflog`를 참고해 안전하게 복구할 수 있다.

---

**지난 글:** [Interactive Rebase: 커밋 수정·합치기·순서 바꾸기](/posts/git-rebase-interactive/)

**다음 글:** [Rebase vs Merge: 어떤 것을 선택해야 할까](/posts/git-rebase-vs-merge/)

<br>
읽어주셔서 감사합니다. 😊
