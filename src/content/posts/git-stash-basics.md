---
title: "git stash — 변경사항 임시 저장"
description: "git stash로 작업 중인 변경사항을 임시 저장하고 나중에 복원하는 방법, 스택 구조, 이름 붙이기, 실전 워크플로를 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "stash", "임시 저장", "워크플로", "브랜치 전환"]
featured: false
draft: false
---

[지난 글](/posts/git-history-rewrite-warning/)에서 히스토리 재작성의 위험을 정리했다. 이번에는 완전히 다른 일상 도구인 `git stash`를 다룬다. 작업 중에 갑자기 다른 브랜치로 이동해야 할 때, 커밋하기엔 이르고 버리기엔 아깝다면 **stash로 잠시 담아두면** 된다.

## stash의 개념

`git stash`는 현재 작업 디렉터리와 스테이징 영역의 변경사항을 스택에 저장하고 **작업 디렉터리를 마지막 커밋 상태로 되돌린다**. 일종의 임시 서랍이다.

![git stash 개념](/assets/posts/git-stash-basics-concept.svg)

stash는 **스택(LIFO)** 구조로, 가장 최근에 저장한 것이 `stash@{0}`이고 그 이전 것이 `stash@{1}`이 된다.

## 기본 명령어

```bash
# 현재 변경사항 저장 (tracked 파일만)
git stash

# 이름 붙여 저장
git stash push -m "로그인 기능 WIP"

# 저장된 stash 목록
git stash list

# 가장 최근 stash 복원 + 스택에서 제거
git stash pop

# 가장 최근 stash 복원 + 스택에는 유지
git stash apply
```

`pop`과 `apply`의 차이: `pop`은 복원 후 스택에서 삭제하고, `apply`는 스택에 남긴다. 여러 브랜치에 같은 변경사항을 적용할 때는 `apply`를 쓴다.

## 실전 워크플로: 긴급 이슈 대응

![긴급 이슈 대응 워크플로](/assets/posts/git-stash-basics-flow.svg)

```bash
# 1. 현재 작업 저장
git stash push -m "login feature WIP"

# 2. main으로 이동 (이제 깨끗한 상태)
git checkout main

# 3. hotfix 브랜치에서 긴급 수정
git checkout -b hotfix/critical-bug
# ... 수정 작업 ...
git commit -m "fix: 긴급 버그 수정"
git push origin hotfix/critical-bug

# 4. 원래 브랜치로 복귀
git checkout feature/login

# 5. 저장해둔 작업 복원
git stash pop
```

stash가 없었다면 미완성 커밋을 남기거나 변경사항을 잃을 뻔한 상황이다.

## 특정 stash 지정

여러 개의 stash가 쌓인 경우 인덱스로 지정한다.

```bash
# stash 목록 확인
git stash list
# stash@{0}: On feature: login feature WIP
# stash@{1}: On main: experiment WIP
# stash@{2}: On develop: hotfix attempt

# 특정 stash 복원
git stash apply stash@{1}

# 특정 stash 삭제
git stash drop stash@{1}

# 특정 stash 내용 확인
git stash show stash@{1}
git stash show -p stash@{1}  # diff 형태로
```

## stash 충돌

stash를 복원할 때 현재 브랜치 상태와 충돌이 날 수 있다.

```bash
git stash pop
# CONFLICT (content): Merge conflict in src/auth.js

# 충돌 해결 후
git add src/auth.js
# stash pop이 충돌났을 때는 stash가 스택에 남아 있음
git stash drop stash@{0}  # 수동으로 제거
```

충돌이 생기면 `stash pop`은 실패하지만 stash는 스택에 남는다. 충돌을 해결한 뒤 수동으로 `git stash drop`으로 제거한다.

## 기본 stash의 한계

`git stash`는 기본적으로 **untracked 파일을 저장하지 않는다**. 새로 만든 파일, `.gitignore`에 포함된 파일은 stash에 담기지 않는다. 이런 경우는 옵션이 필요한데, 다음 글에서 `--include-untracked`와 관련 옵션을 다룬다.

---

**지난 글:** [히스토리 재작성 전 반드시 알아야 할 것들](/posts/git-history-rewrite-warning/)

**다음 글:** [git stash list와 show — 스태시 목록 확인](/posts/git-stash-list-show/)

<br>
읽어주셔서 감사합니다. 😊
