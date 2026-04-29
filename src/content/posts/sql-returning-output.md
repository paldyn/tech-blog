---
title: "RETURNING / OUTPUT — DML 결과를 즉시 돌려받기"
description: "INSERT·UPDATE·DELETE 후 변경된 행을 별도 SELECT 없이 즉시 반환하는 RETURNING(PostgreSQL)과 OUTPUT(SQL Server)의 원리, 활용 패턴, DBMS별 문법 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["sql", "returning", "output", "dml", "postgresql", "sql-server", "insert", "update", "delete"]
featured: false
draft: false
---

[지난 글](/posts/sql-merge-upsert/)에서 MERGE/UPSERT로 DML을 원자적으로 처리하는 방법을 살펴봤다. 이번에는 DML 실행 결과를 즉시 돌려받는 RETURNING과 OUTPUT을 다룬다.

---

## 왜 RETURNING이 필요한가

`INSERT` 후 새로 생성된 ID를 애플리케이션에서 사용해야 하는 상황은 매우 흔하다. 전통적인 접근 방식은 두 단계다.

```sql
-- 기존 방식: 왕복 2회
INSERT INTO orders (user_id, amount) VALUES (42, 9900);
SELECT id, created_at FROM orders WHERE user_id = 42 ORDER BY id DESC LIMIT 1;
```

이 방식에는 두 가지 문제가 있다. 첫째, 네트워크 왕복이 두 번 발생해 레이턴시가 늘어난다. 둘째, INSERT와 SELECT 사이에 다른 트랜잭션이 같은 `user_id`로 삽입하면 잘못된 행을 읽을 수 있다. RETURNING은 이 두 문제를 모두 해결한다.

![RETURNING 흐름 — DML 결과 즉시 반환](/assets/posts/sql-returning-output-flow.svg)

---

## PostgreSQL: RETURNING

PostgreSQL은 `INSERT`, `UPDATE`, `DELETE` 모두에서 `RETURNING`을 지원한다.

```sql
-- INSERT RETURNING: 새 행의 컬럼 반환
INSERT INTO orders (user_id, amount)
VALUES (42, 9900)
RETURNING id, created_at;
```

```sql
-- UPDATE RETURNING: 변경 후 값 반환
UPDATE accounts
SET balance = balance - 100
WHERE id = 7
RETURNING id, balance;
```

```sql
-- DELETE RETURNING: 삭제된 행 반환 (* 가능)
DELETE FROM sessions
WHERE expired_at < NOW()
RETURNING *;
```

`RETURNING *`은 삭제된 모든 컬럼을 반환한다. 삭제 로그나 감사(Audit) 용도로 자주 활용된다.

### CTE와 결합

`RETURNING`을 CTE와 결합하면 DML 결과를 이후 쿼리에서 바로 사용할 수 있다.

```sql
WITH new_order AS (
    INSERT INTO orders (user_id, amount)
    VALUES (42, 9900)
    RETURNING id
)
INSERT INTO order_logs (order_id, action)
SELECT id, 'created' FROM new_order;
```

단일 쿼리로 주문 생성과 로그 삽입을 동시에 처리한다.

---

## SQL Server: OUTPUT

SQL Server는 `OUTPUT` 절로 동일한 기능을 제공한다. `INSERTED`와 `DELETED` 가상 테이블로 변경 전후 값을 모두 접근할 수 있다는 점이 특징이다.

```sql
-- INSERT OUTPUT: INSERTED 가상 테이블
INSERT INTO orders (user_id, amount)
OUTPUT INSERTED.id, INSERTED.created_at
VALUES (42, 9900);
```

```sql
-- UPDATE OUTPUT: 변경 전(DELETED)과 후(INSERTED) 동시 접근
UPDATE accounts
SET balance = balance - 100
OUTPUT DELETED.balance AS old_balance,
       INSERTED.balance AS new_balance
WHERE id = 7;
```

`DELETED`는 변경 전 값, `INSERTED`는 변경 후 값이다. UPDATE에서 두 가지를 동시에 조회할 수 있다는 점이 PostgreSQL RETURNING과의 주요 차이다.

### OUTPUT INTO: 테이블로 저장

```sql
DECLARE @log TABLE (order_id INT, ts DATETIME2);

INSERT INTO orders (user_id, amount)
OUTPUT INSERTED.id, INSERTED.created_at INTO @log
VALUES (42, 9900);

SELECT * FROM @log;  -- 삽입된 결과 확인
```

`OUTPUT INTO`는 반환값을 테이블 변수나 임시 테이블에 저장한다.

---

## Oracle: RETURNING INTO

Oracle은 PL/SQL 컨텍스트에서 `RETURNING INTO`를 지원한다.

```sql
-- Oracle PL/SQL
DECLARE
    v_id orders.id%TYPE;
    v_ts orders.created_at%TYPE;
BEGIN
    INSERT INTO orders (user_id, amount)
    VALUES (42, 9900)
    RETURNING id, created_at INTO v_id, v_ts;
    DBMS_OUTPUT.PUT_LINE('id=' || v_id);
END;
/
```

Oracle 23c부터는 SQL 레벨에서도 `RETURNING` 절을 지원하기 시작했다.

---

## MySQL: 미지원 → 대안

MySQL(MariaDB 포함)은 `RETURNING`을 지원하지 않는다. 대안은 `LAST_INSERT_ID()`다.

```sql
-- MySQL 대안: LAST_INSERT_ID()
INSERT INTO orders (user_id, amount) VALUES (42, 9900);
SELECT LAST_INSERT_ID();  -- 마지막 AUTO_INCREMENT 값
```

`LAST_INSERT_ID()`는 단일 연결(Connection) 스코프이므로 같은 연결에서 다른 INSERT가 발생하면 값이 바뀐다. 멀티스레드 환경에서는 주의가 필요하다.

---

## DBMS별 지원 비교

![DBMS별 RETURNING/OUTPUT 문법](/assets/posts/sql-returning-output-syntax.svg)

---

## 주요 활용 패턴

**1. 생성된 ID 즉시 획득** — AUTO_INCREMENT / SERIAL로 자동 생성된 PK를 바로 얻어 후속 쿼리에 사용한다.

**2. 낙관적 잠금(Optimistic Lock)** — UPDATE 후 `RETURNING version`으로 갱신 여부를 확인한다.

**3. 소프트 삭제 로그** — `DELETE ... RETURNING *`으로 삭제된 행을 아카이브 테이블에 기록한다.

**4. 큐(Queue) 패턴** — `DELETE FROM queue WHERE id = (SELECT id FROM queue LIMIT 1) RETURNING *`으로 큐에서 항목을 원자적으로 꺼낸다.

---

**다음 글:** [SELECT의 논리적 실행 순서](/posts/sql-select-logical-order/)

<br>
읽어주셔서 감사합니다. 😊
