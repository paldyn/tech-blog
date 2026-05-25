---
title: "Git Index 파일: 스테이징 영역의 실체"
description: ".git/index 바이너리 파일의 구조, DIRC 헤더·엔트리 필드(SHA-1·mode·mtime), git ls-files --stage로 직접 읽는 방법, git status가 index를 활용하는 원리를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "index", "staging", "ls-files", "내부구조", "DIRC"]
featured: false
draft: false
---

[지난 글](/posts/git-delta-compression/)에서 pack 파일의 delta 압축 메커니즘을 살펴봤다. 이번에는 Git의 3대 영역 중 하나인 **스테이징 영역(Index)**의 실체, 즉 `.git/index` 바이너리 파일을 들여다본다.

## Index란

`git add`를 실행하면 파일이 "스테이징"된다. 많은 가이드에서 "스테이징 영역(staging area)" 또는 "캐시(cache)"라고 부르는데, 실제로는 `.git/index`라는 단일 바이너리 파일이다.

Index는 커밋을 만들 때 사용할 **다음 트리 스냅샷**을 기록한다. `git commit`은 index를 읽어서 tree 오브젝트를 만들고, 그 tree를 가리키는 commit 오브젝트를 생성한다.

![Index 파일 구조](/assets/posts/git-index-file-structure.svg)

## DIRC 헤더

`.git/index` 파일은 `DIRC`(Directory Cache) 매직 4바이트로 시작한다.

```bash
# 첫 4바이트 확인 (16진수)
xxd .git/index | head -1
# 00000000: 4449 5243 0000 0002 0000 0042  DIRC.......B
#           ^^^^ DIRC      ^^^^ ver2  ^^^^ 66 entries

# 파일 크기 확인
ls -lh .git/index
```

헤더는 12바이트로 구성된다.

- **DIRC** (4B): 파일 타입 식별
- **버전** (4B): 현재 2 (파일 수 65535 초과 시 3)
- **엔트리 수** (4B): 현재 index에 기록된 파일 수

## 엔트리 구조

각 파일은 최소 62바이트의 고정 필드 + 가변 길이 파일명으로 구성된다.

```
ctime  (8B) : 메타데이터 변경 시각 (초 + 나노초)
mtime  (8B) : 내용 수정 시각 (초 + 나노초)
dev    (4B) : 장치 번호
ino    (4B) : inode 번호
mode   (4B) : 파일 모드 (100644 / 100755 / 120000)
uid    (4B) : 사용자 ID
gid    (4B) : 그룹 ID
size   (4B) : 파일 크기 (바이트)
SHA-1  (20B): blob 오브젝트 해시
flags  (2B) : assume-valid, extended 플래그 + 경로 길이
name  (가변): 널 종료 파일 경로, 8바이트 정렬 패딩
```

## git status가 index를 쓰는 방법

`git status`가 빠른 이유는 파일마다 전체 내용을 읽지 않기 때문이다.

![Index를 통한 파일 상태 전환](/assets/posts/git-index-file-flow.svg)

**Working Dir vs Index**: index의 mtime/ctime과 OS 파일 메타데이터를 비교한다. 타임스탬프가 같으면 SHA-1을 계산하지 않아도 변경 없음을 알 수 있다. 타임스탬프가 다를 때만 실제 해시를 재계산한다.

**Index vs HEAD**: index의 SHA-1과 HEAD 커밋의 tree를 비교한다. 다르면 "Changes to be committed"로 표시된다.

## ls-files로 index 직접 읽기

```bash
# index 내 모든 파일 목록
git ls-files

# 모드·SHA·경로 포함
git ls-files --stage
# 100644 abc123def456...  0  src/main.go
# 100644 bcd234efa567...  0  README.md
# <mode> <sha>            <stage> <path>

# 수정된 파일만 (Working Dir vs Index)
git ls-files --modified

# 추적하지 않는 파일 목록
git ls-files --others --exclude-standard

# 충돌 파일 (stage != 0)
git ls-files --unmerged
```

stage 번호는 merge 충돌 시 의미를 가진다. 0은 정상, 1은 공통 base, 2는 ours, 3은 theirs.

## index 직접 조작

```bash
# 특정 blob SHA로 index 강제 업데이트 (plumbing)
git update-index --add --cacheinfo 100644,<sha>,path/file.txt

# 파일을 "변경 없음"으로 가정 (assume-unchanged)
git update-index --assume-unchanged path/file.txt
# 이후 git status는 이 파일을 변경 검사에서 제외함

# assume-unchanged 해제
git update-index --no-assume-unchanged path/file.txt

# skip-worktree (sparse checkout에서 사용)
git update-index --skip-worktree path/file.txt
```

`--assume-unchanged`는 IDE나 빌드 도구가 파일 타임스탬프를 자주 바꿀 때 `git status` 속도를 높이는 데 쓴다. 단, 실제 변경이 있어도 git이 무시하므로 주의가 필요하다.

## index와 merge 충돌

merge 중에 충돌이 발생하면 index는 하나의 파일에 대해 최대 3개의 엔트리를 가진다.

```bash
# 충돌 중 index 확인
git ls-files --unmerged
# 100644 <sha1>  1  conflicted-file.txt   ← common base
# 100644 <sha2>  2  conflicted-file.txt   ← ours
# 100644 <sha3>  3  conflicted-file.txt   ← theirs
```

충돌이 해결되면 stage 1/2/3 엔트리가 하나의 stage 0 엔트리로 합쳐진다.

## Extensions: TREE 캐시

index 파일 끝에는 선택적 확장 섹션이 있다. 가장 중요한 것은 `TREE` 캐시다.

```bash
# index 내 캐시된 tree 확인
git ls-tree HEAD
# 100644 blob abc123  README.md
# 040000 tree def456  src/
```

TREE 캐시는 이미 계산된 tree SHA를 저장해 `git commit` 속도를 높인다. `git add` 후 index가 갱신되면 영향받은 경로의 캐시만 무효화된다.

---

**지난 글:** [Git Delta 압축: pack 파일 내 오브젝트 저장 원리](/posts/git-delta-compression/)

**다음 글:** [git cat-file: 오브젝트 내용을 직접 읽는 plumbing 명령](/posts/git-cat-file/)

<br>
읽어주셔서 감사합니다. 😊
