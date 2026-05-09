---
title: "git log 기초: 커밋 히스토리 탐색하기"
description: "git log의 기본 출력 구조를 이해하고, --oneline, -p, --stat, --follow 등 자주 쓰는 옵션으로 히스토리를 효과적으로 탐색하는 법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "git log", "히스토리", "커밋", "oneline"]
featured: false
draft: false
---

[지난 글](/posts/git-diff-three-dot-two-dot/)에서 브랜치 간 diff 범위를 다뤘다. 이번에는 커밋 히스토리를 탐색하는 `git log`의 기본을 정리한다. `git log`는 단순 히스토리 조회를 넘어 강력한 검색·필터 도구로 쓸 수 있다.

## 기본 출력

```bash
git log
```

최신 커밋부터 역순으로 커밋 목록을 출력한다. 각 커밋마다 SHA-1 해시, 저자, 날짜, 커밋 메시지가 표시된다.

![git log 기본 출력 구조](/assets/posts/git-log-basics-output.svg)

기본 출력은 정보가 많아 스크롤이 길어진다. `q`로 종료하고 화살표 키나 `j`/`k`(vim 방식)로 이동한다.

## 자주 쓰는 옵션

![git log 자주 쓰는 옵션](/assets/posts/git-log-basics-options.svg)

### --oneline: 한 줄 요약

```bash
git log --oneline
# 9a3f1b2 feat: add user authentication
# 1b2c3d4 fix: correct password hashing bug
# 2c3d4e5 chore: update dependencies
```

가장 많이 쓰는 옵션이다. 짧은 해시와 제목만 보여줘 전체 흐름을 빠르게 파악할 수 있다.

### 개수 제한

```bash
git log -5           # 최근 5개만
git log --oneline -10
```

### 변경 내용 포함

```bash
# 각 커밋의 diff 출력
git log -p

# 파일별 통계만
git log --stat

# 파일 이름만
git log --name-only
```

`-p`는 커밋과 함께 실제 변경 내용을 보여준다. 특정 기능이 어디서 바뀌었는지 추적할 때 유용하다.

## 특정 파일의 히스토리

```bash
# src/auth.js를 수정한 커밋만
git log -- src/auth.js
git log --oneline -- src/auth.js

# 파일 이름이 바뀐 경우도 추적
git log --follow -- src/auth.js
```

`--follow`는 `git mv`나 수동 이름 변경 이전 히스토리까지 추적한다. 파일 이름이 바뀐 프로젝트에서 빠진 히스토리를 찾을 때 유용하다.

## 브랜치와 커밋 범위

```bash
# 특정 브랜치 히스토리
git log feature/login

# 모든 브랜치
git log --all --oneline

# 커밋 범위 (A 이후 B까지)
git log abc1234..HEAD --oneline

# main에 없는 feature 커밋만
git log main..feature/login --oneline
```

## HEAD와 브랜치 레퍼런스

```bash
# HEAD 기준 상대 참조
git log HEAD~5..HEAD   # 최근 5개

# 특정 태그 이후
git log v1.0..HEAD --oneline
```

## 실무 팁

커밋을 찾을 때 `git log --oneline`으로 전체 흐름을 파악한 뒤, 특정 커밋 해시로 `git show <hash>`를 실행해 상세 내용을 보는 패턴이 가장 효율적이다.

```bash
# 흐름 파악
git log --oneline -20

# 특정 커밋 상세
git show 9a3f1b2
```

---

**지난 글:** [git diff 두 점(..)과 세 점(...): 브랜치 간 비교의 차이](/posts/git-diff-three-dot-two-dot/)

**다음 글:** [git log --format: 커밋 로그 출력 형식 커스터마이징](/posts/git-log-formatting/)

<br>
읽어주셔서 감사합니다. 😊
