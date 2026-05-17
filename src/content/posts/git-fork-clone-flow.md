---
title: "Fork & Clone 워크플로우"
description: "GitHub에서 오픈소스 프로젝트에 기여하기 위한 Fork → Clone → upstream 설정 → PR 생성 전 과정을 단계별로 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "fork", "clone", "upstream", "오픈소스", "PR", "기여"]
featured: false
draft: false
---

[지난 글](/posts/git-multiple-remotes/)에서 여러 원격 저장소를 관리하는 방법을 살펴봤다. 이번에는 그 지식을 바탕으로 오픈소스 기여의 표준 패턴인 **Fork & Clone 워크플로우** 전 과정을 순서대로 다룬다. GitHub에서 가장 널리 쓰이는 협업 방식이다.

## Fork란 무엇인가

Fork는 다른 사람의 저장소를 **내 GitHub 계정 아래에 복사**하는 작업이다. 원본 저장소에 직접 push 권한이 없어도 내 포크에는 자유롭게 변경을 올릴 수 있다. 이후 Pull Request(PR)를 통해 원본 저장소에 변경 제안을 보내는 것이 기본 흐름이다.

## 단계별 워크플로우

![Fork & Clone 전체 워크플로우](/assets/posts/git-fork-clone-flow-diagram.svg)

### ① GitHub에서 Fork

원본 저장소 페이지의 "Fork" 버튼을 클릭하면 `github.com/myname/repo`가 생성된다. 이 과정은 GitHub UI에서만 이루어지며 Git 명령어는 필요 없다.

### ② 내 포크를 로컬에 Clone

```bash
# SSH 방식 권장
git clone git@github.com:myname/repo.git
cd repo
```

클론 직후에는 `origin`이 내 포크를 가리키도록 자동 설정된다.

### ③ upstream 연결

원본 저장소의 변경 사항을 나중에 가져올 수 있도록 `upstream`을 등록한다.

```bash
git remote add upstream git@github.com:original/repo.git
git remote -v
# origin    git@github.com:myname/repo.git (fetch)
# origin    git@github.com:myname/repo.git (push)
# upstream  git@github.com:original/repo.git (fetch)
# upstream  git@github.com:original/repo.git (push)
```

### ④ 기능 브랜치에서 작업 후 push

```bash
# main이 아닌 별도 브랜치에서 작업
git switch -c feature/fix-null-pointer

# 작업, 커밋 후
git push -u origin feature/fix-null-pointer
```

`main`에 직접 커밋하는 것은 피한다. PR 리뷰 중에 `main`을 업데이트해야 할 때 충돌이 생기기 쉽기 때문이다.

![Fork & Clone 워크플로우 명령어](/assets/posts/git-fork-clone-flow-commands.svg)

### ⑤ Pull Request 생성

GitHub에서 내 포크의 기능 브랜치를 원본 저장소의 `main`으로 PR을 생성한다. 리뷰어의 피드백이 오면 같은 브랜치에 추가 커밋을 올리면 자동으로 PR에 반영된다.

## upstream 동기화: 포크를 최신 상태로 유지

PR 리뷰가 오래 걸리거나, 다른 작업을 시작하기 전에 원본의 최신 변경을 반영해야 할 때가 있다.

```bash
# upstream에서 최신 변경 가져오기
git fetch upstream

# 내 main에 병합
git switch main
git merge upstream/main

# 내 포크(origin)의 main도 업데이트
git push origin main
```

이 과정을 정기적으로 실행해야 긴 시간이 지났을 때 대규모 충돌을 방지할 수 있다.

## PR 머지 후 정리

PR이 머지되면 기능 브랜치는 삭제한다.

```bash
# 로컬 브랜치 삭제 (머지 확인 후)
git switch main
git branch -d feature/fix-null-pointer

# 원격 브랜치 삭제 (GitHub에서 "Delete branch" 버튼으로도 가능)
git push origin --delete feature/fix-null-pointer

# 로컬 추적 브랜치 정리
git fetch --prune
```

## 정리

Fork & Clone 워크플로우는 오픈소스 기여의 표준 패턴이다. 핵심은 **원본에 직접 push하지 않고, 내 포크에서 PR을 통해 제안하는 구조**다. `upstream`을 등록해두면 주기적으로 원본 변경을 반영하기 쉽고, 기능 브랜치를 분리하면 PR 리뷰 중에도 다른 작업을 병행할 수 있다.

---

**지난 글:** [여러 원격 저장소 관리하기](/posts/git-multiple-remotes/)

**다음 글:** [Pull Request 기본 흐름](/posts/git-pr-flow-basics/)

<br>
읽어주셔서 감사합니다. 😊
