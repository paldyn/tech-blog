---
title: "Git Alias: 단축 명령어로 워크플로 가속하기"
description: "git config alias로 자주 쓰는 명령어를 단축하고, 셸 명령어까지 alias로 등록하는 방법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "alias", "설정", "단축키", "생산성"]
featured: false
draft: false
---

[지난 글](/posts/git-config-global/)에서 전역 설정의 기본기를 다뤘다. 이번에는 Git Alias를 통해 자주 쓰는 명령어를 단축하는 방법을 다룬다. 하루에 수십 번 치는 명령어라면 2~3글자만으로 줄여도 체감 차이가 크다.

## Alias란

Git Alias는 긴 명령어에 짧은 이름을 붙이는 기능이다. `git status` 를 `git st`로, `git log --oneline --graph --all`을 `git lg`로 만들 수 있다.

```bash
# 등록 방법 1: 명령어
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit

# 사용
git st        # git status와 동일
git co main   # git checkout main과 동일
```

![Git Alias 예시 모음](/assets/posts/git-config-aliases-examples.svg)

## 자주 쓰는 필수 Alias

```bash
# 기본 단축어
git config --global alias.st   status
git config --global alias.co   checkout
git config --global alias.br   branch
git config --global alias.ci   commit
git config --global alias.df   diff

# 그래프 포함 로그 (가장 많이 쓰는 alias)
git config --global alias.lg \
  "log --oneline --graph --decorate --all"

# 마지막 커밋 취소 (파일은 유지)
git config --global alias.undo "reset HEAD~1 --mixed"

# 스테이지 전체 취소
git config --global alias.unstage "restore --staged ."

# 짧은 상태 보기
git config --global alias.s "status -s"
```

## ~/.gitconfig에 직접 편집

명령어로 하나씩 등록하는 대신 `~/.gitconfig`를 직접 열어 `[alias]` 섹션을 편집하면 편리하다.

```
[alias]
    st      = status
    co      = checkout
    br      = branch
    ci      = commit
    df      = diff
    lg      = log --oneline --graph --decorate --all
    undo    = reset HEAD~1 --mixed
    unstage = restore --staged .
    s       = status -s
    last    = log -1 HEAD
    aliases = !git config --get-regexp alias
```

`git config --global --edit` 명령으로 기본 에디터에서 바로 열 수 있다.

## 셸 명령어 Alias (! 접두사)

`!`를 앞에 붙이면 Git 명령어가 아닌 셸 명령어를 실행할 수 있다.

```bash
# 현재 브랜치를 원격에 push하고 upstream 설정
git config --global alias.publish \
  '!git push -u origin $(git branch --show-current)'

# 등록된 모든 alias 출력
git config --global alias.aliases \
  '!git config --get-regexp alias'

# stash + pull + stash pop (자주 쓰는 패턴)
git config --global alias.sync \
  '!git stash && git pull --rebase && git stash pop'
```

```bash
# 사용 예
git publish          # 현재 브랜치를 자동으로 upstream에 push
git aliases          # 등록된 alias 전체 목록 출력
```

![Alias 사용 전후 비교](/assets/posts/git-config-aliases-usage.svg)

## Alias에 인수 전달

Alias는 그 뒤에 오는 인수를 그대로 받아서 실행한다.

```bash
git config --global alias.co checkout

git co main          # git checkout main
git co -b feature    # git checkout -b feature
git co -- file.txt   # git checkout -- file.txt
```

`!` 셸 alias에서 인수를 제어하고 싶다면 함수를 사용한다.

```bash
git config --global alias.new \
  '!f() { git checkout -b "$1" && git push -u origin "$1"; }; f'

git new feature/login    # 브랜치 생성 + 원격 push 한 번에
```

## 기존 Alias 목록 확인과 삭제

```bash
# 등록된 모든 alias 확인
git config --global --get-regexp alias

# 특정 alias 삭제
git config --global --unset alias.co

# alias가 어떤 명령으로 확장되는지 확인
git help co     # 'co' is aliased to 'checkout'
```

Alias는 전역(`--global`) 또는 저장소별(`--local`)로 설정할 수 있다. 팀 전체가 동일한 alias를 쓰고 싶다면 저장소 안의 Makefile이나 `justfile`에 공유 명령어를 정의하는 방법도 있다.

---

**지난 글:** [Git 전역 설정](/posts/git-config-global/)

**다음 글:** [git init: 새 저장소 초기화](/posts/git-init/)

<br>
읽어주셔서 감사합니다. 😊
