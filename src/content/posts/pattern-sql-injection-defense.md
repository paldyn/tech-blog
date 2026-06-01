---
title: "SQL 인젝션 방어 — 파라미터 바인딩과 안전한 쿼리 작성"
description: "SQL 인젝션의 공격 원리를 이해하고, 파라미터 바인딩·ORM·입력 검증·최소 권한 계정을 활용해 DB를 안전하게 지키는 방법을 언어별 코드 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["SQL 인젝션", "보안", "PreparedStatement", "파라미터 바인딩", "OWASP", "쿼리 보안"]
featured: false
draft: false
---

[지난 글](/posts/pattern-enum-vs-lookup-table/)에서 코드성 데이터 설계를 다뤘습니다. 이번 글은 OWASP Top 10에서 수십 년째 상위권을 차지하는 **SQL 인젝션** 공격 원리와 방어 방법입니다. 이해하기 어렵지 않지만, 이 단 하나의 취약점으로 DB 전체가 노출되는 사고가 여전히 발생하고 있습니다.

## 공격 원리

SQL 인젝션은 사용자 입력이 SQL 구조의 일부로 해석될 때 발생합니다.

![취약 코드 vs 안전 코드](/assets/posts/pattern-sql-injection-defense-attack.svg)

로그인 폼에서 `username` 필드에 `admin' --`를 입력하면:

```sql
-- 의도한 쿼리
SELECT * FROM users WHERE username = 'admin' AND password = '...'

-- 인젝션 후 실제 실행되는 쿼리
SELECT * FROM users WHERE username = 'admin' -- ' AND password = '...'
--                                            ^^ 이후는 주석으로 무력화
```

비밀번호 검증 없이 로그인이 성공합니다. 더 위험한 공격은 `'; DROP TABLE users; --`처럼 구조 자체를 변조하거나, `UNION SELECT` 로 다른 테이블 데이터를 빼내는 것입니다.

## 1순위 방어: 파라미터 바인딩

입력값을 SQL 구조가 아닌 **데이터**로만 처리하는 것이 유일한 근본 해결책입니다.

```python
# Python (psycopg2 / asyncpg)
# 잘못된 방법
query = f"SELECT * FROM users WHERE username = '{username}'"

# 올바른 방법 — %s 또는 $1 자리표시자 사용
query = "SELECT * FROM users WHERE username = %s AND password = %s"
cursor.execute(query, (username, password))
```

```java
// Java (JDBC)
String sql = "SELECT * FROM users WHERE username = ? AND password = ?";
try (PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setString(1, username);
    ps.setString(2, password);
    ResultSet rs = ps.executeQuery();
}
```

```go
// Go (database/sql)
row := db.QueryRow(
    "SELECT id FROM users WHERE username = $1 AND password = $2",
    username, password,
)
```

PreparedStatement는 쿼리 파싱과 바인딩을 분리합니다. 파싱이 먼저 완료된 후 값이 대입되기 때문에, 값 안에 SQL 문법이 있어도 구조를 바꿀 수 없습니다.

## 2순위 방어: ORM 올바르게 사용하기

JPA, MyBatis, SQLAlchemy, Sequelize 같은 ORM은 바인딩을 자동으로 처리합니다. 단, **raw 쿼리를 직접 작성할 때는 여전히 주의**가 필요합니다.

```java
// MyBatis — #{} 사용 (파라미터 바인딩, 안전)
SELECT * FROM users WHERE username = #{username}

// MyBatis — ${} 사용 (문자열 치환, 인젝션 위험!)
SELECT * FROM users WHERE username = '${username}'
-- ${} 는 ORDER BY, 동적 테이블명 등 불가피할 때만 사용하고 화이트리스트로 검증
```

```python
# SQLAlchemy ORM (안전)
user = session.query(User).filter(User.username == username).first()

# SQLAlchemy text() 사용 시 — 파라미터 반드시 명시
from sqlalchemy import text
result = conn.execute(
    text("SELECT * FROM users WHERE username = :name"),
    {"name": username}
)
```

## 3순위 방어: 최소 권한 DB 계정

```sql
-- PostgreSQL: 애플리케이션 전용 계정 생성
CREATE ROLE app_user LOGIN PASSWORD '...';

-- 필요한 권한만 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- DROP, CREATE, TRUNCATE, 시스템 카탈로그 접근은 절대 부여 금지
-- REVOKE ALL ON DATABASE mydb FROM PUBLIC;
```

인젝션이 성공하더라도 공격자가 할 수 있는 작업의 범위를 제한합니다.

## 동적 컬럼명·ORDER BY 처리

컬럼명이나 정렬 방향은 바인딩 파라미터로 전달할 수 없습니다. 이 경우 **화이트리스트 검증** 후 문자열로 조합합니다.

```python
# 화이트리스트 방식 (안전)
ALLOWED_COLUMNS = {"username", "email", "created_at"}
ALLOWED_DIRECTIONS = {"ASC", "DESC"}

def build_query(sort_col: str, sort_dir: str) -> str:
    if sort_col not in ALLOWED_COLUMNS:
        raise ValueError("허용되지 않은 컬럼")
    if sort_dir.upper() not in ALLOWED_DIRECTIONS:
        raise ValueError("허용되지 않은 정렬 방향")
    return f"SELECT * FROM users ORDER BY {sort_col} {sort_dir.upper()}"
```

```sql
-- PostgreSQL: CASE WHEN으로 고정 컬럼 동적 정렬
SELECT *
FROM   users
ORDER BY
  CASE WHEN :col = 'email'      THEN email      END,
  CASE WHEN :col = 'username'   THEN username   END,
  CASE WHEN :col = 'created_at' THEN created_at END;
```

## 방어 레이어 요약

![SQL 인젝션 방어 레이어](/assets/posts/pattern-sql-injection-defense-layers.svg)

```
파라미터 바인딩 → ORM 안전 사용 → 최소 권한 계정 → 입력 검증 + WAF
```

WAF(Web Application Firewall)는 보조 수단입니다. 바인딩 없이 WAF만으로 막으려 하면 우회 기법에 취약합니다.

## 진단: 기존 코드에서 취약점 찾기

```bash
# grep으로 문자열 연결 패턴 검색 (Java 예시)
grep -rn '\".*SELECT.*\".*+' src/
grep -rn 'Statement stmt' src/  # PreparedStatement 아닌 Statement 사용 탐지

# Python
grep -rn 'f".*SELECT\|%.*SELECT\|\.format.*SELECT' src/
```

정적 분석 도구(SAST)는 Semgrep, SonarQube, Checkmarx 등이 SQL 인젝션 패턴을 자동 탐지합니다. CI/CD 파이프라인에 통합하면 코드 리뷰 전에 잡을 수 있습니다.

---

**지난 글:** [ENUM vs 룩업 테이블 — 코드성 데이터 설계](/posts/pattern-enum-vs-lookup-table/)

**다음 글:** [슬로우 쿼리 진단 — EXPLAIN으로 시작하는 성능 분석](/posts/pattern-slow-query-diagnosis/)

<br>
읽어주셔서 감사합니다. 😊
