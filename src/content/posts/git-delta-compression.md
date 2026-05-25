---
title: "Git Delta 압축: pack 파일 내 오브젝트 저장 원리"
description: "Git pack 파일이 유사한 오브젝트를 COPY·INSERT 명령어로 압축하는 delta 메커니즘, OFS_DELTA와 REF_DELTA 차이, pack.depth·pack.window 설정을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "delta-compression", "packfile", "gc", "내부구조", "OFS_DELTA"]
featured: false
draft: false
---

[지난 글](/posts/git-packfile/)에서 pack 파일의 헤더·인덱스 구조를 살펴봤다. 이번에는 pack 파일이 저장 공간을 극적으로 줄이는 핵심 기법인 **delta 압축**을 집중적으로 다룬다.

## delta 압축이란

일반적인 파일 버전 관리에서 파일을 수정할 때마다 전체 내용을 저장하면 공간 낭비가 크다. 10 KB 파일을 100번 수정하면 1 MB가 필요하지만 실제 변경량은 각 수정마다 몇 십 바이트에 불과할 수 있다.

Git의 delta 압축은 **기준 오브젝트(base)**와 **차이(delta)**만 저장한다. delta는 base를 변환해 대상 오브젝트를 재구성하는 명령어 시퀀스다.

![Delta 압축 체인 구조](/assets/posts/git-delta-compression-chain.svg)

## COPY와 INSERT 명령

delta 데이터는 두 종류의 명령어로 구성된다.

**COPY**: base 오브젝트에서 특정 위치의 N바이트를 복사한다. `(offset, length)` 두 값으로 인코딩되어 바이트 수에 비해 매우 작다.

**INSERT**: 새로운 데이터를 직접 삽입한다. `(length, raw bytes)` 형태로, 실제 변경된 내용만 담는다.

파일의 90%가 그대로 유지되고 10%만 변경됐다면, delta는 대부분 COPY 명령(아주 작은 크기)과 일부 INSERT 명령으로 구성되어 전체 크기가 극적으로 줄어든다.

![Delta 오브젝트 내부 포맷](/assets/posts/git-delta-compression-format.svg)

## OFS_DELTA vs REF_DELTA

pack 파일 안에는 두 가지 방식의 delta 타입이 존재한다.

**OFS_DELTA**: base 오브젝트를 같은 pack 파일 내 **오프셋**으로 참조한다. 오프셋은 pack 파일 내 절대 위치이므로, SHA 조회 없이 바로 base를 찾을 수 있어 더 효율적이다. `git gc`가 기본으로 생성하는 방식이다.

**REF_DELTA**: base 오브젝트를 **SHA**로 참조한다. 다른 pack 파일이나 loose 오브젝트를 base로 사용할 수 있어 유연하지만, SHA 조회 비용이 있다. `git bundle`이나 얕은 복제(shallow clone)에서 주로 사용된다.

```bash
# OFS_DELTA 사용 여부 확인 (기본: true)
git config pack.allowOfsDelta
# true

# REF_DELTA만 사용하도록 강제 (비권장, 테스트용)
git config pack.allowOfsDelta false
git repack -adf
```

## delta 체인 깊이

delta 오브젝트 자체가 다른 delta를 base로 삼을 수 있다. 이렇게 체인이 이어지면 depth가 깊어진다.

```
base (depth 0) → delta1 (depth 1) → delta2 (depth 2) → ...
```

depth가 깊을수록 저장 공간은 더 절약되지만, 오브젝트를 복원할 때 체인 전체를 따라가야 하므로 읽기 성능이 저하된다. `pack.depth`로 최대 체인 깊이를 설정한다.

```bash
# 기본값 확인 (보통 50)
git config pack.depth

# 더 깊은 압축 허용 (저장 공간 우선)
git config pack.depth 100

# 읽기 성능 우선 (압축률 낮아짐)
git config pack.depth 10
```

## window: 비교 대상 오브젝트 수

delta를 만들 때 Git은 현재 오브젝트와 주변 N개의 오브젝트를 비교해 가장 효율적인 base를 찾는다. 이 N이 `pack.window`다.

```bash
# 기본값 (보통 10)
git config pack.window

# 더 넓은 비교 (압축률 높아지나 gc 시간 증가)
git config pack.window 20

# 메모리 제한 (기본 10 MiB)
git config pack.windowMemory 100m
```

## verify-pack으로 delta 분석

```bash
# pack 내 오브젝트 목록과 delta 정보 출력
git verify-pack -v .git/objects/pack/pack-*.idx | head -30

# 출력 형식:
# <sha>  <type>  <원본크기>  <압축크기>  <오프셋>  [depth base-sha]
# depth와 base-sha가 있으면 delta 오브젝트

# 가장 큰 오브젝트 찾기
git verify-pack -v .git/objects/pack/pack-*.idx \
  | grep -v chain | sort -k3 -rn | head -10

# delta 통계 요약
git verify-pack -v .git/objects/pack/pack-*.idx | tail -3
# non delta: 800 objects in 50 chains
# chain length = 1: 200 objects
# chain length = 2: 50 objects
```

## gc와 delta 압축

`git gc`는 loose 오브젝트를 pack으로 통합하면서 delta 압축을 적용한다. `--aggressive` 옵션을 주면 기존 pack도 풀어서 재압축한다.

```bash
# 일반 gc
git gc

# 더 강한 delta 최적화 (시간이 오래 걸림)
git gc --aggressive

# gc 없이 수동으로 delta 재압축
git repack -a -d -f --depth=50 --window=20
```

`git repack`의 `-a`는 모든 오브젝트를 하나의 pack으로, `-d`는 이전 pack 파일 삭제, `-f`는 기존 pack도 재처리한다.

## 큰 바이너리 파일의 한계

delta 압축은 텍스트·소스코드에 매우 효과적이다. 하지만 JPEG, ZIP, MP4 같은 바이너리는 이미 자체 압축이 되어 있어 작은 변경도 전체 바이트를 바꾸기 때문에 COPY 명령을 거의 쓸 수 없다.

결과적으로 바이너리 파일은 버전마다 거의 전체 크기로 저장된다. 대용량 바이너리를 Git으로 관리하면 저장소가 빠르게 비대해지는 이유다. 이를 해결하기 위해 Git LFS(Large File Storage)를 사용한다.

---

**지난 글:** [Git Packfile 내부 구조: 헤더·인덱스·델타 압축](/posts/git-packfile/)

**다음 글:** [Git Index 파일: 스테이징 영역의 실체](/posts/git-index-file/)

<br>
읽어주셔서 감사합니다. 😊
