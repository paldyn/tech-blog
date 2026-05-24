---
title: "Git Loose 오브젝트 vs Pack 파일: 오브젝트 저장 방식"
description: ".git/objects/에서 loose 오브젝트와 pack 파일(.pack/.idx)이 어떻게 공존하는지, git gc가 loose를 pack으로 통합하는 과정, verify-pack으로 pack 내용을 조회하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "loose-object", "packfile", "gc", "objects", "내부구조", "델타압축"]
featured: false
draft: false
---

[지난 글](/posts/git-packed-refs/)에서 ref 파일 압축 방식인 packed-refs를 살펴봤다. 오브젝트 저장에도 비슷한 이중 구조가 있다. Git은 오브젝트를 처음에는 **loose 파일**로 저장하고, 나중에 **pack 파일**로 통합한다.

## loose 오브젝트

`git add`로 파일을 추가하거나 `git commit`으로 커밋을 만들 때마다 Git은 `.git/objects/` 아래에 오브젝트 파일을 하나씩 생성한다.

```bash
# 새 파일 커밋 후 objects 디렉터리 확인
ls .git/objects/
# 8a/  ab/  ff/  info/  pack/

ls .git/objects/8a/
# b686e8a729f4b0ccd04e3176f26c78fbf00dcc

# 파일 크기 확인 (zlib 압축되어 있음)
ls -lh .git/objects/8a/b686e8a729f4b0ccd04e3176f26c78fbf00dcc
```

각 파일은 `zlib deflate`로 압축된 바이너리다. SHA-1의 앞 2자리가 디렉터리명, 나머지 38자리가 파일명이 된다.

![Loose vs Pack 저장 구조](/assets/posts/git-loose-vs-pack-storage.svg)

## pack 파일 구조

`git gc`나 `git push` 후에 loose 오브젝트들이 `.git/objects/pack/` 아래 pack 파일로 통합된다. pack 파일은 두 부분으로 구성된다.

- **`.pack` 파일**: 실제 오브젝트 데이터 (FULL 또는 델타 압축)
- **`.idx` 파일**: SHA → .pack 파일 내 오프셋 매핑 인덱스

```bash
ls .git/objects/pack/
# pack-abc123def456....pack
# pack-abc123def456....idx
```

idx 파일이 있어 특정 SHA를 가진 오브젝트를 O(log n) 이진 탐색으로 빠르게 찾을 수 있다.

## 델타 압축

pack 파일 안의 오브젝트는 두 가지 방식으로 저장된다.

**FULL 오브젝트**: zlib으로 전체 내용 압축. pack 내 첫 버전이나 기준 오브젝트.

**DELTA 오브젝트**: 기준 오브젝트와의 **차이(delta)**만 저장.

```bash
# pack 내용 확인
git verify-pack -v .git/objects/pack/pack-abc123.idx | head -20

# 출력 예시:
# abc123def blob   12345  8765  packfile-offset
# fff000aaa blob   12350   234  packfile-offset 2 abc123def
# ↑ "2 abc123def" 는 abc123def의 delta임을 의미
```

`git push` 시 네트워크로 전송되는 것도 pack 파일 포맷이다. 유사한 파일들의 차이만 전송해 대역폭을 절약한다.

## git gc: loose → pack 통합

`git gc`는 loose 오브젝트를 pack으로 통합하고, 고아 오브젝트를 제거하는 가비지 컬렉션 명령이다.

```bash
# 기본 gc 실행
git gc

# 더 강력한 최적화 (시간이 더 걸림)
git gc --aggressive

# 자동 gc 트리거 조건 확인
git config gc.auto
# 6700 (기본값: loose 오브젝트 6700개 이상이면 auto gc)
```

![gc 과정](/assets/posts/git-loose-vs-pack-gc.svg)

Git은 커밋이나 fetch 시 `gc.auto` 임계치를 넘으면 자동으로 gc를 실행한다. `--quiet` 로그에서 `Auto packing the repository for optimum performance.` 메시지를 볼 수 있다.

## pack 파일 조회 명령

```bash
# 모든 pack의 오브젝트 목록
git verify-pack -v .git/objects/pack/*.idx

# pack에서 특정 오브젝트 내용 읽기
git cat-file -p <SHA>  # pack에서도 동일하게 동작

# 저장소 오브젝트 통계
git count-objects
# count: 12 size: 48 in-pack: 2048 packs: 1

git count-objects -v
# loose 오브젝트 개수, 크기, pack 파일 개수 등 상세 출력
```

`count-objects`는 loose 오브젝트와 pack 오브젝트를 구분해서 보여준다. gc 전후를 비교하면 얼마나 압축됐는지 확인할 수 있다.

## loose와 pack 공존

loose 오브젝트와 pack 파일은 함께 존재할 수 있다. Git은 오브젝트를 조회할 때 두 곳을 모두 검색한다.

```
1. .git/objects/{2자}/{38자} (loose)
2. .git/objects/pack/*.idx (pack)
```

새로 만든 커밋은 처음에 loose 파일로 저장되고, gc 후에 pack으로 통합된다.

다음 글에서는 pack 파일의 내부 포맷인 **packfile 구조**를 더 자세히 살펴본다.

---

**지난 글:** [Git packed-refs: ref를 압축 저장하는 파일](/posts/git-packed-refs/)

**다음 글:** [Git Packfile 내부 구조: 헤더·인덱스·델타 압축](/posts/git-packfile/)

<br>
읽어주셔서 감사합니다. 😊
