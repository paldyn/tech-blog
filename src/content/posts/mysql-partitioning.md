---
title: "MySQL 파티셔닝 — 대용량 테이블 분할 전략과 파티션 프루닝"
description: "MySQL 파티셔닝 유형(RANGE, LIST, HASH, KEY)의 원리와 사용 시나리오, 파티션 프루닝 동작 방식, DDL 유지보수, 주의사항을 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["MySQL", "파티셔닝", "RANGE", "LIST", "HASH", "파티션프루닝", "대용량테이블"]
featured: false
draft: false
---

[지난 글](/posts/mysql-binlog-formats/)에서 바이너리 로그 포맷과 PITR 활용을 다뤘다. 대용량 테이블이 쿼리 성능과 유지보수의 병목이 될 때 MySQL 파티셔닝은 효과적인 해결책이 된다. 테이블을 논리적으로는 하나처럼 보이되 물리적으로 여러 조각으로 나눠 특정 조건의 쿼리가 필요한 파티션만 스캔하게 만드는 기법이다.

## 파티셔닝이 필요한 상황

파티셔닝은 모든 테이블에 적합하지 않다. 다음 조건 중 하나 이상이 해당될 때 고려한다.

- 수억 건 이상의 행을 가진 시계열 데이터(주문, 로그, 이벤트)
- 오래된 데이터를 주기적으로 대량 삭제해야 하는 경우
- 파티션 키로 범위를 좁힐 수 있는 쿼리 패턴이 지배적인 경우
- 인덱스가 메모리에 올라가지 않을 만큼 테이블이 비대해진 경우

반대로 파티셔닝은 비파티셔닝 조건의 랜덤 조회나 파티션 키를 사용하지 않는 조인에서는 오히려 오버헤드가 된다.

## 4가지 파티셔닝 유형

![MySQL 파티셔닝 유형](/assets/posts/mysql-partitioning-types.svg)

### RANGE 파티셔닝

가장 많이 쓰이는 유형으로, 컬럼 값이 특정 범위에 속하는 행을 같은 파티션에 저장한다. 날짜나 연도로 분할하는 패턴에 최적이다.

```sql
CREATE TABLE orders (
  id         BIGINT       NOT NULL AUTO_INCREMENT,
  order_year INT          NOT NULL,
  amount     DECIMAL(12,2),
  created_at DATETIME,
  PRIMARY KEY (id, order_year)    -- 파티션 키를 PK에 포함
) ENGINE=InnoDB
PARTITION BY RANGE (order_year) (
  PARTITION p2023 VALUES LESS THAN (2024),
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

`RANGE COLUMNS`를 사용하면 날짜 타입을 직접 지정할 수 있어 YEAR() 함수 없이 DATE 컬럼으로 분할 가능하다.

```sql
PARTITION BY RANGE COLUMNS (created_at) (
  PARTITION p2024 VALUES LESS THAN ('2025-01-01'),
  PARTITION p2025 VALUES LESS THAN ('2026-01-01'),
  PARTITION p_future VALUES LESS THAN (MAXVALUE)
);
```

### LIST 파티셔닝

열거된 특정 값 집합으로 분할한다. 지역 코드, 상태 코드, 카테고리 등 이산적인 값에 적합하다.

```sql
CREATE TABLE sales (
  id      BIGINT       NOT NULL AUTO_INCREMENT,
  region  VARCHAR(10)  NOT NULL,
  amount  DECIMAL(12,2),
  PRIMARY KEY (id, region)
) ENGINE=InnoDB
PARTITION BY LIST COLUMNS (region) (
  PARTITION p_asia     VALUES IN ('KR', 'JP', 'CN', 'SG'),
  PARTITION p_europe   VALUES IN ('DE', 'FR', 'GB', 'NL'),
  PARTITION p_americas VALUES IN ('US', 'CA', 'BR', 'MX')
);
```

목록에 없는 값을 INSERT하면 오류가 발생하므로 항상 모든 가능한 값을 파티션에 포함시키거나 기본 파티션을 두어야 한다.

### HASH & KEY 파티셔닝

데이터를 균등하게 분산시키는 데 쓴다. HASH는 사용자가 정의한 정수 표현식을 MOD 연산으로 나누고, KEY는 MySQL 내장 해시 함수를 사용한다.

```sql
-- HASH: user_id를 4개 파티션에 균등 분산
CREATE TABLE user_activity (
  id      BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  action  VARCHAR(50),
  PRIMARY KEY (id, user_id)
) ENGINE=InnoDB
PARTITION BY HASH (user_id)
PARTITIONS 4;

