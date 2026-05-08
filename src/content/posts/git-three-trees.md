---
title: "Git의 세 가지 트리: 작업 디렉토리, 스테이징, HEAD"
description: "Git이 파일 변경을 추적하는 세 개의 공간(작업 디렉토리, 스테이징 영역, HEAD)의 역할과 그 사이를 이동하는 명령어를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "세 가지 트리", "스테이징", "HEAD", "Working Directory"]
featured: false
draft: false
---

[지난 글](/posts/git-clone/)에서 원격 저장소를 로컬로 복제하는 방법을 살펴봤다. 이제 Git의 내부 구조 중 가장 핵심적인 개념을 다룰 차례다. Git의 **세 가지 트리(three trees)**를 이해하면 `git add`, `git commit`, `git reset`, `git restore` 같은 명령어들이 왜 그런 방식으로 동작하는지 명확하게 납득할 수 있다.

## 세 트리의 개념

Git은 파일의 변경 사항을 세 개의 별도 공간에서 관리한다.

**작업 디렉토리(Working Directory)**: 실제 파일이 있는 공간이다. 에디터로 코드를 편집하면 이 공간이 변한다. Git이 추적하는지 여부와 관계없이 파일 시스템에 존재하는 모든 파일이 여기에 속한다.

**스테이징 영역(Staging Area / Index)**: 다음 커밋에 포함시킬 변경 사항을 담아두는 공간이다. `git add`를 실행하면 변경 사항이 이 공간으로 이동한다. `.git/index` 파일에 저장된다.

**저장소(HEAD)**: 커밋이 완료된 영구적인 이력이 저장된 공간이다. `git commit`을 실행하면 스테이징 영역의 내용이 여기로 이동해 새 커밋 객체가 된다.

![Git의 세 가지 트리](/assets/posts/git-three-trees-overview.svg)

## 세 트리의 상태가 달라지는 과정

코드 편집부터 커밋까지의 흐름을 따라가면 세 트리의 상태 변화를 이해할 수 있다.

```bash
# 초기 상태: 세 트리 모두 일치
git status
# nothing to commit, working tree clean

# 1. 파일 편집 → 작업 디렉토리만 변함
echo "hello" >> app.js

git status
# Changes not staged for commit:
#   modified: app.js
# → 작업 디렉토리 ≠ 스테이징 ≠ HEAD

# 2. git add → 스테이징 영역에 반영
git add app.js

git status
# Changes to be committed:
#   modified: app.js
# → 작업 디렉토리 = 스테이징 ≠ HEAD

# 3. git commit → HEAD에 저장
git commit -m "app.js 수정"

git status
# nothing to commit, working tree clean
# → 세 트리 모두 일치
```

## 각 단계에서 상태 확인하기

각 트리의 차이를 보는 전용 명령어가 있다.

```bash
# 작업 디렉토리 vs 스테이징 영역의 차이
git diff

# 스테이징 영역 vs HEAD(마지막 커밋)의 차이
git diff --staged    # 또는 git diff --cached

# 작업 디렉토리 + 스테이징 전체 vs HEAD의 차이
git diff HEAD
```

## 세 트리 간 이동 명령어

![세 트리 간 이동 명령어](/assets/posts/git-three-trees-commands.svg)

**앞으로 이동 (변경 사항 확정)**:
- `git add`: 작업 디렉토리 → 스테이징 영역
- `git commit`: 스테이징 영역 → HEAD(저장소)

**뒤로 이동 (변경 사항 취소)**:
- `git restore <file>`: 스테이징 영역의 내용으로 작업 디렉토리 복원
- `git restore --staged <file>`: HEAD의 내용으로 스테이징 영역 복원
- `git reset --soft HEAD~1`: HEAD를 이전 커밋으로 이동 (스테이징·작업 디렉토리 유지)
- `git reset --mixed HEAD~1`: HEAD 이동 + 스테이징 초기화 (작업 디렉토리 유지)
- `git reset --hard HEAD~1`: 세 트리 모두 이전 커밋 상태로 되돌림

## 스테이징 영역이 존재하는 이유

SVN 같은 CVCS에는 스테이징 영역이 없다. 변경된 파일 전체가 한 번에 커밋된다. Git의 스테이징 영역은 의도적으로 설계된 기능이다.

**논리적 커밋 단위**: 10개 파일을 수정했더라도 관련된 3개만 골라서 하나의 커밋으로 만들 수 있다.

**부분 변경 스테이징**: 한 파일 안에서도 특정 변경만 골라 스테이징할 수 있다(`git add -p`).

```bash
# 수정 파일 중 일부만 커밋
git add feature-a.js
git commit -m "Feature A 구현"

git add bugfix.js
git commit -m "로그인 버그 수정"

# feature-b.js는 아직 작업 중이므로 스테이징하지 않음
```

세 트리 개념을 이해하면 이후에 다루는 `git reset`, `git rebase`, `git stash` 같은 고급 명령어를 훨씬 자연스럽게 이해할 수 있다.

---

**지난 글:** [git clone: 원격 저장소 복제하기](/posts/git-clone/)

**다음 글:** [스테이징 영역의 본질](/posts/git-staging-essence/)

<br>
읽어주셔서 감사합니다. 😊
