---
title: "git stash --keep-index — 스테이징 유지하며 저장"
description: "git stash --keep-index 옵션으로 스테이징 상태를 유지하면서 unstaged 변경을 임시 저장하는 방법과 커밋 전 테스트 워크플로를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "stash", "keep-index", "staging", "테스트 워크플로"]
featured: false
draft: false
---

[지난 글](/posts/git-stash-untracked/)에서 untracked 파일을 포함해 stash하는 방법을 알아봤다. 이번에는 반대 방향 — **스테이징 상태를 유지하면서** unstaged 변경만 stash에 저장하는 `--keep-index` 옵션을 살펴본다.

## --keep-index란?

기본 `git stash`는 staged/unstaged 구분 없이 모든 변경을 저장하고 워킹 트리를 HEAD 상태로 되돌린다. `--keep-index`는 **스테이징 영역(index)을 건드리지 않고** unstaged 변경만 stash에 넣는다.

![--keep-index 동작 원리](/assets/posts/git-stash-keep-index-concept.svg)

```bash
# 상태 확인
git status
# Changes to be committed (staged):
#   modified: src/api.js
# Changes not staged:
#   modified: src/ui.js

# --keep-index 적용
git stash push --keep-index

# 결과
git status
# Changes to be committed (staged):
#   modified: src/api.js   ← 유지됨!
# (ui.js는 stash에 저장됨)
```

staged 파일은 그대로 남아 있고 unstaged 파일만 stash 스택으로 이동한다.

## 핵심 사용 시나리오: 커밋 전 테스트

가장 일반적인 사용 케이스는 **스테이징된 변경만으로 테스트를 돌려보는** 것이다.

![커밋 전 테스트 워크플로](/assets/posts/git-stash-keep-index-workflow.svg)

커밋하려는 변경(staged)과 아직 미완성인 변경(unstaged)이 섞여 있을 때, 커밋 대상만 격리해서 테스트하고 싶다.

```bash
# 1. 커밋할 파일 스테이징
git add src/api.js

# 2. unstaged 변경 임시 저장 (staged는 유지)
git stash push --keep-index

# 3. 테스트 실행 — staged 변경만 있는 상태
npm test

# 4. 테스트 통과 시 커밋
git commit -m "feat: API endpoint 추가"

# 5. unstaged 변경 복원
git stash pop
```

이 패턴은 "이 커밋만 배포했을 때 문제없나?" 를 확인하는 데 유용하다.

## --keep-index와 -u 조합

`-u`(untracked 포함)와 함께 써서 untracked 파일도 stash에 넣으면서 staged는 유지할 수 있다.

```bash
git status
# Staged:    src/api.js
# Unstaged:  src/ui.js
# Untracked: src/new-helper.js

git stash push --keep-index -u

git status
# Staged:    src/api.js   ← 유지
# (ui.js, new-helper.js 모두 stash에)
```

## 주의: stash에 staged 내용도 저장됨

`--keep-index`를 써도 stash 객체 자체에는 staged 변경이 포함된다. "staged는 stash에 안 들어간다"가 아니라 "워킹 트리에서 staged를 제거하지 않는다"는 의미다.

```bash
# stash 내용 확인
git stash show -p
# diff --git a/src/api.js ...  ← staged였던 파일도 stash에 있음
# diff --git a/src/ui.js ...   ← unstaged 파일도 stash에 있음
```

따라서 `stash pop`으로 복원하면 api.js 변경이 staged와 stash 양쪽에 있어 충돌이 생길 수 있다. 이 경우 `pop` 대신 `drop`으로 삭제하거나, 복원 시 충돌을 해결한다.

## pre-commit 훅에서 활용

Husky나 lint-staged 같은 도구들이 내부적으로 이 패턴을 활용한다. `git commit` 실행 시:

1. 스테이징 영역 저장 (`--keep-index`)
2. 스테이징된 파일만으로 린트/포맷 검사
3. 검사 통과 시 커밋 진행
4. 임시 stash 복원

수동으로 같은 효과를 내려면:

```bash
# pre-commit 스크립트 예시
git stash push --keep-index -q
npm run lint -- --staged
LINT_STATUS=$?
git stash pop -q
exit $LINT_STATUS
```

---

**지난 글:** [git stash와 미추적 파일 — untracked 포함 저장](/posts/git-stash-untracked/)

**다음 글:** [git stash branch — 스태시를 새 브랜치로 변환](/posts/git-stash-branch/)

<br>
읽어주셔서 감사합니다. 😊
