---
title: "git add -u: 추적 중인 파일만 골라 스테이징하기"
description: "git add -u(update)의 동작 원리, -A·.과의 차이, 새 파일을 제외하고 수정/삭제만 스테이징하는 실전 사례를 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "git add", "-u", "스테이징", "추적 파일"]
featured: false
draft: false
---

[지난 글](/posts/git-add-patch/)에서 헝크 단위로 스테이징하는 `git add -p`를 다뤘다. 이번에는 파일 범위를 제어하는 또 다른 옵션, `git add -u`를 살펴본다. 이름의 `-u`는 **update**를 뜻한다.

## git add -u의 핵심

`-u` 옵션은 **Git이 이미 추적하고 있는 파일**(Tracked files)의 변경과 삭제만 스테이징한다. 새로 생성된 Untracked 파일은 포함하지 않는다.

```bash
git status -s
#  M src/app.js       ← 추적 중인 파일, 수정됨
# ?? tmp/debug.log    ← 새 파일, Untracked

git add -u
git status -s
# M  src/app.js       ← 스테이징됨
# ?? tmp/debug.log    ← 여전히 Untracked
```

![git add 옵션 비교](/assets/posts/git-add-update-comparison.svg)

## -A, . 와의 차이점

| 옵션 | 수정 | 삭제 | 신규(Untracked) |
|------|------|------|-----------------|
| `-u` | ✓ | ✓ | ✗ |
| `-A` | ✓ | ✓ | ✓ |
| `.` | ✓ | ✓ | ✓ (Git ≥2.0) |

`-A`와 `.`은 새 파일도 포함하므로 `.gitignore`가 완벽하게 설정되어 있지 않으면 의도치 않은 파일이 스테이징될 수 있다. `-u`는 그 위험이 없다.

## 언제 -u를 사용하는가

### 1. 새 파일을 아직 정리하지 못했을 때

```bash
# 작업 중에 임시 파일이 생겼지만 커밋 전에 정리가 필요한 상황
git add -u   # 수정된 파일만 먼저 커밋
git commit -m "refactor: clean up service layer"
# 이후 tmp/ 파일을 .gitignore에 추가하거나 삭제
```

### 2. 파일 이름 변경 처리

OS 명령(`mv`)으로 파일을 이동하면 Git은 이를 "삭제 + 신규"로 인식한다. `-u`를 쓰면 삭제 부분만 스테이징된다.

```bash
mv old-name.js new-name.js

git add -u          # old-name.js 삭제 스테이징
git add new-name.js  # new-name.js 신규 스테이징

# 두 단계를 한 번에 하려면
git mv old-name.js new-name.js
```

![git add -u 활용 시나리오](/assets/posts/git-add-update-scenario.svg)

### 3. 특정 디렉터리의 추적 파일만 업데이트

```bash
# src/ 하위의 추적된 파일 변경만 스테이징
git add -u src/
```

경로 인수를 함께 쓰면 범위를 제한할 수 있다.

## 삭제 스테이징 주의

`-u`는 추적 파일의 삭제도 포함한다. 파일을 실수로 삭제했다면 `git add -u` 전에 `git restore <file>`로 복구해야 한다.

```bash
rm src/important.js   # 실수로 삭제

# 복구 (git add -u 실행 전에)
git restore src/important.js

# 만약 이미 스테이징했다면
git restore --staged src/important.js
git restore src/important.js
```

## 실용 팁: 커밋 전 항상 확인

어떤 `add` 옵션을 쓰든, 스테이징 후 `git diff --staged`로 실제 커밋될 내용을 확인하는 습관이 중요하다.

```bash
git add -u
git diff --staged   # 스테이징된 내용 diff 출력
git commit -m "fix: update config handling"
```

이 한 단계가 의도치 않은 파일이나 변경이 커밋에 포함되는 것을 막는 가장 효과적인 방법이다.

---

**지난 글:** [git add -p: 변경을 헝크 단위로 골라 스테이징하기](/posts/git-add-patch/)

**다음 글:** [git restore: 파일을 원하는 상태로 되돌리기](/posts/git-restore/)

<br>
읽어주셔서 감사합니다. 😊
