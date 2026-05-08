---
title: "스테이징 영역의 본질: 커밋을 조각하는 작업대"
description: "스테이징 영역이 왜 존재하는지, git add -p로 파일 내 부분 스테이징을 어떻게 하는지, 좋은 커밋을 만드는 습관을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "스테이징", "git add", "git add -p", "커밋"]
featured: false
draft: false
---

[지난 글](/posts/git-three-trees/)에서 Git의 세 가지 트리 개념을 다뤘다. 이번에는 그 중 스테이징 영역의 본질, 즉 **왜 이 공간이 설계됐는지**를 더 깊이 살펴본다. 스테이징 영역을 단순히 "커밋 전에 거치는 단계" 정도로만 이해하면 절반만 아는 것이다.

## 스테이징 없이 커밋하면 어떻게 될까

SVN 같은 도구는 스테이징 영역이 없다. `svn commit`을 실행하면 변경된 파일 전체가 하나의 커밋이 된다. 하루 동안 다섯 개의 파일을 수정했다면, 그 다섯 개가 모두 한 커밋에 들어간다.

이게 문제가 되는 경우는 언제일까?

- 버그 수정과 새 기능 개발을 동시에 했을 때
- 리팩토링과 기능 변경을 섞었을 때
- 긴 작업 중에 중간 지점을 저장하고 싶을 때

스테이징 영역은 이 문제를 해결한다. 수정한 파일이 몇 개든, 커밋에 포함시킬 것과 아닌 것을 선별할 수 있다.

## 실무에서 쓰이는 방식

오늘 하루 작업한 파일이 5개라고 가정한다.

```bash
git status
# Changes not staged for commit:
#   modified: feature-a.js
#   modified: feature-b.js
#   modified: bugfix.js
#   modified: refactor.js
#   modified: docs/readme.md
```

이 변경들을 하나의 커밋에 모두 넣는 것은 나쁜 습관이다. 관련 없는 변경이 섞이면 이후에 특정 변경만 되돌리거나, 코드 리뷰에서 무엇이 바뀌었는지 파악하기 어려워진다.

```bash
# 논리적 단위로 분리해서 커밋
git add feature-a.js
git commit -m "feat: 로그인 기능 추가"

git add bugfix.js
git commit -m "fix: 세션 만료 버그 수정"

git add refactor.js docs/readme.md
git commit -m "refactor: 인증 모듈 정리 + 문서 업데이트"

# feature-b.js는 아직 작업 중 — 스테이징하지 않음
```

![스테이징으로 논리적 커밋 만들기](/assets/posts/git-staging-essence-purpose.svg)

## git add -p: 파일 내 부분 스테이징

더 강력한 기능이 있다. 하나의 파일 안에서도 특정 변경(hunk)만 골라서 스테이징할 수 있다.

```bash
git add -p app.js    # -p = --patch
```

실행하면 파일의 변경 사항을 덩어리(hunk)로 나눠서 하나씩 보여주고, 각각을 스테이징할지 묻는다.

![git add -p 파일 내 부분 스테이징](/assets/posts/git-staging-essence-patch.svg)

이 방식은 버그 수정과 미완성 기능이 같은 파일에 섞여 있어도 논리적으로 분리된 커밋을 만들 수 있다.

인터랙티브 모드에서 사용하는 키:

| 키 | 동작 |
|---|------|
| `y` | 이 hunk를 스테이징에 포함 |
| `n` | 이 hunk를 제외 |
| `s` | 더 작은 단위로 분할 |
| `e` | 이 hunk를 에디터로 직접 편집 |
| `q` | 종료 |
| `?` | 도움말 |

## 스테이징 취소

실수로 스테이징했거나 다시 선별하고 싶을 때 취소하는 방법이다.

```bash
# 특정 파일만 스테이징 취소
git restore --staged app.js

# 전체 스테이징 취소
git restore --staged .
# 또는 git reset HEAD (구버전 방식)
```

스테이징을 취소해도 작업 디렉토리의 파일 내용은 그대로 유지된다. 파일을 수정하지 않고 스테이징 상태만 바꾸는 것이다.

## 현재 스테이징 상태 확인

```bash
# 스테이징된 변경 내용 보기
git diff --staged    # 스테이징 영역 vs HEAD

# 스테이징 안 된 변경 내용 보기
git diff             # 작업 디렉토리 vs 스테이징 영역

# 간략한 상태
git status -s
# M  feature-a.js    ← 스테이징됨 (초록)
#  M bugfix.js       ← 스테이징 안 됨 (빨강)
# ?? new-file.js     ← Untracked
```

`git status -s` 출력에서 첫 번째 열은 스테이징 상태, 두 번째 열은 작업 디렉토리 상태를 나타낸다.

## 좋은 커밋의 기준

스테이징 영역을 잘 활용하면 자연스럽게 좋은 커밋 이력이 만들어진다. 좋은 커밋이란 "하나의 목적만 가진 커밋"이다.

```bash
# 나쁜 커밋 (관련 없는 변경 혼합)
git add .
git commit -m "작업"

# 좋은 커밋 (목적이 명확한 단위)
git add feature-a.js
git commit -m "feat: 사용자 프로필 이미지 업로드 기능"

git add bugfix.js
git commit -m "fix: 파일 크기 제한 누락 버그 수정"
```

나쁜 커밋은 6개월 후에 `git log`나 `git blame`으로 변경 이유를 추적할 때 아무 단서도 주지 않는다. 좋은 커밋은 그 자체가 코드 변경의 문서가 된다.

---

**지난 글:** [Git의 세 가지 트리](/posts/git-three-trees/)

<br>
읽어주셔서 감사합니다. 😊
