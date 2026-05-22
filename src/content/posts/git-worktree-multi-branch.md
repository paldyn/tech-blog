---
title: "Git Worktree 멀티 브랜치 워크플로"
description: "git worktree를 활용해 여러 브랜치를 병렬로 관리하는 실전 패턴 — 핫픽스 병행, 코드 리뷰 동시 진행, 베어 저장소 + worktree 초기화 패턴을 소개한다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "worktree", "워크트리", "멀티브랜치", "워크플로"]
featured: false
draft: false
---

[지난 글](/posts/git-worktree-basics/)에서 `git worktree`의 개념과 기본 명령어를 다뤘다. 이번에는 실무에서 자주 쓰는 멀티 브랜치 패턴을 구체적으로 살펴본다.

## 핫픽스와 기능 개발 병행

가장 흔한 사용 사례다. 기능 개발 도중 긴급 핫픽스가 들어오면 stash 없이 별도 워크트리에서 처리할 수 있다.

![멀티 브랜치 병렬 개발 워크플로](/assets/posts/git-worktree-multi-branch-workflow.svg)

```bash
# 현재 상황: feature/login 개발 중 (~/projects/myapp/)
git switch -c feature/login

# 긴급 핫픽스 요청 → stash 없이 새 워크트리 생성
git worktree add -b hotfix/payment ../myapp-fix main

# 핫픽스 작업
cd ../myapp-fix
vim src/payment.js
git commit -am "fix: resolve payment gateway timeout"
git push

# 워크트리 제거 후 원래 작업으로 복귀
cd ../myapp
git worktree remove ../myapp-fix
# feature/login 파일은 그대로 — 이어서 작업
```

## 코드 리뷰와 개발 동시 진행

PR 리뷰 요청이 들어왔을 때, 현재 작업 중인 브랜치를 건드리지 않고 리뷰할 수 있다.

```bash
# 리뷰할 브랜치로 워크트리 생성
git fetch origin feature/auth
git worktree add ../myapp-review feature/auth

# 별도 터미널에서 리뷰
cd ../myapp-review
# 빌드, 테스트, 코드 확인

# 리뷰 완료 후 제거
git worktree remove ../myapp-review
```

이 패턴은 특히 빌드 시간이 긴 프로젝트에서 유용하다. 한 쪽에서 빌드가 돌아가는 동안 다른 쪽에서 코드를 작성할 수 있다.

## 여러 버전 동시 테스트

레거시 버전과 최신 버전의 동작을 비교해야 할 때 각 버전을 별도 워크트리에서 실행한다.

```bash
# v1.x 워크트리
git worktree add ../myapp-v1 release/v1.x
cd ../myapp-v1 && npm start -- --port 3001

# v2.x 워크트리 (다른 터미널)
cd ../myapp
npm start -- --port 3000
```

## 베어 저장소 + worktree 패턴

워크트리를 많이 사용한다면 처음부터 **베어 저장소(bare repository)** 를 중심에 놓는 패턴을 고려할 수 있다. 베어 저장소는 작업 디렉터리 없이 `.git/` 내용만 가지는 저장소다.

```bash
# 베어 저장소 클론
git clone --bare https://github.com/org/myapp.git myapp.git
cd myapp.git

# 각 브랜치를 워크트리로 생성
git worktree add ../main main
git worktree add ../feature-auth feature/auth

# 이후 각 디렉터리를 독립적으로 사용
cd ../main  # main 브랜치 작업
cd ../feature-auth  # auth 기능 개발
```

![베어 저장소 + worktree 패턴](/assets/posts/git-worktree-multi-branch-bare.svg)

이 패턴의 장점은 "하나의 저장소를 여러 브랜치로 나눠 쓴다"는 의도가 디렉터리 구조에서 명확히 드러난다는 것이다. 각 브랜치가 하나의 디렉터리로 표현되어 탐색이 직관적이다.

## worktree와 IDE

워크트리를 사용할 때 IDE 설정이 중요하다. VS Code 같은 에디터는 폴더 단위로 프로젝트를 열기 때문에 워크트리 디렉터리 각각을 별도 창으로 열어 작업한다.

```bash
# VS Code에서 워크트리 열기
code ../myapp-fix    # 핫픽스 워크트리
code ../myapp        # 메인 워크트리 (다른 창)
```

각 창이 독립적인 파일 상태를 유지하므로 에디터 간 충돌이 없다.

## worktree 관련 유의사항

**`.git` 디렉터리 위치**: 연결된 워크트리에는 `.git` 폴더가 없고 `.git` **파일**이 있다. 이 파일은 메인 워크트리의 `.git/` 위치를 가리키는 텍스트 파일이다.

```bash
cat ../myapp-fix/.git
# gitdir: /home/user/myapp/.git/worktrees/myapp-fix
```

**hooks 공유**: 모든 워크트리는 같은 hooks를 공유한다. pre-commit hook이 하나면 모든 워크트리에서 동일하게 작동한다.

**stash는 워크트리별이 아닌 저장소 공유**: stash는 모든 워크트리가 공유한다. 워크트리 A에서 stash한 내용을 워크트리 B에서 pop할 수 있다.

---

**지난 글:** [Git Worktree 기초](/posts/git-worktree-basics/)

**다음 글:** [Git Sparse Checkout](/posts/git-sparse-checkout/)

<br>
읽어주셔서 감사합니다. 😊
