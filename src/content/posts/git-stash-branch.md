---
title: "git stash branch — 스태시를 새 브랜치로 변환"
description: "git stash branch로 stash를 저장 시점의 커밋에서 새 브랜치를 만들어 충돌 없이 적용하는 방법과 실전 활용 패턴을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "stash", "branch", "브랜치 변환", "충돌 해결"]
featured: false
draft: false
---

[지난 글](/posts/git-stash-keep-index/)에서 `--keep-index`로 staged 상태를 유지하는 방법을 다뤘다. stash를 현재 브랜치에 적용할 때 충돌이 많이 생기는 상황이 있다. `git stash branch`는 이 문제를 우아하게 해결하는 명령이다.

## stash branch란?

`git stash branch <브랜치명>` 은 세 가지 동작을 한 번에 처리한다.

1. stash를 **저장한 시점의 커밋(HEAD)**에서 새 브랜치를 만들어 체크아웃
2. stash를 `apply --index`로 적용 (스테이징 상태 포함)
3. 적용 성공 시 stash를 스택에서 `drop`

![stash branch 동작 순서](/assets/posts/git-stash-branch-concept.svg)

```bash
# 사용법
git stash branch <새-브랜치명>

# 특정 stash 지정
git stash branch <새-브랜치명> stash@{2}
```

## 왜 충돌이 없을까?

`stash pop`이 충돌하는 이유는 stash를 저장한 이후 현재 브랜치가 많이 변했기 때문이다. `stash branch`는 stash를 **저장했던 그 시점의 커밋**으로 되돌아가서 적용하므로 수정 이력이 동일해 충돌이 생기지 않는다.

## 주요 사용 시나리오

### 1. stash pop 충돌이 많을 때

```bash
# pop 시도 → 충돌 다수
git stash pop
# CONFLICT (content): Merge conflict in src/api.js
# CONFLICT (content): Merge conflict in src/auth.js
# ...

# 충돌 취소, 원래 상태로
git checkout .

# 새 브랜치로 꺼내기
git stash branch feature/auth-redesign
```

![충돌 시 stash branch 활용](/assets/posts/git-stash-branch-usecase.svg)

### 2. WIP를 별도 브랜치로 승격

main에서 작업하다가 "이건 별도 PR로 올려야겠다" 싶을 때.

```bash
# main에서 작업 중
git stash push -m "header layout rework"

# 별도 브랜치로 분리
git stash branch feature/header-layout

# 이제 feature/header-layout 브랜치에서 커밋
git add -A
git commit -m "feat: header layout rework"
```

### 3. stash를 PR 기반 작업으로 변환

```bash
# hotfix 브랜치에서 stash로 저장했던 실험적 기능
git checkout main
git stash branch experiment/new-algo stash@{0}
# 이제 experiment/new-algo 브랜치에서 작업 계속
```

## 수동으로 동일하게 구현하면?

`stash branch`의 내부 동작을 수동으로 재현하면 이렇다.

```bash
# 1. stash가 저장된 커밋 SHA 확인
git log --oneline stash@{0} | head -1

# 2. 해당 커밋에서 새 브랜치 생성
git checkout -b feature/new-branch <SHA>

# 3. stash 적용 (인덱스 포함)
git stash apply --index stash@{0}

# 4. 적용 성공 시 삭제
git stash drop stash@{0}
```

`stash branch`가 이 네 단계를 원자적으로 처리한다. 중간에 실패해도 stash는 삭제되지 않는다.

## 팁: 브랜치 이름 규칙

`stash branch`로 만드는 브랜치는 일반 브랜치와 동일하다. 기존 브랜치 이름 규칙을 따르면 된다.

```bash
# 기능 개발
git stash branch feature/user-auth

# 실험적 변경
git stash branch experiment/cache-layer

# 버그 수정
git stash branch fix/null-pointer-login
```

이미 존재하는 브랜치 이름을 지정하면 오류가 발생하므로 새로운 이름을 써야 한다.

---

**지난 글:** [git stash --keep-index — 스테이징 유지하며 저장](/posts/git-stash-keep-index/)

**다음 글:** [git stash vs WIP 커밋 — 임시 저장 전략 비교](/posts/git-stash-vs-wip-commit/)

<br>
읽어주셔서 감사합니다. 😊
