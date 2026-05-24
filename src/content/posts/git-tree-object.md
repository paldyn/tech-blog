---
title: "Git Tree 오브젝트: 디렉터리 구조의 저장 방식"
description: "Git이 디렉터리 스냅샷을 저장하는 tree 오브젝트의 엔트리 형식(mode·SHA·name), 중첩 tree, ls-tree 명령 사용법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "tree", "object-model", "ls-tree", "내부구조", "디렉터리"]
featured: false
draft: false
---

[지난 글](/posts/git-blob/)에서 파일 내용을 저장하는 blob을 살펴봤다. blob은 파일명을 모른다. 파일명과 디렉터리 계층은 **tree 오브젝트**가 담당한다.

## tree 오브젝트란

tree는 한 디렉터리의 **스냅샷**이다. 해당 디렉터리 안에 있는 각 항목(파일·하위 디렉터리·서브모듈)에 대해 다음 세 값을 저장한다.

| 필드 | 예시 | 설명 |
|------|------|------|
| mode | `100644` | 파일 타입·권한 |
| SHA-1 | `8ab686e…` | 가리키는 오브젝트 ID |
| name | `README.md` | 파일명 또는 디렉터리명 |

mode 값은 다음과 같이 해석한다.

| mode | 의미 |
|------|------|
| `100644` | 일반 파일 |
| `100755` | 실행 가능 파일 |
| `040000` | 디렉터리(하위 tree) |
| `120000` | 심볼릭 링크 |
| `160000` | 서브모듈 커밋 |

![Tree 오브젝트 구조](/assets/posts/git-tree-object-structure.svg)

## ls-tree: tree 내용 조회

```bash
# 현재 HEAD의 루트 tree 조회
git ls-tree HEAD
# 100644 blob 8ab686e...  README.md
# 100644 blob f3a2b1c...  main.js
# 040000 tree d7c3a9b...  src

# 재귀적으로 모든 파일 나열 (-r)
git ls-tree -r HEAD
# 100644 blob ...  src/index.js
# 100644 blob ...  src/app.js

# 특정 서브디렉터리 조회
git ls-tree HEAD:src/

# SHA와 파일명만 출력
git ls-tree --name-only HEAD
```

## tree를 직접 읽어보기

`git cat-file -p`로 tree 오브젝트를 들여다볼 수 있다.

```bash
# HEAD가 가리키는 commit의 tree SHA 확인
git cat-file -p HEAD | head -3
# tree abc123def...
# parent ...
# author ...

# tree 오브젝트 내용 출력
git cat-file -p abc123def
# 100644 blob 8ab686e...   README.md
# 040000 tree d7c3a9b...   src
```

## tree가 불변인 이유

tree는 자식을 SHA로만 참조한다. 자식 blob이 바뀌면 SHA가 바뀌고, 부모 tree도 새 SHA가 되어 루트 tree까지 연쇄적으로 바뀐다. 이것이 Git의 **Merkle tree** 구조다.

```
루트 tree abc123
    ├── blob 8ab686e  README.md   ← 내용 변경
    └── tree d7c3a9b  src/

변경 후:
루트 tree fff999      ← SHA 변경됨
    ├── blob 9c4a11b  README.md   ← 새 blob SHA
    └── tree d7c3a9b  src/        ← 변경 없어서 그대로
```

변경된 경로의 tree만 새 SHA가 부여되고, 변경 없는 서브트리는 그대로 재사용된다. 이 덕분에 Git은 스냅샷 방식이면서도 저장 공간을 절약한다.

![Tree 순회 구조](/assets/posts/git-tree-object-traversal.svg)

## write-tree: staging area에서 tree 생성

Git 내부에서는 `git write-tree`로 인덱스(staging area)의 현재 상태를 tree 오브젝트로 기록한다.

```bash
# 파일을 추가하고 인덱스에 등록
echo "hello" > test.txt
git update-index --add --cacheinfo 100644 \
  $(git hash-object -w test.txt) test.txt

# 인덱스를 tree로 기록
git write-tree
# d8329fc1cc938780ffdd9f94e0d364e0ea74f579

# 확인
git cat-file -p d8329fc1cc938780ffdd9f94e0d364e0ea74f579
# 100644 blob ...  test.txt
```

실제로 `git add` + `git commit`이 내부적으로 이 과정을 거친다. `add`는 blob을 생성해 인덱스를 갱신하고, `commit`은 `write-tree`를 호출해 tree를 만든 뒤 commit 오브젝트를 생성한다.

다음 글에서는 tree를 가리키는 **commit 오브젝트**의 구조를 살펴본다.

---

**지난 글:** [Git Blob 오브젝트: 파일 내용의 저장 단위](/posts/git-blob/)

**다음 글:** [Git Commit 오브젝트: 커밋 내부 구조](/posts/git-commit-object/)

<br>
읽어주셔서 감사합니다. 😊
