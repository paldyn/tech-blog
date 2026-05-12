---
title: "원격 저장소(Remote)의 본질과 역할"
description: "Git 원격 저장소의 개념, 추적 브랜치, .git/config의 remote 설정, git remote 명령어의 전반적인 사용법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "remote", "원격 저장소", "origin", "tracking branch"]
featured: false
draft: false
---

[지난 글](/posts/git-conflict-with-stash/)에서 stash 중 충돌 처리를 마무리했다. 이번 글부터는 새로운 주제인 **원격 저장소(Remote)**로 넘어간다. Git에서 협업의 핵심은 원격 저장소와의 연결이다.

## 원격 저장소란

원격 저장소(Remote)는 **네트워크상(또는 다른 경로)에 있는 또 다른 Git 저장소**다. 로컬 저장소와 구조적으로 동일한 완전한 Git 저장소지만, 여러 사람이 공유하거나 백업 목적으로 사용한다.

```
로컬 저장소 (개인 컴퓨터)   ←─fetch──→   원격 저장소 (GitHub 등)
                           ←─push───
```

`origin`은 `git clone` 시 자동으로 붙는 기본 원격 이름이다. 이름일 뿐이며 다른 이름으로 바꾸거나 여러 원격을 동시에 가질 수 있다.

## 원격 저장소의 구조

원격 저장소 정보는 `.git/config`에 저장된다.

```ini
[remote "origin"]
    url = https://github.com/example/repo.git
    fetch = +refs/heads/*:refs/remotes/origin/*
```

`fetch` 항목은 원격 브랜치를 로컬의 어느 참조 경로에 매핑할지 정의한다. `+refs/heads/*:refs/remotes/origin/*`은 원격의 모든 브랜치를 `origin/*` 형태로 추적 브랜치에 저장하라는 뜻이다.

## 추적 브랜치(Tracking Branch)

`git fetch`를 실행하면 원격 브랜치의 최신 내용이 로컬의 **추적 브랜치**(`origin/main` 등)에 기록된다. 추적 브랜치는 원격 상태의 로컬 스냅샷이다.

![원격 저장소의 구조](/assets/posts/git-remote-essence-concept.svg)

```bash
# 추적 브랜치 목록
git branch -r
# origin/main
# origin/feature/auth
# origin/HEAD -> origin/main

# 로컬과 원격 브랜치 모두 보기
git branch -a
```

추적 브랜치(`origin/main`)는 `git fetch` 전까지 로컬에 남아 있는 이전 스냅샷이다. 네트워크 없이도 원격의 마지막 상태를 참조할 수 있다.

## 원격 저장소 조회

```bash
# 등록된 원격과 URL 보기
git remote -v
# origin  https://github.com/example/repo.git (fetch)
# origin  https://github.com/example/repo.git (push)

# 특정 원격의 상세 정보
git remote show origin
```

`git remote show origin`은 각 로컬 브랜치가 어느 원격 브랜치를 추적하는지, 최신 동기화 상태까지 보여준다.

## 원격 저장소 추가·변경·삭제

![원격 저장소 핵심 명령어](/assets/posts/git-remote-essence-commands.svg)

```bash
# 원격 추가
git remote add origin https://github.com/example/repo.git

# URL 변경 (SSH로 전환 등)
git remote set-url origin git@github.com:example/repo.git

# 이름 변경
git remote rename origin upstream

# 원격 삭제
git remote remove upstream
```

## 여러 원격 저장소

하나의 로컬 저장소가 여러 원격을 가질 수 있다. 포크(fork) 기반 협업에서 흔히 사용한다.

```bash
# 포크한 자신의 저장소
git remote add origin https://github.com/myname/repo.git

# 원본(upstream) 저장소도 추가
git remote add upstream https://github.com/orgname/repo.git

# upstream의 최신 내용을 내 포크에 반영
git fetch upstream
git rebase upstream/main
git push origin main
```

## origin은 관습일 뿐

`origin`이라는 이름은 Git 내부에서 특별한 의미를 갖지 않는다. 단지 `git clone` 시 자동으로 붙는 관습적 이름이다. 팀 컨벤션에 따라 `backup`, `deploy`, `upstream` 등 다른 이름을 자유롭게 사용할 수 있다.

```bash
# 직접 init한 뒤 원격 추가 시 이름 자유 선택
git init
git remote add server https://git.example.com/repo.git
git push server main
```

---

**지난 글:** [git stash 적용 중 충돌 처리](/posts/git-conflict-with-stash/)

<br>
읽어주셔서 감사합니다. 😊
