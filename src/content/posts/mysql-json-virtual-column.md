---
title: "MySQL JSON 타입과 가상 컬럼 — 반정형 데이터 처리"
description: "MySQL JSON 네이티브 타입의 내부 저장 방식, 경로 연산자(->, ->>), JSON 함수, 가상 컬럼(VIRTUAL/STORED)과 인덱스를 조합해 JSON 필드에 인덱스를 적용하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 39
type: "knowledge"
category: "SQL"
tags: ["mysql", "json", "generated-column", "virtual-column", "json-index", "json-functions", "반정형데이터"]
featured: false
draft: false
---

[지난 글](/posts/mysql-event-scheduler/)에서 이벤트 스케줄러로 자동 배치 작업을 처리하는 방법을 살펴봤습니다. 이번 글에서는 MySQL 5.7에서 도입된 **JSON 네이티브 타입**과 **가상 컬럼(Generated Column)**을 사용해 반정형 데이터를 효율적으로 관리하는 방법을 다룹니다.

## JSON 네이티브 타입

MySQL 5.7.8부터 `JSON` 타입이 추가됐습니다. VARCHAR에 JSON 문자열을 저장하는 것과 달리, `JSON` 타입은 이진 최적화 형식으로 저장합니다.

```sql
-- JSON 컬럼이 있는 테이블
CREATE TABLE orders (
  id     BIGINT AUTO_INCREMENT PRIMARY KEY,
  meta   JSON,
  amount DECIMAL(10,2)
);

-- 올바른 JSON만 허용
INSERT INTO orders (meta, amount)
VALUES ('{"status":"paid","tags":["VIP","express"]}', 9900);

-- 잘못된 JSON은 에러
INSERT INTO orders (meta) VALUES ('not-a-json');
-- ERROR 3140: Invalid JSON text
```

`JSON` 타입은 삽입 시 **유효성을 검증**하고, 내부적으로 경로 접근이 빠른 이진 형식으로 변환합니다.

## 경로 접근 연산자

![JSON 타입과 가상 컬럼](/assets/posts/mysql-json-virtual-column-structure.svg)

`->` 연산자는 `JSON_EXTRACT`의 단축형으로 따옴표가 포함된 JSON 값을 반환합니다. `->>` 연산자는 `JSON_UNQUOTE(JSON_EXTRACT)`의 단축형으로 문자열 값에서 따옴표를 제거합니다.

```sql
-- -> : JSON 값 그대로 (따옴표 포함)
SELECT meta->'$.status' FROM orders WHERE id = 1;
-- 결과: "paid"

-- ->> : 따옴표 제거된 순수 문자열
SELECT meta->>'$.status' FROM orders WHERE id = 1;
-- 결과: paid

-- 중첩 경로
SELECT meta->>'$.address.city' FROM users WHERE id = 1;

-- 배열 인덱스 접근
SELECT meta->'$.tags[0]' FROM orders WHERE id = 1;
-- 결과: "VIP"
```

WHERE 조건이나 ORDER BY에서도 동일하게 사용할 수 있습니다. 단, 인덱스 없이 조회하면 Full Table Scan이 발생합니다.

## 가상 컬럼 — JSON에 인덱스 걸기

JSON 컬럼 자체에는 직접 인덱스를 생성할 수 없습니다. 대신 **Generated Column(가상 컬럼)**을 만들고 그 컬럼에 인덱스를 생성합니다.

![JSON 가상 컬럼 코드](/assets/posts/mysql-json-virtual-column-code.svg)

```sql
-- VIRTUAL: 디스크에 저장 안 함, 조회 시 실시간 계산
-- STORED: 디스크에 저장, INSERT/UPDATE 시 계산

ALTER TABLE orders
  ADD COLUMN status_gc VARCHAR(20)
  GENERATED ALWAYS AS (meta->>'$.status') VIRTUAL;

CREATE INDEX idx_status ON orders(status_gc);

-- 이제 인덱스 활용 조회 가능
EXPLAIN SELECT * FROM orders WHERE status_gc = 'paid';
-- type: ref (인덱스 사용!)
```

8.0.13+부터는 가상 컬럼을 생략하고 함수 기반 인덱스를 직접 사용할 수 있습니다.

