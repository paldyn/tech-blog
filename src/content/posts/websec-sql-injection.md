---
title: "SQL 인젝션: 공격 원리와 방어 완전 정복"
description: "SQL 인젝션의 공격 원리와 인증 우회·UNION 기반·에러 기반 공격 기법을 설명하고, Prepared Statement·ORM·최소 권한 원칙으로 구성된 다층 방어 전략을 Python 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 5
type: "knowledge"
category: "Security"
tags: ["SQL인젝션", "PreparedStatement", "ORM", "SQLi", "데이터베이스보안", "OWASP"]
featured: false
draft: false
---

[지난 글](/posts/websec-injection-overview/)에서 인젝션 취약점의 공통 원리와 유형 분류를 살펴봤다. 이번 글에서는 인젝션 계열 중 가장 역사가 길고 피해가 큰 **SQL 인젝션(SQL Injection, SQLi)**을 깊이 파헤친다. 적절한 방어 없이 단 하나의 파라미터만으로 전체 데이터베이스를 덤프할 수 있다는 사실이 SQLi를 그토록 위협적으로 만든다.

## SQL 인젝션이란

SQL 인젝션은 사용자 입력이 SQL 쿼리에 직접 삽입될 때, 공격자가 입력에 SQL 문법을 삽입해 **의도치 않은 쿼리 실행을 유도**하는 취약점이다.

취약한 코드의 전형:

```python
# 절대 금지: 사용자 입력을 직접 쿼리에 삽입
def login_UNSAFE(username, password):
    query = f"""
        SELECT * FROM users
        WHERE username = '{username}'
        AND password = '{password}'
    """
    return db.execute(query).fetchone()
```

공격자가 `username`에 `admin' --`을 입력하면:

```sql
SELECT * FROM users
WHERE username = 'admin' --' AND password = '아무값'
```

`--`로 비밀번호 검사가 주석 처리되어 인증이 우회된다.

![SQL 인젝션 공격 흐름](/assets/posts/websec-sql-injection-attack.svg)

## 주요 공격 기법

### 1. 인증 우회 (Authentication Bypass)

`' OR '1'='1' --` 같은 항상 참인 조건을 삽입해 인증을 건너뛴다. 로그인뿐 아니라 admin 패널 접근에도 사용된다.

```sql
-- 원본
SELECT * FROM users WHERE username='' AND password=''
-- 공격 후 (password = ' OR '1'='1' --)
SELECT * FROM users WHERE username='' AND password='' OR '1'='1' --'
-- '1'='1'은 항상 True → 모든 사용자 행 반환 → 첫 번째 사용자로 로그인
```

### 2. UNION 기반 추출 (UNION-based Extraction)

UNION을 이용해 다른 테이블의 데이터를 쿼리 결과에 추가한다.

```sql
-- 칼럼 수 확인
' ORDER BY 3-- (3칼럼 존재하면 에러 없음, 4칼럼은 에러)

-- 데이터 추출 (칼럼 수 = 3 가정)
' UNION SELECT username, password, email FROM admin_users --

-- 정보 스키마로 테이블 목록 확인
' UNION SELECT table_name, 2, 3 FROM information_schema.tables --
```

### 3. 에러 기반 추출 (Error-based Extraction)

에러 메시지에 데이터를 포함시켜 반환받는다.

```sql
-- MySQL: 에러 메시지에 버전 포함
' AND extractvalue(1, concat(0x7e, version())) --
-- 결과: XPATH syntax error: '~8.0.32'

-- 중첩 쿼리로 데이터 추출
' AND (SELECT 1 FROM (SELECT COUNT(*), concat(
    (SELECT password FROM users WHERE username='admin' LIMIT 1), 0x3a, FLOOR(RAND()*2)
) x FROM information_schema.tables GROUP BY x) a) --
```

### 4. 스택드 쿼리 (Stacked Queries)

세미콜론으로 여러 쿼리를 연결해 DDL/DML을 실행한다.

