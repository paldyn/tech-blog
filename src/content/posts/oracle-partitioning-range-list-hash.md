---
title: "Oracle 파티셔닝: Range·List·Hash"
description: "Oracle 파티셔닝의 세 가지 기본 유형인 Range, List, Hash의 동작 원리와 파티션 프루닝 메커니즘, 복합 파티셔닝 전략을 실무 DDL 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["oracle", "partitioning", "range-partition", "list-partition", "hash-partition", "partition-pruning", "composite-partition", "performance"]
featured: false
draft: false
---

[지난 글](/posts/plsql-bulk-collect-forall/)에서 BULK COLLECT와 FORALL로 대량 데이터를 효율적으로 처리하는 법을 살펴봤다. 이번에는 테이블 자체를 물리적으로 나누는 **파티셔닝(Partitioning)**을 다룬다. Oracle에서 파티셔닝은 대용량 테이블의 성능·관리성·가용성을 동시에 해결하는 핵심 기법이다.

## 파티셔닝이 필요한 이유

수억 건의 주문 테이블에서 지난달 데이터만 조회한다고 가정하자. 인덱스가 있어도 옵티마이저가 Full Table Scan을 선택하는 경우가 있다. 파티셔닝을 적용하면 "지난달" 파티션만 스캔하면 되므로 디스크 I/O 자체가 줄어든다. 게다가 오래된 파티션을 DROP하면 DELETE 수백만 건 없이 즉시 공간을 회수한다.

![Oracle 파티셔닝 유형 비교: Range·List·Hash](/assets/posts/oracle-partitioning-range-list-hash-types.svg)

## Range 파티셔닝

가장 흔한 유형이다. 파티션 키의 연속된 범위로 행을 나눈다. 날짜·숫자 컬럼에 적합하다.

```sql
CREATE TABLE sales (
  sale_id  NUMBER,
  sale_dt  DATE     NOT NULL,
  amount   NUMBER(15,2)
)
PARTITION BY RANGE (sale_dt) (
  PARTITION p2024q1
    VALUES LESS THAN (DATE '2024-04-01'),
  PARTITION p2024q2
    VALUES LESS THAN (DATE '2024-07-01'),
  PARTITION p2024q3
    VALUES LESS THAN (DATE '2024-10-01'),
  PARTITION p2024q4
    VALUES LESS THAN (DATE '2025-01-01'),
  PARTITION p_max
    VALUES LESS THAN (MAXVALUE)
);
```

`VALUES LESS THAN (MAXVALUE)`는 정의된 범위에 속하지 않는 행을 받아내는 "overflow" 파티션이다. 이 파티션이 없으면 범위 밖 행 INSERT 시 에러가 발생한다. 단, Interval 파티셔닝(다음 글)을 쓰면 이 걱정이 사라진다.

## 파티션 프루닝

파티셔닝의 핵심 성능 이점은 **파티션 프루닝(Partition Pruning)**에 있다. WHERE 절의 파티션 키 조건을 CBO가 분석해, 해당 범위에 없는 파티션은 아예 접근하지 않는다.

![파티션 프루닝과 DDL 구문](/assets/posts/oracle-partitioning-range-list-hash-pruning.svg)

```sql
-- 실행 계획에서 Pstart/Pstop으로 프루닝 확인
EXPLAIN PLAN FOR
  SELECT SUM(amount)
  FROM   sales
  WHERE  sale_dt >= DATE '2024-01-01'
    AND  sale_dt <  DATE '2024-04-01';

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
-- PARTITION RANGE SINGLE | Pstart=1 Pstop=1
```

`Pstart=Pstop=1`이면 파티션 하나만 스캔했다는 뜻이다. 프루닝이 되려면 조건이 **정적(리터럴이나 바인드 변수)**이거나 **실행 시점 결정 가능**해야 한다. 함수로 파티션 키를 감싸면 프루닝이 깨진다.

```sql
-- 프루닝 안 됨: 함수로 감쌈
WHERE TRUNC(sale_dt, 'MM') = DATE '2024-01-01'

-- 프루닝 됨: 직접 비교
WHERE sale_dt >= DATE '2024-01-01'
  AND sale_dt <  DATE '2024-02-01'
```

## List 파티셔닝

이산 값 목록으로 파티션을 나눈다. 지역 코드, 상태 값, 카테고리처럼 범위가 아닌 "이 값이면 이 파티션"인 경우에 사용한다.

```sql
CREATE TABLE orders (
  order_id   NUMBER,
  region_cd  VARCHAR2(10),
  order_dt   DATE,
  amount     NUMBER
)
PARTITION BY LIST (region_cd) (
  PARTITION p_capital VALUES ('SEO', 'GGI', 'ICN'),
  PARTITION p_chungcheong VALUES ('DCN', 'CCB', 'CCN'),
  PARTITION p_honam VALUES ('GJU', 'JNB', 'JNN'),
  PARTITION p_yeongnam VALUES ('PUS', 'DGU', 'GBB', 'GBN'),
  PARTITION p_others VALUES (DEFAULT)
);
```

