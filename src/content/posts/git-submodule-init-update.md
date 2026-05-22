---
title: "Git 서브모듈 init과 update: 설정과 동기화"
description: "git submodule init과 update의 역할 차이, --recurse-submodules 클론 옵션, 원격 업데이트 반영 방법, Detached HEAD 처리까지 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "submodule", "init", "update", "서브모듈"]
featured: false
draft: false
---

[지난 글](/posts/git-submodule-basics/)에서 서브모듈의 개념과 `git submodule add`로 서브모듈을 추가하는 방법을 살펴봤다. 이번에는 서브모듈이 포함된 저장소를 클론한 뒤 초기화하고 업데이트하는 과정을 다룬다.

## init과 update는 왜 두 단계인가

서브모듈이 포함된 저장소를 일반적인 `git clone`으로 받으면 서브모듈 디렉터리는 **빈 상태**다. Git은 `.gitmodules` 파일만 가져오고 실제 파일은 다운로드하지 않는다.

- `git submodule init`: `.gitmodules`의 URL·경로 정보를 `.git/config`에 등록한다. 실제 파일 다운로드는 하지 않는다.
- `git submodule update`: 등록된 정보를 바탕으로 실제 파일을 다운로드하고 포인터가 가리키는 커밋으로 체크아웃한다.

두 단계를 분리한 이유는 URL을 `.git/config`에서 재정의할 수 있도록 하기 위해서다. 예를 들어 내부 미러 URL을 사용하는 경우 `init` 후 `.git/config`에서 URL을 수정한 뒤 `update`할 수 있다.

## 가장 빠른 초기화 방법

실무에서는 대부분 init과 update를 따로 실행할 필요가 없다.

```bash
# 하나의 명령으로 모든 서브모듈 초기화 + 파일 다운로드
git submodule update --init --recursive
```

`--recursive`는 서브모듈 안에 또 다른 서브모듈이 있을 때 중첩으로 처리한다.

![서브모듈 init → update 흐름](/assets/posts/git-submodule-init-update-flow.svg)

## 클론 시 서브모듈 함께 받기

저장소를 처음 받는 단계에서 서브모듈까지 한 번에 초기화할 수 있다.

```bash
git clone --recurse-submodules https://github.com/org/main.git
```

이미 클론한 뒤 서브모듈을 깜빡했다면:

```bash
git submodule update --init --recursive
```

팀에서 이 명령을 자주 쓴다면 `Makefile`이나 `npm postinstall` 스크립트에 등록해두면 편하다.

## 서브모듈 업데이트 시나리오

서브모듈을 관리하다 보면 두 가지 업데이트 상황이 생긴다.

**시나리오 A: 원격 서브모듈에 새 커밋이 생겼을 때**

서브모듈 원격에 변경이 생기면 `--remote` 옵션으로 최신 커밋을 가져올 수 있다.

```bash
git submodule update --remote --recursive
```

이 명령은 `.gitmodules`에 지정된 브랜치(없으면 `HEAD`)의 최신 커밋으로 서브모듈을 이동시킨다. 이후 메인 저장소에서 포인터를 업데이트하는 커밋을 남겨야 한다.

**시나리오 B: 팀원이 포인터를 업데이트했을 때**

팀원이 서브모듈 포인터를 업데이트해 푸시했다면 `git pull` 후 `update`를 실행한다.

```bash
git pull
git submodule update --init --recursive
```

`git pull --recurse-submodules`로 한 번에 처리할 수도 있다.

![서브모듈 업데이트 시나리오](/assets/posts/git-submodule-init-update-update.svg)

## Detached HEAD 처리

`git submodule update`를 실행하면 서브모듈은 항상 **Detached HEAD** 상태가 된다. 브랜치가 아니라 특정 커밋 SHA에 직접 체크아웃되기 때문이다.

서브모듈 안에서 작업하려면 반드시 브랜치로 이동해야 한다.

```bash
# 서브모듈 디렉터리로 이동
cd libs/util

# 브랜치로 이동
git switch main

# 작업 후 커밋
git add .
git commit -m "fix: patch in submodule"
git push

# 메인 저장소로 돌아와 포인터 업데이트
cd ../../
git add libs/util
git commit -m "chore: update libs/util pointer"
```

## 전체 서브모듈에 명령 실행

`git submodule foreach`로 모든 서브모듈에 임의의 명령을 일괄 실행할 수 있다.

```bash
# 모든 서브모듈에서 git pull
git submodule foreach 'git pull origin main'

# 각 서브모듈의 현재 브랜치 확인
git submodule foreach 'git branch --show-current'
```

---

**지난 글:** [Git 서브모듈 기초: 저장소 안의 저장소](/posts/git-submodule-basics/)

**다음 글:** [서브모듈 주의사항과 함정](/posts/git-submodule-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