```sql
-- 데이터 파괴
'; DROP TABLE users; --
-- 새 관리자 계정 추가
'; INSERT INTO users VALUES ('hacker', 'hacked', 'admin'); --
```

## 방어 전략

![SQL 인젝션 방어](/assets/posts/websec-sql-injection-defense.svg)

### Prepared Statement (가장 중요)

파라미터 바인딩은 SQL 코드 구조를 사전에 확정하고 입력값을 순수 데이터로만 전달한다.

```python
import psycopg2

def get_user(conn, username: str, password_hash: str):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, role FROM users WHERE username=%s AND password_hash=%s",
            (username, password_hash)  # 두 번째 인자는 항상 튜플
        )
        return cur.fetchone()

def search_products(conn, category: str, max_price: float):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM products WHERE category=%s AND price<=%s",
            (category, max_price)
        )
        return cur.fetchall()
```

### ORM 사용

SQLAlchemy, Django ORM, Hibernate 등 ORM은 내부적으로 파라미터 바인딩을 처리한다.

```python
from sqlalchemy.orm import Session
from sqlalchemy import and_

def search_users_safe(db: Session, name: str, active: bool = True):
    return (
        db.query(User)
        .filter(and_(User.name == name, User.active == active))
        .limit(100)
        .all()
    )

# 동적 정렬이 필요할 때: ORM 속성으로만 허용
ALLOWED_SORT_COLUMNS = {"name": User.name, "created_at": User.created_at}

def list_users(db: Session, sort_by: str = "name"):
    column = ALLOWED_SORT_COLUMNS.get(sort_by, User.name)  # 허용 목록 강제
    return db.query(User).order_by(column).all()
```

### 입력 검증으로 2차 방어

파라미터 바인딩이 메인 방어지만, 타입 검증으로 공격 벡터를 추가 줄인다.

```python
from pydantic import BaseModel, validator

class SearchRequest(BaseModel):
    query: str
    page: int = 1
    limit: int = 20

    @validator("query")
    def query_length(cls, v):
        if len(v) > 200:
            raise ValueError("검색어는 200자 이하")
        return v

    @validator("page", "limit")
    def positive_int(cls, v):
        if v < 1:
            raise ValueError("양의 정수 필요")
        return v
```

## 최소 권한 원칙 적용

```sql
-- 앱 전용 계정에 필요한 권한만
CREATE USER 'webapp_user'@'%' IDENTIFIED BY 'strong_random_password';

-- 읽기 전용 서비스
GRANT SELECT ON appdb.products TO 'webapp_user'@'%';
GRANT SELECT ON appdb.categories TO 'webapp_user'@'%';

-- 쓰기 필요 시 특정 테이블만
GRANT SELECT, INSERT, UPDATE ON appdb.orders TO 'webapp_user'@'%';

-- DROP, ALTER, FILE, SUPER, PROCESS 등 위험 권한 절대 금지
```

## 에러 메시지 숨기기

에러 기반 SQLi는 DB 에러 메시지가 노출될 때 훨씬 쉬워진다.

```python
import logging

logger = logging.getLogger(__name__)

def safe_db_query(conn, query_func, *args):
    try:
        return query_func(conn, *args)
    except Exception as e:
        # 내부 에러는 로그에만 기록
        logger.error("DB error: %s | args: %s", e, args)
        # 사용자에게는 일반 메시지만
        raise DatabaseError("요청을 처리할 수 없습니다")
```

SQL 인젝션 방어의 핵심은 단 한 문장으로 요약된다. **사용자 입력을 SQL 코드에 직접 삽입하지 말라.** 다음 글에서는 응답 없이 참/거짓으로만 데이터를 추출하는 블라인드 SQL 인젝션을 다룬다.

---

**지난 글:** [인젝션 취약점 완전 정복: 개요와 공통 원리](/posts/websec-injection-overview/)

**다음 글:** [블라인드 SQL 인젝션: 응답 없이 데이터 훔치기](/posts/websec-sql-injection-blind/)

<br>
읽어주셔서 감사합니다. 😊
