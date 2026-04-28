---
title: "DROP vs TRUNCATE — 삭제의 두 얼굴"
description: "DROP TABLE과 TRUNCATE TABLE의 차이, TRUNCATE가 DDL인 이유와 롤백 불가 여부, DELETE와의 성능 비교, 그리고 FK 참조 테이블에서 TRUNCATE 사용 시 주의사항을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["sql", "drop", "truncate", "delete", "ddl", "dml", "rollback", "테이블삭제"]
featured: false
draft: false
---

[지난 글](/posts/sql-alter-table/)에서 테이블 구조를 바꾸는 ALTER TABLE을 다뤘다. 이번에는 테이블이나 데이터를 삭제하는 세 가지 명령 — DROP, TRUNCATE, DELETE — 의 차이를 정확히 짚어본다.

---

## 세 가지 삭제 명령

데이터를 없애는 SQL에는 목적에 따라 세 종류가 있다.

- **DROP TABLE**: 테이블 구조(스키마)와 데이터를 모두 제거
- **TRUNCATE TABLE**: 테이블 구조는 남기고 데이터만 전체 삭제
- **DELETE FROM**: 조건에 맞는 특정 행만 삭제

![DROP vs TRUNCATE vs DELETE 비교](/assets/posts/sql-drop-vs-truncate-comparison.svg)

---

## DROP TABLE

테이블 자체를 데이터베이스에서 완전히 제거한다. 복구 불가능하다.

```sql
DROP TABLE temp_log;

-- 존재하지 않을 때 에러를 막으려면
DROP TABLE IF EXISTS temp_log;

-- 연결된 뷰·FK를 함께 삭제 (PostgreSQL)
DROP TABLE customers CASCADE;
```

`CASCADE` 없이 FK 참조를 받는 부모 테이블을 DROP하면 에러가 발생한다.

---

## TRUNCATE TABLE

테이블 구조는 그대로 두고 모든 데이터를 빠르게 삭제한다. 내부적으로 테이블의 데이터 페이지를 통째로 해제하므로 DELETE보다 훨씬 빠르고 트랜잭션 로그도 적게 남는다.

```sql
TRUNCATE TABLE session_tokens;

-- 시퀀스 초기화 (PostgreSQL)
TRUNCATE TABLE orders RESTART IDENTITY;

-- FK 참조 자식도 함께 삭제 (PostgreSQL)
TRUNCATE TABLE customers CASCADE;
```

![TRUNCATE 주의사항](/assets/posts/sql-drop-vs-truncate-truncate-detail.svg)

---

## TRUNCATE는 DDL인가 DML인가

SQL 표준은 TRUNCATE를 DDL로 분류한다. DBMS별로 동작이 다르다.

- **Oracle, MySQL**: DDL은 묵시적 커밋(Implicit Commit)이 발생한다. TRUNCATE 직후에는 ROLLBACK이 불가능하다.
- **PostgreSQL**: DDL도 트랜잭션 안에서 실행 가능하다. BEGIN ~ ROLLBACK으로 TRUNCATE를 취소할 수 있다.

```sql
-- PostgreSQL에서 TRUNCATE 롤백 예시
BEGIN;
TRUNCATE TABLE test_data;
-- 아직 커밋하지 않았으므로
ROLLBACK;
-- test_data는 복원됨
```

MySQL이나 Oracle을 사용한다면 TRUNCATE는 실행 즉시 되돌릴 수 없다고 생각하고 사용해야 한다.

---

## DELETE vs TRUNCATE — 성능 차이

DELETE는 각 행을 하나씩 로그에 기록하며 삭제한다. TRUNCATE는 데이터 페이지를 통째로 해제하므로 훨씬 빠르다.

```sql
-- 1억 행 테이블에서 전체 삭제
DELETE FROM events;    -- 수십 분 소요, 트랜잭션 로그 대량 생성
TRUNCATE TABLE events; -- 수 초 이내, 로그 최소

-- TRUNCATE가 불가능한 경우에는 배치 DELETE 사용
DELETE FROM events WHERE created_at < NOW() - INTERVAL '1 year'
    LIMIT 10000; -- MySQL: 청크 단위 반복
```

TRUNCATE는 트리거도 발동하지 않는다. DELETE 트리거로 감사 로그를 남기는 테이블을 TRUNCATE하면 감사 로그가 생성되지 않는다.

---

## 사용 기준 정리

| 상황 | 권장 명령 |
|---|---|
| 테이블 자체가 더 이상 필요 없음 | `DROP TABLE IF EXISTS` |
| 테이블은 남기고 모든 데이터 삭제 | `TRUNCATE TABLE` |
| 특정 조건의 행만 삭제 | `DELETE FROM ... WHERE` |
| 롤백이 필요한 경우 | `DELETE FROM` (또는 PostgreSQL TRUNCATE) |
| FK 참조 테이블의 데이터 삭제 | FK 자식 먼저 DELETE, 또는 TRUNCATE CASCADE |

---

## TRUNCATE 전 안전 체크

운영 DB에서 TRUNCATE를 실행하기 전 반드시 확인해야 할 것들:

```sql
-- 테이블에 데이터 있는지 확인
SELECT COUNT(*) FROM orders;

-- FK 자식 테이블 존재 여부 확인 (PostgreSQL)
SELECT conrelid::regclass AS child_table
FROM pg_constraint
WHERE confrelid = 'customers'::regclass AND contype = 'f';
```

TRUNCATE는 되돌리기 어렵다(DBMS에 따라 불가능). 실행 전에 반드시 데이터 확인과 백업을 먼저 챙겨야 한다.

다음 글에서는 DML의 첫 번째인 INSERT 문의 기본과 고급 패턴을 다룬다.

---

**지난 글:** [테이블 변경 — ALTER TABLE로 스키마 진화시키기](/posts/sql-alter-table/)

**다음 글:** [데이터 삽입 — INSERT 문의 기본과 응용](/posts/sql-insert-basics/)

<br>
읽어주셔서 감사합니다. 😊
