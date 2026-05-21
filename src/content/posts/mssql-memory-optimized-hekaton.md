---
title: "SQL Server In-Memory OLTP — Hekaton 메모리 최적화 테이블"
description: "SQL Server In-Memory OLTP(Hekaton)의 메모리 최적화 테이블 구조, 해시/범위 인덱스 선택, 네이티브 컴파일 저장 프로시저, 내구성 옵션과 한계를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "InMemoryOLTP", "Hekaton", "메모리최적화", "네이티브컴파일", "고성능"]
featured: false
draft: false
---

[지난 글](/posts/mssql-columnstore-index/)에서 분석 쿼리를 위한 컬럼스토어 인덱스를 다뤘다. 이번에는 OLTP 트랜잭션을 극한으로 가속하는 **In-Memory OLTP(코드명 Hekaton)** — SQL Server 2014에서 도입된 메모리 최적화 테이블과 네이티브 컴파일 저장 프로시저를 살펴본다.

## In-Memory OLTP란

기존 SQL Server 테이블은 디스크 기반이다. 데이터를 읽으려면 버퍼 풀에서 페이지를 찾고, 없으면 디스크에서 읽어온다. 락 관리, 래치 경합, 로그 플러시 모두 성능 병목이 된다.

**메모리 최적화 테이블(Memory-Optimized Table)**은 모든 데이터 행이 **메모리에 상주**한다. 락이 없는 낙관적 MVCC, 래치 없는 인덱스, 선택적 영속화로 단건 OLTP 트랜잭션을 **10~30배** 빠르게 처리한다.

```sql
-- 메모리 최적화 파일 그룹 추가 (먼저 필요)
ALTER DATABASE AdventureWorks
    ADD FILEGROUP mo_fg CONTAINS MEMORY_OPTIMIZED_DATA;

ALTER DATABASE AdventureWorks
    ADD FILE (NAME='mo_data', FILENAME='C:\Data\mo_data')
    TO FILEGROUP mo_fg;
```

![Hekaton In-Memory OLTP 아키텍처](/assets/posts/mssql-hekaton-architecture.svg)

## 메모리 최적화 테이블 생성

```sql
-- 세션 캐시 테이블 예시
CREATE TABLE dbo.hot_sessions (
    session_id   NVARCHAR(64)   NOT NULL
                 CONSTRAINT pk_session PRIMARY KEY NONCLUSTERED
                 HASH WITH (BUCKET_COUNT = 262144),
    user_id      INT            NOT NULL,
    data         NVARCHAR(4000),
    created_at   DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    expires_at   DATETIME2      NOT NULL,
    INDEX ix_expires NONCLUSTERED (expires_at)
)
WITH (
    MEMORY_OPTIMIZED = ON,
    DURABILITY = SCHEMA_AND_DATA  -- 재시작 후 데이터 복원
);
```

`DURABILITY = SCHEMA_ONLY`로 설정하면 재시작 시 데이터를 복원하지 않아 더 빠르지만, 서버 재시작 후 데이터가 사라진다. 임시 저장소나 캐시 용도에 적합하다.

## 인덱스 유형: 해시 vs 범위

![메모리 최적화 테이블 인덱스 유형](/assets/posts/mssql-hekaton-indexes.svg)

**해시 인덱스**는 동등 조회(`=`)에 특화된다. `BUCKET_COUNT`를 예상 행 수의 1~2배로 설정한다. 너무 작으면 충돌 체인이 길어져 성능이 저하되고, 너무 크면 메모리를 낭비한다.

**범위 인덱스(Bw-Tree)**는 범위 조회, ORDER BY를 지원한다. 래치 없는 Bw-Tree(Buzzword-Tree) 자료구조로 동시 쓰기 충돌 없이 동작한다.

```sql
-- BUCKET_COUNT 적정 값 확인 (생성 후)
SELECT i.name,
       hs.total_bucket_count,
       hs.empty_bucket_count,
       hs.avg_chain_length,
       hs.max_chain_length
FROM   sys.dm_db_xtp_hash_index_stats hs
JOIN   sys.indexes i ON i.object_id = hs.object_id
                     AND i.index_id  = hs.index_id
WHERE  hs.object_id = OBJECT_ID('hot_sessions');

-- avg_chain_length > 5 → BUCKET_COUNT 늘리기
-- empty_bucket_count > 50% → BUCKET_COUNT 줄이기
```

## 네이티브 컴파일 저장 프로시저

일반 T-SQL 저장 프로시저는 실행 시 SQL 파서, 최적화, 인터프리터를 거친다. **네이티브 컴파일 저장 프로시저**는 `WITH NATIVE_COMPILATION` 옵션으로 **처음 생성 시 C 코드로 컴파일되어 DLL로 로드**된다. 실행 시 SQL 엔진을 우회해 추가 5~10배의 성능을 얻는다.

```sql
CREATE PROCEDURE dbo.upsert_session
    @session_id   NVARCHAR(64),
    @user_id      INT,
    @data         NVARCHAR(4000),
    @expires_at   DATETIME2
WITH
    NATIVE_COMPILATION,
    SCHEMABINDING  -- 네이티브 컴파일 필수 옵션
AS
BEGIN ATOMIC WITH (
    TRANSACTION ISOLATION LEVEL = SNAPSHOT,
    LANGUAGE = N'Korean'
)
    -- 메모리 최적화 테이블만 접근 가능
    UPDATE dbo.hot_sessions
    SET    user_id    = @user_id,
           data       = @data,
           expires_at = @expires_at
    WHERE  session_id = @session_id;

    IF @@ROWCOUNT = 0
        INSERT INTO dbo.hot_sessions
            (session_id, user_id, data, expires_at)
        VALUES
            (@session_id, @user_id, @data, @expires_at);
END;
```

`BEGIN ATOMIC`은 네이티브 컴파일 SP의 고유 블록으로, `TRANSACTION ISOLATION LEVEL`을 명시해야 한다. 내부 오류 시 자동 롤백한다.

## 한계와 주의사항

In-Memory OLTP는 강력하지만 제약이 있다.

| 항목 | 제한 |
|------|------|
| 스키마 변경 | 테이블 삭제 후 재생성 (일부 ALTER 지원) |
| 외래 키 | 미지원 (애플리케이션 수준 보장) |
| 트리거 | 미지원 |
| 최대 행 크기 | ~8060바이트 |
| 지원 데이터 타입 | BLOB/XML 등 일부 미지원 |
| 복구 시간 | 대용량 메모리 로드 시간 증가 |

```sql
-- 메모리 사용량 모니터링
SELECT type,
       pages_kb / 1024.0 AS mb_used
FROM   sys.dm_os_memory_clerks
WHERE  type LIKE 'MEMORYCLERK_XTP%'
ORDER  BY pages_kb DESC;

-- 만료된 세션 정리 (배치 작업)
DELETE TOP(1000) FROM dbo.hot_sessions
WHERE  expires_at < SYSUTCDATETIME();
```

In-Memory OLTP는 **초당 수만 건의 단건 트랜잭션**이 발생하는 세션 관리, 임시 데이터, 고빈도 큐 처리에 탁월하다. 복잡한 JOIN·집계가 많은 쿼리에는 효과가 제한적이므로, 프로파일링으로 병목을 먼저 확인하고 적용해야 한다.

---

**지난 글:** [SQL Server 컬럼스토어 인덱스 — OLAP 성능의 핵심](/posts/mssql-columnstore-index/)

**다음 글:** [SQL Server 카디널리티 추정기 — 실행 계획 품질의 핵심](/posts/mssql-cardinality-estimator/)

<br>
읽어주셔서 감사합니다. 😊
