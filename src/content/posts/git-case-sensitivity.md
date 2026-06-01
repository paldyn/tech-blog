---
title: "파일명 대소문자 문제 다루기"
description: "Git은 파일명 대소문자를 구분하지만 macOS·Windows 파일시스템은 구분하지 않아 생기는 충돌의 원인과, 대소문자만 바꾸는 rename을 git mv로 안전하게 처리하는 방법, core.ignorecase 설정과 중복 파일 정리 절차를 설명한다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "대소문자", "git-mv", "파일시스템", "협업", "rename"]
featured: false
draft: false
---

[지난 글](/posts/git-line-ending-issues/)에서 줄바꿈 문제를 다뤘다. 이번엔 같은 "OS 차이"에서 오는 또 하나의 함정, 파일명 대소문자 문제다. CI(보통 Linux)에서는 멀쩡한데 개발자 로컬(macOS/Windows)에서만 파일을 못 찾거나, `Readme.md`를 `README.md`로 바꿨는데 Git이 변경을 인식하지 못하는 상황이 대표적이다. 원인은 Git과 파일시스템이 대소문자를 다르게 취급하는 데 있다.

## 무엇이 어긋나는가

Git 저장소는 파일명을 **대소문자까지 구분**해서 추적한다. 즉 `README.md`와 `Readme.md`는 Git에게 서로 다른 두 파일이다. 그런데 macOS의 기본 파일시스템(APFS)과 Windows의 NTFS는 보통 **대소문자를 구분하지 않는다.** `readme.md`로 열어도 `README.md` 파일이 잡힌다.

![대소문자만 다른 파일이 OS마다 다르게 보인다](/assets/posts/git-case-sensitivity-problem.svg)

문제는 여기서 생긴다. Linux에서 누군가 `README.md`와 `Readme.md`를 둘 다 커밋해 두면, 그걸 macOS에서 체크아웃할 때 파일시스템이 두 이름을 같은 것으로 보고 하나로 덮어쓴다. 결과적으로 한 파일이 사라지거나, `git status`가 깨끗한데도 작업 트리가 이상해진다.

## 대소문자만 바꾸는 rename

가장 흔한 작업은 "`Readme.md`를 `readme.md`로 바꾸기"처럼 대소문자만 변경하는 경우다. 그런데 대소문자를 구분하지 않는 파일시스템에서는 그냥 파일을 rename해도 Git이 변경을 알아채지 못한다. OS가 둘을 같은 이름으로 보기 때문이다.

![git mv로 대소문자 변경을 안전하게](/assets/posts/git-case-sensitivity-fix.svg)

해법은 `git mv`로 변경을 **스테이징에 명시**하는 것이다. 가장 안전한 방법은 중간 이름을 거치는 2단계 rename이다.

```bash
# 한 번에 바꾸면 무시될 수 있으니 임시 이름을 경유
git mv Readme.md readme.tmp
git mv readme.tmp readme.md
git commit -m "rename: Readme.md -> readme.md"
```

`git mv`는 OS rename과 달리 Git의 인덱스에 직접 변경을 기록하므로, 대소문자 차이도 확실히 반영된다.

## 이미 중복 파일이 들어왔다면

대소문자만 다른 파일이 이미 둘 다 커밋된 상태라면, 먼저 그 사실을 확인하고 하나를 정리해야 한다.

```bash
# 대소문자 무시하고 중복된 경로 찾기
git ls-files | sort -f | uniq -if | head

# 불필요한 쪽을 인덱스에서 제거 (정확한 케이스로 지정)
git rm --cached Readme.md
git commit -m "fix: remove duplicate-cased file"
```

이 작업은 대소문자를 구분하는 Linux 환경(또는 CI)에서 수행하면 두 파일을 정확히 구별할 수 있어 안전하다.

## core.ignorecase 설정

로컬에서 Git이 대소문자를 어떻게 다룰지는 `core.ignorecase`로 정해진다. 보통 OS에 맞춰 자동 설정되지만, 명시적으로 켜고 끌 수 있다.

```bash
# 현재 값 확인
git config core.ignorecase

# 대소문자를 구분하도록 강제 (주의: 파일시스템이 받쳐 줘야 함)
git config core.ignorecase false
```

다만 이 설정을 `false`로 바꿔도 **파일시스템 자체가 대소문자를 구분하지 못하면** 충돌은 여전히 일어난다. 설정은 Git의 동작만 바꿀 뿐 파일시스템의 한계를 넘지는 못한다.

## 예방이 최선

근본적인 예방책은 팀 차원의 **파일명 규칙**이다. 모든 파일명을 소문자(또는 kebab-case)로 통일하면 대소문자 충돌 자체가 발생하지 않는다. 디렉터리 이름도 마찬가지다.

```bash
# CI에서 대소문자 중복을 검사해 사고를 조기에 차단
git ls-files | sort -f | uniq -Dif
# 출력이 있으면 중복 — 빌드를 실패시킨다
```

정리하면, 대소문자 문제는 **`git mv`로 명시적 rename, 중복은 Linux에서 정리, 그리고 소문자 통일 규칙**으로 다스린다. 다음 글에서는 되돌리기 주제로 돌아와, 까다롭기로 유명한 "머지 커밋을 revert할 때의 함정"을 다룬다.

---

**지난 글:** [줄바꿈(CRLF/LF) 문제 깔끔하게 해결하기](/posts/git-line-ending-issues/)

**다음 글:** [머지 커밋 revert의 함정과 해결](/posts/git-revert-merge-issue/)

<br>
읽어주셔서 감사합니다. 😊
