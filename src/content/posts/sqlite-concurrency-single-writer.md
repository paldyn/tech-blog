---
title: "SQLite 동시성과 단일 writer 모델"
description: "SQLite의 5단계 잠금 상태, 단일 writer 제약, WAL 모드 동시성, BEGIN IMMEDIATE 패턴, 멀티스레드/멀티프로세스 안전 사용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["SQLite", "동시성", "잠금", "WAL", "멀티스레드", "BEGIN IMMEDIATE"]
featured: false
draft: false
---

[지난 글](/posts/sqlite-wal-vs-rollback-journal/)에서 WAL 모드가 읽기와 쓰기를 동시에 허용한다는 점을 살펴봤다. 그러나 "읽기와 쓰기 동시"는 가능해도 **"쓰기와 쓰기 동시"는 SQLite에서 근본적으로 불가능**하다. 이번에는 SQLite의 단일 writer 모델과 잠금 메커니즘을 자세히 다룬다.

## 5단계 잠금 상태

SQLite는 파일 수준 잠금으로 동시성을 제어한다. 단순한 읽기/쓰기 잠금이 아닌 5단계 상태 기계를 사용한다.

![SQLite 잠금 상태 전이](/assets/posts/sqlite-concurrency-single-writer-locks.svg)

| 상태 | 설명 | 동시 허용 |
|---|---|---|
| UNLOCKED | 잠금 없음 | N/A |
| SHARED | 읽기 잠금 | N개 동시 SHARED |
| RESERVED | 쓰기 예약 (쓰기 의도 표명) | SHARED + 1개 RESERVED |
| PENDING | 기존 SHARED 소멸 대기 | 새 SHARED 차단 |
| EXCLUSIVE | 배타적 쓰기 | 단독 |

읽기 트랜잭션은 SHARED를 획득한다. 쓰기 트랜잭션은 RESERVED → PENDING → EXCLUSIVE 순서로 전이한다. PENDING 상태에서 기존 SHARED 트랜잭션들이 모두 종료되면 EXCLUSIVE로 승격된다.

## WAL 모드의 잠금 차이

WAL 모드에서는 잠금 메커니즘이 달라진다.

- **읽기 트랜잭션**: WAL 인덱스(SHM)에서 읽기 마크만 설정 (DB 파일 SHARED 불필요)
- **쓰기 트랜잭션**: WAL 파일에 RESERVED와 유사한 WAL Write Lock
- **체크포인트**: DB 파일 EXCLUSIVE 잠금 필요

결과적으로 WAL에서는 읽기가 쓰기를 차단하지 않고, 쓰기도 읽기를 차단하지 않는다. 단, **writer는 여전히 1개만** 허용된다.

## 트랜잭션 유형과 시작 방법

```sql
-- 1. BEGIN DEFERRED (기본값)
--    처음에는 UNLOCKED. 첫 읽기 시 SHARED, 첫 쓰기 시 RESERVED 획득
BEGIN;
SELECT ...;   -- SHARED 획득
UPDATE ...;   -- RESERVED → EXCLUSIVE 시도 (이 시점에 충돌 위험)
COMMIT;

-- 2. BEGIN IMMEDIATE
--    시작 즉시 RESERVED 획득 (SHARED는 계속 허용)
--    쓰기 의도가 있으면 이 방식을 사용
BEGIN IMMEDIATE;
SELECT ...;   -- RESERVED 상태에서 읽기
UPDATE ...;   -- 이미 RESERVED라서 안전
COMMIT;

-- 3. BEGIN EXCLUSIVE
--    시작 즉시 EXCLUSIVE 획득 (읽기도 차단)
--    롤백 저널 모드에서 극단적 직렬화 시
BEGIN EXCLUSIVE;
UPDATE ...;
COMMIT;
```

`BEGIN DEFERRED`에서 발생하는 문제: 두 연결이 동시에 BEGIN을 실행하고 둘 다 SELECT를 한 뒤 UPDATE를 시도하면 둘 다 SHARED 상태에서 RESERVED로 승격하려 해 **SQLITE_BUSY** 충돌이 발생한다. `BEGIN IMMEDIATE`를 사용하면 시작 시점에 하나가 대기하므로 충돌이 없다.

![SQLite 동시성 패턴 — 멀티스레드 안전 사용법](/assets/posts/sqlite-concurrency-single-writer-patterns.svg)

## SQLITE_BUSY와 재시도

```python
import sqlite3
import time

def execute_with_retry(conn, sql, params=(), max_retries=5):
    for attempt in range(max_retries):
        try:
            conn.execute(sql, params)
            conn.commit()
            return
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e):
                time.sleep(0.1 * (2 ** attempt))  # 지수 백오프
            else:
                raise
    raise RuntimeError("DB 잠금 획득 실패")

# busy_timeout PRAGMA가 더 나은 방법
conn = sqlite3.connect("app.db", timeout=10.0)
conn.execute("PRAGMA busy_timeout = 10000")  # ms
```

