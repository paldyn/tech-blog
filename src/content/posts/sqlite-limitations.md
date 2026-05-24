---
title: "SQLite의 한계와 사용하면 안 되는 경우"
description: "SQLite의 설계 제약, 미지원 SQL 기능, 동시성 한계, 크기 제한, 네트워크 접근 불가 등 SQLite가 적합하지 않은 상황과 대안 선택 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["SQLite", "한계", "비교", "PostgreSQL", "MySQL", "선택기준"]
featured: false
draft: false
---

[지난 글](/posts/sqlite-mobile-embedded/)에서 SQLite의 다양한 활용 환경을 살펴봤다. SQLite 시리즈의 마지막으로, SQLite를 선택하면 안 되는 상황과 설계적 한계를 명확히 정리한다. SQLite를 정확히 이해한다는 것은 SQLite의 강점만큼 **한계도 명확히 아는 것**이다.

## SQLite의 설계 철학과 한계의 관계

SQLite 공식 문서는 "적합한 사용 사례"를 직접 열거한다. SQLite는 **클라이언트-서버 DB를 대체하기 위해 설계된 것이 아니다**. 파일 형식(애플리케이션 파일 포맷), 임베디드 디바이스, 중소 트래픽 웹사이트, 분석 파이프라인에서 빛난다. 반대로 대규모 동시 쓰기, 세밀한 권한 제어, 원격 접속이 필요한 환경에서는 설계 자체가 맞지 않는다.

![SQLite 선택 결정 트리](/assets/posts/sqlite-limitations-decision.svg)

## 미지원 또는 제한된 SQL 기능

![SQLite 미지원 기능과 대안](/assets/posts/sqlite-limitations-missing-features.svg)

### ALTER TABLE 제약

SQLite는 컬럼 타입 변경, 컬럼 이름 변경(3.25+ 가능), 제약 추가/삭제가 불가능하다. 컬럼 삭제는 3.35.0+에서 지원된다. 변경이 필요하면 테이블 재생성이 유일한 방법이다.

```sql
-- SQLite에서 컬럼 타입 변경: 테이블 재생성으로 해결
BEGIN;

-- 1. 새 구조의 임시 테이블 생성
CREATE TABLE users_new (
    id    INTEGER PRIMARY KEY,
    name  TEXT    NOT NULL,
    email TEXT    NOT NULL,  -- 기존 VARCHAR(100) → TEXT (재정의)
    score REAL    DEFAULT 0  -- 기존 INTEGER → REAL
);

-- 2. 데이터 복사
INSERT INTO users_new(id, name, email, score)
SELECT id, name, email, CAST(score AS REAL)
FROM users;

-- 3. 기존 테이블 교체
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

COMMIT;
```

### 외래 키 기본 비활성화

```sql
-- SQLite는 외래 키가 기본 OFF
-- 모든 연결에서 명시적으로 켜야 한다
PRAGMA foreign_keys = ON;

-- 꺼진 상태에서는 이게 오류 없이 성공한다
INSERT INTO orders(user_id) VALUES (99999);  -- user_id=99999 없어도 통과

-- Python에서 항상 켜두려면
def get_conn(path):
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
```

### 동시성 한계 상세

```python
import sqlite3
import threading
import time

def stress_test(n_writers: int):
    results = []
    errors = []

    def writer(thread_id: int):
        conn = sqlite3.connect("test.db", timeout=5.0)
        conn.execute("PRAGMA journal_mode = WAL")
        try:
            for i in range(100):
                conn.execute("BEGIN IMMEDIATE")
                conn.execute(
                    "INSERT INTO counters(val) VALUES(?)", (i,)
                )
                conn.execute("COMMIT")
            results.append(f"writer-{thread_id}: OK")
        except sqlite3.OperationalError as e:
            errors.append(f"writer-{thread_id}: {e}")
        finally:
            conn.close()

    threads = [threading.Thread(target=writer, args=(i,))
               for i in range(n_writers)]
    for t in threads: t.start()
    for t in threads: t.join()

    print(f"성공: {len(results)}, 실패(BUSY): {len(errors)}")

# 5개 동시 writer → WAL에서 순차 처리, 일부 timeout
# stress_test(5)

# 결론: 동시 writer가 10개 이상 → PostgreSQL로 전환 고려
```

## 크기와 성능 한계

| 항목 | 제한값 | 비고 |
|---|---|---|
| 최대 DB 파일 크기 | 281 TB | 이론값, 실제 수 GB면 검토 |
| 최대 행 크기 | 1 GB | BLOB/TEXT 오버플로 |
| 최대 컬럼 수 | 2000 | PRAGMA max_column |
| 최대 테이블 수 | 제한 없음 | B-Tree 수 제한 |
| 최대 인덱스 크기 | 이론상 무제한 | 실제 페이지 수 제한 |
| 동시 read connection | 수십~수백 | WAL 모드, SHM 인덱스 크기 |
| 최대 동시 writer | **1개** | 핵심 제약 |

