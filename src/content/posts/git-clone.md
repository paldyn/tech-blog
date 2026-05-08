---
title: "git clone: 원격 저장소 복제하기"
description: "git clone의 동작 원리, HTTPS vs SSH, 디렉토리 지정, 얕은 클론 등 실무에서 쓰는 옵션을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "git clone", "원격저장소", "GitHub"]
featured: false
draft: false
---

[지난 글](/posts/git-init/)에서 로컬에서 새 저장소를 만드는 방법을 살펴봤다. 실제 개발에서는 기존에 존재하는 원격 저장소를 로컬로 가져오는 경우가 더 많다. `git clone`이 그 역할을 한다.

## clone은 단순 다운로드가 아니다

`git clone URL`은 파일만 내려받는 게 아니다. 원격 저장소의 **모든 것**을 복제한다.

- 전체 커밋 이력 (첫 번째 커밋부터 현재까지)
- 모든 브랜치 정보
- 모든 태그
- `origin` 원격 설정 (push/fetch할 주소가 자동 설정)

클론이 완료되면 인터넷 없이도 전체 이력 탐색, 브랜치 전환, 커밋 비교가 가능하다.

![git clone이 하는 일](/assets/posts/git-clone-process.svg)

## 기본 사용법

```bash
# GitHub 저장소 클론
git clone https://github.com/user/repo.git

# 클론 완료 후 자동으로 생성된 것들
cd repo
git remote -v
# origin  https://github.com/user/repo.git (fetch)
# origin  https://github.com/user/repo.git (push)

git branch -a
# * main
#   remotes/origin/HEAD -> origin/main
#   remotes/origin/main
#   remotes/origin/develop
```

## HTTPS vs SSH

원격 저장소에 접근하는 두 가지 방식이 있다.

**HTTPS**: 별도 설정 없이 즉시 사용 가능하다. 처음 push/pull 시 GitHub 계정 자격증명(토큰)을 요구한다. `git-credential-helper`를 설정하면 이후에는 자동 인증된다.

**SSH**: SSH 키를 GitHub 계정에 등록해두면 비밀번호 없이 인증된다. 개발자 환경에서 더 편리하다.

```bash
# HTTPS
git clone https://github.com/user/repo.git

# SSH (키 설정 완료 후)
git clone git@github.com:user/repo.git
```

## 주요 옵션

![git clone 주요 옵션](/assets/posts/git-clone-options.svg)

**디렉토리 이름 지정**: 기본적으로 저장소 이름 그대로 디렉토리가 생성된다. 다른 이름을 쓰고 싶다면 URL 뒤에 지정한다.

```bash
git clone https://github.com/user/long-project-name.git app
# ./app/ 디렉토리에 클론됨
```

**특정 브랜치 체크아웃**: 기본적으로 기본 브랜치(보통 `main`)가 체크아웃된다. 다른 브랜치를 원한다면 `-b`를 사용한다.

```bash
git clone -b develop https://github.com/user/repo.git
```

**얕은 클론(Shallow Clone)**: CI/CD 파이프라인처럼 최신 상태만 필요하고 이력은 불필요한 경우, `--depth`로 가져올 커밋 수를 제한한다.

```bash
git clone --depth 1 https://github.com/user/repo.git
# 최신 커밋 하나만 받음 — 클론 속도 대폭 감소
```

수백 MB의 이력이 있는 대형 저장소에서 CI 빌드 시간을 수십 초 단축할 수 있다. 단, 이력 탐색이 필요한 작업(git log, git blame 등)은 제한된다.

**서브모듈 포함**: 저장소 안에 다른 Git 저장소가 서브모듈로 포함된 경우, 자동으로 초기화하려면 `--recurse-submodules`를 사용한다.

```bash
git clone --recurse-submodules https://github.com/user/repo.git
```

## 클론 후 확인

```bash
cd repo

# 현재 브랜치와 상태
git status
# On branch main
# Your branch is up to date with 'origin/main'.
# nothing to commit, working tree clean

# 원격 설정 확인
git remote -v

# 전체 이력 확인
git log --oneline -5

# 로컬에서 사용 가능한 모든 브랜치
git branch -a
```

## 로컬 저장소 클론

원격뿐 아니라 로컬 디렉토리도 클론할 수 있다.

```bash
git clone /path/to/local/repo new-copy
# 로컬 경로도 동일하게 동작
```

테스트 환경 구성이나 저장소 백업에 유용하다.

---

**지난 글:** [git init: 새 저장소 초기화](/posts/git-init/)

**다음 글:** [Git의 세 가지 트리](/posts/git-three-trees/)

<br>
읽어주셔서 감사합니다. 😊
