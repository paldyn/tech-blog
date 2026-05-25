---
title: "git hash-object: 파일을 직접 오브젝트로 만들기"
description: "git hash-object로 blob 오브젝트를 직접 생성하는 방법, SHA 계산 원리(헤더+내용), -w로 objects에 저장하기, update-index·write-tree·commit-tree와 함께 plumbing 워크플로를 구현하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "hash-object", "plumbing", "blob", "SHA-1", "내부구조", "update-index"]
featured: false
draft: false
---

[지난 글](/posts/git-cat-file/)에서 기존 오브젝트를 읽는 `git cat-file`을 살펴봤다. 이번에는 반대로 파일에서 오브젝트를 직접 생성하는 `git hash-object`를 다룬다.

## git hash-object란

`git hash-object`는 파일 내용을 받아 Git 오브젝트 형식으로 변환하고 SHA-1 해시를 계산한다. `-w` 옵션이 있으면 `.git/objects/`에 실제로 저장한다.

```bash
# SHA 계산만 (objects에 저장하지 않음)
git hash-object README.md

# SHA 계산 + objects에 저장
git hash-object -w README.md

# stdin에서 읽기
echo "hello world" | git hash-object --stdin
# 8ab686e8a729f4b0ccd04e3176f26c78fbf00dcc
```

## SHA 계산 원리

Git은 파일 내용을 그대로 해시하지 않는다. 오브젝트 타입·크기를 나타내는 헤더를 앞에 붙인 뒤 SHA-1을 계산한다.

```
헤더 형식: "{type} {size}\0{content}"
예시: "blob 12\0hello world\n"
```

- **type**: blob / tree / commit / tag
- **size**: 내용 바이트 수 (10진수 ASCII)
- **\0**: NUL 바이트 구분자
- **content**: 원본 파일 내용

이 조합 전체에 SHA-1을 적용한 40자리 16진수가 오브젝트 SHA다.

![hash-object 동작 과정](/assets/posts/git-hash-object-process.svg)

## 저장 위치

`-w`로 저장할 때 SHA의 앞 2자리가 디렉터리, 나머지 38자리가 파일명이 된다.

```bash
SHA=$(git hash-object -w file.txt)
echo $SHA
# 8ab686e8a729f4b0ccd04e3176f26c78fbf00dcc

ls .git/objects/8a/
# b686e8a729f4b0ccd04e3176f26c78fbf00dcc

# 저장된 내용 확인 (zlib 압축됨)
git cat-file -p $SHA
# file.txt 내용 출력
```

## 오브젝트 타입 지정

기본적으로 blob 타입으로 저장하지만, `-t` 옵션으로 타입을 바꿀 수 있다. 실제 사용 빈도는 낮지만 내부 구조 이해에 유용하다.

```bash
# 기본: blob 타입
git hash-object -w file.txt

# tree 타입으로 저장 (특수한 경우)
git hash-object -t tree -w --stdin < tree-data.bin

# tag 오브젝트로 저장
git hash-object -t tag -w --stdin < tag-data.txt
```

## plumbing으로 git add + commit 직접 구현

`git hash-object`, `git update-index`, `git write-tree`, `git commit-tree`를 조합하면 `git add`와 `git commit`을 plumbing 수준에서 직접 구현할 수 있다.

![수동 스테이징 흐름](/assets/posts/git-hash-object-usecase.svg)

```bash
# 1) 파일을 blob으로 저장
SHA=$(git hash-object -w hello.txt)
echo "blob SHA: $SHA"

# 2) index에 등록 (git add와 동일 효과)
git update-index --add --cacheinfo 100644,$SHA,hello.txt

# 3) index에서 tree 오브젝트 생성
TREE=$(git write-tree)
echo "tree SHA: $TREE"

# 4) commit 오브젝트 생성 (처음 커밋이면 -p 없이)
COMMIT=$(git commit-tree $TREE -m "init: first commit")
echo "commit SHA: $COMMIT"

# 5) HEAD를 새 커밋으로 업데이트
git update-ref HEAD $COMMIT
```

이 다섯 단계가 `git add hello.txt && git commit -m "init: first commit"`과 동일하다.

## 여러 파일 동시 처리

```bash
# 여러 파일 한 번에 처리
git hash-object -w file1.txt file2.txt file3.txt

# find와 함께 특정 확장자 파일 모두 저장
find . -name "*.go" | xargs git hash-object -w

# 실제 파일 없이 문자열로 blob 생성
printf "config value" | git hash-object -w --stdin
```

## 내용이 같은 파일의 SHA

Git은 내용 기반으로 SHA를 결정하므로, 다른 경로라도 내용이 완전히 같은 파일은 SHA가 동일하다.

```bash
cp file1.txt file2.txt
SHA1=$(git hash-object file1.txt)
SHA2=$(git hash-object file2.txt)
echo "$SHA1 == $SHA2"  # 동일한 SHA
```

이것이 Git이 중복 파일을 효율적으로 저장하는 이유다. 같은 내용이면 하나의 blob만 존재하고 여러 tree가 같은 SHA를 참조한다.

## SHA 계산 직접 확인

Python으로 Git의 SHA 계산 로직을 검증할 수 있다.

```python
import hashlib

content = b"hello world\n"
header = f"blob {len(content)}\0".encode()
data = header + content

sha = hashlib.sha1(data).hexdigest()
print(sha)  # 8ab686e8a729f4b0ccd04e3176f26c78fbf00dcc
```

`git hash-object`의 결과와 동일하다. 이를 통해 Git SHA가 암호학적으로 안전한 체크섬이며 내용에 의해 완전히 결정됨을 확인할 수 있다.

---

**지난 글:** [git cat-file: 오브젝트 내용을 직접 읽는 plumbing 명령](/posts/git-cat-file/)

**다음 글:** [git rev-parse: 참조를 SHA로 변환하는 범용 도구](/posts/git-rev-parse/)

<br>
읽어주셔서 감사합니다. 😊
