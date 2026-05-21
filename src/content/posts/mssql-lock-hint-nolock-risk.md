---
title: "NOLOCK 힌트의 위험성 — SQL Server 락 힌트 가이드"
description: "WITH (NOLOCK) 힌트가 더티 리드·팬텀 행·중복 행을 유발하는 이유와 올바른 대안(RCSI, SNAPSHOT), 그리고 UPDLOCK·READPAST 등 유용한 락 힌트를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "NOLOCK", "락힌트", "더티리드", "동시성", "RCSI", "UPDLOCK"]
featured: false
draft: false
---

[지난 글](/posts/mssql-isolation-snapshot-rcsi/)에서 RCSI와 SNAPSHOT 격리로 락 없이 일관된 읽기를 보장하는 방법을 살펴봤다. 이번에는 성능을 위해 락을 우회하려다 잘못된 데이터를 읽는 함정 — **WITH (NOLOCK)** — 과 올바른 대안을 다룬다.

## NOLOCK이 인기 있는 이유

SQL Server를 처음 접한 개발자나 DBA가 느리거나 대기가 발생하는 쿼리를 발견하면 흔히 다음처럼 고칩니다.

```sql
-- "락 때문에 느려요. NOLOCK 달면 빨라지지 않나요?"
SELECT *
FROM   orders WITH (NOLOCK)
WHERE  order_date >= '2026-01-01';
```

실제로 빨라지는 경우가 있다. 다른 트랜잭션의 배타 락을 기다리지 않으므로 즉시 반환된다. 하지만 이 속도는 **정확성을 희생한 속도**다.

## NOLOCK이 유발하는 3가지 문제

![NOLOCK 더티 리드 발생 시나리오](/assets/posts/mssql-nolock-dirty-read.svg)

**1. 더티 리드(Dirty Read)** — 아직 커밋되지 않은, 결국 롤백될 수도 있는 데이터를 읽는다. 금융 금액, 재고 수량 같은 민감한 데이터에서 완전히 잘못된 값이 반환될 수 있다.

**2. 팬텀 행(Phantom Row)** — 페이지 분할 중에 조회하면 같은 행이 두 번 나타나거나 아예 빠지는 현상이 발생한다. B-Tree 페이지 이동 중에 읽기가 겹치면 발생한다.

**3. 누락 행(Missing Row)** — 팬텀의 반대. 존재하는 행인데 페이지 이동 타이밍에 조회하면 결과에 포함되지 않는다.

더티 리드는 개념적으로 알려진 문제지만, 팬텀과 누락은 NOLOCK 사용 중 실제로 발생한다는 사실이 SQL Server 내부 문서에도 명시되어 있다.

```sql
-- 이런 쿼리에 NOLOCK이 붙어 있으면 매우 위험하다
SELECT SUM(balance) FROM accounts WITH (NOLOCK);  -- 잘못된 합계
SELECT COUNT(*)     FROM inventory WITH (NOLOCK);  -- 잘못된 재고
```

## 올바른 대안: RCSI

대부분의 NOLOCK 사용은 **락 대기를 피하기 위한** 목적이다. 올바른 해결책은 RCSI를 활성화하는 것이다. 행 버전 기반으로 읽기 트랜잭션이 공유 락을 걸지 않아 대기 없이 일관된 데이터를 읽는다.

```sql
-- 한 번만 실행 (DB 수준 설정)
ALTER DATABASE MyDB
    SET READ_COMMITTED_SNAPSHOT ON;

-- 이후 NOLOCK 없이도 대기 없이 읽힘
SELECT *
FROM   orders
WHERE  order_date >= '2026-01-01';
```

## 유용한 락 힌트들

NOLOCK이 틀렸다고 해서 모든 힌트가 나쁜 건 아니다. 상황에 맞게 쓰면 가치 있는 힌트들이 있다.

![SQL Server 락 힌트 가이드](/assets/posts/mssql-lock-hints-guide.svg)

### UPDLOCK — 데드락 예방

SELECT 시점에 업데이트 락을 미리 잡아 이후 UPDATE 시 발생할 수 있는 데드락을 예방한다.

```sql
BEGIN TRANSACTION;
    -- 업데이트 락으로 읽기 → 다른 트랜잭션의 UPDLOCK 대기
    SELECT @stock = qty
    FROM   inventory WITH (UPDLOCK)
    WHERE  product_id = 1001;

    IF @stock >= 10
        UPDATE inventory SET qty = qty - 10
        WHERE  product_id = 1001;
COMMIT;
```

### READPAST — 큐(Queue) 패턴

잠긴 행을 건너뛰고 잠기지 않은 다음 행을 읽는다. 여러 워커가 동시에 큐 테이블을 처리할 때 유용하다.

```sql
-- 여러 워커가 동시에 실행해도 중복 없이 각자 다른 행 처리
WITH cte AS (
    SELECT TOP 1 *
    FROM   job_queue WITH (UPDLOCK, READPAST)
    WHERE  status = 'PENDING'
    ORDER  BY created_at
)
UPDATE cte SET status = 'PROCESSING'
OUTPUT inserted.*;
```

### HOLDLOCK — 범위 보장이 필요할 때

공유 락을 트랜잭션 끝까지 유지해 팬텀을 막는다. `SERIALIZABLE`과 동일하며, Exists 확인 후 INSERT하는 패턴에서 중복 삽입을 방지한다.

```sql
BEGIN TRANSACTION;
    IF NOT EXISTS (
        SELECT 1 FROM users WITH (HOLDLOCK)
        WHERE  email = 'kim@example.com'
    )
        INSERT INTO users (email) VALUES ('kim@example.com');
COMMIT;
```

## 진단: NOLOCK 찾기

기존 코드베이스에 NOLOCK이 얼마나 퍼져 있는지 확인하는 방법이다.

```sql
-- 현재 실행 중인 쿼리에서 NOLOCK 텍스트 검색
SELECT session_id, text
FROM   sys.dm_exec_sessions s
CROSS  APPLY sys.dm_exec_sql_text(s.most_recent_sql_handle)
WHERE  text LIKE '%NOLOCK%';

-- 저장 프로시저, 뷰, 함수에서 NOLOCK 검색
SELECT OBJECT_NAME(object_id) AS obj_name,
       type_desc,
       OBJECT_DEFINITION(object_id) AS definition
FROM   sys.objects
WHERE  OBJECT_DEFINITION(object_id) LIKE '%NOLOCK%'
  AND  type IN ('P', 'V', 'FN', 'IF', 'TF');
```

---

**지난 글:** [SQL Server 격리 수준 — SNAPSHOT과 RCSI의 이해](/posts/mssql-isolation-snapshot-rcsi/)

**다음 글:** [SQL Server 교착상태 분석 — 데드락 그래프 읽는 법](/posts/mssql-deadlock-graph-analysis/)

<br>
읽어주셔서 감사합니다. 😊
