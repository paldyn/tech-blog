---
title: "태그 목록 조회와 생성 패턴"
description: "git tag -l의 glob 필터, version:refname 정렬, 과거 커밋 태깅, 원격 태그 동기화까지 태그 관리 전반을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "tag", "git tag -l", "버전 관리", "릴리스"]
featured: false
draft: false
---

[지난 글](/posts/git-lightweight-tag/)에서 Lightweight 태그의 내부 구조를 살펴봤다. 이번에는 태그를 **목록으로 조회하고 체계적으로 생성**하는 패턴을 정리한다. 버전 수십 개가 쌓인 프로젝트에서 원하는 태그를 빠르게 찾고, 정확한 커밋에 태그를 붙이는 방법이다.

## 기본 목록 조회

```bash
# 로컬 태그 전체 목록
git tag

# -l 옵션으로 패턴 필터
git tag -l "v1.*"       # v1. 으로 시작하는 것만
git tag -l "v[0-9]*"   # v 다음 숫자로 시작
git tag -l "*-rc*"     # RC 버전만
```

`-l` 없이 `git tag`만 입력해도 목록이 나오지만, glob 패턴을 쓰려면 `-l`이 필수다. `git tag "v1.*"` 처럼 `-l` 없이 패턴을 주면 패턴이 새 태그 이름으로 해석되어 에러가 난다.

![태그 목록 조회 패턴](/assets/posts/git-tag-list-create-pattern.svg)

## 정렬 문제와 version:refname

기본 정렬은 **사전순**이라 `v1.10.0`이 `v1.2.0`보다 앞에 온다. 버전 의미 순서로 보려면 `--sort` 옵션이 필요하다.

```bash
# 버전 의미 순서 (오름차순)
git tag --sort=version:refname

# 내림차순 (최신 버전 먼저)
git tag --sort=-version:refname

# 태그 생성일 순서
git tag --sort=-creatordate

# 패턴과 함께
git tag -l "v*" --sort=-version:refname
```

`version:refname`은 Semantic Versioning 규칙을 이해하고 정렬한다. `v1.2.0 < v1.10.0 < v2.0.0` 순서가 보장된다.

## 설정으로 기본 정렬 변경

프로젝트 전체에서 항상 버전 정렬을 사용하고 싶다면 설정에 등록한다.

```bash
# 전역 설정
git config --global tag.sort version:refname

# 프로젝트 단위
git config tag.sort version:refname
```

이후 `git tag` 명령이 자동으로 버전 순서로 출력된다.

## 태그 생성

```bash
# HEAD에 Lightweight 태그
git tag v1.0.0

# HEAD에 Annotated 태그 (릴리스 권장)
git tag -a v1.0.0 -m "Release v1.0.0"

# 과거 커밋에 태그 붙이기
git tag v0.9.0 abc1234
git tag -a v0.9.0 -m "Retroactive tag" abc1234
```

SHA는 7자리 이상 지정하면 된다. 전체 40자리를 입력할 필요는 없다.

![태그 생성 — HEAD vs 과거 커밋](/assets/posts/git-tag-list-create-flow.svg)

## 이미 태그가 있는 커밋에 덮어쓰기

기본적으로 같은 이름의 태그가 이미 있으면 에러가 난다. `-f`(force)로 강제 덮어쓸 수 있다.

```bash
# 이미 존재하는 태그 강제 이동
git tag -f v1.0.0 newcommit

# 원격에도 강제 push 필요
git push origin -f v1.0.0
```

원격에 이미 push된 태그를 `-f`로 덮어쓰는 것은 다른 팀원의 로컬 레포와 불일치를 유발하므로 공유 태그에는 사용하지 않는다.

## 원격 태그 조회

원격에 있는 태그를 로컬에서 먼저 확인하려면 `ls-remote`를 쓴다.

```bash
# 원격 태그 목록
git ls-remote --tags origin

# 특정 패턴만
git ls-remote --tags origin "refs/tags/v1.*"

# fetch해서 로컬에 가져오기
git fetch --tags
```

원격 태그는 `git fetch`로 가져오지 않으면 `git tag`에 보이지 않는다. `git fetch`만 해도 태그가 자동으로 따라오는 경우가 많지만, 누락된 경우에는 `--tags`를 명시한다.

## 태그 정보 상세 확인

```bash
# 태그가 가리키는 커밋과 태그 메시지 확인
git show v1.0.0

# 태그가 가리키는 커밋 SHA만 출력
git rev-parse v1.0.0

# 태그 객체 타입 확인 (lightweight=commit, annotated=tag)
git cat-file -t v1.0.0
```

`git show`는 Annotated 태그라면 태그 메타데이터(tagger, date, message)를 먼저 보여주고, 그 다음에 커밋 정보를 출력한다.

---

**지난 글:** [Lightweight 태그 — 단순한 포인터의 모든 것](/posts/git-lightweight-tag/)

**다음 글:** [태그 Push와 Fetch — 원격 동기화](/posts/git-tag-push-fetch/)

<br>
읽어주셔서 감사합니다. 😊
