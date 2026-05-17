---
title: "MySQL Invisible Index — 안전한 인덱스 비활성화와 삭제 전략"
description: "MySQL 8.0에서 도입된 Invisible Index로 인덱스를 옵티마이저에서 제외하면서 구조는 유지하는 방법, DROP INDEX와의 차이, 안전한 인덱스 정리 절차를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 28
type: "knowledge"
category: "SQL"
tags: ["mysql", "invisible-index", "index-management", "optimizer", "인덱스관리", "mysql8"]
featured: false
draft: false
---

[지난 글](/posts/mysql-icp-index-condition-pushdown/)에서 Index Condition Pushdown이 스토리지 엔진 레벨 필터링을 통해 I/O를 줄이는 방법을 살펴봤습니다. 이번 글에서는 MySQL 8.0에서 도입된 **Invisible Index** 기능과 안전한 인덱스 관리 전략을 다룹니다.

## 인덱스를 함부로 삭제하면 안 되는 이유

인덱스가 많아지면 쓰기 성능이 저하됩니다. 불필요해 보이는 인덱스를 삭제하고 싶지만, 그 인덱스가 실제로 어떤 쿼리에서 사용되는지 확인하기 어렵습니다. DROP INDEX를 실행한 뒤 특정 쿼리가 Full Scan으로 바뀌어 성능이 급락하면 인덱스를 다시 생성해야 하는데, 대형 테이블에서 인덱스 재빌드는 오래 걸립니다.

MySQL 8.0은 이 문제를 **Invisible Index**로 해결합니다. 인덱스를 옵티마이저에서 보이지 않게(invisible) 만들어 실제로 사용되지 않는 상태를 테스트한 뒤, 문제가 없으면 DROP하는 두 단계 접근입니다.

## Invisible Index 동작 원리

Invisible 상태의 인덱스는 다음 두 가지 특성을 갖습니다.

- **데이터 동기화는 계속**: INSERT/UPDATE/DELETE 시 인덱스 업데이트가 정상적으로 이루어집니다. 쓰기 오버헤드는 그대로 존재합니다.
- **옵티마이저 무시**: 쿼리 플랜 생성 시 이 인덱스는 후보에서 제외됩니다. `EXPLAIN`에서 보이지 않습니다.

![Invisible Index 안전한 인덱스 비활성화 절차](/assets/posts/mysql-invisible-index-workflow.svg)

```sql
-- Invisible로 전환
ALTER TABLE orders ALTER INDEX idx_old_col INVISIBLE;

-- Visible로 복원 (즉시)
ALTER TABLE orders ALTER INDEX idx_old_col VISIBLE;

-- 인덱스 생성 시부터 invisible
CREATE INDEX idx_test ON orders (col) INVISIBLE;
```

## DROP INDEX와 비교

![Invisible Index vs DROP INDEX 비교](/assets/posts/mysql-invisible-index-compare.svg)

인덱스를 처음부터 invisible로 생성하면 쿼리 플랜에 영향을 주지 않고 인덱스 효과를 테스트할 수도 있습니다.

```sql
-- 새 인덱스를 invisible로 먼저 생성 (운영에 영향 없음)
CREATE INDEX idx_new ON orders (status, created_at) INVISIBLE;

-- 특정 세션에서만 이 인덱스 강제 사용 (테스트)
SET optimizer_switch = 'use_invisible_indexes=on';
EXPLAIN SELECT * FROM orders WHERE status = 'active' ORDER BY created_at;
-- → idx_new가 선택되는지 확인

SET optimizer_switch = 'use_invisible_indexes=off';  -- 원복

-- 효과 확인 후 visible 전환
ALTER TABLE orders ALTER INDEX idx_new VISIBLE;
```

## 사용하지 않는 인덱스 식별

```sql
-- 인덱스 사용 통계 (performance_schema)
SELECT
  OBJECT_NAME   AS table_name,
  INDEX_NAME,
  COUNT_READ,
  COUNT_WRITE,
  COUNT_FETCH
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE OBJECT_SCHEMA = 'mydb'
  AND INDEX_NAME IS NOT NULL
  AND INDEX_NAME != 'PRIMARY'
ORDER BY COUNT_FETCH ASC;
-- COUNT_FETCH=0 → 조회 시 한 번도 사용되지 않은 인덱스

-- sys 스키마 활용 (8.0+)
SELECT * FROM sys.schema_unused_indexes
WHERE object_schema = 'mydb';
```

`COUNT_FETCH`가 0이더라도 배치 작업, 월별 리포트 등 드물게 실행되는 쿼리에서 사용될 수 있으므로, **충분한 기간(최소 한 달 이상)** 모니터링 후 결정하는 것이 ���전합니다.

## 안전한 인덱스 정리 절차

```sql
-- 1. 사용 통계로 후보 선정
SELECT index_name FROM sys.schema_unused_indexes
WHERE object_schema = 'mydb' AND object_name = 'orders';

-- 2. INVISIBLE 전환
ALTER TABLE orders ALTER INDEX idx_candidate INVISIBLE;

-- 3. 슬로우 쿼리 로그 및 성능 모니터링 (1~4주)
-- slow_query_log = ON, long_query_time = 1

-- 4a. 문제 없으면 최종 삭제
ALTER TABLE orders DROP INDEX idx_candidate;

-- 4b. 성능 저하 발생 시 즉시 복원
ALTER TABLE orders ALTER INDEX idx_candidate VISIBLE;
```

## PRIMARY KEY와 Unique Index

PRIMARY KEY는 invisible로 만들 수 없습니다. Unique Index는 invisible로 만들 수 있지만, 유니크 제약 자체는 여전히 적용됩니다. 제약을 해제하려면 인덱스를 DROP해야 합니다.

```sql
-- PK는 invisible 불가 (오류)
ALTER TABLE t ALTER INDEX PRIMARY INVISIBLE;
-- ERROR 3522 (HY000): A primary key index cannot be invisible.

-- Unique Index: invisible 가능하지만 제약은 유지
ALTER TABLE t ALTER INDEX uq_email INVISIBLE;
INSERT INTO t (email) VALUES ('a@b.com');  -- 중복 시 여전히 오류
```

Invisible Index는 운영 환경에서 인덱스 변경의 위험을 줄이는 실용적인 도구입니다. 인덱스 정리 작업을 할 때 DROP 전에 반드시 Invisible 단계를 거치는 습관을 들이면, 예상치 못한 성능 저하를 피할 수 있습니다.

---

**지난 글:** [MySQL Index Condition Pushdown — 스토리지 엔진 레벨 필터링](/posts/mysql-icp-index-condition-pushdown/)

**다음 글:** [MySQL Functional Index — 표현식 기반 인덱스](/posts/mysql-functional-index/)

<br>
읽어주셔서 감사합니다. 😊
