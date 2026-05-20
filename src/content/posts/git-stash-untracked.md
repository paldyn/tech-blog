---
title: "git stash와 미추적 파일 — untracked 포함 저장"
description: "git stash push -u로 untracked 파일을 포함해 저장하는 방법, --all 옵션으로 ignored 파일까지 저장하는 방법, 각 옵션의 저장 범위를 비교한다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "stash", "untracked", "-u", "--all"]
featured: false
draft: false
---

[지난 글](/posts/git-stash-drop-clear/)에서 stash를 삭제하는 방법을 다뤘다. 기본 `git stash`는 추적 중인 파일만 저장한다. 새로 만든 파일처럼 아직 `git add`로 추적을 시작하지 않은 **untracked 파일**은 기본 stash에서 제외된다. 이번에는 이를 포함시키는 방법을 살펴본다.

## 기본 stash의 한계

```bash
# 작업 상태
git status
# Changes not staged:
#   modified:   src/auth.js
# Untracked files:
#   src/new-feature.js

git stash
git status
# Untracked files:
#   src/new-feature.js   ← 남아 있음!
```

`git stash`는 modified/staged 파일만 저장하고, untracked 파일은 워킹 트리에 그대로 남긴다.

## -u / --include-untracked

`-u` 또는 `--include-untracked` 옵션을 붙이면 untracked 파일도 함께 저장된다.

![stash 저장 범위 비교](/assets/posts/git-stash-untracked-scope.svg)

```bash
# untracked 포함 저장
git stash push -u

# 메시지와 함께
git stash push -u -m "new feature WIP"

# 긴 옵션 형태
git stash push --include-untracked -m "full WIP"

# 결과 확인
git status
# nothing to commit, working tree clean ← 새 파일도 사라짐
```

## -a / --all: ignored 파일까지

`-a` 또는 `--all`은 `.gitignore`에 의해 무시된 파일까지 stash에 포함시킨다.

![-u 실전 패턴](/assets/posts/git-stash-untracked-use.svg)

```bash
# ignored 파일까지 포함
git stash push -a

# 예: .env, *.log, dist/ 같은 파일들도 저장됨
```

`-a`는 `node_modules/`, `dist/`, `.env` 같은 파일도 stash에 담아버린다. 파일 수가 많으면 stash 생성이 매우 느려지므로 실제로는 `-u`를 쓰는 경우가 대부분이다.

## 저장 범위 요약

| 옵션 | staged | modified | untracked | ignored |
|------|--------|----------|-----------|---------|
| 없음 | ✓ | ✓ | ✗ | ✗ |
| `-u` | ✓ | ✓ | ✓ | ✗ |
| `-a` | ✓ | ✓ | ✓ | ✓ |

## 특정 파일만 stash

전체 저장이 아니라 일부 파일만 골라 stash할 수 있다.

```bash
# 특정 파일만 stash
git stash push src/auth.js src/new-feature.js

# 특정 경로 패턴
git stash push "src/*.js"

# untracked 특정 파일 포함
git stash push -u src/new-feature.js
```

파일을 명시하면 해당 파일의 변경만 저장하고 나머지는 워킹 트리에 유지된다.

## 실전 시나리오

긴급 hotfix를 위해 현재 feature 작업을 통째로 치울 때 유용하다.

```bash
# feature 작업 중 (새 파일 포함)
git status
# modified:   src/feature.js
# Untracked:  src/feature-helper.js

# 전부 stash (untracked 포함)
git stash push -u -m "feature: auth redesign WIP"

# hotfix 브랜치로 이동
git checkout hotfix/login-crash
# 작업 후 커밋...

# feature 브랜치 복귀
git checkout feature/auth-redesign
git stash pop
```

`-u` 없이 stash했다면 `src/feature-helper.js`가 남아 있어 hotfix 작업 중 혼선이 생길 수 있다.

## gitignore 파일과 -u의 관계

`-u`는 `.gitignore`에 등록된 파일은 건드리지 않는다. untracked이지만 ignored는 아닌 파일만 대상이 된다.

```bash
# .gitignore에 없는 새 파일: -u로 저장됨
touch new-file.js
git stash push -u   # new-file.js 포함

# .gitignore에 있는 파일: -u로 저장 안 됨, -a로만 가능
echo "secret.env" >> .gitignore
touch secret.env
git stash push -u   # secret.env 제외
git stash push -a   # secret.env 포함
```

---

**지난 글:** [git stash drop과 clear — 스태시 삭제](/posts/git-stash-drop-clear/)

**다음 글:** [git stash --keep-index — 스테이징 유지하며 저장](/posts/git-stash-keep-index/)

<br>
읽어주셔서 감사합니다. 😊
