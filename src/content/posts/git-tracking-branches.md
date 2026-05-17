---
title: "원격 추적 브랜치 이해하기"
description: "origin/main 같은 원격 추적 브랜치가 무엇인지, 어떻게 동작하는지, ahead/behind 개념까지 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "tracking branches", "원격 추적 브랜치", "origin", "fetch", "ahead", "behind"]
featured: false
draft: false
---

[지난 글](/posts/git-clone-bare/)에서 Bare 저장소를 다뤘다. 이번에는 `git branch -a`를 실행했을 때 보이는 `remotes/origin/main` 같은 **원격 추적 브랜치(remote-tracking branch)**가 무엇인지, 그리고 fetch·push·pull이 이 브랜치를 어떻게 다루는지 살펴본다.

## 원격 추적 브랜치란

`git clone`이나 `git fetch`를 실행하면 Git은 원격 저장소의 브랜치 상태를 로컬에 **읽기 전용 스냅샷**으로 기록한다. 이것이 원격 추적 브랜치다. 형식은 `<remote>/<branch>`, 즉 `origin/main`, `origin/develop` 형태다.

원격 추적 브랜치는 **직접 체크아웃하거나 커밋을 추가할 수 없다**. 마지막으로 통신했을 때 원격의 상태를 보여주는 북마크에 가깝다.

```bash
# 원격 추적 브랜치 포함 전체 목록
git branch -a

# 원격 추적 브랜치만
git branch -r
```

![원격 추적 브랜치 동작 원리](/assets/posts/git-tracking-branches-overview.svg)

## fetch가 추적 브랜치를 업데이트하는 방법

`git fetch origin`을 실행하면 세 가지 일이 일어난다.

1. 원격 저장소에서 새로운 커밋 객체를 내려받는다
2. `origin/main` 같은 원격 추적 브랜치 포인터를 원격의 현재 HEAD로 갱신한다
3. **로컬 브랜치는 건드리지 않는다**

```bash
# fetch 후 origin/main과 로컬 main의 차이 확인
git fetch origin
git log main..origin/main   # 원격에만 있는 커밋
git log origin/main..main   # 로컬에만 있는 커밋
```

이 두 범위를 보면 현재 브랜치가 원격보다 얼마나 앞서 있는지(ahead), 얼마나 뒤처져 있는지(behind)를 파악할 수 있다.

## ahead / behind 상태

```bash
# 추적 정보와 ahead/behind 표시
git branch -vv
# * main  a1b2c3d [origin/main: ahead 2, behind 1] 커밋 메시지
```

`ahead 2`는 로컬에 원격에 없는 커밋이 2개 있다는 뜻(push 필요), `behind 1`은 원격에 로컬에 없는 커밋이 1개 있다는 뜻(pull 필요)이다.

## 추적 브랜치 직접 참조

원격 추적 브랜치는 일반 ref처럼 커밋 범위 지정, diff, log 등에 직접 사용할 수 있다.

```bash
# origin/main 기준으로 내 변경만 diff
git diff origin/main

# 로컬이 origin/main보다 앞선 커밋만 log
git log origin/main..HEAD

# 원격 추적 브랜치에서 새 로컬 브랜치 생성
git checkout -b hotfix origin/hotfix
```

마지막 명령처럼 원격 추적 브랜치를 시작점으로 로컬 브랜치를 만들면 Git이 자동으로 업스트림을 설정해준다.

## fetch --prune으로 오래된 추적 브랜치 정리

원격에서 삭제된 브랜치라도 로컬의 원격 추적 브랜치는 자동으로 사라지지 않는다.

```bash
# 삭제된 원격 브랜치에 대응하는 추적 브랜치 제거
git fetch --prune origin

# 또는 한 번만 실행
git remote prune origin
```

`fetch.prune=true`를 전역 설정에 추가하면 모든 fetch 시 자동으로 prune이 적용된다.

```bash
git config --global fetch.prune true
```

![원격 추적 브랜치 조회 명령어](/assets/posts/git-tracking-branches-commands.svg)

## 정리

원격 추적 브랜치(`origin/main` 등)는 마지막 통신 시점의 원격 상태를 로컬에 캐시해두는 읽기 전용 포인터다. `git fetch`가 이 포인터를 갱신하고, `git branch -vv`로 ahead/behind 상태를 확인하며, `--prune`으로 불필요한 추적 브랜치를 정리할 수 있다. 원격 추적 브랜치를 잘 이해하면 fetch/pull/push가 각각 무엇을 하는지가 훨씬 명확해진다.

---

**지난 글:** [Bare 저장소란 무엇인가 — git clone --bare](/posts/git-clone-bare/)

**다음 글:** [업스트림 설정으로 push/pull 자동화하기](/posts/git-upstream-set/)

<br>
읽어주셔서 감사합니다. 😊
