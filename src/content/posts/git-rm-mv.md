---
title: "git rm / git mv: 파일 삭제와 이동을 히스토리에 남기는 법"
description: "git rm과 git mv 명령으로 파일 삭제·이름 변경·디렉터리 이동을 스테이징까지 한 번에 처리하는 방법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "git rm", "git mv", "파일 삭제", "이름 변경", "추적 해제"]
featured: false
draft: false
---

[지난 글](/posts/git-reset-types/)에서 `git reset`의 세 가지 모드를 살펴봤다. 이번에는 작업 트리에서 파일을 지우거나 이름을 바꿀 때 Git이 이 변경을 히스토리에 정확히 기록할 수 있도록 도와주는 `git rm`과 `git mv`를 다룬다.

## 왜 `rm` 대신 `git rm`을 쓰는가

터미널에서 `rm src/old.js`를 실행하면 파일은 사라지지만 Git은 이 삭제를 **Untracked changes**로 인식한다. `git status`를 보면 `deleted: src/old.js`가 스테이징되지 않은 채로 남는다. 커밋하려면 다시 `git add -u` 또는 `git rm src/old.js`를 실행해야 한다.

`git rm`은 **워킹트리 파일 삭제 + 인덱스(스테이징) 등록**을 한 번에 처리한다.

```bash
# 파일 삭제 후 바로 스테이징됨
git rm src/old.js

# 확인
git status
# Changes to be committed:
#       deleted:    src/old.js
```

![git rm / git mv 동작 흐름](/assets/posts/git-rm-mv-overview.svg)

## --cached: 인덱스에서만 제거

가장 자주 쓰는 플래그다. 워킹트리 파일은 남기되 Git 추적에서만 제외한다.

```bash
# .gitignore 추가를 깜빡해서 이미 커밋된 파일을 추적 해제
echo "secret.env" >> .gitignore
git rm --cached secret.env
git commit -m "chore: stop tracking secret.env"
```

파일은 로컬에 그대로 있지만 다음 커밋 이후부터 Git은 이 파일을 신경 쓰지 않는다.

## 재귀 삭제와 강제 삭제

```bash
# 디렉터리 전체를 재귀적으로 삭제
git rm -r dist/
git rm -r --cached node_modules/

# 워킹트리에 변경이 있는 파일 강제 삭제
git rm -f config/local.js
```

워킹트리 파일이 인덱스와 다르거나(수정됨), 또는 HEAD와 다른 경우 Git은 기본으로 `git rm`을 거부한다. `-f`(force) 플래그를 주면 강제로 삭제한다.

## git mv: 이름 변경과 디렉터리 이동

`mv old.js new.js`로 파일을 옮기면 Git은 이를 삭제 + 추가로 인식한다. 유사도가 높을 때 `git log --follow`로 히스토리를 추적할 수 있지만, 명시적으로 `git mv`를 쓰면 rename이 인덱스에 바로 스테이징된다.

```bash
# 이름 변경
git mv old-name.js new-name.js

# 다른 디렉터리로 이동
git mv src/util.js lib/util.js

# 상태 확인 — R(rename)으로 표시됨
git status
# Changes to be committed:
#       renamed:    old-name.js -> new-name.js
```

`git mv`는 내부적으로 세 단계를 수행한다: `mv` → `git rm` → `git add`. 수동으로 이 세 명령을 실행한 결과와 동일하다.

![git rm / git mv 실전 패턴](/assets/posts/git-rm-mv-examples.svg)

## 대소문자 변경 주의 (macOS / Windows)

파일 시스템이 대소문자 비구별(case-insensitive)인 macOS/Windows에서는 `git mv Button.js button.js`처럼 대소문자만 바꾸는 경우 일반 `mv`로는 변경이 감지되지 않는다. `git mv`를 쓰면 Git이 rename으로 처리해 안전하다.

```bash
# macOS/Windows 대소문자 rename
git mv Header.jsx header.jsx
```

## 정리

| 명령 | 워킹트리 | 인덱스 | 용도 |
|------|---------|--------|------|
| `git rm` | 삭제 | 삭제 스테이징 | 파일 완전 제거 |
| `git rm --cached` | 유지 | 삭제 스테이징 | 추적만 해제 |
| `git mv` | 이동/개명 | rename 스테이징 | 이름·경로 변경 |

파일 삭제나 이동을 할 때는 항상 `git rm`/`git mv`를 먼저 고려하자. `git status`에서 예상치 못한 `deleted:` 항목이 보이면 십중팔구 Git을 거치지 않은 삭제다.

---

**지난 글:** [git reset: soft·mixed·hard 세 가지 모드 완전 정복](/posts/git-reset-types/)

**다음 글:** [git clean: 추적되지 않는 파일을 한 번에 정리하기](/posts/git-clean/)

<br>
읽어주셔서 감사합니다. 😊
