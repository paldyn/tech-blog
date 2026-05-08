---
title: "git init: 새 저장소 초기화"
description: "git init 명령어의 동작 방식, .git 디렉토리 구조, 새 프로젝트와 기존 프로젝트에 적용하는 방법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "git init", "저장소", "초기화"]
featured: false
draft: false
---

[지난 글](/posts/git-config-aliases/)에서 생산성을 높이는 alias 설정을 살펴봤다. 이제 실제로 저장소를 만들 차례다. `git init`은 Git 여정의 시작점이다. 이 명령 하나가 평범한 디렉토리를 버전 관리가 가능한 Git 저장소로 바꾼다.

## git init이 하는 일

`git init`을 실행하면 현재 디렉토리(또는 지정한 디렉토리) 안에 `.git` 숨김 디렉토리가 생성된다. 이 `.git` 디렉토리가 Git 저장소의 핵심이다. 커밋 이력, 브랜치 정보, 설정, 훅 스크립트 — 버전 관리에 필요한 모든 데이터가 이 안에 있다.

```bash
mkdir my-project && cd my-project
git init
# Initialized empty Git repository in /Users/user/my-project/.git/

ls -la
# drwxr-xr-x   9 user  staff  288  .git
# (다른 파일 없음)
```

기존 파일이 있는 디렉토리에서도 안전하게 실행할 수 있다. 기존 파일에는 아무 영향도 주지 않고 `.git` 디렉토리만 추가된다.

![.git 디렉토리 구조](/assets/posts/git-init-structure.svg)

## .git 디렉토리 내부

`.git` 안의 주요 구성 요소를 알아두면 Git의 동작 방식을 이해하는 데 도움이 된다.

```
.git/
├── HEAD          # 현재 브랜치 포인터
├── config        # 저장소별 설정 (git config --local)
├── description   # GitWeb 전용 설명 (일반 사용 시 무관)
├── hooks/        # 이벤트 훅 스크립트
├── info/         # .gitignore의 대안 (exclude 파일)
├── objects/      # 모든 Git 객체 (blob, tree, commit, tag)
└── refs/
    ├── heads/    # 로컬 브랜치 (main, feature/... 등)
    └── tags/     # 태그
```

`HEAD` 파일을 직접 열어보면 이런 내용이 있다.

```bash
cat .git/HEAD
# ref: refs/heads/main
```

현재 브랜치가 `main`이고, `main` 브랜치의 최신 커밋 해시는 `.git/refs/heads/main` 파일에 저장된다.

## 두 가지 사용 패턴

![git init 두 가지 방법](/assets/posts/git-init-workflow.svg)

**새 프로젝트 시작**:

```bash
git init my-project    # 디렉토리 생성 + 초기화
cd my-project
```

**기존 프로젝트에 Git 추가**:

```bash
cd ~/existing-project
git init
git add .
git commit -m "초기 커밋: 기존 코드 이관"
```

## 초기화 후 첫 커밋까지

```bash
# 1. 초기화
git init

# 2. 파일 생성
echo "# My Project" > README.md

# 3. 상태 확인 (Untracked 파일 목록)
git status

# 4. 스테이징
git add README.md

# 5. 커밋
git commit -m "첫 번째 커밋"

# 6. 이력 확인
git log --oneline
# abc1234 첫 번째 커밋
```

## 브랜치 이름 지정

`git init -b` 옵션으로 초기 브랜치 이름을 지정할 수 있다. (Git 2.28 이상)

```bash
git init -b main          # main 브랜치로 초기화
git init --initial-branch=main   # 동일한 효과
```

전역 설정으로 `init.defaultBranch main`을 설정해두었다면 `-b` 없이도 `main`으로 초기화된다.

## Bare 저장소

`--bare` 옵션을 추가하면 작업 디렉토리 없이 `.git` 내용만 있는 저장소가 만들어진다. 일반 개발자가 코드를 편집하는 저장소가 아니라, 팀이 push/fetch하는 중앙 서버 저장소에 사용한다.

```bash
git init --bare team-project.git
# Initialized empty bare Git repository
```

GitHub, GitLab의 원격 저장소가 내부적으로 이 bare 구조를 사용한다.

## .git 삭제 = 버전 관리 제거

저장소에서 Git을 완전히 제거하고 싶다면 `.git` 디렉토리만 삭제하면 된다. 실제 파일은 그대로 남는다.

```bash
rm -rf .git    # 버전 이력 완전 삭제 (복구 불가)
# 주의: 이 작업은 되돌릴 수 없다
```

---

**지난 글:** [Git 단축 명령어(alias) 설정](/posts/git-config-aliases/)

**다음 글:** [git clone: 원격 저장소 복제](/posts/git-clone/)

<br>
읽어주셔서 감사합니다. 😊
