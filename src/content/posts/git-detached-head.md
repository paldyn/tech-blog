---
title: "Detached HEAD: 브랜치 없는 커밋 상태 이해하기"
description: "Detached HEAD 상태가 발생하는 원인, 그 상태에서 커밋이 사라지는 원리, 브랜치 생성으로 작업을 보존하는 방법과 reflog 복구까지 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "Detached HEAD", "HEAD", "브랜치", "reflog"]
featured: false
draft: false
---

[지난 글](/posts/git-checkout-vs-switch/)에서 `git switch`와 `git checkout`의 차이를 다뤘다. 이번에는 `git switch --detach`나 커밋 해시로 체크아웃할 때 나타나는 **Detached HEAD** 상태를 살펴본다. 처음 보면 당황스럽지만, 원리를 알면 유용하게 활용할 수 있다.

## Detached HEAD란

정상 상태에서 HEAD는 브랜치를 가리키고, 브랜치가 특정 커밋을 가리킨다.

```
HEAD → main → C3
```

Detached HEAD는 HEAD가 브랜치를 거치지 않고 커밋을 직접 가리키는 상태다.

```
HEAD → C2 (브랜치 없음)
```

`cat .git/HEAD`로 확인하면 정상일 때는 `ref: refs/heads/main`, Detached HEAD일 때는 SHA-1 해시가 직접 들어 있다.

![Detached HEAD 개념](/assets/posts/git-detached-head-concept.svg)

## 어떻게 진입하나

```bash
# 특정 커밋으로 이동
git switch --detach abc1234
git checkout abc1234           # 구 방식

# 태그로 이동
git switch --detach v1.0.0

# 원격 추적 브랜치로 이동
git checkout origin/main       # 로컬 브랜치 없이 원격 상태 확인
```

## 진입 시 Git의 경고

```
You are in 'detached HEAD' state. You can look around, make experimental
changes and commit them, and you can discard any commits you make in this
state without impacting any branches by switching back to a branch.
```

이 상태에서 커밋하면 어떤 브랜치에도 속하지 않는 커밋이 생성된다.

## 위험: 작업한 커밋이 사라질 수 있다

Detached HEAD에서 커밋을 몇 개 만든 뒤 다른 브랜치로 전환하면, 그 커밋들은 어떤 브랜치 포인터도 참조하지 않는다. Git의 가비지 컬렉션이 실행되면 삭제된다.

```bash
# Detached HEAD에서 커밋
git commit -m "실험적 변경"  # 어떤 브랜치도 이 커밋을 가리키지 않음
git switch main              # 이 시점에 경고 메시지 출력
```

```
Warning: you are leaving 1 commit behind, not connected to any of your branches:
  abc1234 실험적 변경
```

## 대처 방법

![Detached HEAD 대처 방법](/assets/posts/git-detached-head-recovery.svg)

### 1. 커밋을 보존하고 싶을 때

```bash
# 현재 위치에서 새 브랜치 생성 → 포인터가 생겨 GC에서 보호됨
git switch -c experiment-results
git branch save-my-work HEAD  # 동일 효과
```

### 2. 탐색만 하고 버릴 때

```bash
git switch main   # 또는 이전 브랜치로
```

Detached 상태에서 커밋 없이 떠나면 아무것도 잃지 않는다.

### 3. 이미 전환 후 커밋이 생각났을 때

```bash
git reflog
# → abc1234 HEAD@{3}: commit: 실험적 변경

git branch recovered-work abc1234
```

reflog는 기본 90일간 보존된다.

## 합법적 활용: 과거 코드 탐색

Detached HEAD는 의도적으로 쓸 때도 있다.

```bash
# 릴리스 태그 시점의 동작 확인
git switch --detach v1.2.3

# 빌드·테스트만 하고 복귀
npm run build
git switch main
```

이 경우에는 커밋을 만들지 않으므로 위험이 없다.

## 요약

| 상황 | 대응 |
|------|------|
| Detached에서 커밋 보존 | `git switch -c 새브랜치명` |
| 탐색 후 원래 브랜치로 | `git switch main` |
| 이미 전환 후 복구 | `git reflog` → `git branch` |

---

**지난 글:** [git checkout vs git switch: 브랜치 전환 명령 비교](/posts/git-checkout-vs-switch/)

<br>
읽어주셔서 감사합니다. 😊
