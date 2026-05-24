---
title: "Git Packfile 내부 구조: 헤더·인덱스·델타 압축"
description: ".pack과 .idx 파일의 바이너리 포맷, OFS_DELTA·REF_DELTA 델타 압축 방식, git verify-pack으로 packfile을 분석하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "packfile", "delta-compression", "verify-pack", "내부구조", "OFS_DELTA"]
featured: false
draft: false
---

[지난 글](/posts/git-loose-vs-pack/)에서 loose 오브젝트가 gc 후 pack 파일로 통합되는 과정을 살펴봤다. 이번에는 pack 파일의 **바이너리 포맷** 자체를 들여다본다.

## .pack과 .idx 파일

pack은 항상 두 파일이 짝을 이룬다.

```bash
ls .git/objects/pack/
# pack-abc123def456....idx   ← 인덱스
# pack-abc123def456....pack  ← 데이터
```

**`.pack`**: 실제 오브젝트 데이터  
**`.idx`**: SHA → .pack 내 오프셋 매핑 인덱스 (빠른 조회용)

같은 SHA 접두사를 가진 파일명으로 묶인다. `.idx` 없이 `.pack`만 있으면 SHA로 오브젝트를 찾을 수 없다.

![Packfile 포맷](/assets/posts/git-packfile-format.svg)

## .pack 파일 구조

.pack 파일은 세 부분으로 구성된다.

**헤더 (12 bytes)**
```
PACK  (4 bytes: magic number 'P','A','C','K')
0002  (4 bytes: 버전, 현재 2)
NNNN  (4 bytes: 오브젝트 개수)
```

**오브젝트 데이터 (가변 길이)**

각 오브젝트는 타입·크기 헤더 + 압축 데이터로 구성된다.

| 타입 | 비트 | 설명 |
|------|------|------|
| `OBJ_COMMIT` | 001 | 전체 commit 내용 |
| `OBJ_TREE` | 010 | 전체 tree 내용 |
| `OBJ_BLOB` | 011 | 전체 blob 내용 |
| `OBJ_TAG` | 100 | 전체 tag 내용 |
| `OBJ_OFS_DELTA` | 110 | 같은 pack 내 오프셋 기준 델타 |
| `OBJ_REF_DELTA` | 111 | SHA 참조 기준 델타 |

**트레일러 (20 bytes)**: 파일 전체에 대한 SHA-1 체크섬

## .idx 파일 구조 (v2)

.idx는 빠른 오브젝트 조회를 위한 인덱스다.

1. **매직 + 버전** (8 bytes): `\xfftOc\x00\x00\x00\x02`
2. **Fan-out 테이블** (1024 bytes): 256개의 4-byte 카운터. 이진 탐색 가속용
3. **SHA-1 목록** (20 × N bytes): 정렬된 오브젝트 SHA 배열
4. **CRC32** (4 × N bytes): 각 오브젝트의 무결성 체크섬
5. **오프셋** (4 × N bytes): SHA → .pack 파일 내 바이트 위치

Git이 특정 SHA를 조회할 때:
1. Fan-out 테이블로 대략적 위치를 파악한다
2. SHA 목록에서 이진 탐색으로 정확한 인덱스를 찾는다
3. 오프셋 배열에서 .pack 파일 내 위치를 얻는다
4. .pack 파일에서 해당 오프셋을 읽는다

## 델타 압축: OFS_DELTA vs REF_DELTA

Git은 유사한 오브젝트를 기준 오브젝트 + 차이(delta)로 저장해 공간을 절약한다.

![델타 압축 원리](/assets/posts/git-packfile-delta.svg)

**OFS_DELTA**: 기준 오브젝트를 같은 .pack 파일 내 오프셋으로 참조. 더 효율적이며 `git gc`가 기본으로 생성한다.

**REF_DELTA**: 기준 오브젝트를 SHA로 참조. 다른 pack이나 loose 오브젝트를 기준으로 사용할 수 있다. 주로 `git bundle`이나 얕은 복제에서 사용된다.

```bash
# verify-pack으로 delta 관계 확인
git verify-pack -v .git/objects/pack/pack-*.idx | head -20

# 출력 예:
# abc123 blob   12345  8765  1024
# fff000 blob   12350   234  8789 2 abc123
#         ↑             ↑         ↑ abc123의 delta
#    SHA  타입  원본크기 압축크기  오프셋
```

세 번째 숫자 뒤에 `{depth} {base-sha}`가 있으면 delta 오브젝트다. `depth`는 델타 체인 깊이다.

## packfile 분석 실전 명령

```bash
# pack 파일 목록
ls -lh .git/objects/pack/

# pack 내 오브젝트 통계
git verify-pack -v .git/objects/pack/pack-*.idx | tail -1
# non delta: 1234 objects in 2 chains

# 가장 큰 오브젝트 찾기 (원본 크기 기준)
git verify-pack -v .git/objects/pack/pack-*.idx \
  | grep -v "^#" | sort -k3 -rn | head -10

# SHA로 오브젝트 타입 확인 (pack에서도 동일)
git cat-file -t abc123def

# pack 파일 직접 생성 (내부 이해용)
git pack-objects .git/objects/pack/test < /dev/stdin
```

## pack과 네트워크 전송

`git push`·`git fetch`·`git clone`은 pack 포맷으로 오브젝트를 전송한다. 서버와 클라이언트가 서로 어떤 오브젝트를 가지고 있는지 협상(negotiate)한 뒤, 필요한 오브젝트만 담은 thin pack을 만들어 전송한다.

```bash
# 전송 통계 확인 (fetch 시)
git fetch -v origin main
# remote: Counting objects: 42, done.
# remote: Compressing objects: 100% (35/35), done.
# remote: Total 42 (delta 14), reused 28 (delta 8)
# Receiving objects: 100% (42/42), 15.23 KiB | 3.81 MiB/s, done.
```

delta 수치가 높을수록 압축 효율이 좋다는 의미다. 대형 바이너리 파일은 델타 압축이 거의 효과 없어 pack 크기가 커진다. Git LFS를 사용하는 이유 중 하나다.

---

**지난 글:** [Git Loose 오브젝트 vs Pack 파일: 오브젝트 저장 방식](/posts/git-loose-vs-pack/)

<br>
읽어주셔서 감사합니다. 😊
