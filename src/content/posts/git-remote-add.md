---
title: "git remote add — 원격 저장소 추가하기"
description: "git remote add 명령어로 원격 저장소를 로컬에 등록하는 방법과 origin, upstream 같은 원격 이름 관리를 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "remote", "git remote add", "origin", "upstream"]
featured: false
draft: false
---

[지난 글](/posts/git-remote-essence/)에서 원격 저장소의 개념과 `.git/config` 내부 구조를 살펴봤다. 이번 글에서는 실제로 원격 저장소를 로컬에 **등록**하는 `git remote add` 명령을 중심으로, 이름 규칙과 다양한 URL 형식까지 구체적으로 다룬다.

## 왜 원격 저장소를 "추가"해야 하는가

`git clone`을 사용하면 `origin`이 자동으로 등록된다. 하지만 직접 `git init`으로 시작한 저장소이거나, 포크(fork) 워크플로처럼 **두 개 이상의 원격**을 다뤄야 하는 상황에서는 `git remote add`가 필수다.

명령의 핵심은 단순하다. 원격 저장소의 URL에 짧고 기억하기 쉬운 **이름**을 붙이는 것이다. 이 이름이 이후 `git push origin main`, `git fetch upstream` 처럼 모든 원격 관련 명령에서 식별자로 쓰인다.

![원격 저장소 연결 구조](/assets/posts/git-remote-add-workflow.svg)

## 기본 문법

```bash
git remote add <이름> <URL>
```

`<이름>`은 자유롭게 정할 수 있지만, 관례적으로 다음 두 가지를 가장 많이 사용한다.

| 이름 | 용도 |
|------|------|
| `origin` | 내가 직접 push·pull 하는 주 원격 저장소 |
| `upstream` | 포크(fork)한 원본 프로젝트의 저장소 |

이 두 이름이 관례일 뿐 강제 사항은 아니다. 팀 내에서 `backup`, `staging` 같은 이름도 얼마든지 쓸 수 있다.

## HTTPS와 SSH URL

원격 저장소 URL에는 두 가지 형식이 있다.

```bash
# HTTPS 방식: 토큰 또는 비밀번호 인증
git remote add origin https://github.com/user/repo.git

# SSH 방식: 공개키 인증 (한 번 설정하면 편리)
git remote add origin git@github.com:user/repo.git
```

HTTPS는 설정이 간단하고 방화벽 제한이 없는 환경에서 잘 동작한다. SSH는 초기 키 등록이 필요하지만, 이후 매번 인증 없이 push·pull 할 수 있어 일상 개발에 편리하다. 나중에 `git remote set-url`로 HTTPS ↔ SSH 전환이 가능하므로 처음 선택이 부담스럽지 않다.

## 실제 사용 예시

```bash
# 빈 로컬 저장소에 GitHub 원격 추가
git init my-project
cd my-project
git remote add origin https://github.com/user/my-project.git

# 포크 워크플로: upstream도 추가
git remote add upstream https://github.com/original/my-project.git

# 등록된 원격 목록과 URL 확인
git remote -v
```

`git remote -v` 출력에서 각 원격마다 `(fetch)`와 `(push)` 두 줄이 나타난다. 기본적으로 둘 다 같은 URL을 가리키지만, `git remote set-url --push`로 push URL만 별도로 설정할 수도 있다.

```
origin  https://github.com/user/my-project.git (fetch)
origin  https://github.com/user/my-project.git (push)
upstream  https://github.com/original/my-project.git (fetch)
upstream  https://github.com/original/my-project.git (push)
```

## 등록 이후 .git/config 확인

`git remote add`는 `.git/config`에 다음과 같은 섹션을 추가한다.

```ini
[remote "origin"]
    url = https://github.com/user/my-project.git
    fetch = +refs/heads/*:refs/remotes/origin/*
```

`fetch` 옵션의 `+refs/heads/*:refs/remotes/origin/*`은 refspec이다. 원격의 모든 브랜치(`refs/heads/*`)를 로컬의 추적 브랜치(`refs/remotes/origin/*`)에 매핑한다는 의미다. 이 설정 덕분에 `git fetch origin` 하면 `origin/main`, `origin/develop` 같은 추적 브랜치가 자동으로 갱신된다.

## 주요 서브명령 한눈에

```bash
# 목록 확인
git remote           # 이름만
git remote -v        # 이름 + URL

# 상세 정보 (추적 브랜치, HEAD 등)
git remote show origin

# URL 변경
git remote set-url origin git@github.com:user/repo.git
```

![git remote add 주요 패턴](/assets/posts/git-remote-add-commands.svg)

## 주의사항

- 같은 이름의 원격이 이미 있으면 에러가 발생한다. `git remote remove <이름>` 후 다시 추가하거나, `git remote set-url`로 URL을 덮어쓰면 된다.
- 원격 이름에 슬래시(`/`)는 포함할 수 없다. `team/origin` 같은 이름은 불가능하다.
- `git remote add`는 **로컬 설정**만 변경한다. 원격 저장소 자체에는 아무 영향이 없다.

## 정리

`git remote add` 한 줄로 로컬 저장소가 원격 저장소를 인식하기 시작한다. HTTPS와 SSH 중 팀 환경에 맞는 URL 형식을 선택하고, `origin`과 `upstream`이라는 관례를 따르면 이후의 협업 명령들이 훨씬 직관적이 된다.

---

**지난 글:** [원격 저장소(Remote)의 본질과 역할](/posts/git-remote-essence/)

**다음 글:** [원격 저장소 이름 변경과 삭제](/posts/git-remote-rename-remove/)

<br>
읽어주셔서 감사합니다. 😊
