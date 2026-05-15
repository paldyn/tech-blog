---
title: "추적 브랜치(Tracking Branch): 로컬과 원격의 연결 고리"
description: "원격 추적 브랜치의 개념을 이해하고, git push -u와 git branch -u로 추적 관계를 설정·변경·확인하는 방법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "추적 브랜치", "tracking branch", "upstream", "origin"]
featured: false
draft: false
---

[지난 글](/posts/git-branch-rename-delete/)에서 브랜치 이름 변경과 삭제를 다뤘다. 이번에는 로컬 브랜치가 원격 브랜치를 추적하는 메커니즘을 살펴본다. 추적 관계를 이해하면 `git push`나 `git pull` 인수 없이 쓸 수 있는 이유, 그리고 "ahead/behind" 표시의 의미를 명확히 알 수 있다.

## 원격 추적 브랜치란

`git clone` 또는 `git fetch`를 실행하면 Git은 **원격 추적 브랜치**(remote-tracking branch)를 로컬에 생성한다. `origin/main` 같은 이름으로 `.git/refs/remotes/` 아래 저장된다.

```bash
# 원격 추적 브랜치 확인
git branch -r
# → origin/HEAD -> origin/main
#   origin/main
#   origin/develop
```

이것은 "마지막으로 통신했을 때 원격의 상태"를 기록하는 읽기 전용 스냅샷이다. 직접 체크아웃하거나 수정할 수 없다.

## 추적 관계(upstream)

로컬 `main`이 `origin/main`을 추적한다는 것은, 두 브랜치 사이의 ahead/behind 관계를 Git이 자동으로 계산해준다는 의미다.

![추적 브랜치 개념](/assets/posts/git-branch-tracking-concept.svg)

추적 관계가 설정되면 `git push`나 `git pull`을 인수 없이 실행해도 Git이 대상 원격·브랜치를 자동으로 알아낸다.

## 추적 관계 설정

```bash
# push 시 동시에 설정 (-u = --set-upstream)
git push -u origin feature-login

# 이미 있는 브랜치에 나중에 설정
git branch --set-upstream-to=origin/feature-login feature-login
git branch -u origin/feature-login  # 현재 브랜치에만 적용
```

`git clone`은 기본적으로 `main` 브랜치에 추적 관계를 자동 설정한다.

![추적 브랜치 설정 명령](/assets/posts/git-branch-tracking-commands.svg)

## 추적 관계 확인

```bash
# 모든 브랜치 추적 관계 + ahead/behind
git branch -vv
# → * main     abc1234 [origin/main: ahead 2] feat: login
#     develop  def5678 [origin/develop] fix: null check
```

`git status`는 현재 브랜치의 상태만, `git branch -vv`는 전체 브랜치의 추적 관계를 한눈에 보여준다.

## ahead와 behind

- **ahead N**: 로컬에 N개의 커밋이 원격보다 앞서 있음 → push 필요
- **behind N**: 원격에 N개의 커밋이 로컬보다 앞서 있음 → pull 필요
- **ahead M, behind N**: 양쪽 모두 커밋이 있음 → rebase 또는 merge 필요

```bash
# ahead/behind 숫자를 직접 확인
git rev-list --count main..origin/main  # behind
git rev-list --count origin/main..main  # ahead
```

## 추적 관계 제거

```bash
git branch --unset-upstream main
```

제거 후에는 인수 없이 `git push`를 실행하면 오류가 발생한다. 의도적으로 여러 원격을 사용하는 경우에 유용하다.

## 추적 관계 없이 push/pull

추적 관계가 없어도 명시적으로 대상을 지정하면 동작한다.

```bash
git push origin main
git pull origin main
```

하지만 매번 타이핑해야 하므로 `-u`로 추적 관계를 한 번 설정해두는 것이 편하다.

---

**지난 글:** [브랜치 이름 변경과 삭제: git branch -m/-d/-D](/posts/git-branch-rename-delete/)

**다음 글:** [브랜치 네이밍 컨벤션: 팀이 합의해야 할 규칙들](/posts/git-branch-naming/)

<br>
읽어주셔서 감사합니다. 😊
