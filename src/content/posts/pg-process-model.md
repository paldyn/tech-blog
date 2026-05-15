---
title: "PostgreSQL 프로세스 모델"
description: "PostgreSQL의 멀티프로세스 설계를 깊이 파고듭니다. Backend Process의 로컬 메모리(work_mem, maintenance_work_mem, temp_buffers)와 Shared Memory의 역할, 연결당 메모리 비용, 그리고 pg_stat_activity로 프로세스를 모니터링하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["postgresql", "process-model", "backend-process", "work-mem", "shared-buffers", "local-memory", "pg_stat_activity", "fork", "connection-overhead", "maintenance_work_mem"]
featured: false
draft: false
---

[지난 글](/posts/pg-architecture-overview/)에서 PostgreSQL의 전체 아키텍처를 개관했다. 이번에는 **프로세스 모델**을 더 깊이 파고든다. 특히 연결 하나가 얼마나 많은 메모리를 사용하는지, 그리고 메모리 파라미터를 어떻게 설계해야 하는지가 핵심이다.

## fork() 기반 프로세스 생성

클라이언트가 PostgreSQL에 접속하면 다음 순서가 발생한다.

1. 클라이언트가 TCP 5432 포트로 연결 요청
2. Postmaster가 요청을 받아 `fork()` 시스템 콜로 자신을 복사
3. 새로 생성된 **Backend Process**가 클라이언트와 1:1로 통신
4. 클라이언트가 연결을 끊으면 Backend Process도 종료

이 방식은 **Copy-on-Write(CoW)** 덕분에 초기 메모리 복사 비용이 낮다. 그러나 연결이 늘어날수록 OS 프로세스가 증가해 Context Switching 비용이 높아진다. `max_connections`의 기본값이 100인 이유다.

## 메모리 영역의 두 종류

![PostgreSQL 프로세스 모델 — 메모리 구조](/assets/posts/pg-process-model-diagram.svg)

### 공유 메모리 (Shared Memory)

모든 Backend Process가 공유하는 영역이다. 크기는 서버 기동 시 결정되어 실행 중 변경할 수 없다.

- **Shared Buffers**: 테이블·인덱스 페이지의 캐시. 자주 접근하는 페이지를 메모리에 유지해 디스크 I/O를 줄인다.
- **WAL Buffers**: WAL 레코드를 디스크에 쓰기 전 임시 저장.
- **Lock Table**: 행·테이블·Advisory Lock 정보.
- **Proc Array**: 모든 Backend의 트랜잭션 상태. MVCC의 Snapshot 계산에 사용.

### 로컬 메모리 (Local Memory)

각 Backend Process가 독점적으로 사용하는 메모리다. 연결당 독립적으로 할당된다.

| 파라미터 | 용도 | 기본값 |
|---|---|---|
| `work_mem` | 정렬, 해시 조인, Bitmap Index Scan 등 | 4MB |
| `maintenance_work_mem` | VACUUM, ANALYZE, CREATE INDEX | 64MB |
| `temp_buffers` | 임시 테이블 캐시 | 8MB |

```sql
-- 현재 메모리 파라미터 조회
SELECT name, setting, unit, source
FROM   pg_settings
WHERE  name IN ('shared_buffers', 'work_mem',
                'maintenance_work_mem', 'effective_cache_size');

-- 실행 계획 기반 work_mem 튜닝 (세션 단위)
SET work_mem = '256MB';
EXPLAIN ANALYZE SELECT * FROM orders ORDER BY amount DESC;
RESET work_mem;
```

## work_mem의 함정 — 병렬 쿼리와 곱셈 효과

`work_mem`은 **쿼리 하나당** 이 금액이 아니라 **노드 하나당** 이 금액이다. 복잡한 쿼리는 여러 정렬/해시 노드를 가질 수 있고, 병렬 작업자(`max_parallel_workers_per_gather`)가 추가되면 실제 소비는:

```
실제 work_mem 소비 ≈ work_mem × 노드 수 × 병렬 작업자 수
```

연결 100개에서 각각 256MB를 쓰면 25GB가 된다. **`work_mem`은 충분히 작게(4-16MB)** 유지하고, 필요한 쿼리에서만 `SET work_mem`으로 세션 단위로 올리는 전략이 안전하다.

![프로세스 · 메모리 모니터링 SQL](/assets/posts/pg-process-model-sql.svg)

## 연결당 오버헤드

새 Backend Process 하나가 시작할 때 소비하는 메모리는 대략 10MB 수준이다. `max_connections = 500`으로 설정하면 연결만으로 5GB가 예약된다. 여기에 `work_mem`이 더해지므로 **커넥션 풀러(PgBouncer)** 를 도입해 실제 Backend 수를 줄이는 것이 운영의 핵심이다.

```bash
# PgBouncer 예시 (외부 풀러)
# 클라이언트 1000개 → PgBouncer → PostgreSQL 50개 연결
# transaction pooling 모드 권장
```

## pg_stat_activity로 프로세스 모니터링

```sql
-- 상태별 연결 수
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;

-- 오래 실행 중인 쿼리 (10분 이상)
SELECT pid, now() - query_start AS duration,
       state, query
FROM   pg_stat_activity
WHERE  state != 'idle'
  AND  query_start < now() - INTERVAL '10 minutes'
ORDER  BY duration DESC;

-- 특정 프로세스 취소 (쿼리만 취소, 연결 유지)
SELECT pg_cancel_backend(pid)
FROM   pg_stat_activity
WHERE  pid = 12345;

-- 연결 자체 강제 종료
SELECT pg_terminate_backend(12345);
```

## max_connections 설계

```
max_connections 공식 (경험칙):
  여유 RAM(GB) × 100 / (work_mem MB)

예: 32GB RAM, work_mem=4MB
  => (32 × 1024 - shared_buffers 8192) MB ÷ 4MB ÷ 10(여유) ≈ 600
  → max_connections = 200 (PgBouncer로 나머지 처리)
```

실제로는 `shared_buffers`를 전체 RAM의 25%, `effective_cache_size`를 75%로 설정하고, `work_mem`은 OLTP에서 4-16MB, 분석 쿼리는 256MB 이상으로 세션별 조정하는 패턴이 일반적이다.

## 정리

PostgreSQL의 프로세스 모델은 단순하지만 연결 수와 메모리 설계를 잘못하면 OOM이 발생한다. 핵심 원칙은 두 가지다. 첫째, `max_connections`를 작게 유지하고 커넥션 풀러를 사용한다. 둘째, `work_mem`은 기본값을 낮게 두고 필요할 때만 세션 단위로 올린다.

---

**지난 글:** [PostgreSQL 아키텍처 개요](/posts/pg-architecture-overview/)

**다음 글:** [Shared Buffers와 work_mem — PostgreSQL 메모리 심화](/posts/pg-memory-shared-buffers-work-mem/)

<br>
읽어주셔서 감사합니다. 😊