`DEFAULT` 파티션은 어느 목록에도 속하지 않는 값을 받는다. `DEFAULT` 없이 목록에 없는 값을 INSERT하면 에러가 난다.

## Hash 파티셔닝

파티션 키의 해시값으로 행을 균등하게 분산한다. 핫스팟 없이 I/O를 여러 디스크에 퍼뜨리는 것이 목적이다. 파티션 수는 반드시 **2의 거듭제곱(2, 4, 8, 16…)**을 권장한다. Oracle 내부 해시 함수 특성상 균등 분포가 보장된다.

```sql
CREATE TABLE customers (
  cust_id    NUMBER,
  cust_name  VARCHAR2(100),
  join_dt    DATE
)
PARTITION BY HASH (cust_id)
PARTITIONS 8
STORE IN (tbs01, tbs02, tbs03, tbs04,
          tbs05, tbs06, tbs07, tbs08);
```

`STORE IN`으로 파티션별 테이블스페이스를 지정하면 물리적 I/O 분산이 실제로 이루어진다. 특정 `cust_id`로 조회하면 한 파티션만 접근하므로 조인 성능도 향상된다(Hash Partition-Wise Join).

## 복합 파티셔닝 (Composite)

두 레벨을 조합한다. 현업에서 가장 자주 보는 패턴은 **Range-Hash**와 **Range-List**다.

```sql
-- Range-Hash: 날짜로 Range, 고객ID로 Hash 분산
CREATE TABLE orders (
  order_id  NUMBER,
  order_dt  DATE,
  cust_id   NUMBER,
  amount    NUMBER
)
PARTITION BY RANGE (order_dt)
SUBPARTITION BY HASH (cust_id)
SUBPARTITIONS 4 (
  PARTITION p2024
    VALUES LESS THAN (DATE '2025-01-01'),
  PARTITION p2025
    VALUES LESS THAN (DATE '2026-01-01')
);
```

Range로 오래된 파티션을 DROP(이력 관리)하고, 내부를 Hash로 분산(I/O 균등)하는 두 마리 토끼를 잡는다.

## 로컬 인덱스 vs 글로벌 인덱스

파티션 테이블의 인덱스는 두 종류다.

| 종류 | 특성 | DROP PARTITION 시 |
|---|---|---|
| 로컬 인덱스 | 파티션과 1:1 대응 | 자동 처리 (인덱스 손상 없음) |
| 글로벌 인덱스 | 파티션 경계 무관 | UNUSABLE → 재생성 또는 UPDATE GLOBAL INDEXES |

```sql
-- 로컬 인덱스 (파티션과 동일 구조)
CREATE INDEX idx_sales_local
  ON sales (sale_dt)
  LOCAL;

-- 글로벌 인덱스 (Range 파티션, 테이블과 무관)
CREATE INDEX idx_sales_global
  ON sales (sale_id)
  GLOBAL PARTITION BY RANGE (sale_id)
  (PARTITION p1 VALUES LESS THAN (1000000),
   PARTITION p2 VALUES LESS THAN (MAXVALUE));
```

이력 파티션을 자주 DROP한다면 로컬 인덱스를 선택하는 것이 관리 부담을 줄인다.

## 파티션 관리 DDL

```sql
-- 파티션 추가
ALTER TABLE sales ADD PARTITION p2025q1
  VALUES LESS THAN (DATE '2025-04-01');

-- 파티션 삭제 (데이터 포함)
ALTER TABLE sales DROP PARTITION p2024q1;

-- 파티션 이동 (테이블스페이스 변경)
ALTER TABLE sales MOVE PARTITION p2024q2
  TABLESPACE tbs_archive;

-- 파티션 분할
ALTER TABLE sales SPLIT PARTITION p_max
  AT (DATE '2026-01-01')
  INTO (PARTITION p2025, PARTITION p_max);
```

## 정리

- **Range**: 시계열 데이터, 파티션 DROP으로 이력 삭제, Interval 파티셔닝으로 자동화
- **List**: 이산 코드값, DEFAULT 파티션 필수, 신규 코드 추가 시 파티션 관리 필요
- **Hash**: 핫스팟 방지, I/O 분산, 파티션 수 = 2의 거듭제곱
- **프루닝**: 파티션 키에 함수 금지, 정적 조건 유지
- **로컬 인덱스**: 파티션 DROP 시 자동 정리, 이력 관리 테이블에 권장

---

**지난 글:** [BULK COLLECT와 FORALL](/posts/plsql-bulk-collect-forall/)

**다음 글:** [Oracle Interval 파티셔닝](/posts/oracle-interval-partitioning/)

<br>
읽어주셔서 감사합니다. 😊
