---
title: "git checkout vs git switch: 브랜치 전환 명령 비교"
description: "Git 2.23에서 분리된 git switch와 git restore의 배경을 이해하고, 기존 git checkout 명령과 1:1로 대응되는 신 명령을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "git switch", "git checkout", "git restore", "브랜치 전환"]
featured: false
draft: false
---

[지난 글](/posts/git-branch-naming/)에서 브랜치 네이밍 컨벤션을 다뤘다. 이번에는 브랜치를 전환하는 두 가지 방법을 비교한다. `git checkout`은 오랫동안 브랜치 전환·파일 복원·커밋 체크아웃을 모두 담당해 왔는데, Git 2.23에서 역할이 분리됐다.

## git checkout이 너무 많은 일을 했다

`git checkout`은 맥락에 따라 동작이 달라졌다.

```bash
git checkout main           # 브랜치 전환
git checkout -b feature     # 브랜치 생성 + 전환
git checkout HEAD -- app.js # 파일 복원 (스테이지·워킹 트리)
git checkout abc1234        # 커밋 체크아웃 (Detached HEAD)
```

같은 명령이 인수에 따라 완전히 다른 동작을 하니 학습 곡선이 가파르고 실수를 유발했다.

## Git 2.23의 역할 분리

Git 2.23(2019년 8월)에서 두 명령이 도입됐다.

- **`git switch`**: 브랜치 전환 전담
- **`git restore`**: 파일 복원 전담

![git checkout vs git switch 비교](/assets/posts/git-checkout-vs-switch-compare.svg)

## 명령 대응표

![명령 대응 비교표](/assets/posts/git-checkout-vs-switch-examples.svg)

주요 대응 관계는 다음과 같다.

```bash
# 브랜치 전환
git checkout main         →  git switch main

# 브랜치 생성 + 전환
git checkout -b feature   →  git switch -c feature

# 이전 브랜치로 복귀
git checkout -            →  git switch -

# 파일 복원 (워킹 트리)
git checkout -- app.js    →  git restore app.js

# 특정 커밋 시점으로 파일 복원
git checkout HEAD~2 -- app.js  →  git restore --source HEAD~2 app.js

# Detached HEAD 진입
git checkout abc1234      →  git switch --detach abc1234
```

## git switch 주요 옵션

```bash
# 원격 브랜치 기반으로 로컬 생성 + 추적 설정
git switch -c feature origin/feature

# 강제 전환 (변경 사항 버림)
git switch --discard-changes main

# Detached HEAD 진입 (커밋 해시·태그·브랜치 모두 가능)
git switch --detach v1.0.0
git switch --detach abc1234
```

## git checkout은 여전히 동작

`git checkout`은 하위 호환성을 위해 계속 지원된다. 기존 스크립트나 레거시 문서를 수정할 필요는 없다.

다만 새로 작성하는 코드·문서에서는 `switch`/`restore`를 쓰는 것이 더 명확하다. 팀 가이드에 "브랜치 전환은 `git switch`"라고 명시해두면 혼동을 줄일 수 있다.

## 어떤 버전부터 쓸 수 있나

```bash
git --version
# git version 2.23.0 이상이면 switch/restore 사용 가능

# 버전이 낮으면 업그레이드
brew upgrade git        # macOS
sudo apt upgrade git    # Ubuntu/Debian
```

macOS 내장 git은 구 버전일 수 있다. Homebrew로 최신 버전을 설치하는 것을 권장한다.

---

**지난 글:** [브랜치 네이밍 컨벤션: 팀이 합의해야 할 규칙들](/posts/git-branch-naming/)

**다음 글:** [Detached HEAD: 브랜치 없는 커밋 상태 이해하기](/posts/git-detached-head/)

<br>
읽어주셔서 감사합니다. 😊
