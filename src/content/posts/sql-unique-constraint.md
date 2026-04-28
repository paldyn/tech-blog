---
title: "유니크 제약 — UNIQUE 인덱스와 NULL 허용 동작"
description: "UNIQUE 제약이 PRIMARY KEY와 어떻게 다른지, NULL 값을 여러 개 허용하는 이유, 복합 UNIQUE의 활용, 그리고 부분 UNIQUE 인덱스로 soft-delete 패턴을 구현하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["sql", "unique", "constraint", "unique-index", "null", "composite-unique", "partial-index", "ddl"]
featured: false
draft: false
---

[지난 글](/posts/sql-foreign-key-referential-integrity/)에서 외래 키와 참조 무결성을 살펴봤다. 이번에는 PRIMARY KEY와 자주 혼동되는 UNIQUE 제약의 세부 동작을 정리한다.

---

## UNIQUE 제약의 역할

`UNIQUE`는 컬럼(또는 컬럼 조합)에 중복 값이 들어오지 못하게 막는다. 테이블에서 기본 식별자가 아니지만 비즈니스적으로 유일해야 하는 컬럼 — 이메일, 사용자명, 상품 코드 등 — 에 적합하다.

```sql
CREATE TABLE users (
    user_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email    VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(50)  NOT NULL UNIQUE
);
```

![UNIQUE 제약 개요](/assets/posts/sql-unique-constraint-overview.svg)

---

## PRIMARY KEY vs UNIQUE

두 제약 모두 내부적으로 UNIQUE 인덱스를 생성하지만 차이가 있다.

- **PRIMARY KEY**: 테이블당 하나, NULL 불가, 테이블의 대표 식별자
- **UNIQUE**: 여러 개 가능, NULL 허용(일부 DBMS에서), 보조 식별자

---

## UNIQUE와 NULL — DBMS별 차이

SQL 표준에서 `NULL = NULL`은 UNKNOWN이다. NULL은 "알 수 없는 값"이므로 두 NULL이 같은지 다른지 판단할 수 없다. 이 논리를 따르면 **NULL은 중복이 아니므로 UNIQUE 컬럼에 여러 NULL을 허용**해야 한다.

대부분의 DBMS(PostgreSQL, Oracle, MySQL, SQLite)가 이 표준을 따른다. 단, **SQL Server**는 오래된 구현으로 인해 NULL을 1개만 허용한다.

```sql
-- PostgreSQL에서 아래 두 INSERT 모두 성공
INSERT INTO users (email, phone) VALUES ('a@example.com', NULL);
INSERT INTO users (email, phone) VALUES ('b@example.com', NULL);
-- phone 컬럼이 UNIQUE여도 NULL은 두 개 들어갈 수 있음
```

---

## 복합 UNIQUE

여러 컬럼의 조합이 유일해야 할 때 사용한다. 한 사용자가 동일한 소셜 로그인 제공자로 두 번 연결되면 안 되는 경우가 대표적이다.

```sql
CREATE TABLE oauth_connections (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    provider    VARCHAR(20) NOT NULL,  -- 'google', 'kakao', ...
    provider_id VARCHAR(100) NOT NULL,
    CONSTRAINT uq_user_provider UNIQUE (user_id, provider)
);
```

이 제약은 `(user_id=1, provider='google')`이 이미 있으면 다시 삽입을 막지만, `(user_id=1, provider='kakao')`는 허용한다.

---

## UNIQUE 제약 vs UNIQUE 인덱스

![UNIQUE 인덱스 vs 제약](/assets/posts/sql-unique-constraint-index.svg)

`UNIQUE` 제약과 `CREATE UNIQUE INDEX`는 동일한 인덱스를 생성하지만 목적과 기능이 다르다.

- **제약**: 이름 지정, DEFERRABLE, FK 참조 대상
- **인덱스**: `WHERE` 절로 부분 인덱스 가능, 더 유연한 옵션

일반적인 중복 방지에는 제약을 사용하고, 특수한 조건부 유일성이 필요할 때 부분 UNIQUE 인덱스를 사용한다.

---

## Soft-delete와 부분 UNIQUE 인덱스

논리 삭제(soft-delete) 패턴에서는 삭제된 행(`deleted_at IS NOT NULL`)에도 이메일이 남아 있다. 동일한 이메일로 재가입을 허용하면서도 활성 사용자의 이메일은 중복되지 않게 하려면 부분 UNIQUE 인덱스를 쓴다.

```sql
-- 삭제되지 않은 행에만 이메일 유일성 적용 (PostgreSQL)
CREATE UNIQUE INDEX uq_active_users_email
    ON users (email)
    WHERE deleted_at IS NULL;

-- 아래 두 INSERT 모두 성공: 하나는 삭제됨, 하나는 활성
INSERT INTO users (email, deleted_at) VALUES ('a@ex.com', NOW());
INSERT INTO users (email, deleted_at) VALUES ('a@ex.com', NULL);

-- 아래는 실패: 활성 이메일 중복
INSERT INTO users (email, deleted_at) VALUES ('a@ex.com', NULL);
```

MySQL은 부분 인덱스를 지원하지 않아 이 패턴을 적용할 수 없다. MySQL에서는 `deleted_at`을 컬럼에 포함하는 복합 인덱스로 유사하게 구현하거나, 애플리케이션 레이어에서 검증해야 한다.

---

## 제약 이름과 ALTER TABLE

```sql
-- 이름 지정
CONSTRAINT uq_users_email UNIQUE (email)

-- 나중에 추가
ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);

-- 제거
ALTER TABLE users DROP CONSTRAINT uq_users_email;
```

이름 없이 생성하면 DBMS가 자동으로 이름을 붙이는데, 나중에 제거하거나 수정하기 불편하다. 제약에는 항상 명시적인 이름을 붙이는 것이 좋다.

다음 글에서는 이미 만든 테이블의 구조를 바꾸는 `ALTER TABLE`을 다룬다.

---

**지난 글:** [외래 키와 참조 무결성 — FOREIGN KEY의 작동 원리](/posts/sql-foreign-key-referential-integrity/)

**다음 글:** [테이블 변경 — ALTER TABLE로 스키마 진화시키기](/posts/sql-alter-table/)

<br>
읽어주셔서 감사합니다. 😊
