---
title: "Gitflow feature 브랜치 워크플로우"
description: "Gitflow의 feature 브랜치 생성·작업·publish·finish 절차, git-flow CLI와 git 직접 명령어 비교, --no-ff 머지의 의미, 장기 feature 브랜치의 develop 리베이스 전략을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "Gitflow", "feature", "브랜치전략", "워크플로우"]
featured: false
draft: false
---

[지난 글](/posts/gitflow-overview/)에서 Gitflow의 다섯 가지 브랜치 구조를 개요로 살펴봤다. 이번에는 일상적인 기능 개발에서 가장 자주 사용하는 **feature 브랜치**의 구체적인 절차를 다룬다.

## feature 브랜치의 역할

feature 브랜치는 하나의 기능이나 작업 단위를 격리해서 개발하는 임시 브랜치다.

- **출발지**: develop
- **목적지**: develop
- 이름 형식: `feature/<기능명>` 또는 `feature/<이슈ID>-<설명>`

feature 브랜치는 절대 main에 직접 머지하지 않는다.

## feature 시작

```bash
# git-flow CLI
git flow feature start user-authentication

# git 직접 명령어와 동일
git checkout develop
git checkout -b feature/user-authentication
```

`git flow feature start`는 develop 최신 상태에서 자동으로 분기한다.

## 작업과 커밋

```bash
# 기능 개발
git add src/auth/
git commit -m "feat(auth): JWT 토큰 발급 로직 추가"

git add tests/auth/
git commit -m "test(auth): JWT 토큰 유효성 검사 단위 테스트"
```

![feature 브랜치 워크플로우](/assets/posts/gitflow-feature-branch-flow.svg)

## develop과 동기화 (장기 브랜치)

feature 브랜치가 며칠 이상 지속되면 develop이 앞서 나간다. 주기적으로 동기화해서 충돌을 작게 유지한다.

```bash
# develop의 새 커밋을 feature 브랜치에 반영
git fetch origin
git rebase origin/develop

# 충돌 발생 시
git rebase --continue   # 충돌 해결 후
git rebase --abort      # 리베이스 취소
```

팀에서 rebase 대신 merge를 선호한다면:

```bash
git merge develop
```

## 원격 push (협업)

여러 개발자가 같은 feature를 작업할 때는 원격에 push한다.

```bash
# git-flow CLI
git flow feature publish user-authentication

# git 직접
git push -u origin feature/user-authentication
```

원격 feature 브랜치를 가져올 때:

```bash
git flow feature track user-authentication
# 또는
git checkout -b feature/user-authentication origin/feature/user-authentication
```

## feature 완료

```bash
# git-flow CLI (develop으로 --no-ff 머지 + 로컬 브랜치 삭제)
git flow feature finish user-authentication

# git 직접
git checkout develop
git merge --no-ff feature/user-authentication
git branch -d feature/user-authentication
git push origin --delete feature/user-authentication
```

![git-flow CLI와 git 직접 명령어 비교](/assets/posts/gitflow-feature-branch-commands.svg)

## --no-ff 머지의 의미

`--no-ff` (no fast-forward)는 develop에 feature의 모든 커밋이 직렬로 들어가는 대신 **머지 커밋을 강제로 생성**한다.

```
fast-forward (--ff):
develop ─────────────●──●──●  ← feature 커밋이 develop에 직접 붙음
                     ↑feature 분기점

--no-ff:
feature ────●──●──●
           /         \
develop ──●───────────●  ← 머지 커밋 생성
```

`--no-ff`를 사용하면 `git log --graph`에서 "이 커밋들이 feature/user-authentication으로 개발됐다"는 사실을 명확하게 볼 수 있다.

## 여러 feature 브랜치 병렬 개발

```bash
# 팀원 A: feature/login
git flow feature start login

# 팀원 B: feature/payment  (동시에)
git flow feature start payment

# 각자 독립적으로 develop에 머지
git flow feature finish login
git flow feature finish payment
```

두 브랜치가 같은 파일을 수정했다면 두 번째 `finish`에서 충돌이 발생한다. 충돌을 해결한 후 머지를 완료한다.

---

**지난 글:** [Gitflow: 브랜치 전략 개요](/posts/gitflow-overview/)

**다음 글:** [Gitflow release와 hotfix 브랜치](/posts/gitflow-release-hotfix/)

<br>
읽어주셔서 감사합니다. 😊
