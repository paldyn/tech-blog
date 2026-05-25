---
title: "Git Plumbing vs Porcelain: 명령어 계층 이해하기"
description: "Git 명령어가 사람 친화적 Porcelain과 스크립트 친화적 Plumbing으로 나뉘는 이유, 각 계층의 특성, 스크립트에서 Plumbing을 써야 하는 상황, 주요 대응표를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "plumbing", "porcelain", "스크립트", "cat-file", "hash-object", "내부구조"]
featured: false
draft: false
---

[지난 글](/posts/git-update-ref/)에서 참조를 직접 수정하는 `git update-ref`를 살펴봤다. 이번 글에서는 지금까지 살펴본 저수준 명령들의 개념적 위치인 **Plumbing과 Porcelain**의 구분을 정리한다.

## 배관공과 도자기

Git 문서에서 "plumbing"은 배관(수도관·파이프) 시스템, "porcelain"은 도자기(화장실·세면대)를 의미한다. 같은 배관 시스템 위에 사용자가 쓰는 깔끔한 인터페이스가 얹혀 있다는 비유다.

- **Plumbing**: Git 내부 구조를 직접 다루는 저수준 명령. 배관처럼 복잡하지만 정확하고 예측 가능하다.
- **Porcelain**: 일상적인 Git 작업을 위한 고수준 명령. 도자기처럼 사용자 친화적이고 보기 좋다.

![계층 구조](/assets/posts/git-plumbing-vs-porcelain-layers.svg)

## Porcelain 명령의 특성

`git add`, `git commit`, `git push`, `git log`, `git status`가 대표적인 Porcelain 명령이다.

**사람 친화적 출력**: 컬러, 페이징, 사람이 읽기 쉬운 형식으로 출력한다.

**여러 plumbing 조합**: 하나의 명령이 내부적으로 여러 plumbing 명령을 실행한다. `git add`는 `git hash-object -w`와 `git update-index`를 조합한다.

**출력 형식이 변할 수 있음**: Git 버전 업그레이드에 따라 출력 형식이 바뀔 수 있다. 스크립트에서 파싱하면 취약하다.

```bash
# porcelain: 사람이 읽기 좋지만 파싱하기 어렵다
git status
# On branch main
# Changes to be committed:
#   (use "git restore --staged <file>..." to unstage)
#         modified:   src/main.go
```

## Plumbing 명령의 특성

`git cat-file`, `git hash-object`, `git update-ref`, `git rev-parse`, `git ls-files`, `git write-tree`, `git commit-tree`가 대표적인 Plumbing 명령이다.

**안정적인 출력 형식**: 버전 업그레이드에도 출력 형식을 유지한다. 스크립트 파싱에 적합하다.

**단일 책임**: 하나의 오브젝트·ref를 다루는 단순한 역할을 한다.

**스크립트 친화적**: 파이프, xargs, awk와 조합해 복잡한 작업을 구성할 수 있다.

```bash
# plumbing: 파싱하기 쉽고 일관된 출력
git ls-files --stage
# 100644 abc123def456 0    src/main.go
# 100644 bcd234efa567 0    README.md
```

![Porcelain ↔ Plumbing 대응](/assets/posts/git-plumbing-vs-porcelain-map.svg)

## 스크립트에서 Porcelain이 위험한 이유

```bash
# ❌ 취약한 방식: porcelain 출력 파싱
BRANCH=$(git status | grep "On branch" | awk '{print $3}')

# ✅ 안전한 방식: plumbing 사용
BRANCH=$(git rev-parse --abbrev-ref HEAD)
```

```bash
# ❌ 취약: git log 출력 파싱
git log --oneline | head -1 | awk '{print $1}'

# ✅ 안전: rev-parse 직접 사용
git rev-parse --short HEAD
```

```bash
# ❌ 취약: git status 출력으로 변경 파일 추출
git status --short | grep "^M" | awk '{print $2}'

# ✅ 안전: diff-index 사용
git diff-index --name-only HEAD
```

## 주요 Plumbing 명령 목록

**오브젝트 관련**

```bash
git cat-file        # 오브젝트 읽기 (-t, -s, -p, --batch)
git hash-object     # 파일을 blob으로 저장
git ls-tree         # tree 오브젝트 목록
git mktree          # tree 오브젝트 생성
git write-tree      # index에서 tree 생성
git commit-tree     # tree에서 commit 생성
git pack-objects    # loose objects → pack
git verify-pack     # pack 파일 검증
```

**ref 관련**

```bash
git update-ref      # ref 생성/수정/삭제
git symbolic-ref    # symbolic ref 읽기/쓰기
git rev-parse       # 참조를 SHA로 변환
git rev-list        # 커밋 목록 나열
git show-ref        # ref 목록 출력
git for-each-ref    # ref 반복 처리
```

**index 관련**

```bash
git ls-files        # index 파일 목록
git update-index    # index 직접 수정
git read-tree       # tree를 index로 로드
git diff-index      # index vs tree 비교
git diff-files      # working tree vs index 비교
```

## Porcelain을 안전하게 파싱하는 --porcelain 옵션

일부 porcelain 명령은 `--porcelain` 플래그를 제공한다. 이 플래그를 주면 기계가 파싱하기 쉬운 안정적인 형식으로 출력한다.

```bash
# git status --porcelain: 고정된 2문자 상태 코드
git status --porcelain
# M  src/main.go       ← staged
#  M README.md         ← unstaged
# ?? new-file.txt      ← untracked

# git diff --name-status: 파일명과 상태만
git diff --name-status HEAD
# M  src/main.go

# git stash list --format=...
git stash list --format="%gd %s"
```

`--porcelain` 옵션이 있는 명령은 스크립트에서도 비교적 안전하게 쓸 수 있다.

## 언제 Plumbing을 써야 하나

Plumbing 명령이 필요한 상황은 다음과 같다.

- Git 훅 스크립트에서 oject·ref 값을 추출할 때
- CI/CD 파이프라인에서 브랜치·커밋 정보를 추출할 때
- 커스텀 Git 도구를 개발할 때
- Git 내부 구조를 이해하고 디버깅할 때
- working tree를 건드리지 않고 오브젝트만 조작할 때

반면 일상적인 개발 작업에서는 Porcelain을 쓰는 것이 훨씬 편리하다.

---

**지난 글:** [git update-ref: 참조를 직접 수정하는 plumbing 명령](/posts/git-update-ref/)

**다음 글:** [Git GPG 서명 설정: 커밋 신원 보증하기](/posts/git-gpg-signing-setup/)

<br>
읽어주셔서 감사합니다. 😊
