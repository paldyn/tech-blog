---
title: "SQL 언어 분류 — DDL, DML, DCL, TCL"
description: "SQL 명령을 DDL·DML·DCL·TCL로 분류하는 기준과 각 범주의 역할, 자동 커밋 여부 등 실무에서 자주 혼동하는 개념을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["SQL", "DDL", "DML", "DCL", "TCL", "SQL 분류"]
featured: false
draft: false
---

[지난 글](/posts/sql-client-server-protocol/)에서 SQL이 클라이언트에서 DBMS까지 전달되는 경로를 살펴봤습니다. 이번에는 SQL 명령어 자체를 분류합니다. DDL, DML, DCL, TCL이라는 네 글자 약어를 들어봤지만 정확히 어떤 기준으로 나뉘는지, 실무에서 왜 이 구분이 중요한지 살펴봅니다.

## 왜 분류가 필요한가

SQL 명령은 종류에 따라 동작 방식이 다릅니다.

- DDL은 대부분의 DBMS에서 **자동으로 커밋(COMMIT)**됩니다. 실수로 `DROP TABLE`을 실행하면 `ROLLBACK`으로 복구할 수 없습니다.
- DML은 트랜잭션 안에서 실행되고 `ROLLBACK`으로 되돌릴 수 있습니다.
- DCL은 권한을 즉시 적용합니다.
- TCL은 트랜잭션 생명주기를 관리합니다.

이 차이를 모르면 의도치 않은 데이터 손실이나 권한 문제가 생깁니다.

## 네 가지 범주

![SQL 언어 범주 전체 지도](/assets/posts/sql-language-categories-map.svg)

### DDL — Data Definition Language

**"구조"를 정의하고 변경합니다.**

| 명령 | 설명 |
|---|---|
| `CREATE` | 테이블, 인덱스, 뷰, 시퀀스 등 생성 |
| `ALTER` | 기존 객체 구조 변경 (열 추가, 타입 변경) |
| `DROP` | 객체 삭제 (데이터 포함) |
| `TRUNCATE` | 모든 행 삭제 (DDL이므로 대부분 롤백 불가, 빠름) |
| `RENAME` | 객체 이름 변경 |

Oracle에서는 DDL이 실행되기 전후에 자동으로 COMMIT이 발생합니다. PostgreSQL은 트랜잭션 안에서 DDL을 실행하고 ROLLBACK할 수 있습니다(예외: `DROP DATABASE`).

### DML — Data Manipulation Language

**"데이터"를 조회하고 변경합니다.**

| 명령 | 설명 |
|---|---|
| `SELECT` | 데이터 조회 |
| `INSERT` | 새 행 삽입 |
| `UPDATE` | 기존 행 수정 |
| `DELETE` | 행 삭제 |
| `MERGE` | INSERT/UPDATE/DELETE 복합 처리 |

DML은 트랜잭션 범위 안에서 실행됩니다. 명시적 트랜잭션이 없어도 `autocommit` 모드에서는 각 문이 자동으로 커밋됩니다.

### DCL — Data Control Language

**"권한"을 부여하거나 회수합니다.**

| 명령 | 설명 |
|---|---|
| `GRANT` | 사용자/역할에 권한 부여 |
| `REVOKE` | 부여된 권한 회수 |

```sql
-- 읽기 권한만 부여
GRANT SELECT ON orders TO reporting_user;

-- INSERT 권한 회수
REVOKE INSERT ON orders FROM reporting_user;
```

### TCL — Transaction Control Language

**"트랜잭션"을 시작·종료·복원합니다.**

| 명령 | 설명 |
|---|---|
| `BEGIN` / `START TRANSACTION` | 트랜잭션 시작 |
| `COMMIT` | 변경 사항 영구 저장 |
| `ROLLBACK` | 변경 사항 취소 |
| `SAVEPOINT` | 중간 복원 지점 설정 |
| `RELEASE SAVEPOINT` | 세이브포인트 해제 |

## 코드로 보는 네 범주

![각 범주 코드 예시](/assets/posts/sql-language-categories-example.svg)

```sql
-- DDL: 구조 생성
CREATE TABLE orders (
    id          INT           PRIMARY KEY,
    customer_id INT           NOT NULL,
    total       NUMERIC(12,2) NOT NULL
);

-- TCL + DML: 안전한 데이터 조작
BEGIN;
    INSERT INTO orders (id, customer_id, total) VALUES (1, 42, 99000);
    UPDATE orders SET total = 98000 WHERE id = 1;
COMMIT;  -- 또는 문제 발생 시 ROLLBACK;

-- DCL: 권한 제어
GRANT SELECT ON orders TO analyst;
```

## DQL이라는 추가 범주

일부 교재는 `SELECT`를 DML에서 분리해 **DQL(Data Query Language)**로 구분합니다. 읽기 전용이라는 특성이 다르기 때문입니다. 표준 문서는 이 구분을 두지 않지만, 실무에서 SELECT 권한만 따로 부여하거나 읽기 전용 레플리카를 별도로 두는 설계에서 이 개념이 유용합니다.

## DDL이 자동 커밋되는 이유

DDL은 **카탈로그(시스템 테이블)**를 수정합니다. 카탈로그는 다른 세션이 동시에 참조하는 공유 상태입니다. 긴 트랜잭션 안에서 카탈로그를 수정하면 잠금 경합이 심해지므로, 대부분의 DBMS가 DDL을 즉시 커밋하도록 설계합니다. PostgreSQL이 예외적으로 DDL을 트랜잭션에 포함하는 것은 유연성을 제공하기 위한 독자적 선택입니다.

## 정리

| 범주 | 핵심 동사 | 대상 | 트랜잭션 |
|---|---|---|---|
| DDL | CREATE, ALTER, DROP | 객체 구조 | 대부분 자동 COMMIT |
| DML | SELECT, INSERT, UPDATE, DELETE | 데이터 | 트랜잭션 내 실행 |
| DCL | GRANT, REVOKE | 권한 | 즉시 적용 |
| TCL | COMMIT, ROLLBACK | 트랜잭션 | 트랜잭션 제어 자체 |

다음 글부터는 DDL의 핵심인 `CREATE TABLE`을 자세히 살펴봅니다.

---

**지난 글:** [클라이언트-서버 프로토콜 — SQL이 전달되는 방식](/posts/sql-client-server-protocol/)

**다음 글:** [CREATE TABLE 기초 — 테이블을 만드는 방법](/posts/sql-create-table-basics/)

<br>
읽어주셔서 감사합니다. 😊
