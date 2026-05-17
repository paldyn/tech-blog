---
title: "주석 태그 심층 분석 — git tag -a"
description: "Annotated 태그의 내부 객체 구조, GPG 서명, git describe와의 연동, 릴리스 워크플로에서의 활용법을 상세히 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "tag", "annotated tag", "GPG", "서명", "릴리스", "describe"]
featured: false
draft: false
---

[지난 글](/posts/git-tag-types/)에서 Lightweight와 Annotated 태그의 차이를 비교했다. 이번에는 **Annotated 태그의 내부 구조와 활용 패턴**을 더 깊이 살펴본다. 공식 릴리스, GPG 서명, 자동화된 버전 관리 등 Annotated 태그가 핵심 역할을 하는 시나리오를 다룬다.

## Annotated 태그의 내부 구조

Annotated 태그는 Git 객체 데이터베이스에 독립적인 **tag 타입 객체**를 생성한다. 이 객체가 다시 커밋 객체를 가리키는 2단계 간접 참조 구조다.

```bash
# 태그 생성
git tag -a v2.0.0 -m "Release v2.0.0: major rewrite"

# 태그 객체 타입 확인
git cat-file -t v2.0.0
# tag

# 태그 객체 내부 확인
git cat-file -p v2.0.0
# object abc1234...
# type commit
# tag v2.0.0
# tagger Jane Doe <jane@example.com> 1747526400 +0900
#
# Release v2.0.0: major rewrite
```

태그 객체는 `object`(가리키는 커밋), `type`, `tag`(태그 이름), `tagger`(작성자와 날짜), **메시지**를 포함한다.

![Annotated 태그 내부 구조](/assets/posts/git-annotated-tag-structure.svg)

## GPG 서명 태그

릴리스의 무결성을 보장하려면 GPG 서명 태그를 사용한다.

```bash
# 서명된 Annotated 태그 생성 (-s = GPG sign)
git tag -s v2.0.0 -m "Signed release v2.0.0"

# 서명 검증
git tag -v v2.0.0
# object abc1234...
# gpg: Signature made ...
# gpg: Good signature from "Jane Doe <jane@example.com>"
```

`-s` 옵션은 기본 GPG 키로 태그를 서명한다. 특정 키를 지정하려면 `-u <key-id>`를 사용한다. 서명된 태그는 배포 파이프라인에서 무결성 검증 단계에 활용할 수 있다.

```bash
# 특정 GPG 키로 서명
git tag -u ABCD1234 -a v2.0.0 -m "Release v2.0.0"

# 다른 사람의 키로 서명된 태그 검증
git tag -v v2.0.0   # 신뢰 체인에 없으면 경고 출력
```

## git describe와의 연동

`git describe`는 가장 가까운 Annotated 태그를 기준으로 현재 커밋의 위치를 설명한다.

```bash
git describe
# v2.0.0-14-gabc1234
# (가장 가까운 태그 v2.0.0에서 14개 커밋 이후, 현재 커밋 abc1234)

# 정확히 태그가 붙은 커밋이라면
git describe
# v2.0.0
```

이 출력을 빌드 파이프라인에서 버전 식별자로 사용하는 패턴이 흔하다.

```bash
VERSION=$(git describe --tags --always)
echo "Building version: $VERSION"
```

Lightweight 태그는 기본적으로 `git describe`에 참여하지 않는다. 릴리스 버전 관리에 `git describe`를 쓴다면 **반드시 Annotated 태그**를 사용해야 한다.

## 태그를 원격에 push하기

기본적으로 `git push`는 태그를 포함하지 않는다. 명시적으로 push해야 한다.

```bash
# 특정 태그 push
git push origin v2.0.0

# 로컬의 모든 태그 push (lightweight 포함)
git push origin --tags

# annotated 태그만 push (lightweight 제외)
git push origin --follow-tags
```

`--follow-tags`는 push하는 커밋에 연결된 Annotated 태그만 포함해서 push한다. CI에서 코드와 함께 태그를 자동으로 올릴 때 유용하다.

![Annotated 태그 핵심 명령어](/assets/posts/git-annotated-tag-commands.svg)

## 릴리스 워크플로 예시

```bash
# 1. main에서 릴리스 태그 생성
git switch main
git pull origin main
git tag -a v2.1.0 -m "$(cat CHANGELOG.md | head -20)"

# 2. 태그 push (--follow-tags 또는 명시적)
git push origin main --follow-tags

# 3. GitHub에서 릴리스 생성 (CLI 방법)
gh release create v2.1.0 --title "v2.1.0" --notes-file CHANGELOG.md
```

태그가 push되면 GitHub는 자동으로 릴리스 초안을 제안한다. CI/CD 파이프라인에서 태그 push 이벤트를 트리거로 배포를 자동화할 수도 있다.

## 태그 메시지 수정

Annotated 태그는 생성 후 메시지를 수정할 수 없다. 이미 원격에 push된 태그라면 더욱 그렇다. 내용이 틀렸다면 태그를 삭제하고 다시 만들어야 한다.

```bash
# 로컬 태그 삭제
git tag -d v2.0.0

# 원격 태그 삭제
git push origin --delete v2.0.0

# 수정된 메시지로 새 태그 생성
git tag -a v2.0.0 -m "Release v2.0.0: corrected description"
git push origin v2.0.0
```

이미 배포에 사용된 태그를 수정하는 것은 혼란을 야기할 수 있으므로, 가능하면 `v2.0.1` 같은 새 버전 태그를 만드는 방향이 낫다.

## 정리

Annotated 태그는 독립적인 태그 객체를 생성해 메타데이터(tagger, date, message)와 선택적 GPG 서명을 포함한다. `git describe`와 연동되고, `--follow-tags`로 코드와 함께 push하며, CI/CD 트리거로 활용하기에 Lightweight 태그보다 훨씬 풍부한 기능을 제공한다. 공식 릴리스에는 Annotated 태그를 표준으로 사용한다.

---

**지난 글:** [Git 태그의 두 종류: Lightweight vs Annotated](/posts/git-tag-types/)

<br>
읽어주셔서 감사합니다. 😊
