---
title: "git status 읽기: 저장소 상태를 한눈에 파악하기"
description: "git status의 파일 상태(Untracked, Modified, Staged, Unmodified)와 --short 출력 코드를 정확하게 해석하는 법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "git status", "파일 상태", "스테이징"]
featured: false
draft: false
---

[지난 글](/posts/git-commit-message-conventions/)에서 커밋 메시지 규격을 다뤘다. 커밋을 만들기 전 현재 저장소 상태를 정확히 읽는 것이 먼저다. `git status`는 가장 자주 실행하는 명령 중 하나인데, 출력을 제대로 해석하지 못하면 의도치 않은 파일이 커밋에 섞이거나 수정된 파일을 빠뜨리게 된다.

## 파일의 네 가지 상태

Git이 추적하는 파일은 항상 네 가지 상태 중 하나에 있다.

| 상태 | 의미 |
|------|------|
| **Untracked** | Git이 이 파일의 존재를 모름. 새로 만든 파일 |
| **Modified** | 마지막 커밋 이후 변경됐지만 스테이징 안 됨 |
| **Staged** | `git add` 해서 인덱스에 올라간 상태 |
| **Unmodified** | 마지막 커밋과 동일. `git status`에 나타나지 않음 |

```bash
git status
# On branch main
# Changes to be committed:          ← Staged
#   (use "git restore --staged <file>..." to unstage)
#         new file:   src/auth.js
#         modified:   package.json
#
# Changes not staged for commit:    ← Modified
#   (use "git add <file>..." to update what will be committed)
#         modified:   README.md
#
# Untracked files:                  ← Untracked
#   (use "git add <file>..." to include in what will be committed)
#         .env.local
```

![파일 상태와 git status](/assets/posts/git-status-overview-states.svg)

## 세 개 섹션의 의미

### Changes to be committed

다음 커밋에 포함될 변경 사항이다. `git add`한 것들이 여기에 나온다.

- `new file:` — 새 파일을 처음 스테이징
- `modified:` — 기존 파일의 변경을 스테이징
- `deleted:` — 파일 삭제를 스테이징(`git rm`)

### Changes not staged for commit

추적 중인 파일이 수정됐지만 아직 `git add`를 안 한 상태다. 지금 커밋하면 이 변경은 포함되지 않는다.

### Untracked files

Git이 전혀 모르는 파일이다. `.gitignore`에 등록되지 않은 새 파일이 여기 나온다. `git add`하기 전까지 커밋에 절대 포함되지 않는다.

## 한 파일이 두 섹션에 동시에 나올 수 있다

```bash
echo "v2" >> README.md
git add README.md       # 스테이징
echo "v3" >> README.md  # 스테이징 후 추가 수정
git status
# Changes to be committed:
#       modified:   README.md   ← "v1→v2" 변경
# Changes not staged for commit:
#       modified:   README.md   ← "v2→v3" 변경
```

`git add` 후 파일을 추가로 수정하면 **인덱스(스테이징된 버전)와 워킹트리 버전이 달라진다**. 지금 커밋하면 "v2" 상태가 커밋되고, "v3"는 포함되지 않는다. `git add README.md`를 다시 실행해야 "v3"도 스테이징된다.

## --short 플래그로 간결하게

```bash
git status -s   # 또는 --short
# A  src/auth.js
# MM README.md
#  M src/config.js
# ?? .env.local
```

두 자리 코드의 첫 번째 문자는 **인덱스(스테이징 영역) 상태**, 두 번째는 **워킹트리 상태**다.

![git status --short 해석](/assets/posts/git-status-overview-short.svg)

## --branch 플래그

```bash
git status -sb
# ## main...origin/main [ahead 2]
# A  src/auth.js
```

`-b` 또는 `--branch`를 추가하면 현재 브랜치와 원격과의 관계(ahead/behind)가 첫 줄에 나온다.

## 브랜치 정보 읽기

```
## main...origin/main [ahead 2]
```

- `ahead 2`: 로컬에 커밋이 2개 더 있음 → `git push` 필요
- `behind 3`: 원격에 커밋이 3개 더 있음 → `git pull` 필요
- `ahead 1, behind 2`: 양쪽 모두 변경됨 → diverged, 동기화 필요

## 실용 팁: alias 설정

`git status`는 긴 출력이라 `git status -sb`를 자주 쓰게 된다.

```bash
git config --global alias.st "status -sb"
git st   # 이제 이걸로 충분
```

이 명령을 하루에 수십 번 실행하게 된다. 타이핑을 줄이면 그만큼 자주 확인하게 되고, 그게 실수를 줄이는 가장 효과적인 방법이다.

---

**지난 글:** [커밋 메시지 컨벤션: 좋은 커밋 메시지의 조건](/posts/git-commit-message-conventions/)

**다음 글:** [빈 커밋: 히스토리에 메모를 남기는 기술](/posts/git-empty-commit/)

<br>
읽어주셔서 감사합니다. 😊
