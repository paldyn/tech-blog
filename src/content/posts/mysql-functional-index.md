---
title: "MySQL Functional Index — 표현식 기반 인덱스로 함수 쿼리 최적화"
description: "MySQL 8.0.13에서 도입된 Functional Index(표현식 인덱스)로 함수 호출이 포함된 WHERE 조건을 인덱스로 처리하는 방법, Generated Column과의 관계, JSON 필드 인덱싱, 주의 사항을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 29
type: "knowledge"
category: "SQL"
tags: ["mysql", "functional-index", "expression-index", "generated-column", "json", "인덱스", "mysql8"]
featured: false
draft: false
---

[지난 글](/posts/mysql-invisible-index/)에서 Invisible Index로 안전하게 인덱스를 비활성화하는 방법을 살펴봤습니다. 이번 글에서는 MySQL 8.0.13에서 도입된 **Functional Index**로 함수 호출이 포함된 쿼리를 인덱스로 처리하는 방법을 다룹니다.

## 함수 호출이 인덱스를 무력화하는 문제

인덱스가 걸린 칼럼에 함수를 적용하면 옵티마이저가 인덱스를 사용하지 못합니다. 칼럼 값을 변환한 결과로 인덱스를 찾을 수 없기 때문입니다.

```sql
-- created_at 칼럼에 인덱스가 있어도 함수로 감싸면 Full Scan
SELECT * FROM orders WHERE YEAR(created_at) = 2024;
SELECT * FROM orders WHERE MONTH(created_at) = 3;
SELECT * FROM orders WHERE LOWER(email) = 'user@example.com';
SELECT * FROM orders WHERE JSON_EXTRACT(meta, '$.city') = 'Seoul';
```

전통적인 해결책은 쿼리를 범위 조건으로 바꾸는 것입니다. 예를 들어 `WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'`처럼 작성하면 인덱스를 활용할 수 있습니다. 그러나 코드를 바꾸기 어렵거나, 레거시 ORM이 고정된 쿼리를 생성하는 환경에서는 제약이 됩니다.

## Functional Index 생성

MySQL 8.0.13부터 표현식에 직접 인덱스를 만들 수 있습니다. 표현식은 반드시 이중 괄호 `((표현식))`으로 감싸야 합니다.

```sql
-- YEAR() 표현식 인덱스
CREATE INDEX idx_year ON orders ((YEAR(created_at)));

-- 소문자 변환 Unique 인덱스 (대소문자 무관 중복 방지)
ALTER TABLE users
  ADD UNIQUE INDEX uq_lower_email ((LOWER(email)));

-- JSON 필드 인덱스
CREATE INDEX idx_city ON users ((address->>'$.city'));

-- 복합 Functional Index
CREATE INDEX idx_month_status
  ON orders ((MONTH(created_at)), status);
```

이제 `WHERE YEAR(created_at) = 2024`처럼 기존 쿼리가 자동으로 인덱스를 활용합니다.

![Functional Index — 표현식 기반 인덱스 패턴](/assets/posts/mysql-functional-index-examples.svg)

## 내부 동작: Generated Column 자동 생성

Functional Index는 내부적으로 **숨겨진 Virtual Generated Column**을 자동으로 만들고, 그 칼럼에 인덱스를 생성합니다.

```sql
-- Functional Index 생성 내부 동작 확인
SHOW CREATE TABLE orders\G
-- 숨겨진 Generated Column이 있음 (직접 조회 불가)
-- information_schema.columns 에서도 hidden 컬럼은 제외됨

-- 명시적 Generated Column + 인덱스 방식 (MySQL 5.7+)
ALTER TABLE users
  ADD COLUMN email_lower VARCHAR(255)
    GENERATED ALWAYS AS (LOWER(email)) VIRTUAL,
  ADD UNIQUE INDEX uq_email_lower (email_lower);
```

두 방식은 동일한 결과를 만들며, Functional Index가 더 간결합니다. MySQL 5.7에서는 Functional Index가 없으므로 Generated Column 방식을 사용해야 합니다.

![Generated Column 기반 인덱스 (8.0 이전 대안)](/assets/posts/mysql-functional-index-generated.svg)

## 제약 사항

```sql
-- 비결정적 함수 불가 (오류)
CREATE INDEX idx_now ON t ((NOW()));
-- ERROR 3506 (HY000): Expression of functional index 'idx_now'
-- contains a disallowed function.

-- 사용 가능: 결정적 순수 함수
-- LOWER(), UPPER(), ABS(), YEAR(), MONTH(), DAY(), FLOOR(), ROUND()
-- JSON_EXTRACT(), ->>, CAST(), CONVERT()

-- 사용 불가: 비결정적 함수
-- NOW(), RAND(), UUID(), SYSDATE(), USER()

-- 부분 인덱스(조건부 인덱스) 불가 (MySQL은 partial index 미지원)
-- PostgreSQL WHERE 절 인덱스 방식은 MySQL에서 불가

-- NULL 처리: 표현식 결과가 NULL이면 인덱스에 저장됨 (B-Tree에서 NULL 허용)
```

## EXPLAIN 검증

```sql
-- Functional Index 사용 확인
EXPLAIN SELECT * FROM orders WHERE YEAR(created_at) = 2024\G

-- key: idx_year          ← Functional Index 사용
-- type: ref 또는 range   ← 인덱스 스캔

-- Functional Index 미사용 (함수 불일치)
EXPLAIN SELECT * FROM orders WHERE YEAR(created_at) + 0 = 2024\G
-- → type: ALL  (미묘한 표현식 차이로 매칭 실패)
```

## 실전 활용 패턴

이메일 대소문자 무관 조회와 UNIQUE 제약을 함께 처리할 때 Functional Index가 특히 유용합니다.

```sql
-- 대소문자 무관 이메일 조회 + 중복 방지
ALTER TABLE users
  ADD UNIQUE INDEX uq_email_ci ((LOWER(email)));

-- 이제 다음 쿼리가 인덱스를 사용하고, 중복도 방지됨
SELECT * FROM users WHERE LOWER(email) = LOWER(?);
INSERT INTO users (email) VALUES ('User@Example.com');
-- → LOWER('User@Example.com') = 'user@example.com' 이미 존재하면 오류
```

Functional Index는 기존 쿼리를 수정하지 않고도 인덱스를 활용할 수 있게 해주는 강력한 도구입니다. 특히 ORM이 생성하는 고정된 쿼리나 레거시 코드베이스에서 성능을 개선할 때 유용합니다.

---

**지난 글:** [MySQL Invisible Index — 안전한 인덱스 비활성화와 삭제 전략](/posts/mysql-invisible-index/)

**다음 글:** [MySQL FULLTEXT 인덱스 — 전문 검색 구현](/posts/mysql-fulltext-index/)

<br>
읽어주셔서 감사합니다. 😊
