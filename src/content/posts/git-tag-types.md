---
title: "Git 태그의 두 종류: Lightweight vs Annotated"
description: "Git 태그의 두 가지 유형인 Lightweight와 Annotated의 내부 구조 차이, 사용 상황, 생성 명령어를 비교한다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "tag", "lightweight", "annotated", "릴리스", "버전"]
featured: false
draft: false
---

[지난 글](/posts/git-credential-helper/)에서 HTTPS 인증을 자동화하는 credential helper를 다뤘다. 이번에는 코드베이스의 특정 시점을 표시하는 **Git 태그(tag)**의 두 가지 유형을 비교한다. 태그는 배포 버전, 릴리스 포인트, 중요한 마일스톤을 기록하는 데 사용된다.

## 태그란 무엇인가

태그는 특정 커밋에 붙이는 **고정 포인터**다. 브랜치와 달리 새 커밋을 추가해도 태그는 이동하지 않는다. `v1.0`, `v2.3.1` 같은 버전 레이블이 대표적인 사용 사례다.

Git에는 두 종류의 태그가 있다: **Lightweight(경량 태그)**와 **Annotated(주석 태그)**.

## Lightweight 태그

```bash
# Lightweight 태그 생성: 메시지 없이 커밋에 직접 연결
git tag v1.0-lw

# 특정 커밋에 태그
git tag v1.0-lw abc1234
```

Lightweight 태그는 단순히 커밋 SHA를 가리키는 **이름 붙은 ref**다. `refs/tags/v1.0-lw` 파일에 커밋 SHA가 직접 저장된다. 별도의 태그 객체가 생성되지 않는다.

메시지, 태거 정보, GPG 서명을 포함할 수 없다. 개발 중에 임시로 위치를 표시하거나, 개인 작업 북마크로 활용하기에 적합하다.

## Annotated 태그

```bash
# Annotated 태그 생성: -a 플래그 필수, 메시지 포함
git tag -a v1.0 -m "First stable release"

# 에디터로 메시지 작성
git tag -a v1.0

# 특정 커밋에 Annotated 태그
git tag -a v1.0 abc1234 -m "First stable release"
```

Annotated 태그는 **별도의 태그 객체**를 생성한다. 이 객체는 태거(tagger) 이름·이메일·날짜, 태그 메시지, 그리고 실제 커밋에 대한 참조를 포함한다. GPG 서명도 지원한다.

![Lightweight vs Annotated 태그 비교](/assets/posts/git-tag-types-comparison.svg)

## 내부 구조 차이

Lightweight 태그의 `refs/tags/v1.0-lw`는 커밋 SHA를 직접 담는다.

Annotated 태그의 `refs/tags/v1.0`은 **태그 객체**의 SHA를 담는다. 태그 객체가 다시 커밋 객체를 참조하는 간접 구조다.

```bash
# Lightweight: 커밋 SHA가 바로 나옴
git rev-parse v1.0-lw
# abc1234...

# Annotated: 태그 객체 SHA가 나옴
git rev-parse v1.0
# def5678...

# Annotated 태그가 가리키는 커밋 SHA 확인 (^{} = dereference)
git rev-parse v1.0^{}
# abc1234...
```

## 태그 상세 정보 확인

```bash
# Annotated 태그의 메타데이터 확인
git show v1.0
# tag v1.0
# Tagger: Jane Doe <jane@example.com>
# Date:   Sat May 18 12:00:00 2026 +0900
#
# First stable release
#
# commit abc1234...
```

Lightweight 태그에 `git show`를 실행하면 커밋 정보만 바로 보여주고 태그 메타데이터는 없다.

![Lightweight vs Annotated 태그 생성](/assets/posts/git-tag-types-commands.svg)

## 어떤 태그를 써야 하나

| 상황 | 권장 유형 |
|---|---|
| 공개 릴리스, 배포 버전 | Annotated |
| CI/CD 자동 태그 | Annotated |
| GPG 서명이 필요한 배포 | Annotated |
| 개인 북마크, 임시 표시 | Lightweight |
| `git describe` 기반 버전 | Annotated |

`git describe` 명령은 기본적으로 **Annotated 태그만** 참조한다. Lightweight 태그를 대상으로 하려면 `--tags` 플래그가 필요하다. 릴리스 워크플로에서 `git describe`를 쓴다면 반드시 Annotated 태그를 사용해야 한다.

## 정리

Lightweight 태그는 커밋에 직접 연결되는 단순 포인터이고, Annotated 태그는 메타데이터를 담는 별도 객체다. 공식 릴리스에는 Annotated 태그를 사용하는 것이 업계 표준이다. 다음 글에서는 Annotated 태그를 더 깊이 살펴본다.

---

**지난 글:** [자격 증명 헬퍼로 인증 자동화하기](/posts/git-credential-helper/)

**다음 글:** [주석 태그 심층 분석 — git tag -a](/posts/git-annotated-tag/)

<br>
읽어주셔서 감사합니다. 😊
