---
title: "Git 전역 설정: 처음 딱 한 번 해두면 되는 것들"
description: "git config --global로 설정하는 사용자 정보, 기본 브랜치, 에디터, 줄 끝 처리까지 — Git을 시작하기 전 꼭 해둬야 할 설정을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "설정", "git config", "전역설정"]
featured: false
draft: false
---

[지난 글](/posts/git-install/)에서 Git을 설치했다. 이제 Git에게 자신이 누구인지 알려줄 차례다. 이름과 이메일을 설정하지 않으면 첫 커밋에서 오류를 만나거나, 커밋 로그에 엉뚱한 작성자가 기록된다. 처음에 딱 한 번만 설정하면 된다.

## 설정 레벨: system, global, local

Git 설정에는 세 가지 범위가 있다. 좁은 범위가 넓은 범위를 덮어쓴다.

![Git 설정 레벨](/assets/posts/git-config-global-levels.svg)

- **system**: `/etc/gitconfig` — 이 머신의 모든 사용자에게 적용
- **global**: `~/.gitconfig` — 내 계정의 모든 저장소에 적용 (가장 자주 사용)
- **local**: `.git/config` — 해당 저장소에만 적용 (기본값)

일반 개발자는 global 레벨을 주로 사용한다. 특정 프로젝트에서 회사 이메일 대신 개인 이메일을 쓰고 싶다면 local로 덮어쓸 수 있다.

## 필수 설정: 이름과 이메일

커밋에 기록되는 작성자 정보다. GitHub, GitLab 계정과 일치시키는 것을 권장한다.

```bash
git config --global user.name "홍길동"
git config --global user.email "hong@example.com"
```

실제 이름 대신 닉네임을 써도 기술적으로는 문제없다. 단, GitHub에서 커밋과 계정을 연결하려면 GitHub 계정에 등록된 이메일과 일치해야 한다.

![필수 전역 설정](/assets/posts/git-config-global-settings.svg)

## 기본 브랜치 이름

Git 2.28부터 `git init` 시 생성되는 기본 브랜치 이름을 설정할 수 있다. GitHub의 기본값인 `main`으로 맞춰두는 것이 편하다.

```bash
git config --global init.defaultBranch main
```

이 설정 전에 만든 저장소는 `master` 브랜치를 사용하고 있을 수 있다. 이미 생성된 저장소의 브랜치 이름을 바꾸려면 별도 작업이 필요하다.

## 에디터 설정

`git commit` 이나 `git rebase -i` 를 실행하면 에디터가 열린다. 원하는 에디터를 미리 지정한다.

```bash
# VS Code
git config --global core.editor "code --wait"

# Vim (기본값)
git config --global core.editor "vim"

# nano (초보자 친화적)
git config --global core.editor "nano"

# Neovim
git config --global core.editor "nvim"
```

`--wait` 플래그는 VS Code가 파일을 닫을 때까지 Git이 기다리도록 한다. 없으면 VS Code가 열리는 순간 Git이 빈 메시지로 진행한다.

## 줄 끝(Line Ending) 처리

Windows와 macOS/Linux는 줄 끝 문자가 다르다. 팀이 혼합 환경이라면 충돌을 예방하기 위해 설정한다.

```bash
# macOS / Linux
git config --global core.autocrlf input
# 체크아웃 시 변환 없음, 커밋 시 CRLF → LF 변환

# Windows
git config --global core.autocrlf true
# 체크아웃 시 LF → CRLF, 커밋 시 CRLF → LF 자동 변환
```

## 색상 출력 활성화

대부분의 최신 Git은 자동으로 켜져 있지만, 명시적으로 활성화할 수 있다.

```bash
git config --global color.ui auto
```

## 현재 설정 확인 및 수정

```bash
# 모든 global 설정 보기
git config --global --list

# 특정 키 값 확인
git config --global user.name

# 특정 설정 삭제
git config --global --unset core.editor

# 에디터로 직접 열기
git config --global --edit
```

`~/.gitconfig`는 일반 텍스트 파일이라 에디터로 직접 편집해도 된다.

## 작업별 이메일 분리

여러 GitHub 계정(회사·개인)을 사용한다면 저장소별로 다른 이메일을 쓸 수 있다.

```bash
# 특정 저장소에서만 다른 이메일 사용
cd ~/work/company-project
git config --local user.email "work@company.com"
# .git/config에 저장됨 — global 설정을 덮어씀
```

또는 `~/.gitconfig`에 디렉토리 조건부 설정을 추가할 수 있다.

```
# ~/.gitconfig
[includeIf "gitdir:~/work/"]
    path = ~/.gitconfig-work

# ~/.gitconfig-work
[user]
    email = work@company.com
    name = 홍길동 (Work)
```

`~/work/` 하위의 모든 저장소에서 자동으로 work 설정이 적용된다.

설정을 마쳤으면 이제 실제로 저장소를 만들거나 복제할 준비가 됐다. 다음 글에서는 자주 쓰는 명령어를 단축해주는 alias 설정을 다룬다.

---

**지난 글:** [Git 설치 가이드](/posts/git-install/)

**다음 글:** [Git 단축 명령어(alias) 설정](/posts/git-config-aliases/)

<br>
읽어주셔서 감사합니다. 😊
