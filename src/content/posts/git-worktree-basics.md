---
title: "Git Worktree 기초: 하나의 저장소, 여러 작업 디렉터리"
description: "git worktree add로 하나의 저장소에서 여러 브랜치를 동시에 체크아웃하는 방법, stash 없이 컨텍스트를 전환하는 실용적 워크플로를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "worktree", "워크트리", "멀티브랜치"]
featured: false
draft: false
---

[지난 글](/posts/git-subtree-basics/)에서 서브트리로 외부 저장소를 통합하는 방법을 살펴봤다. 이번에는 완전히 다른 주제로, 하나의 Git 저장소에서 여러 브랜치를 **동시에** 체크아웃할 수 있는 `git worktree`를 다룬다.

## worktree가 필요한 순간

작업 중인 feature 브랜치를 stash하고 hotfix 브랜치로 전환한 경험이 있을 것이다. stash 후 체크아웃, 핫픽스 작업, 다시 복귀, stash pop — 이 과정에서 실수로 stash를 덮어쓰거나 context를 잃는 일이 발생한다.

`git worktree`는 이 문제를 근본적으로 해결한다. **하나의 Git 저장소에 여러 작업 디렉터리(worktree)를 연결**해, 각 디렉터리에서 서로 다른 브랜치를 동시에 체크아웃할 수 있다.

## 핵심 개념

`git worktree`의 핵심은 `.git/` 디렉터리(오브젝트 DB, 레퍼런스 등)는 **공유**하면서 작업 디렉터리만 여러 개 유지한다는 것이다.

![git worktree: 하나의 저장소, 여러 작업 디렉터리](/assets/posts/git-worktree-basics-concept.svg)

기존의 저장소 경로는 **메인 워크트리**가 되고, `git worktree add`로 만드는 추가 경로는 **연결된 워크트리(linked worktree)** 가 된다.

## 워크트리 추가하기

```bash
# 기존 브랜치로 워크트리 추가
git worktree add ../myapp-hotfix hotfix/critical

# 새 브랜치를 동시에 생성하며 워크트리 추가
git worktree add -b hotfix/new-issue ../myapp-fix main

# 이후 해당 디렉터리로 이동해 작업
cd ../myapp-hotfix
git branch   # hotfix/critical 에 있음
```

`../myapp-hotfix`는 메인 저장소 디렉터리 옆에 생성된다. 절대 경로도 사용할 수 있다.

## 목록 확인과 삭제

![git worktree 핵심 명령어](/assets/posts/git-worktree-basics-commands.svg)

```bash
# 현재 워크트리 목록 확인
git worktree list
# /home/user/myapp           a3f9c82 [main]
# /home/user/myapp-hotfix    7d2e4f1 [hotfix/critical]
# /home/user/myapp-review    c0b5e31 [feature/auth]

# 작업 완료 후 워크트리 제거
git worktree remove ../myapp-hotfix

# 디렉터리를 수동으로 삭제했다면 깨진 링크 정리
git worktree prune
```

## 브랜치 잠금 규칙

같은 브랜치를 두 워크트리에서 동시에 체크아웃하려 하면 Git이 거부한다.

```bash
# hotfix/critical가 이미 다른 워크트리에서 사용 중이면 오류 발생
git worktree add ../another-dir hotfix/critical
# fatal: 'hotfix/critical' is already checked out at '../myapp-hotfix'
```

이 제약은 같은 브랜치를 두 곳에서 수정해 충돌하는 상황을 방지한다. 완전히 새로운 브랜치(`-b` 옵션)를 사용하거나, 기존 워크트리를 제거해야 한다.

## 실용적인 사용 사례

**코드 리뷰와 개발 병행**: feature 브랜치 개발 중에 PR 리뷰 요청을 받았을 때, stash 없이 별도 워크트리에서 리뷰 브랜치를 체크아웃하고 확인한다.

```bash
# 리뷰할 브랜치로 워크트리 생성
git worktree add ../myapp-review feature/pr-1234

# 터미널 탭을 두 개 열어 동시에 작업
```

**빌드 비교**: 두 브랜치의 빌드 결과를 동시에 비교할 때 유용하다.

**긴급 핫픽스**: 기능 개발 중 긴급 패치가 필요한 경우 stash 없이 전환한다.

```bash
# 기능 개발 중단 없이 핫픽스 워크트리 생성
git worktree add -b hotfix/cve-2026-01 ../myapp-hotfix main

# 핫픽스 작업 완료 후
cd ../myapp-hotfix
git commit -m "fix: patch CVE-2026-01"
git push

# 원래 작업으로 복귀
cd ../myapp
git worktree remove ../myapp-hotfix
```

---

**지난 글:** [Git 서브트리 기초](/posts/git-subtree-basics/)

**다음 글:** [Git Worktree 멀티 브랜치 워크플로](/posts/git-worktree-multi-branch/)

<br>
읽어주셔서 감사합니다. 😊
