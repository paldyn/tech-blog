---
title: "git diff --staged: 커밋 전 인덱스 변경 내용 검토하기"
description: "git diff --staged(--cached)를 활용해 스테이징된 변경 내용을 커밋 전에 정확히 확인하는 방법을 살펴본다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "git diff", "staged", "cached", "커밋 전 검토", "스테이징"]
featured: false
draft: false
---

[지난 글](/posts/git-diff-overview/)에서 `git diff`의 세 가지 비교 영역을 살펴봤다. 이번에는 그 중에서도 실무에서 가장 유용한 `git diff --staged`를 집중적으로 다룬다.

## --staged가 보여주는 것

`git diff --staged`는 **인덱스(스테이징 영역)와 HEAD(마지막 커밋) 사이의 차이**를 보여준다. 즉, 지금 `git commit`을 실행하면 커밋에 포함될 정확한 변경 내용이다.

```bash
git add src/app.js
git diff --staged      # 커밋 예정 내용 확인
git diff --cached      # --staged와 동일 (구버전 호환)
```

`git diff`(인수 없음)는 스테이징되지 않은 변경을 보여주는 반면, `--staged`는 스테이징된 변경만 보여준다.

![git diff --staged 워크플로](/assets/posts/git-diff-staged-flow.svg)

## 왜 커밋 전에 반드시 확인해야 하는가

빠르게 개발하다 보면 의도치 않게 스테이징하는 일이 생긴다.

- `console.log` 디버그 출력 남기기
- 개인 로컬 설정값 하드코딩
- 미완성 코드나 TODO 주석
- 민감한 토큰·패스워드

`git commit`을 실행하기 직전, `git diff --staged`로 한 번 확인하는 습관만 들여도 이런 실수를 막을 수 있다.

## 활용 패턴

![git diff --staged 활용 패턴](/assets/posts/git-diff-staged-tips.svg)

### 특정 파일만 검토

```bash
# 스테이징된 파일 중 특정 파일만 diff
git diff --staged src/auth.js

# 패턴 매칭
git diff --staged -- '*.test.js'
```

### 통계 요약

```bash
git diff --staged --stat
# src/app.js       | 8 ++++----
# src/auth.js      | 3 +++
# 2 files changed, 11 insertions(+), 4 deletions(-)
```

전체 변경을 한눈에 보고 싶을 때 `--stat`이 유용하다.

### 파일 목록만

```bash
git diff --staged --name-only
git diff --staged --name-status
# M src/app.js
# A src/new-feature.js
# D src/deprecated.js
```

## 부분 스테이징과 함께 쓰기

`git add -p`로 파일의 일부 hunk만 스테이징했다면, 두 가지 diff를 각각 확인할 수 있다.

```bash
# 파일 일부만 스테이징
git add -p src/app.js

# 커밋 예정 부분 확인
git diff --staged src/app.js

# 아직 스테이징 안 된 부분 확인
git diff src/app.js
```

이 패턴은 하나의 파일에 여러 논리적 변경이 섞여 있을 때 커밋을 깔끔하게 분리하는 데 유용하다.

## git diff --staged vs git show

커밋 후 `git show`도 비슷한 내용을 보여주지만 이미 커밋된 뒤다. `git diff --staged`는 커밋 전 마지막 점검 도구다.

```bash
# 커밋 전 (아직 수정 가능)
git diff --staged

# 커밋 후 (변경 불가)
git show HEAD
git show HEAD --stat
```

## 정리

커밋 전 체크리스트:

```bash
git status                 # 전체 상태 확인
git diff --staged          # 커밋 예정 내용 상세 확인
git diff --staged --stat   # 변경 규모 파악
git commit -m "..."        # OK이면 커밋
```

`git diff --staged`를 커밋 루틴의 일부로 만들면 히스토리 품질이 눈에 띄게 좋아진다.

---

**지난 글:** [git diff: 워킹트리·인덱스·커밋 간 변경 내용 비교하기](/posts/git-diff-overview/)

**다음 글:** [git diff 두 점(..)과 세 점(...): 브랜치 간 비교의 차이](/posts/git-diff-three-dot-two-dot/)

<br>
읽어주셔서 감사합니다. 😊
