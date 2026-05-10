---
title: "git branch: 브랜치 목록 조회와 생성"
description: "git branch로 로컬·원격 브랜치를 조회하고, 다양한 생성 패턴(생성만/생성+이동/특정 ref 기준)을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "git branch", "브랜치 생성", "브랜치 목록", "git switch"]
featured: false
draft: false
---

[지난 글](/posts/git-branch-essence/)에서 브랜치가 41바이트 포인터 파일임을 이해했다. 이번에는 실제로 브랜치를 조회하고 생성하는 명령을 구체적으로 살펴본다.

## 브랜치 목록 조회

```bash
# 로컬 브랜치만
git branch

# 원격 추적 브랜치 포함
git branch -a

# 원격 브랜치만
git branch -r

# 각 브랜치의 최신 커밋 메시지 표시
git branch -v
```

`*`로 표시된 것이 현재 체크아웃된 브랜치(HEAD가 가리키는 곳)다.

![브랜치 목록 조회 옵션](/assets/posts/git-branch-list-create-commands.svg)

## 병합 상태로 필터링

삭제해도 안전한 브랜치를 찾을 때 유용하다.

```bash
# 현재 브랜치에 이미 병합된 브랜치
git branch --merged

# 아직 병합되지 않은 브랜치
git branch --no-merged

# 특정 브랜치 기준
git branch --merged main
git branch --no-merged develop
```

`--merged`에 표시된 브랜치는 `-d`로 안전하게 삭제할 수 있다.

## 브랜치 생성

```bash
# 현재 커밋에서 브랜치 생성 (HEAD는 이동하지 않음)
git branch feature-login

# 생성 + 즉시 이동 (가장 자주 쓰는 패턴)
git switch -c feature-login
git checkout -b feature-login  # 구 방식, 동일 효과
```

`git switch -c`는 Git 2.23에서 도입된 명확한 명령이다. `git checkout -b`는 여전히 동작하지만 새 코드에서는 `switch`를 권장한다.

![브랜치 생성 패턴](/assets/posts/git-branch-list-create-workflow.svg)

## 특정 커밋·태그 기준으로 생성

```bash
# 3커밋 전 지점에서 핫픽스 브랜치
git branch hotfix/null-check HEAD~3

# 릴리스 태그에서 브랜치
git branch release/1.0 v1.0.0-rc

# 다른 브랜치 기준
git branch feature-v2 develop
```

## 원격 브랜치 기반 생성

원격에 있는 브랜치를 로컬에 만들면서 추적 관계까지 설정한다.

```bash
# origin/feature-login 기반으로 로컬 브랜치 생성
git switch -c feature-login origin/feature-login

# 원격과 동일한 이름으로 자동 생성 (추적 자동 설정)
git switch feature-login   # origin/feature-login 자동 추적
```

## 브랜치 목록 정리 팁

시간이 지나면 브랜치가 쌓인다. 주기적으로 정리하는 습관을 들이자.

```bash
# 원격에서 삭제된 브랜치의 로컬 추적 브랜치 정리
git fetch --prune

# 병합 완료된 브랜치 일괄 삭제 (main 제외)
git branch --merged main \
  | grep -v "^\* \|main" \
  | xargs git branch -d
```

---

**지난 글:** [브랜치의 본질: Git 브랜치가 가볍고 빠른 이유](/posts/git-branch-essence/)

**다음 글:** [브랜치 이름 변경과 삭제: git branch -m/-d/-D](/posts/git-branch-rename-delete/)

<br>
읽어주셔서 감사합니다. 😊
