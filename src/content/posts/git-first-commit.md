---
title: "첫 번째 커밋: 변경을 역사에 새기는 순간"
description: "git add와 git commit의 관계, 루트 커밋의 특징, 커밋 직후 생성되는 객체 구조를 단계별로 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "커밋", "git commit", "git add", "루트 커밋"]
featured: false
draft: false
---

[지난 글](/posts/git-staging-essence/)에서 스테이징 영역이 왜 존재하는지 살펴봤다. 이번에는 그 준비 과정 너머, **커밋을 실제로 생성하는 순간**에 집중한다. 첫 번째 커밋은 일반 커밋과 구조가 조금 다르다. 왜 다른지, 안에서 무슨 일이 벌어지는지 이해하면 이후 리베이스·병합·복구 모두 훨씬 명확해진다.

## 준비: 저장소 초기화부터

프로젝트 디렉터리를 Git 저장소로 만드는 것이 출발점이다.

```bash
mkdir my-project && cd my-project
git init
# Initialized empty Git repository in /my-project/.git/
```

`git init`은 `.git/` 디렉터리를 만든다. 이 안에 Git이 관리하는 모든 데이터가 들어간다. 이 시점에서는 커밋이 하나도 없어 `HEAD`가 가리킬 커밋이 없는 상태다.

## 첫 파일 만들고 스테이징

파일을 하나 만들고 스테이징 영역에 올린다.

```bash
echo "# My Project" > README.md
git add README.md
git status
# Changes to be committed:
#   new file: README.md
```

`git add`는 파일 내용을 읽어 **blob 객체**를 `.git/objects/`에 저장하고, 인덱스(`.git/index`)에 해당 blob의 해시와 파일 경로를 기록한다. 이 시점에서 이미 파일 내용은 Git 데이터베이스에 들어가 있다.

## git commit 실행

```bash
git commit -m "Initialize repository"
# [main (root-commit) a3f9d21] Initialize repository
#  1 file changed, 1 insertion(+)
#  create mode 100644 README.md
```

출력의 `root-commit`이라는 단어에 주목한다. 이것이 **루트 커밋**임을 Git이 직접 알려주는 것이다.

![첫 커밋 흐름](/assets/posts/git-first-commit-flow.svg)

## 루트 커밋이란

일반 커밋은 반드시 하나 이상의 부모 커밋을 갖는다. 그런데 저장소의 역사는 어딘가에서 시작해야 하므로, **첫 커밋만은 부모가 없다**. 이것이 루트 커밋이다.

`git cat-file -p HEAD`로 방금 만든 커밋 내용을 직접 볼 수 있다.

```bash
git cat-file -p HEAD
# tree b2c4e8f9...
# author PALDYN <dev@paldyn.com> 1746748800 +0900
# committer PALDYN <dev@paldyn.com> 1746748800 +0900
#
# Initialize repository
```

`parent` 줄이 없다. 이것이 루트 커밋의 핵심 특징이다. 보통 커밋이라면 `parent a3f9d21...` 같은 줄이 반드시 있다.

## 커밋이 만드는 세 가지 객체

`git commit`을 실행하면 내부적으로 세 종류의 객체가 생성된다.

| 객체 | 설명 |
|------|------|
| **blob** | 파일 내용 자체. `git add` 시점에 이미 생성됨 |
| **tree** | 디렉터리 구조. blob 해시와 파일 이름의 매핑 |
| **commit** | 트리 해시, 작성자, 시각, 메시지, 부모 해시를 담은 객체 |

커밋 객체는 트리를 가리키고, 트리는 blob을 가리키는 계층 구조다. 특정 커밋을 체크아웃하면 Git은 이 트리를 따라가 파일을 복원한다.

## 커밋 후 확인하기

```bash
git log --oneline
# a3f9d21 (HEAD -> main) Initialize repository

git show HEAD
# commit a3f9d21...
# Author: PALDYN <dev@paldyn.com>
# Date:   ...
#
#     Initialize repository
#
# diff --git a/README.md b/README.md
# new file mode 100644
# +# My Project
```

![첫 커밋 명령어](/assets/posts/git-first-commit-commands.svg)

## author와 committer가 다를 수 있다

커밋 객체에는 `author`와 `committer` 두 가지 신원 정보가 들어간다. 대부분의 경우 동일하지만, **rebase나 cherry-pick** 이후에는 달라질 수 있다. 원 작성자(author)는 코드를 처음 쓴 사람, 커미터(committer)는 최종적으로 저장소에 기록한 사람이다.

```bash
git log --format="%an (%ae) / committer: %cn (%ce)"
```

## 흔한 실수: 설정 없이 커밋

이름과 이메일을 설정하지 않으면 커밋이 실패한다.

```bash
# 오류 메시지 예시
# *** Please tell me who you are.
# Run  git config --global user.email "you@example.com"
#      git config --global user.name "Your Name"
```

`git config --global user.name`과 `git config --global user.email`을 먼저 설정해야 한다. 이미 설정했다면 `git config --list | grep user`로 값을 확인한다.

## 커밋은 스냅샷이다

흔히 커밋을 "변경 사항의 저장"으로 이해하지만, Git 내부적으로는 **그 시점의 전체 스냅샷**을 저장한다. diff가 아니라 스냅샷이다. 다만 같은 내용의 파일은 동일한 blob 해시를 공유하므로 실제 디스크 사용량은 효율적이다.

이 스냅샷 개념이 Git을 타임머신으로 만든다. 어떤 커밋으로 돌아가도 그 시점의 파일 상태 전체를 완벽하게 복원할 수 있는 이유가 여기에 있다.

---

**다음 글:** [커밋 객체 해부: 내부 구조를 손으로 뜯어보기](/posts/git-commit-anatomy/)

<br>
읽어주셔서 감사합니다. 😊
