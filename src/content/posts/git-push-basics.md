---
title: "git push 기본 사용법"
description: "git push 명령어의 기본 구조, 업스트림 설정(-u), 브랜치별 푸시 방법을 상세히 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "push", "origin", "upstream", "tracking"]
featured: false
draft: false
---

[지난 글](/posts/git-pull-rebase/)에서 pull --rebase로 히스토리를 깔끔하게 동기화하는 방법을 다뤘다. 이번에는 반대 방향, 즉 로컬의 커밋을 원격으로 **올리는** `git push`의 기본 구조를 살펴본다. push는 협업의 완성 단계다. 올바른 push 습관이 팀의 히스토리 품질을 결정한다.

## push의 기본 구조

```bash
git push <원격이름> <로컬브랜치>:<원격브랜치>
```

대부분의 경우 로컬 브랜치와 원격 브랜치 이름이 동일하므로 단순화된 형식을 쓴다.

```bash
# 로컬 main을 origin의 main으로 push
git push origin main

# 또는 명시적으로
git push origin main:main
```

![git push 흐름도](/assets/posts/git-push-basics-flow.svg)

## 처음 push: -u 옵션으로 업스트림 설정

새 브랜치를 처음으로 원격에 push할 때는 `-u`(또는 `--set-upstream`) 옵션을 함께 사용한다.

```bash
# 처음 push + 업스트림 추적 설정
git push -u origin main
```

`-u` 옵션은 두 가지 일을 동시에 한다.
1. 로컬 브랜치와 원격 브랜치 사이의 **추적 관계**를 `.git/config`에 기록한다.
2. 이후부터 해당 브랜치에서 `git push`만 입력해도 원격과 브랜치를 자동으로 인식한다.

```ini
# -u 설정 후 .git/config에 추가되는 내용
[branch "main"]
    remote = origin
    merge = refs/heads/main
```

업스트림이 설정된 이후에는 단순히 `git push`만으로 동일한 원격·브랜치로 push된다.

## 피처 브랜치 push

일반적인 개발 흐름에서는 피처 브랜치에서 작업하고 원격에 push한 뒤 PR(Pull Request)을 연다.

```bash
# 새 피처 브랜치 생성 및 전환
git switch -c feature/user-auth

# 작업 후 커밋
git add .
git commit -m "feat: add JWT authentication"

# 처음 push (업스트림 설정 포함)
git push -u origin feature/user-auth

# 이후 추가 커밋이 생기면
git push
```

## 다른 이름으로 push

로컬 브랜치 이름과 원격 브랜치 이름을 다르게 지정할 수 있다.

```bash
# 로컬 fix/login을 원격 hotfix/login으로 push
git push origin fix/login:hotfix/login
```

단, 이런 비대칭 이름은 혼동을 유발하므로 특수한 경우가 아니면 이름을 일치시키는 것이 좋다.

## push 기본 동작 설정

`push.default` 설정으로 인자 없이 `git push`를 실행할 때의 기본 동작을 제어한다.

```bash
# 현재 브랜치와 같은 이름의 원격 브랜치로 push (권장)
git config --global push.default current

# 업스트림 추적 브랜치로 push (기본값)
git config --global push.default simple

# 이름이 같은 모든 브랜치를 push (위험할 수 있음)
git config --global push.default matching
```

`simple`은 Git 2.0의 기본값이며, 업스트림이 설정된 경우에만 push한다. `current`는 업스트림 설정 없이도 현재 브랜치 이름을 원격에 그대로 사용해 push한다. 팀 내에서 `current`를 선호하는 이유는 `-u` 없이도 새 브랜치를 바로 push할 수 있어서 편리하기 때문이다.

![git push 주요 패턴](/assets/posts/git-push-basics-commands.svg)

## push 전 확인 습관

push는 원격에 반영되는 공개 행위이므로, 특히 공유 브랜치에서는 push 전에 상태를 확인하는 습관이 중요하다.

```bash
# push할 커밋 목록 확인 (원격에 없는 것만)
git log origin/main..HEAD

# 변경된 파일 내용 확인
git diff origin/main

# 원격 최신 상태와 비교
git fetch origin
git status
```

`git fetch` 후 `git status`를 실행하면 "Your branch is ahead of 'origin/main' by 2 commits" 같은 메시지로 push할 커밋 수를 확인할 수 있다.

## push 실패의 흔한 원인

**원격이 더 앞서 있는 경우 (non-fast-forward):**

```bash
$ git push origin main
! [rejected] main -> main (non-fast-forward)
```

원격 `main`에 로컬이 모르는 커밋이 있을 때 발생한다. `git pull`로 먼저 통합한 후 다시 push해야 한다.

```bash
git pull origin main   # 또는 git pull --rebase origin main
git push origin main
```

## 정리

`git push -u origin <브랜치>`는 새 브랜치를 원격에 올리면서 추적 관계를 설정하는 한 줄 명령이다. 이후에는 `git push`만으로도 올바른 원격·브랜치로 전송된다. push 전에 `git log origin/브랜치..HEAD`로 전송할 커밋을 확인하는 습관을 들이면 실수를 크게 줄일 수 있다.

---

**지난 글:** [pull --rebase — 깔끔한 히스토리 유지하기](/posts/git-pull-rebase/)

**다음 글:** [git push --force의 위험성과 주의사항](/posts/git-push-force/)

<br>
읽어주셔서 감사합니다. 😊
