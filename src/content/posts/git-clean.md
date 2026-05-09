---
title: "git clean: 추적되지 않는 파일을 한 번에 정리하기"
description: "git clean 명령의 -f, -d, -x, -X, -n 플래그를 조합해 빌드 결과물, 실험 파일, 무시 파일을 안전하게 삭제하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "git clean", "untracked", "워킹트리 정리", "빌드 산출물"]
featured: false
draft: false
---

[지난 글](/posts/git-rm-mv/)에서 `git rm`으로 추적 중인 파일을 제거하는 법을 다뤘다. 이번에는 반대편, **한 번도 `git add`하지 않은 untracked 파일**을 정리하는 `git clean`을 살펴본다.

## git clean이 필요한 상황

개발하다 보면 워킹트리에 쌓이는 파일이 있다.

- 빌드 결과물(`dist/`, `*.o`, `*.pyc`)
- 실험적으로 만든 임시 파일
- `.gitignore`에 있어야 하는데 누락된 설정 파일

이런 파일은 `git status`에 Untracked 항목으로 보이지만 `git reset`으로는 지울 수 없다. `git clean`이 바로 이 역할을 한다.

## 기본 사용법

```bash
# 먼저 반드시 dry-run으로 확인
git clean -n

# 실제 삭제 (force 필수)
git clean -f
```

`-f`(force) 없이는 실행되지 않는다. Git이 실수로 인한 삭제를 막기 위한 안전장치다.

![git clean Untracked 파일 제거 범위](/assets/posts/git-clean-overview.svg)

## 플래그 조합 이해

| 플래그 | 의미 |
|--------|------|
| `-n` | Dry-run: 삭제할 파일 목록만 출력 |
| `-f` | 실제 삭제 (필수) |
| `-d` | 디렉터리도 삭제 |
| `-x` | `.gitignore` 무시 파일까지 포함 |
| `-X` | `.gitignore` 파일만 삭제 (untracked는 유지) |
| `-i` | 대화형: 파일별로 삭제 여부 선택 |

실전에서 가장 많이 쓰는 조합은 `-fd`(파일+디렉터리)와 `-fdx`(빌드 산출물까지 완전 초기화)다.

## 실전 시나리오

![git clean 실전 시나리오](/assets/posts/git-clean-scenarios.svg)

### 완전 초기화

```bash
# 프레시 빌드 환경 준비 — ignore 파일까지 모두 제거
git clean -fdx
```

CI 파이프라인에서 깨끗한 빌드 환경을 보장할 때 자주 쓴다. `node_modules/`, `dist/`, `*.log` 등 `.gitignore`에 있는 파일도 모두 사라진다.

### 대화형 정리

```bash
git clean -i
# 메뉴가 표시되고 각 파일에 대해 yes/no 선택
```

어떤 파일을 지울지 확신이 없을 때 `-i`를 쓰면 파일별로 선택할 수 있다.

### 특정 경로 지정

```bash
# src/ 아래의 untracked 파일만 정리
git clean -fd src/

# 특정 파일만
git clean -f scratch.js
```

## stash와 clean의 차이

`git stash`는 변경 사항을 임시 저장해 되돌릴 수 있지만, untracked 파일은 기본적으로 포함하지 않는다(stash -u 옵션으로 가능). `git clean`은 복구가 불가능한 완전 삭제다. 작업 중인 untracked 파일이 있다면 clean 전에 stash하거나 다른 곳에 백업하자.

```bash
# untracked 포함 stash (clean 전 안전망)
git stash -u

# 이후 clean
git clean -fd
```

## 핵심 원칙: 항상 -n 먼저

`git clean`으로 삭제된 파일은 reflog에도 없고 stash에도 없다. 되돌릴 방법이 없다.

```bash
# 실제 삭제 전 항상 목록 확인
git clean -nfd
git clean -nfdx  # ignore 파일 포함 시

# 목록 확인 후 실행
git clean -fd
```

---

**지난 글:** [git rm / git mv: 파일 삭제와 이동을 히스토리에 남기는 법](/posts/git-rm-mv/)

**다음 글:** [git diff: 워킹트리·인덱스·커밋 간 변경 내용 비교하기](/posts/git-diff-overview/)

<br>
읽어주셔서 감사합니다. 😊
