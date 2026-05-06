---
title: "Oracle 메모리 구조 — SGA·PGA·UGA"
description: "Oracle 인스턴스의 메모리를 구성하는 SGA(Buffer Cache, Shared Pool, Redo Log Buffer)와 PGA(Sort Area, UGA), 자동 메모리 관리(ASMM/AMM), 바인드 변수와 Soft Parse의 관계를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["oracle", "sga", "pga", "uga", "buffer-cache", "shared-pool", "memory", "bind-variable", "soft-parse"]
featured: false
draft: false
---

[지난 글](/posts/oracle-instance-vs-database/)에서 Oracle 인스턴스와 데이터베이스의 차이를 살펴봤다. 이번에는 인스턴스의 핵심인 **메모리 구조**를 구성 요소별로 상세히 파악한다.

---

## 메모리 전체 구조

Oracle 메모리는 크게 **SGA**(공유)와 **PGA**(프로세스별)로 나뉜다.

![Oracle 메모리 구조 전체 지도](/assets/posts/oracle-memory-sga-pga-uga-overview.svg)

---

## SGA (System Global Area)

SGA는 인스턴스에 접속한 **모든 프로세스**가 공유하는 메모리다. 인스턴스 시작 시 `sga_target` 크기만큼 운영체제로부터 할당된다.

### 1. Buffer Cache

디스크(데이터 파일)에서 읽어 들인 **8KB 블록**을 메모리에 캐시한다. 같은 블록을 다시 요청하면 디스크를 읽지 않고 캐시에서 반환한다.

```sql
-- Buffer Cache 히트율 확인 (99% 이상이 목표)
SELECT 1 - (physical_reads /
            (db_block_gets + consistent_gets)) AS hit_ratio
FROM v$buffer_pool_statistics;

-- Buffer Cache 크기 확인
SELECT pool, name, bytes/1024/1024 AS mb
FROM v$sgastat
WHERE name = 'buffer_cache';
```

히트율이 낮으면 `db_cache_size` 또는 `sga_target`을 늘린다.

### 2. Shared Pool

SQL·PL/SQL의 **파싱 결과(Library Cache)**와 **딕셔너리 정보(Dictionary Cache)**를 저장한다. Shared Pool이 크면 더 많은 SQL 커서를 캐시해 반복 파싱(Hard Parse)을 피할 수 있다.

![Shared Pool과 Soft Parse](/assets/posts/oracle-memory-sga-pga-uga-shared-pool.svg)

**Hard Parse**: SQL 텍스트가 매번 다르면 Library Cache 미스 → 매번 파싱·최적화 수행 → CPU 낭비 + Shared Pool 소진.  
**Soft Parse**: 바인드 변수로 SQL 텍스트를 동일하게 유지하면 캐시된 커서 재사용 → 파싱 생략.

```sql
-- Hard Parse 비율 확인
SELECT name, value
FROM v$sysstat
WHERE name IN ('parse count (hard)', 'parse count (total)');

-- Hard parse / total parse × 100 이 5% 넘으면 바인드 변수 점검
```

### 3. Redo Log Buffer

변경 내역(Redo Vector)을 LGWR 프로세스가 Redo Log 파일에 쓰기 전까지 임시 보관한다. 크기를 무조건 크게 키울 필요는 없다. LGWR이 3초마다 또는 1/3 차면 자동으로 플러시한다.

```sql
SELECT name, bytes FROM v$sgastat
WHERE name = 'log_buffer';
```

---

## PGA (Program Global Area)

PGA는 각 **서버 프로세스**(또는 백그라운드 프로세스)에 **독립적으로** 할당된다. 공유되지 않아 다른 세션이 볼 수 없다.

### 주요 구성

- **Sort Area**: `ORDER BY`, `GROUP BY`, 해시 조인 등 정렬·집계 작업 메모리
- **Hash Join Area**: 해시 조인 빌드 단계 메모리
- **Bitmap Merge Area**: 비트맵 인덱스 병합

PGA가 부족하면 작업이 임시 테이블스페이스(temp)로 Spill된다.

```sql
-- 세션별 PGA 사용량
SELECT s.sid, s.username, p.pga_alloc_mem/1024/1024 AS pga_mb
FROM v$session s JOIN v$process p ON s.paddr = p.addr
ORDER BY p.pga_alloc_mem DESC;
```

### UGA (User Global Area)

UGA는 **세션 상태**(커서, 패키지 변수 등)를 저장한다. 전용 서버 모드에서는 PGA 안에, 공유 서버 모드에서는 SGA의 Large Pool 안에 위치한다.

---

## 자동 메모리 관리

Oracle 10g부터 메모리 크기를 수동으로 조정하지 않아도 된다.

```sql
-- ASMM (Automatic Shared Memory Management)
-- SGA 내부 구성 요소 자동 조정
ALTER SYSTEM SET sga_target = 4G SCOPE = BOTH;

-- AMM (Automatic Memory Management, 11g+)
-- SGA + PGA 전체를 하나의 목표값으로 관리
ALTER SYSTEM SET memory_target  = 8G SCOPE = SPFILE;
ALTER SYSTEM SET memory_max_target = 8G SCOPE = SPFILE;
```

`memory_target`을 설정하면 Oracle이 SGA와 PGA 사이에서 메모리를 자동으로 재분배한다.

---

## 메모리 크기 튜닝 기준

| 컴포넌트 | 튜닝 지표 | 해결 방향 |
|----------|----------|-----------|
| Buffer Cache | 히트율 < 99% | `db_cache_size` 증가 |
| Shared Pool | Hard Parse > 5% | 바인드 변수 강제, `shared_pool_size` 증가 |
| PGA | Temp 사용 급증 | `pga_aggregate_target` 증가 |

---

**지난 글:** [Oracle 인스턴스와 데이터베이스](/posts/oracle-instance-vs-database/)

**다음 글:** [Oracle 백그라운드 프로세스](/posts/oracle-background-processes/)

<br>
읽어주셔서 감사합니다. 😊
