---
title: "Git 오브젝트 모델: blob·tree·commit·tag"
description: "Git 내부가 어떻게 동작하는지 이해하는 첫걸음인 네 가지 오브젝트 타입(blob, tree, commit, tag)의 구조와 상호 참조 방식을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "object-model", "blob", "tree", "commit", "tag", "내부구조", "SHA"]
featured: false
draft: false
---

[지난 글](/posts/git-eol-conversion/)에서 줄 끝 변환 처리를 다루며 Git이 파일 내용을 다루는 방식을 잠깐 엿봤다. 이번에는 Git 내부가 실제로 어떻게 데이터를 저장하는지, **오브젝트 모델** 전체를 처음부터 설명한다.

## Git은 스냅샷 데이터베이스

Git은 **내용 기반 주소 지정(content-addressable) 파일 시스템** 위에 버전 관리 시스템을 올린 것이다. 모든 데이터는 `SHA-1` 해시로 식별되는 **불변 오브젝트**로 저장된다. 같은 내용이면 반드시 같은 SHA이며, 한 번 저장된 오브젝트는 바뀌지 않는다.

오브젝트는 네 가지 타입으로 구성된다.

![Git 오브젝트 모델 — 4가지 타입](/assets/posts/git-object-model-types.svg)

## blob: 파일 내용

`blob`은 파일 한 개의 **내용(바이트 열)**만 담는다. 파일명도, 권한도, 경로도 저장하지 않는다. 순수한 데이터만 있다.

```bash
# 파일에서 직접 blob SHA 계산 (저장 없이)
git hash-object main.c

# 실제로 저장
git hash-object -w main.c

# blob 내용 확인
git cat-file -p <sha>
```

같은 내용을 가진 파일은 경로나 파일명에 관계없이 저장소에서 동일한 blob을 가리킨다. 파일을 복사해도 blob은 하나뿐이다.

## tree: 디렉터리 구조

`tree`는 파일명·권한·SHA의 목록이다. 디렉터리 구조를 표현한다.

```bash
# 현재 tree 구조 보기
git cat-file -p HEAD^{tree}

# 결과:
# 100644 blob a8c3... README.md
# 100644 blob 4f1b... main.c
# 040000 tree 9f2a... src
```

각 항목은 `<mode> <type> <sha> <name>` 형식이다. `100644`는 일반 파일, `040000`은 디렉터리(서브 tree), `100755`는 실행 가능 파일이다.

## commit: 스냅샷 + 메타데이터

`commit`은 특정 시점의 전체 스냅샷이다.

```bash
# 커밋 내용 직접 확인
git cat-file -p HEAD

# tree: 최상위 tree SHA
# parent: 부모 커밋 SHA (병합이면 2개)
# author: 작성자 + 타임스탬프
# committer: 커밋한 사람 (rebase 시 author와 달라짐)
# (빈 줄)
# 커밋 메시지
```

커밋은 **diff(변경 사항)가 아니라 스냅샷**을 가리킨다. `git show`로 diff처럼 보이는 것은 부모 커밋의 tree와 비교한 결과를 UI가 계산해서 보여주는 것이다.

## tag: 불변 레이블

`annotated tag`는 커밋을 가리키는 별도 오브젝트다. 서명·메시지·태거 정보를 포함한다.

```bash
# annotated tag 생성
git tag -a v1.0.0 -m "Release version 1.0"

# tag 오브젝트 내용 확인
git cat-file -p v1.0.0
# object: 커밋 SHA
# type: commit
# tag: v1.0.0
# tagger: Alice <a@example.com>
# ...메시지
```

`lightweight tag`는 오브젝트를 만들지 않고 커밋 SHA에 대한 단순한 ref 포인터다. `git tag v1.0.0` (옵션 없이)으로 만든다.

## 오브젝트 간 관계

![오브젝트 그래프 — 실제 저장소 구조](/assets/posts/git-object-model-graph.svg)

두 커밋이 있을 때, 변경되지 않은 파일의 blob은 공유된다. `main.c`를 건드리지 않은 커밋 C2는 C1과 동일한 B1 blob을 가리킨다. 이것이 Git이 공간 효율적인 이유다.

## 오브젝트 저장 경로

오브젝트는 `.git/objects/`에 저장된다.

```
.git/objects/
├── 4b/
│   └── 825dc642cb6eb9a060e54bf8d69288fbee4904   # blob
├── 9f/
│   └── 2a3e1b...                               # tree
├── ab/
│   └── cd1234...                               # commit
├── info/
└── pack/
```

SHA의 앞 2글자가 디렉터리, 나머지 38글자가 파일명이다. 저장소가 커지면 `git gc`가 여러 loose object를 하나의 **pack file**로 묶어 압축한다.

## cat-file: 오브젝트 탐색

```bash
# 오브젝트 타입 확인
git cat-file -t HEAD          # commit
git cat-file -t HEAD^{tree}   # tree
git cat-file -t HEAD:main.c   # blob

# 오브젝트 크기 확인 (bytes)
git cat-file -s HEAD

# 오브젝트 내용 출력
git cat-file -p <sha>
git cat-file -p HEAD:src/main.c   # 특정 파일 특정 커밋 버전
```

오브젝트 모델을 이해하면 `git rebase`, `git cherry-pick`, `git reset` 같은 명령이 내부에서 어떤 오브젝트를 어떻게 조작하는지 명확하게 보인다. 다음 글부터 blob, tree, commit 각각을 더 자세히 파헤친다.

---

**지난 글:** [Git 줄 끝 변환 처리](/posts/git-eol-conversion/)

<br>
읽어주셔서 감사합니다. 😊
