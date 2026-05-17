---
title: "여러 원격 저장소 관리하기"
description: "하나의 로컬 저장소에 origin, upstream, backup 등 여러 원격을 등록하고, 각각에 fetch·push하는 방법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "remote", "upstream", "origin", "multiple remotes", "포크"]
featured: false
draft: false
---

[지난 글](/posts/git-upstream-set/)에서 로컬 브랜치와 원격 추적 브랜치를 연결하는 업스트림 설정을 다뤘다. 이번에는 하나의 로컬 저장소에 **여러 원격 저장소**를 등록하고 각각을 목적에 맞게 활용하는 패턴을 살펴본다. 오픈소스 기여나 팀 환경에서는 `origin` 하나만으로는 부족한 경우가 많다.

## 왜 여러 원격이 필요한가

오픈소스 기여 시나리오를 생각해보면 이해가 쉽다. 원본 저장소(upstream)에서 변경 사항을 가져오면서, 내가 작업한 내용은 내 포크(origin)에 push한다. 여기에 내부 백업 서버(backup)까지 추가하면 세 곳의 원격을 하나의 로컬 저장소에서 관리하게 된다.

```bash
# 현재 등록된 원격 목록과 URL 확인
git remote -v
# origin    https://github.com/myname/repo.git (fetch)
# origin    https://github.com/myname/repo.git (push)
```

![여러 원격 저장소 토폴로지](/assets/posts/git-multiple-remotes-topology.svg)

## 원격 추가: git remote add

```bash
# 오픈소스 원본 저장소를 upstream으로 등록
git remote add upstream https://github.com/original/repo.git

# 자체 백업 서버 등록
git remote add backup ssh://user@server/srv/git/repo.git

# 등록 결과 확인
git remote -v
```

이름은 관례적으로 `origin`(내 포크/주 작업 저장소), `upstream`(원본 소스), `backup`(보조 미러) 순서로 많이 쓴다. 이름 자체는 임의로 지정 가능하다.

## upstream에서 최신 코드 가져오기

오픈소스 기여 워크플로에서 가장 자주 사용하는 패턴이다.

```bash
# upstream에서 최신 변경 사항 받기
git fetch upstream

# upstream/main을 내 main에 병합
git switch main
git merge upstream/main

# 내 포크(origin)도 최신 상태로 유지
git push origin main
```

이 흐름을 주기적으로 실행하면 내 포크가 원본과 동기화된 상태를 유지할 수 있다.

## 여러 원격에 동시 push

같은 내용을 여러 원격에 push해야 한다면 push URL을 여러 개 등록하는 방법이 있다.

```bash
# origin에 push URL 추가 (기존 URL 유지 + 새 URL 추가)
git remote set-url --add --push origin https://github.com/myname/repo.git
git remote set-url --add --push origin ssh://user@backup-server/repo.git

# git push origin 실행 시 두 URL 모두에 동시 push
git push origin
```

단, fetch와 push를 분리하고 싶다면 `--add --push`보다는 각 원격을 별개로 등록하는 편이 더 명확하다.

![여러 원격 관리 명령어](/assets/posts/git-multiple-remotes-commands.svg)

## 원격 이름 변경 및 삭제

```bash
# 원격 이름 변경
git remote rename backup archive

# 원격 삭제 (로컬 파일은 영향 없음)
git remote remove archive

# 또는 단축형
git remote rm archive
```

원격을 삭제해도 로컬 커밋 기록이나 파일은 전혀 영향받지 않는다. 단지 해당 원격과의 연결 정보만 지워진다.

## 원격별 URL 변경

기존 원격의 URL을 바꿔야 할 때(저장소 이전, SSH ↔ HTTPS 전환 등)는 `set-url`을 사용한다.

```bash
# HTTPS → SSH 전환
git remote set-url origin git@github.com:myname/repo.git

# 변경 확인
git remote get-url origin
```

## 정리

`git remote add`로 원격을 여러 개 등록하면 `origin`(내 포크), `upstream`(원본), `backup`(미러) 등 목적에 따라 원격을 분리해서 관리할 수 있다. `git fetch upstream`으로 원본의 최신 코드를 반영하고, `git push origin`으로 내 작업을 내 포크에 올리는 패턴은 오픈소스 기여의 기본 흐름이다.

---

**지난 글:** [업스트림 설정으로 push/pull 자동화하기](/posts/git-upstream-set/)

**다음 글:** [Fork & Clone 워크플로우](/posts/git-fork-clone-flow/)

<br>
읽어주셔서 감사합니다. 😊
