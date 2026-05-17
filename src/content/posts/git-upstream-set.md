---
title: "업스트림 설정으로 push/pull 자동화하기"
description: "git branch --set-upstream-to와 git push -u로 로컬 브랜치의 업스트림을 설정하고, 매번 remote 이름을 입력하지 않아도 되는 워크플로를 만드는 방법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "upstream", "set-upstream", "branch tracking", "push", "pull"]
featured: false
draft: false
---

[지난 글](/posts/git-tracking-branches/)에서 원격 추적 브랜치가 무엇인지 살펴봤다. 이번에는 로컬 브랜치가 어떤 원격 추적 브랜치를 **추적(tracking)**하는지 설정하는 방법을 다룬다. 업스트림이 설정되면 `git push origin feature/x` 대신 `git push`만 입력해도 Git이 어디로 보내야 할지 알아서 판단한다.

## 업스트림이 없을 때의 문제

새 로컬 브랜치를 만들고 처음으로 push하려 하면 오류가 발생한다.

```bash
git switch -c feature/login
# 작업 후
git push
# fatal: The current branch feature/login has no upstream branch.
```

Git이 어느 원격 저장소의 어떤 브랜치로 push할지 모르기 때문이다. 매번 `git push origin feature/login`을 입력하는 것도 방법이지만, 업스트림을 설정해두면 이후부터 `git push`만으로 충분하다.

## push -u: push와 동시에 업스트림 설정

```bash
# 첫 번째 push 시 -u(--set-upstream) 플래그 추가
git push -u origin feature/login
```

이 명령은 두 가지를 동시에 수행한다.
1. `origin`에 `feature/login` 브랜치로 커밋을 전송한다
2. 로컬 `feature/login`의 업스트림을 `origin/feature/login`으로 설정한다

이후부터는 해당 브랜치에서 `git push`, `git pull`을 인자 없이 실행할 수 있다.

![업스트림 설정 흐름](/assets/posts/git-upstream-set-flow.svg)

## --set-upstream-to: 기존 브랜치에 업스트림 연결

이미 로컬에 있는 브랜치에 업스트림을 나중에 설정할 때는 `--set-upstream-to`를 사용한다.

```bash
# 긴 형식
git branch --set-upstream-to=origin/feature/login

# 단축 형식 (-u)
git branch -u origin/feature/login

# 다른 브랜치에 설정 (현재 브랜치가 아닐 때)
git branch -u origin/develop develop
```

설정 내용은 `.git/config`의 `[branch "feature/login"]` 섹션에 저장된다.

```ini
[branch "feature/login"]
    remote = origin
    merge = refs/heads/feature/login
```

## 업스트림 확인과 해제

```bash
# 모든 브랜치의 추적 상태 확인
git branch -vv
# * feature/login  abc1234 [origin/feature/login] 로그인 폼 추가
#   main           def5678 [origin/main] 릴리스 v1.2

# 업스트림 해제
git branch --unset-upstream

# 특정 브랜치 업스트림 해제
git branch --unset-upstream feature/login
```

![업스트림 설정 관련 주요 명령어](/assets/posts/git-upstream-set-commands.svg)

## push.default 설정과의 관계

업스트림 동작 방식은 `push.default` 설정에 따라 달라진다.

```bash
# simple (Git 2.x 기본값): 업스트림 브랜치와 이름이 같을 때만 push
git config --global push.default simple

# upstream: 업스트림 브랜치 이름에 관계없이 push
git config --global push.default upstream

# current: 현재 브랜치와 같은 이름의 원격 브랜치로 push
git config --global push.default current
```

대부분의 환경에서 `simple`(기본값)이면 충분하다. 로컬 브랜치 이름과 원격 브랜치 이름을 항상 일치시키는 관례를 따르면 헷갈릴 일이 없다.

## 정리

업스트림 설정은 `git push -u origin <브랜치>`로 첫 push 시 함께 처리하는 것이 가장 간편하다. 이미 존재하는 브랜치라면 `git branch -u origin/<브랜치>`로 연결하고, `git branch -vv`로 상태를 확인한다. 업스트림이 설정된 이후에는 `git push`와 `git pull`에서 remote·브랜치 인자를 생략할 수 있어 워크플로가 한결 단순해진다.

---

**지난 글:** [원격 추적 브랜치 이해하기](/posts/git-tracking-branches/)

**다음 글:** [여러 원격 저장소 관리하기](/posts/git-multiple-remotes/)

<br>
읽어주셔서 감사합니다. 😊
