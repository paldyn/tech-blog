---
title: "comm · cmp — 파일 집합 연산과 바이너리 비교"
description: "comm으로 두 정렬된 파일의 교집합·차집합을 구하고, cmp로 바이너리 파일을 바이트 단위로 비교하는 방법을 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["comm", "cmp", "텍스트처리", "Linux", "집합연산"]
featured: false
draft: false
---

[지난 글](/posts/linux-diff-patch/)에서 diff와 patch로 파일 차이를 추출하고 적용하는 방법을 살펴봤습니다. 이번 글에서는 두 파일의 집합 연산을 수행하는 `comm`과 바이트 단위로 파일을 비교하는 `cmp`를 다룹니다. 두 명령어는 각각 텍스트 집합 연산과 바이너리 무결성 검사에 특화돼 있습니다.

![comm · cmp 개념 다이어그램](/assets/posts/linux-comm-cmp-overview.svg)

## comm — 집합 연산 도구

`comm`은 두 개의 **정렬된** 파일을 입력 받아 세 컬럼으로 출력합니다.

- **컬럼 1**: file1에만 있는 줄
- **컬럼 2**: file2에만 있는 줄
- **컬럼 3**: 두 파일에 모두 있는 줄

```bash
# 두 정렬된 파일 비교
comm a.txt b.txt
```

컬럼은 탭으로 들여쓰기돼 구분됩니다. 컬럼 2는 탭 하나, 컬럼 3은 탭 두 개로 시작합니다.

### -숫자: 특정 컬럼 숨기기

`-1`, `-2`, `-3` 옵션은 각각 해당 컬럼의 출력을 숨깁니다.

```bash
# 교집합만 출력 (1, 2번 컬럼 숨김)
comm -12 a.txt b.txt

# 차집합 A - B (2, 3번 컬럼 숨김)
comm -23 a.txt b.txt

# 차집합 B - A (1, 3번 컬럼 숨김)
comm -13 a.txt b.txt
```

### 정렬 전제 조건

`comm`은 입력 파일이 정렬돼 있다는 것을 전제합니다. 정렬되지 않은 파일에 쓰면 잘못된 결과가 나옵니다. 프로세스 치환으로 즉석에서 정렬할 수 있습니다.

```bash
# 파일을 직접 정렬해 비교
comm -12 <(sort list1.txt) <(sort list2.txt)
```

### 실전 집합 연산

```bash
# 두 서버의 설치 패키지 차이
comm -23 \
  <(dpkg --get-selections | awk '{print $1}' | sort) \
  <(ssh server2 "dpkg --get-selections | awk '{print \$1}' | sort")

# 새로 추가된 사용자 확인
comm -13 <(sort users_before.txt) <(sort users_after.txt)

# 두 로그 파일의 공통 IP 주소
comm -12 \
  <(awk '{print $1}' access1.log | sort -u) \
  <(awk '{print $1}' access2.log | sort -u)
```

### 합집합

`comm`으로 합집합을 구하는 직접적인 옵션은 없습니다. `sort -u`를 쓰는 것이 더 간단합니다.

```bash
# 합집합 (중복 제거)
sort -u a.txt b.txt
```

---

## cmp — 바이너리 파일 비교

`cmp`는 두 파일을 바이트 단위로 비교합니다. 텍스트뿐 아니라 바이너리 파일에도 사용할 수 있어 파일 무결성 검사에 적합합니다.

```bash
# 기본: 첫 번째 차이 위치 출력
cmp file1.bin file2.bin
# → file1.bin file2.bin differ: byte 42, line 3
```

### -s: 조용한 모드

```bash
# 출력 없이 종료 코드만 반환 (0=같음, 1=다름)
cmp -s original.iso backup.iso && echo "동일" || echo "다름"
```

스크립트에서 파일 동일성을 확인할 때 `-s`를 주로 사용합니다.

### -l: 모든 차이 나열

```bash
# 모든 차이 나는 바이트 위치와 값 출력
cmp -l file1 file2
# → 42 101 102
# (바이트 위치, file1 8진수, file2 8진수)
```

![comm · cmp 실전 코드 패턴](/assets/posts/linux-comm-cmp-code.svg)

## 실전 활용

### 배포 파일 무결성 검사

```bash
# 로컬 빌드와 원격 배포본이 동일한지 확인
scp server:/app/app.jar /tmp/remote_app.jar
cmp -s /tmp/local_app.jar /tmp/remote_app.jar \
  && echo "OK" || echo "배포 파일 불일치"
```

### 백업 검증

```bash
# 원본과 백업이 정확히 같은지
for f in /data/*.db; do
  backup="/backup/$(basename $f)"
  cmp -s "$f" "$backup" || echo "불일치: $f"
done
```

### 두 환경의 설정 파일 비교

```bash
# prod/staging 설정 파일 차이
comm -3 <(sort prod_config.txt) <(sort staging_config.txt)
```

`comm -3`은 공통 줄을 숨겨서 양쪽에만 있는 줄을 모두 보여줍니다.

## diff vs comm vs cmp 비교

| 명령어 | 대상 | 출력 | 주요 용도 |
|--------|------|------|-----------|
| `diff` | 텍스트 파일 | 변경 컨텍스트 | 코드/설정 변경 확인 |
| `comm` | 정렬된 텍스트 | 집합 연산 결과 | 목록 교집합/차집합 |
| `cmp` | 모든 파일 | 첫 차이 위치 | 바이너리 무결성 검사 |

---

**지난 글:** [diff · patch — 파일 비교와 패치 적용](/posts/linux-diff-patch/)

**다음 글:** [jq · yq — JSON/YAML 커맨드라인 처리](/posts/linux-jq-yq/)

<br>
읽어주셔서 감사합니다. 😊
