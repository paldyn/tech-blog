---
title: "Oracle 비트맵 인덱스"
description: "Oracle 비트맵 인덱스의 구조, 저카디널리티 컬럼에서의 효율, DW/OLAP 환경에서의 적합성과 OLTP에서의 위험성을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["oracle", "bitmap-index", "index", "dw", "olap", "cardinality", "bitmap-and", "bitmap-or", "oltp-danger", "bitmap-join-index"]
featured: false
draft: false
---

[지난 글](/posts/oracle-btree-index/)에서 Oracle B-Tree 인덱스의 구조와 비용 모델을 살펴봤다. B-Tree는 OLTP에서 빛나지만, **저카디널리티 컬럼 + 복합 조건 집계**가 주를 이루는 DW/OLAP 환경에서는 **비트맵 인덱스**가 탁월하다.

## 비트맵 인덱스 구조

비트맵 인덱스는 인덱스 키(고유 값)별로 **비트 배열(Bitmap)**을 저장한다. 각 비트는 테이블의 한 행에 대응한다.

- **비트 = 1**: 해당 행이 이 키 값을 가짐
- **비트 = 0**: 해당 행이 이 키 값을 가지지 않음

![비트맵 인덱스 구조와 동작](/assets/posts/oracle-bitmap-index-structure.svg)

`status` 컬럼에 PENDING·SHIPPED·DONE 세 값이 있다면, 세 개의 비트맵이 생성된다. `WHERE status = 'PENDING' AND region = 'EAST'` 조건은 두 비트맵의 **비트 AND 연산**으로 해당 행을 즉시 찾는다.

---

## B-Tree vs 비트맵 인덱스 비교

| 비교 항목 | B-Tree 인덱스 | 비트맵 인덱스 |
|-----------|-------------|-------------|
| 적합한 카디널리티 | 고(PK, 유니크) | 저(성별, 지역, 상태) |
| 적합한 환경 | OLTP | DW/OLAP |
| 복합 조건 | 각 인덱스 별도 접근 | 비트 AND/OR 연산 |
| DML 잠금 | 행 수준 | 비트맵 세그먼트 전체 |
| 저장 공간 | 크다 | 매우 작다 (압축 가능) |
| COUNT(*) | 행 읽기 필요 | 비트 카운트만 |

---

## 비트맵 인덱스의 강점: 복합 조건 집계

DW에서 흔한 다차원 조건 집계는 비트맵 인덱스가 압도적이다.

```sql
-- 비트맵 인덱스 생성 (DW 팩트 테이블)
CREATE BITMAP INDEX bidx_sales_status
ON   sales_fact (status);

CREATE BITMAP INDEX bidx_sales_region
ON   sales_fact (region);

CREATE BITMAP INDEX bidx_sales_quarter
ON   sales_fact (quarter);

-- 다차원 집계: 비트 AND 연산으로 처리
SELECT COUNT(*), SUM(amount)
FROM   sales_fact
WHERE  status  = 'COMPLETED'
AND    region  = 'EAST'
AND    quarter = 'Q1';
```

실행 계획에서 `BITMAP AND` 오퍼레이션이 보이면 비트맵 인덱스가 효율적으로 동작하는 것이다.

---

## 비트맵 JOIN 인덱스

스타 스키마에서 팩트 테이블과 디멘전 테이블 간 조인 결과를 사전에 인덱싱하는 특수한 형태다.

```sql
-- Bitmap Join Index: 조인 결과를 팩트 테이블에 사전 인덱싱
CREATE BITMAP INDEX bidx_sales_cust_region
ON   sales_fact (customers.region)
FROM sales_fact sf, customers c
WHERE sf.customer_id = c.customer_id;
```

이렇게 하면 `WHERE c.region = 'EAST'` 조건이 팩트 테이블만 접근해도 처리된다. 단, 디멘전 테이블이 변경되면 인덱스를 재빌드해야 한다.

![비트맵 인덱스 생성 및 확인](/assets/posts/oracle-bitmap-index-sql.svg)

---

## OLTP에서 비트맵 인덱스의 위험

비트맵 인덱스는 DML 시 **비트맵 세그먼트 전체에 X 잠금**을 획득한다. 이것이 OLTP에서 치명적인 이유다.

단일 행 UPDATE라도 해당 비트맵 세그먼트를 공유하는 수천 행이 잠금 대기에 빠질 수 있다. 동시 INSERT/UPDATE가 많은 OLTP 테이블에 비트맵 인덱스를 생성하면 데드락과 극심한 잠금 경합이 발생한다.

```sql
-- 비트맵 인덱스 잠금 경합 확인
SELECT w.sid, w.event, w.seconds_in_wait
FROM   v$session_wait w
WHERE  w.event = 'enq: TX - row lock contention'
ORDER  BY w.seconds_in_wait DESC;

-- OLTP 테이블의 비트맵 인덱스 제거
DROP INDEX bidx_orders_status;
```

---

## 비트맵 인덱스 적용 체크리스트

비트맵 인덱스를 고려하기 전에 다음을 확인한다.

- 컬럼의 고유 값 수(카디널리티)가 수십~수백 이하인가?
- 해당 테이블에 동시 DML이 거의 없는가?
- 주요 쿼리 패턴이 여러 저카디널리티 컬럼의 복합 AND/OR 조건인가?
- 배치 로드 후 인덱스를 재빌드하는 것이 가능한가?

세 가지 이상이 충족되면 비트맵 인덱스를 강력히 권장한다.

```sql
-- 비트맵 인덱스 사용 확인 (실행 계획)
EXPLAIN PLAN FOR
SELECT COUNT(*), SUM(amount)
FROM   sales_fact
WHERE  status = 'COMPLETED'
AND    region = 'EAST';

SELECT * FROM TABLE(dbms_xplan.display);
-- BITMAP AND, BITMAP INDEX SINGLE VALUE 오퍼레이션 확인
```

---

**지난 글:** [Oracle B-Tree 인덱스](/posts/oracle-btree-index/)

**다음 글:** [Oracle Reverse Key 인덱스](/posts/oracle-reverse-key-index/)

<br>
읽어주셔서 감사합니다. 😊
