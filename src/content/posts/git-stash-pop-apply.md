---
title: "git stash pop과 apply — 복원 방식의 차이"
description: "git stash pop과 apply의 동작 차이, --index 옵션으로 스테이징 상태 복원, 충돌 발생 시 처리 방법을 상세히 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "stash", "pop", "apply", "스태시 복원"]
featured: false
draft: false
---

[지난 글](/posts/git-stash-list-show/)에서 `git stash list`와 `show`로 스태시 목록을 조회하는 방법을 살펴봤다. 이번에는 저장된 stash를 실제로 **복원하는 두 가지 방법** — `pop`과 `apply` — 의 차이를 구체적으로 알아본다.

## pop vs apply 기본 차이

두 명령 모두 stash를 워킹 트리에 적용하지만 결정적인 차이가 하나 있다.

![pop vs apply 비교](/assets/posts/git-stash-pop-apply-concept.svg)

| 명령 | 복원 | 스택에서 제거 |
|------|------|-------------|
| `pop` | ✓ | ✓ |
| `apply` | ✓ | ✗ |

`pop`은 복원 후 스택에서 항목을 삭제한다. `apply`는 복원만 하고 스택은 그대로 유지한다. 여러 브랜치에 같은 변경사항을 적용해야 할 때 `apply`를 쓴다.

## 기본 사용법

```bash
# pop: 가장 최근 stash 복원 + 삭제
git stash pop

# pop: 특정 stash 복원 + 삭제
git stash pop stash@{2}

# apply: 가장 최근 stash 복원 (스택 유지)
git stash apply

# apply: 특정 stash 복원 (스택 유지)
git stash apply stash@{1}
```

특정 stash를 지정하지 않으면 둘 다 `stash@{0}` — 가장 최근 항목 — 을 대상으로 한다.

## --index 옵션: 스테이징 상태 복원

기본적으로 `pop`/`apply`는 **스테이징 여부를 구분하지 않고** 모든 변경을 워킹 트리에만 적용한다. stash 저장 당시 스테이징했던 파일을 다시 스테이징 상태로 복원하려면 `--index` 옵션이 필요하다.

```bash
# 스테이징 상태도 함께 복원
git stash apply --index
git stash pop --index

# 차이 확인 예시
# stash 저장 시: src/api.js는 staged, src/ui.js는 unstaged
# --index 없이: 둘 다 unstaged로 복원
# --index 있이: src/api.js는 staged, src/ui.js는 unstaged로 복원
```

커밋 직전 단계에서 작업 흐름이 끊겼을 때 `--index`로 복원하면 스테이징을 다시 할 필요가 없다.

## 충돌 발생 시 처리

stash를 복원할 때 현재 워킹 트리의 변경사항과 충돌이 생길 수 있다.

![충돌 처리 흐름](/assets/posts/git-stash-pop-apply-conflict.svg)

**중요한 동작 차이**: `pop` 시 충돌이 발생하면 stash는 스택에서 제거되지 않는다. 충돌을 해결한 후 `git stash drop`으로 수동 삭제해야 한다.

```bash
# 충돌 발생
git stash pop
# CONFLICT (content): Merge conflict in src/auth.js
# The stash entry is kept in case you need it again.

# 충돌 파일 편집 후
git add src/auth.js

# stash 수동 삭제
git stash drop

# 또는 apply 사용 시 동일하게
git stash apply
# 충돌 해결 후
git add src/auth.js
# apply는 원래 스택을 유지하므로 별도 drop 필요
git stash drop
```

## apply가 더 안전한 경우

`apply`는 스택을 유지하므로 실수로 잘못 복원했을 때 다시 시도할 수 있다.

```bash
# 잘못된 브랜치에서 pop → 되돌리기 어려움
git checkout wrong-branch
git stash pop   # stash@{0} 사라짐

# apply는 안전
git checkout branch-a
git stash apply stash@{0}   # 적용 확인 후

git checkout branch-b
git stash apply stash@{0}   # 다른 브랜치에도 적용

# 다 됐으면 삭제
git stash drop stash@{0}
```

여러 브랜치에 같은 변경을 적용하거나, 복원 결과를 확인한 뒤 삭제하고 싶을 때는 `apply` + `drop` 조합이 낫다.

## 요약

- `pop` = `apply` + `drop`. 한 번에 끝내고 싶을 때
- `apply` = 복원만. 스택 보존, 재사용 가능
- `--index` = 스테이징 상태까지 복원
- 충돌 시 `pop`도 스택을 유지 → 해결 후 수동 `drop`

---

**지난 글:** [git stash list와 show — 스태시 목록 확인](/posts/git-stash-list-show/)

**다음 글:** [git stash drop과 clear — 스태시 삭제](/posts/git-stash-drop-clear/)

<br>
읽어주셔서 감사합니다. 😊
