---
title: "Git Blob 오브젝트: 파일 내용의 저장 단위"
description: "Git이 파일 내용을 저장하는 가장 기본 단위인 blob 오브젝트의 내부 구조, SHA 해시 생성 원리, hash-object·cat-file 명령 사용법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "blob", "object-model", "hash-object", "cat-file", "내부구조", "SHA-1"]
featured: false
draft: false
---

[지난 글](/posts/git-object-model/)에서 Git 오브젝트 모델 전체를 조감했다면, 이번에는 그 네 가지 타입 중 가장 단순한 **blob**을 파고든다. blob을 완전히 이해하면 나머지 tree·commit·tag도 자연스럽게 읽힌다.

## blob이란

blob(Binary Large Object)은 **파일 내용 그 자체**를 저장하는 오브젝트다. 파일명도 없고, 권한 정보도 없다. 오직 바이트 스트림만 담는다. 같은 내용이 프로젝트 어디에 몇 번 등장하든, Git은 blob을 딱 하나만 저장한다.

![Blob 오브젝트 내부 구조](/assets/posts/git-blob-structure.svg)

## 오브젝트 데이터 포맷

Git이 blob을 디스크에 쓸 때 실제로 저장하는 바이트는 다음 구조다.

```
blob {size}\0{content}
```

`"Hello, Git!\n"` 이라는 12바이트 파일이라면 Git은 `"blob 12\0Hello, Git!\n"` 전체를 SHA-1로 해시한 뒤, 그 결과를 zlib deflate로 압축해서 `.git/objects/{앞2자}/{나머지38자}` 경로에 저장한다.

```bash
# 직접 확인
printf "blob 12\0Hello, Git!\n" | sha1sum
# → 8ab686e8a729f4b0ccd04e3176f26c78fbf00dcc
```

SHA를 직접 계산하지 않아도 `git hash-object`가 대신한다.

## hash-object: blob 직접 생성

```bash
# 파일을 blob으로 저장 (-w: 실제 .git/objects에 기록)
echo "Hello, Git!" > hello.txt
git hash-object -w hello.txt
# 8ab686e8a729f4b0ccd04e3176f26c78fbf00dcc

# stdin에서 바로 입력
echo "Hello, Git!" | git hash-object --stdin -w

# -w 없으면 SHA만 계산 (저장 안 함)
git hash-object hello.txt
```

`-w` 플래그가 없으면 SHA만 계산해서 출력할 뿐, `.git/objects/`에는 아무것도 쓰지 않는다. 체크섬을 미리 알고 싶을 때 유용하다.

## cat-file: 저장된 blob 읽기

```bash
SHA=8ab686e8a729f4b0ccd04e3176f26c78fbf00dcc

# 타입 확인 (-t)
git cat-file -t $SHA
# blob

# 내용 출력 (-p)
git cat-file -p $SHA
# Hello, Git!

# 크기(byte) 확인 (-s)
git cat-file -s $SHA
# 12

# 여러 오브젝트 일괄 확인
git cat-file --batch-all-objects --batch-check | grep blob
```

`-p` 옵션은 파일 타입에 따라 적절한 형식으로 출력한다. blob의 경우 raw 내용이 그대로 나온다.

![Blob 조작 명령](/assets/posts/git-blob-commands.svg)

## 내용 기반 주소 지정의 의미

blob의 핵심은 **내용이 같으면 반드시 SHA도 같다**는 점이다. 실용적으로 두 가지 이득이 있다.

**중복 제거**: `README.md`와 `docs/README.md`가 완전히 같은 내용이라면, Git은 blob을 하나만 저장한다. tree 오브젝트만 두 개의 엔트리가 생기고, 실제 내용은 공유된다.

**무결성 보장**: SHA를 모르면 내용을 조작할 수 없다. 내용이 바뀌면 SHA가 바뀌어 기존 경로의 파일이 자동으로 무효화된다.

## 파일명과 권한은 어디에?

blob에는 파일명과 권한(`100644`, `100755` 등)이 전혀 없다. 이 정보는 **tree 오브젝트**가 담당한다. tree는 `{mode} {name}\0{blob-sha}` 형식의 엔트리 목록이다. 같은 blob SHA를 가리키더라도 tree가 파일명을 다르게 지정할 수 있다.

```bash
# blob이 포함된 tree 찾기
git ls-tree HEAD
# 100644 blob 8ab686e8...  hello.txt
# 100644 blob ...           README.md
```

## 실전 활용 패턴

```bash
# 특정 커밋 시점의 파일 내용 바로 읽기
git cat-file -p HEAD:src/main.js

# 두 blob 비교 (diff 없이 SHA만으로 동일 여부 확인)
git hash-object -w file-a.txt
git hash-object -w file-b.txt
# SHA가 같으면 내용 완전 동일

# .git/objects 디렉터리 직접 탐색
find .git/objects -type f | head -5
# .git/objects/8a/b686e8a729f4b0ccd04e3176f26c78fbf00dcc
```

blob은 Git 오브젝트 모델의 말단 노드다. tree가 blob을 가리키고, commit이 tree를 가리키며, 전체 스냅샷이 구성된다. 다음 글에서는 파일 이름과 디렉터리 구조를 담는 **tree 오브젝트**를 살펴본다.

---

**지난 글:** [Git 오브젝트 모델: blob·tree·commit·tag](/posts/git-object-model/)

**다음 글:** [Git Tree 오브젝트: 디렉터리 구조의 저장 방식](/posts/git-tree-object/)

<br>
읽어주셔서 감사합니다. 😊