`busy_timeout`은 SQLITE_BUSY 발생 시 SQLite 내부에서 자동으로 재시도한다. 명시적 재시도 루프보다 효율적이다.

## 멀티스레드 사용 패턴

Python의 `sqlite3` 모듈은 기본적으로 같은 연결을 다른 스레드에서 사용하는 것을 허용하지 않는다(`check_same_thread=True`). 안전하게 멀티스레드를 사용하려면 두 가지 방법이 있다.

### 방법 1: 스레드별 독립 연결 (WAL 모드 권장)

```python
import sqlite3
import threading

_local = threading.local()

def get_conn() -> sqlite3.Connection:
    if not hasattr(_local, 'db') or _local.db is None:
        conn = sqlite3.connect("app.db", timeout=10.0)
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA busy_timeout = 10000")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.row_factory = sqlite3.Row
        _local.db = conn
    return _local.db

def close_conn():
    if hasattr(_local, 'db') and _local.db:
        _local.db.close()
        _local.db = None

# 각 스레드에서 get_conn() 호출로 해당 스레드 전용 연결 사용
def worker_task(item_id: int):
    conn = get_conn()
    # 읽기는 그냥 SELECT
    row = conn.execute(
        "SELECT * FROM items WHERE id = ?", (item_id,)
    ).fetchone()
    
    # 쓰기는 BEGIN IMMEDIATE로
    with conn:  # conn.__enter__ = BEGIN, __exit__ = COMMIT/ROLLBACK
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "UPDATE items SET processed = 1 WHERE id = ?",
            (item_id,)
        )
```

### 방법 2: 단일 연결 + 직렬화

```python
import sqlite3
import threading
from contextlib import contextmanager

class SerializedDB:
    def __init__(self, path: str):
        self._conn = sqlite3.connect(
            path,
            check_same_thread=False  # 직렬화로 안전 보장
        )
        self._conn.execute("PRAGMA journal_mode = WAL")
        self._lock = threading.Lock()

    @contextmanager
    def transaction(self):
        with self._lock:
            try:
                self._conn.execute("BEGIN IMMEDIATE")
                yield self._conn
                self._conn.execute("COMMIT")
            except Exception:
                self._conn.execute("ROLLBACK")
                raise

db = SerializedDB("app.db")

def update_stock(product_id: int, qty: int):
    with db.transaction() as conn:
        conn.execute(
            "UPDATE products SET stock = stock - ? WHERE id = ?",
            (qty, product_id)
        )
```

## 멀티프로세스 접근

여러 독립 프로세스가 같은 SQLite 파일에 접근하는 것은 **WAL 모드 + busy_timeout**으로 가능하다. 단, 모든 프로세스가 같은 호스트에서 실행되어야 하며 원격 파일시스템은 피해야 한다.

```bash
# 프로세스 A: 읽기 전용 접근
sqlite3 app.db "SELECT COUNT(*) FROM logs;"

# 프로세스 B: 쓰기 (WAL에서 위와 동시 실행 가능)
sqlite3 app.db "INSERT INTO logs VALUES (datetime('now'), 'event');"
```

## 성능 한계와 대안

SQLite는 초당 수만 건의 단순 INSERT를 처리할 수 있다. 하지만 **동시 쓰기가 많은 웹 서버** 환경에서는 병목이 된다.

```
단일 writer 한계가 문제인 경우:
  - 요청당 DB 쓰기가 필요한 웹 API (트래픽 > 수백 RPS)
  - 여러 서버 인스턴스가 공유 DB를 쓰는 경우
  → PostgreSQL / MySQL로 전환 고려

SQLite로 충분한 경우:
  - 읽기 중심 앱 (블로그, 설정 저장소)
  - 큐(Queue)처럼 한 프로세스만 쓰는 패턴
  - 배치 처리 (단일 트랜잭션에 묶어 처리)
```

```python
# 배치 INSERT: 단일 트랜잭션으로 성능 극대화
def bulk_insert(conn, rows):
    conn.execute("BEGIN")
    try:
        conn.executemany(
            "INSERT INTO events (ts, data) VALUES (?, ?)",
            rows
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise

# 1000건 개별 INSERT vs 한 번에 → 100배 이상 빠름
```

SQLite의 단일 writer 모델은 제약이지만 동시에 구현 단순성의 원천이기도 하다. 이 모델을 이해하고 적합한 사용 패턴을 선택하면 놀랍도록 효율적인 로컬 데이터 저장소로 활용할 수 있다.

---

**지난 글:** [SQLite WAL 모드와 롤백 저널 — 트랜잭션 내구성 구현](/posts/sqlite-wal-vs-rollback-journal/)

**다음 글:** [SQLite FTS5 — 전문 검색 구현하기](/posts/sqlite-fts5/)

<br>
읽어주셔서 감사합니다. 😊
