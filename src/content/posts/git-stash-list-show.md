---
title: "git stash list와 show — 스태시 목록 확인"
description: "git stash list로 저장된 항목 목록을 조회하고, stash show로 변경 내용을 확인하는 방법, 포맷 옵션과 실전 사용 패턴을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "stash", "list", "show", "스태시 조회"]
featured: false
draft: false
---

[지난 글](/posts/git-stash-basics/)에서 `git stash`의 기본 개념과 워크플로를 살펴봤다. 이번에는 stash 스택을 **조회하고 내용을 확인**하는 방법을 자세히 다룬다. stash가 여러 개 쌓였을 때 원하는 것을 찾는 방법이 핵심이다.

## stash list

`git stash list`는 스택에 저장된 모든 stash 항목을 출력한다.

![stash 스택 구조](/assets/posts/git-stash-list-show-concept.svg)

```bash
git stash list
# stash@{0}: WIP on feature/login: abc1234 로그인 WIP
# stash@{1}: WIP on main: def5678 hotfix 시도
# stash@{2}: WIP on develop: ghi9012 실험

# 이름 붙인 경우
git stash push -m "API 연동 작업 중"
git stash list
# stash@{0}: On feature/login: API 연동 작업 중
```

이름이 없으면 "WIP on 브랜치: SHA 메시지" 형식이 기본이다. 스택이 커지면 이름을 붙이는 게 관리하기 쉽다.

## stash list 포맷 옵션

`git log`와 동일한 `--format` 옵션을 쓸 수 있다.

```bash
# 인덱스와 메시지만
git stash list --format="%gd: %s"
# stash@{0}: On feature/login: API 연동 작업 중

# 날짜 포함
git stash list --format="%gd %cr: %s"
# stash@{0} 2 hours ago: On feature/login: API 연동 작업 중

# 간결한 형태
git stash list --oneline
```

`%gd`는 stash ref(예: stash@{0}), `%s`는 제목, `%cr`은 상대 날짜다.

## stash show

`git stash show`는 특정 stash가 어떤 파일을 변경했는지 요약을 보여준다.

![stash show 상세 확인](/assets/posts/git-stash-list-show-detail.svg)

```bash
# 가장 최근 stash 변경 파일 요약
git stash show
# src/auth.js     | 12 +++++++++---
# src/login.css   |  5 ++---
# 2 files changed, ...

# 특정 stash
git stash show stash@{1}

# stat 형태 (파일 목록 + 통계)
git stash show --stat
git stash show --stat stash@{2}
```

## stash show -p: 전체 diff

```bash
# 전체 diff 출력 (가장 최근 stash)
git stash show -p

# 특정 stash의 전체 diff
git stash show -p stash@{1}
```

`-p`(또는 `--patch`)는 실제 변경 내용을 diff 형태로 보여준다. stash를 복원하기 전에 내용을 미리 확인할 때 유용하다.

## 실전 패턴: 원하는 stash 찾기

```bash
# 1. 목록으로 후보 좁히기
git stash list
# stash@{0}: On feature: API 연동 작업 중
# stash@{1}: On main: 설정 파일 수정
# stash@{2}: On develop: 실험적 기능

# 2. show로 파일 확인
git stash show stash@{1}
# config/settings.py | 8 +++++---

# 3. diff로 내용 확인
git stash show -p stash@{1}

# 4. 원하는 stash 복원
git stash apply stash@{1}
```

## stash와 git log 연계

stash는 내부적으로 커밋 객체로 저장된다. `git log`로도 확인할 수 있다.

```bash
# stash 커밋의 상세 정보
git log --oneline stash@{0}^..stash@{0}

# stash가 저장된 브랜치 확인
git show stash@{0} --format="%D"
```

stash 객체는 parent가 두 개인 특수한 머지 커밋 구조다. parent 1은 HEAD, parent 2는 인덱스(스테이징) 상태다.

## stash 관리 팁

스택이 커지면 오래된 stash를 정리하는 것이 좋다.

```bash
# 모든 stash 목록 확인
git stash list

# 특정 stash 삭제
git stash drop stash@{2}

# 모든 stash 삭제 (신중히)
git stash clear

# 특정 stash를 새 브랜치로 만들기
git stash branch new-branch stash@{1}
```

`stash branch`는 stash를 만든 시점의 HEAD에서 새 브랜치를 만들고 stash를 적용한 뒤 스택에서 제거한다. stash가 현재 브랜치와 충돌날 때 유용하다.

---

**지난 글:** [git stash — 변경사항 임시 저장](/posts/git-stash-basics/)

<br>
읽어주셔서 감사합니다. 😊
