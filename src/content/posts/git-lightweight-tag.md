---
title: "Lightweight 태그 — 단순한 포인터의 모든 것"
description: "Lightweight 태그의 내부 동작 원리, 생성·조회·삭제 명령어, Annotated 태그와의 실질적 차이를 상세히 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "tag", "lightweight tag", "refs", "버전 관리"]
featured: false
draft: false
---

[지난 글](/posts/git-annotated-tag/)에서 Annotated 태그의 내부 구조와 GPG 서명, `git describe` 연동을 살펴봤다. 이번에는 반대편에 있는 **Lightweight 태그**를 깊이 파헤친다. 단순해 보이지만, 내부 구조를 이해하면 언제 쓰고 언제 피해야 할지 명확히 판단할 수 있다.

## Lightweight 태그란

Lightweight 태그는 특정 커밋을 가리키는 **단순한 이름 붙은 포인터**다. `.git/refs/tags/` 경로 아래 텍스트 파일 하나가 생성되고, 그 안에는 커밋의 SHA-1 해시만 들어있다.

```bash
# Lightweight 태그 생성 (옵션 없음)
git tag v1.0-beta

# 특정 커밋에 태그 붙이기
git tag v1.0-beta abc1234

# 내부 파일 직접 확인
cat .git/refs/tags/v1.0-beta
# abc1234abc1234abc1234abc1234abc1234abc1234
```

Annotated 태그처럼 별도의 tag 객체를 Git 데이터베이스에 만들지 않는다. 그냥 refs 파일 하나가 전부다.

![Lightweight 태그 개념 — 커밋 직접 참조](/assets/posts/git-lightweight-tag-concept.svg)

## 내부 구조 확인

`git cat-file`로 태그 타입을 확인해보면 Lightweight와 Annotated의 차이가 명확히 드러난다.

```bash
# Lightweight 태그
git cat-file -t v1.0-beta
# commit   ← 태그 객체가 아닌 커밋 직접 참조

# Annotated 태그
git cat-file -t v2.0.0
# tag      ← 별도 tag 객체 존재

# Lightweight 태그의 커밋 내용 (태그 메타데이터 없음)
git cat-file -p v1.0-beta
# tree abc...
# parent def...
# author ...
# committer ...
# feat: initial release
```

Lightweight 태그는 커밋 자체를 바라보기 때문에 tagger, 태그 작성 날짜, 태그 메시지가 없다.

## 생성·조회·삭제

기본 명령어는 간단하다.

```bash
# 현재 HEAD에 태그
git tag v1.0.0

# 특정 커밋에 태그
git tag v1.0.0 abc1234

# 태그 목록 보기
git tag
git tag -l "v1.*"     # 패턴 필터

# 태그가 가리키는 커밋 확인
git rev-parse v1.0.0
git show v1.0.0       # 커밋 내용 출력

# 로컬 태그 삭제
git tag -d v1.0.0

# 원격 태그 삭제
git push origin --delete v1.0.0
```

![Lightweight 태그 주요 명령어](/assets/posts/git-lightweight-tag-commands.svg)

## git describe와의 관계

`git describe`는 기본적으로 **Annotated 태그만** 참조한다. Lightweight 태그가 붙어있어도 `git describe` 출력에 반영되지 않는다.

```bash
# v1.0-beta가 Lightweight이면
git describe
# fatal: No names found, cannot describe anything.

# --tags 옵션을 주면 Lightweight 포함
git describe --tags
# v1.0-beta-3-gabc1234
```

릴리스 버전을 `git describe`로 식별하는 파이프라인을 운영한다면 반드시 Annotated 태그를 써야 한다. `--tags`를 쓰면 Lightweight도 포함되지만, 그 경우 태그 종류를 일관되게 유지하기 어렵다.

## push할 때 주의점

기본 `git push`는 태그를 포함하지 않는다. 명시적으로 push해야 한다.

```bash
# 특정 태그만 push
git push origin v1.0.0

# 모든 태그 push (Lightweight + Annotated 모두)
git push origin --tags

# Annotated 태그만 push (Lightweight 제외)
git push origin --follow-tags
```

`--follow-tags`는 push하는 커밋과 연결된 Annotated 태그만 포함한다. CI에서 코드 푸시와 함께 릴리스 태그를 올릴 때 안전한 선택이다. Lightweight 태그는 이 옵션으로는 push되지 않는다.

## Lightweight를 써도 좋은 상황

모든 태그를 Annotated로 만들 필요는 없다. Lightweight가 적합한 상황이 있다.

- **개인 작업 북마크**: 나중에 돌아올 커밋을 임시로 표시할 때
- **로컬 전용 레퍼런스**: 공유되지 않고 삭제 예정인 태그
- **CI 내부 빌드 식별자**: 릴리스가 아닌 빌드 번호 추적용
- **스크립트 임시 체크포인트**: 배포 스크립트 중간 검증 지점

반면 공식 릴리스, 오픈소스 배포, GPG 서명이 필요한 경우에는 무조건 Annotated 태그를 쓴다.

## 실수로 Lightweight를 Annotated로 바꾸기

릴리스 태그를 실수로 Lightweight로 만들었다면, 삭제 후 재생성해야 한다.

```bash
# 기존 Lightweight 태그 삭제 (원격 포함)
git tag -d v1.0.0
git push origin --delete v1.0.0

# Annotated 태그로 다시 생성
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

이미 다른 팀원이 해당 태그를 사용하고 있다면 `git fetch --tags`로 갱신하도록 공지해야 한다.

---

**지난 글:** [주석 태그 심층 분석 — git tag -a](/posts/git-annotated-tag/)

**다음 글:** [태그 목록 조회와 생성 패턴](/posts/git-tag-list-create/)

<br>
읽어주셔서 감사합니다. 😊