-- KEY: PK 자동 활용
CREATE TABLE sessions (
  id         BIGINT NOT NULL AUTO_INCREMENT,
  user_id    BIGINT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB
PARTITION BY KEY()
PARTITIONS 8;
```

HASH/KEY 파티셔닝은 특정 범위 쿼리에서 프루닝이 제한적이라 실무에서는 RANGE를 더 많이 쓴다.

## 파티션 프루닝과 EXPLAIN

파티션 프루닝은 쿼리의 WHERE 조건이 파티션 키와 일치할 때 불필요한 파티션을 스캔하지 않는 최적화다.

![파티션 프루닝 & 유지보수](/assets/posts/mysql-partitioning-pruning.svg)

```sql
-- 프루닝 확인: EXPLAIN의 partitions 필드
EXPLAIN
SELECT * FROM orders WHERE order_year = 2025;

-- 결과 예시
-- partitions: p2025
-- type: ALL (파티션 내 전체 스캔이지만 p2025만 대상)

-- 프루닝이 일어나지 않는 경우
EXPLAIN
SELECT * FROM orders WHERE YEAR(created_at) = 2025;
-- YEAR() 함수 래핑으로 파티션 키 식별 실패 → 모든 파티션 스캔
```

프루닝이 일어나려면 파티션 키 컬럼을 그대로 조건에 사용해야 한다. 함수로 감싸거나 계산식을 적용하면 프루닝이 비활성화된다.

## 파티션 유지보수 DDL

파티셔닝의 가장 큰 실용적 이점은 오래된 파티션을 통째로 DROP하는 것이다. `DELETE` 문으로 수억 건을 지우는 것과 달리 파티션 DROP은 파일 시스템 수준에서 즉각 처리된다.

```sql
-- 파티션 목록 확인
SELECT PARTITION_NAME, TABLE_ROWS, DATA_LENGTH
FROM information_schema.PARTITIONS
WHERE TABLE_NAME = 'orders' AND TABLE_SCHEMA = 'mydb';

-- 새 파티션 추가 (MAXVALUE 파티션이 있으면 REORGANIZE 필요)
ALTER TABLE orders
REORGANIZE PARTITION p_future INTO (
  PARTITION p2027 VALUES LESS THAN (2028),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- MAXVALUE가 없을 때 단순 추가
ALTER TABLE orders
ADD PARTITION (
  PARTITION p2027 VALUES LESS THAN (2028)
);

-- 오래된 파티션 즉각 삭제 (DELETE보다 1000배 빠름)
ALTER TABLE orders DROP PARTITION p2022;

-- 파티션 내 데이터 비우기 (구조 유지)
ALTER TABLE orders TRUNCATE PARTITION p2022;

-- 파티션 간 데이터 이동 (익스체인지)
CREATE TABLE orders_archive LIKE orders REMOVE PARTITIONING;
ALTER TABLE orders EXCHANGE PARTITION p2022
  WITH TABLE orders_archive;
```

파티션 EXCHANGE는 아카이브 패턴에 유용하다. 파티션 내 데이터를 비파티션 테이블로 즉각 이동시킨 뒤 아카이브 테이블은 별도 스토리지에 보관할 수 있다.

## 주요 제약 사항

```sql
-- 파티션 키는 PK/유니크 인덱스 컬럼에 포함되어야 함
-- 잘못된 예:
CREATE TABLE t (
  id   INT PRIMARY KEY,
  yr   INT
) PARTITION BY RANGE (yr) (...);
-- ERROR 1503: A PRIMARY KEY must include all columns
--             in the table's partitioning function

-- 올바른 예:
CREATE TABLE t (
  id   INT,
  yr   INT,
  PRIMARY KEY (id, yr)  -- yr 포함
) PARTITION BY RANGE (yr) (...);

-- 외래 키 불가
-- MySQL 파티션 테이블은 FK 제약 지원 안 함
-- FK 무결성은 애플리케이션 레벨에서 처리 필요

-- 전문 검색 인덱스(FULLTEXT) 불가
-- SPATIAL 인덱스 불가
```

파티셔닝은 올바르게 설계하면 대용량 시계열 테이블의 쿼리 성능과 관리 효율을 크게 높인다. 핵심은 쿼리 패턴을 먼저 분석해 파티션 키와 조건이 일치하는지 확인하는 것이다.

---

**지난 글:** [MySQL 바이너리 로그 포맷 — STATEMENT·ROW·MIXED 비교](/posts/mysql-binlog-formats/)

**다음 글:** [MySQL 백업 — mysqldump와 XtraBackup 완전 가이드](/posts/mysql-backup-mysqldump-xtrabackup/)

<br>
읽어주셔서 감사합니다. 😊
