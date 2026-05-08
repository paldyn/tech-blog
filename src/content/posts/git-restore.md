---
title: "git restore: 파일을 원하는 상태로 되돌리기"
description: "git restore의 두 모드(워킹트리 복원, 스테이징 취소)와 --source 옵션으로 특정 커밋에서 파일을 가져오는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "git restore", "파일 복원", "언스테이징", "되돌리기"]
featured: false
draft: false
---

[지난 글](/posts/git-add-update/)에서 `git add -u`로 추적 파일만 스테이징하는 법을 다뤘다. 이번에는 반대 방향, 스테이징을 취소하거나 파일 내용을 되돌리는 `git restore`를 살펴본다. Git 2.23에서 `git checkout`의 파일 복원 기능을 분리해 만든 명령이다.

## git restore의 두 가지 모드

`git restore`는 크게 두 가지 동작을 한다.

1. **워킹트리 복원**: 수정된 파일을 인덱스(스테이징 영역) 상태로 되돌림
2. **스테이징 취소**: 인덱스를 HEAD 커밋 상태로 되돌림 (워킹트리는 유지)

![git restore 두 가지 모드](/assets/posts/git-restore-modes.svg)

## 모드 1: 워킹트리 복원

```bash
# 파일을 수정했지만 아직 스테이징 전, 되돌리고 싶을 때
echo "wrong change" >> src/app.js
git restore src/app.js   # 인덱스 상태로 복원
```

`git status`에서 `Changes not staged for commit`에 있는 파일에 작용한다.

```bash
# 전체 워킹트리를 인덱스 상태로
git restore .

# 구버전 동등 명령
git checkout -- src/app.js
```

**⚠ 주의**: 이 명령으로 되돌린 변경은 **복구할 수 없다**. 커밋도 안 되고 reflog에도 없으므로 신중하게 사용해야 한다. 불확실하면 `git stash`로 임시 저장 후 실행한다.

## 모드 2: 스테이징 취소 (언스테이징)

```bash
# 실수로 스테이징한 파일을 되돌리기
git add .env.local
git restore --staged .env.local   # 언스테이징 (파일 내용은 그대로)
git status
# Untracked files:
#       .env.local
```

`--staged` 플래그는 인덱스를 HEAD 커밋 상태로 되돌린다. 워킹트리의 실제 파일은 건드리지 않는다.

```bash
# 구버전 동등 명령
git reset HEAD .env.local
```

## 두 모드 동시 적용

```bash
git restore --staged --worktree src/app.js
# 또는 단축형
git restore -SW src/app.js
```

인덱스와 워킹트리 모두 HEAD 상태로 되돌린다. 스테이징과 수정 모두 없애고 싶을 때 사용한다.

## --source: 특정 커밋에서 파일 복원

기본은 인덱스(모드 1) 또는 HEAD(모드 2)가 소스지만, `--source`로 다른 출처를 지정할 수 있다.

```bash
# 두 커밋 전 상태로 파일 복원
git restore --source HEAD~2 src/config.js

# 특정 커밋 해시에서 복원
git restore --source a3f9d21 src/auth.js

# 다른 브랜치의 파일 가져오기
git restore --source feature/login src/login.js
```

![--source 옵션 사용](/assets/posts/git-restore-source.svg)

`--source`를 사용하면 기본적으로 워킹트리만 변경된다. 스테이징까지 하려면 `--staged`를 추가한다.

```bash
git restore --source HEAD~1 --staged --worktree config.js
git commit -m "revert: restore config to previous version"
```

## checkout과 restore의 관계

| 구버전 (`git checkout`) | 신버전 (`git restore`) |
|------------------------|----------------------|
| `git checkout -- file` | `git restore file` |
| `git checkout HEAD -- file` | `git restore --source HEAD file` |
| `git reset HEAD file` | `git restore --staged file` |

Git 2.23 이전에는 `git checkout`이 브랜치 전환과 파일 복원을 모두 담당했다. 헷갈리는 경우가 많아서 두 명령으로 분리됐다.

## 실전 시나리오

```bash
# 시나리오: 파일 수정 후 일부만 되돌리고 싶다
git add -p src/app.js   # 원하는 변경만 스테이징
git restore src/app.js  # 스테이징 안 된 나머지 변경을 버림
git commit -m "feat: add validation"

# 시나리오: 실수로 전체를 add했을 때
git add -A
git restore --staged config/secret.json   # 민감한 파일 언스테이징
git commit -m "feat: add feature"

# 시나리오: 파일을 완전히 망가뜨렸을 때
git restore --source HEAD src/critical.js   # 마지막 커밋 버전으로 복원
```

`git restore`는 `git reset`보다 안전하고 의미가 명확하다. 파일 단위로 되돌리는 작업이라면 `git restore`를 우선 선택하는 것이 좋은 습관이다.

---

**지난 글:** [git add -u: 추적 중인 파일만 골라 스테이징하기](/posts/git-add-update/)

**다음 글:** [git reset: soft·mixed·hard 세 가지 모드 완전 정복](/posts/git-reset-types/)

<br>
읽어주셔서 감사합니다. 😊