```sql
-- 8.0.13+: 함수 인덱스로 직접 생성
CREATE INDEX idx_status_fn
  ON orders ((meta->>'$.status'));

-- 동일하게 활용 가능
SELECT * FROM orders WHERE meta->>'$.status' = 'paid';
-- type: ref
```

## 주요 JSON 함수

```sql
-- 값 설정 / 삽입 / 대체
UPDATE orders
SET meta = JSON_SET(meta, '$.status', 'shipped')
WHERE id = 1;

-- JSON_SET: 존재하면 덮어씀, 없으면 추가
-- JSON_INSERT: 없을 때만 추가 (존재하면 무시)
-- JSON_REPLACE: 존재할 때만 덮어씀 (없으면 무시)
-- JSON_REMOVE: 해당 경로 삭제
UPDATE orders SET meta = JSON_REMOVE(meta, '$.temp_flag') WHERE id = 1;

-- 여러 키 병합 업데이트 (PATCH 스타일)
UPDATE orders
SET meta = JSON_MERGE_PATCH(meta, '{"status":"refunded","reason":"취소"}')
WHERE id = 1;

-- 배열에 요소 추가
UPDATE orders
SET meta = JSON_ARRAY_APPEND(meta, '$.tags', 'urgent')
WHERE id = 1;
```

## JSON 배열 검색

```sql
-- 배열에 특정 값 포함 여부
SELECT * FROM orders
WHERE JSON_CONTAINS(meta, '"VIP"', '$.tags');

-- JSON 경로 존재 여부
SELECT * FROM orders
WHERE JSON_CONTAINS_PATH(meta, 'one', '$.address.city');

-- 배열 펼쳐서 조회 (JSON_TABLE)
SELECT jt.*
FROM orders,
  JSON_TABLE(
    meta,
    '$.tags[*]' COLUMNS (tag VARCHAR(50) PATH '$')
  ) AS jt
WHERE jt.tag = 'VIP';
```

## VIRTUAL vs STORED 선택

VIRTUAL 컬럼은 저장 공간을 사용하지 않지만 조회마다 계산합니다. STORED 컬럼은 디스크에 저장되어 조회가 빠르지만 INSERT/UPDATE 시 계산 비용이 발생합니다.

```sql
-- VIRTUAL 선호 상황: 자주 읽지 않는 파생 값
-- STORED 선호 상황: 자주 읽히는 값, 파티셔닝 키로 사용 시
-- (파티셔닝 키는 STORED만 가능)

-- 기존 테이블에 생성 컬럼 추가 (ALTER TABLE)
ALTER TABLE orders
  ADD COLUMN order_year YEAR
  GENERATED ALWAYS AS (YEAR(created_at)) STORED,
  ADD INDEX idx_year (order_year);
```

## JSON 타입 사용 가이드

반정형 데이터를 JSON으로 저장할지, 정규화된 컬럼으로 분리할지는 **조회 패턴**에 따라 결정합니다.

```sql
-- JSON이 적합한 경우
-- - 속성 수가 가변적이고 예측 불가
-- - 소수의 JSON 경로만 조회 기준으로 사용
-- - 전체 문서를 한 번에 읽어야 하는 경우

-- 정규화 컬럼이 적합한 경우
-- - 항상 존재해야 하는 필수 속성
-- - 정렬·집계·조인 조건으로 자주 사용
-- - NOT NULL / UNIQUE / FK 제약이 필요한 경우

-- 혼합 패턴 (추천)
CREATE TABLE products (
  id       BIGINT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(200) NOT NULL,   -- 핵심 컬럼은 정규화
  price    DECIMAL(10,2) NOT NULL,
  extra    JSON,                     -- 선택적 속성은 JSON
  category VARCHAR(50) GENERATED ALWAYS AS (extra->>'$.category') VIRTUAL,
  INDEX idx_category (category)
);
```

---

**지난 글:** [MySQL 이벤트 스케줄러 — 자동 배치 작업 스케줄링](/posts/mysql-event-scheduler/)

**다음 글:** [MySQL 리플리케이션 — 비동기·반동기·그룹 리플리케이션](/posts/mysql-replication-async-semi-group/)

<br>
읽어주셔서 감사합니다. 😊