### 성능이 나빠지는 패턴

```sql
-- 1. 많은 단건 INSERT (각각 커밋)
-- 느림: 각 INSERT = 1 fsync
INSERT INTO logs VALUES(1, 'event1');
INSERT INTO logs VALUES(2, 'event2');
-- ... 10000번 반복

-- 빠름: 트랜잭션으로 묶음
BEGIN;
INSERT INTO logs VALUES(1, 'event1');
INSERT INTO logs VALUES(2, 'event2');
-- ... 10000개
COMMIT;  -- fsync 1회

-- 2. COUNT(*) on large table (커버링 인덱스 없음)
-- SQLite는 행 수를 별도 저장 안 함 → 풀스캔
SELECT COUNT(*) FROM huge_table;  -- 수백만 행 = 느림

-- 해결: 별도 카운터 테이블 유지
CREATE TABLE stats (table_name TEXT PRIMARY KEY, row_count INTEGER);
CREATE TRIGGER inc_count AFTER INSERT ON huge_table
BEGIN
    INSERT INTO stats VALUES('huge_table', 1)
    ON CONFLICT(table_name) DO UPDATE SET row_count = row_count + 1;
END;
```

## 네트워크 접근과 권한 제어 부재

SQLite는 **TCP 리스너가 없다**. 같은 호스트의 프로세스만 파일로 접근할 수 있다. 웹 API 서버에서 SQLite를 쓴다면 그 서버만 접근하는 것이지, 외부 DB 관리 도구가 원격으로 연결할 수 없다.

```bash
# 원격 접근이 필요하면 rqlite (분산 SQLite) 또는 Turso 사용
# rqlite: Raft 합의 기반 분산 SQLite 클러스터
# https://rqlite.io/

# Turso: libSQL (SQLite 호환 fork) + 엣지 배포
# npx turso db create mydb
# npx turso db shell mydb
```

### 사용자/권한 없음

```python
# SQLite에는 사용자, 역할, 권한이 없다
# 보안은 OS 파일 권한 + 애플리케이션 계층에서 처리해야 한다

import os
import stat

# DB 파일을 앱 사용자만 읽고 쓸 수 있게 설정
os.chmod("app.db", stat.S_IRUSR | stat.S_IWUSR)  # 600

# 민감 데이터: SQLCipher로 파일 자체를 암호화
# pip install sqlcipher3
import sqlcipher3

conn = sqlcipher3.connect("encrypted.db")
conn.execute("PRAGMA key='비밀키'")
conn.execute("CREATE TABLE IF NOT EXISTS secrets (data TEXT)")
```

## SQLite vs 다른 DB — 실용적 선택 기준

```
SQLite 사용:
  ✓ 로컬 앱 저장소 (모바일, 데스크탑, IoT)
  ✓ 테스트 환경 (설치 없는 인메모리 DB)
  ✓ CLI/스크립트 데이터 처리 (csv → sqlite3 → 분석)
  ✓ 단일 서버, 읽기 중심, 소규모 (< 수십만 RPS)
  ✓ 오프라인-퍼스트 캐시 + 서버 동기화

PostgreSQL / MySQL 사용:
  ✗ 다중 서버 인스턴스, 로드밸런서
  ✗ 동시 write가 수백 RPS 이상
  ✗ 세밀한 사용자 권한 제어 (RBAC)
  ✗ 원격 DB 관리 (pgAdmin, DataGrip 등)
  ✗ 고급 데이터 타입 (PostGIS, JSONB 등)

DuckDB 사용:
  ✗ 분석 쿼리 (GROUP BY, 윈도우 함수, 대용량 집계)
  ✗ 파일 기반 분석 (CSV/Parquet 직접 쿼리)
  ✗ OLAP 워크로드
```

```python
# 실전: pytest에서 SQLite 인메모리 DB로 빠른 테스트
import sqlite3
import pytest

@pytest.fixture
def db():
    conn = sqlite3.connect(":memory:")
    conn.executescript("""
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            amount REAL
        );
    """)
    conn.execute("PRAGMA foreign_keys = ON")
    yield conn
    conn.close()

def test_order_requires_user(db):
    with pytest.raises(sqlite3.IntegrityError):
        db.execute("INSERT INTO orders(user_id, amount) VALUES(999, 100)")
```

SQLite는 "DB 서버가 없어야 하는 곳"에서 세계 최고의 선택이다. 하지만 여러 서버가 필요하거나 동시 쓰기 요구가 높은 순간, 망설임 없이 클라이언트-서버 DB로 전환해야 한다. 올바른 도구를 올바른 곳에 사용하는 것, 그것이 SQLite 시리즈를 통해 전달하고자 한 핵심 메시지다.

---

**지난 글:** [SQLite 모바일·임베디드 환경 활용](/posts/sqlite-mobile-embedded/)

<br>
읽어주셔서 감사합니다. 😊
