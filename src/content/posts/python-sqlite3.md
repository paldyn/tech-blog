---
title: "sqlite3: 내장 관계형 데이터베이스"
description: "Python sqlite3 모듈 사용법을 정리합니다. Connection과 Cursor, execute/executemany, row_factory, 트랜잭션 관리, SQL 인젝션 방지, 메모리 DB 활용, 커스텀 타입 어댑터까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "sqlite3", "데이터베이스", "SQL", "트랜잭션", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-pickle/)에서 `pickle`로 Python 객체를 직렬화하는 방법을 살펴봤습니다. 이번 글에서는 Python에 내장된 관계형 데이터베이스 `sqlite3`를 다룹니다. 별도 서버 없이 파일 하나로 완전한 SQL 데이터베이스를 쓸 수 있어서, 소규모 앱, 로컬 캐시, 테스트 환경에서 매우 유용합니다.

## 기본 연결과 테이블 생성

```python
import sqlite3

# 파일 DB — 없으면 새로 생성
conn = sqlite3.connect('app.db')

# 메모리 DB — 프로세스 종료 시 사라짐 (테스트에 적합)
conn = sqlite3.connect(':memory:')

# 테이블 생성
conn.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age  INTEGER,
        email TEXT UNIQUE
    )
""")
conn.commit()
conn.close()
```

## with 문으로 트랜잭션 관리

`with sqlite3.connect(...)` 패턴을 사용하면 블록이 정상 종료될 때 자동으로 `commit()`, 예외 발생 시 `rollback()`을 수행합니다.

```python
import sqlite3

with sqlite3.connect('app.db') as conn:
    conn.execute(
        "INSERT INTO users (name, age) VALUES (?, ?)",
        ('Alice', 30)
    )
    conn.execute(
        "INSERT INTO users (name, age) VALUES (?, ?)",
        ('Bob', 25)
    )
    # 블록 종료 시 자동 commit
```

![sqlite3 구조](/assets/posts/python-sqlite3-flow.svg)

## SQL 인젝션 방지: 파라미터 바인딩

절대로 f-string이나 문자열 포매팅으로 SQL을 만들지 마세요.

```python
# 절대 금지 — SQL 인젝션 취약
name = user_input
conn.execute(f"SELECT * FROM users WHERE name = '{name}'")
# name = "'; DROP TABLE users; --" 이면 테이블 삭제됨!

# 올바른 방법 1: ? 플레이스홀더
conn.execute("SELECT * FROM users WHERE name = ?", (name,))

# 올바른 방법 2: :name 형식 (가독성 높음)
conn.execute(
    "SELECT * FROM users WHERE name = :name AND age > :age",
    {'name': name, 'age': 18}
)
```

## 데이터 조회

```python
import sqlite3

with sqlite3.connect('app.db') as conn:
    # 커서로 조회
    cursor = conn.execute("SELECT * FROM users WHERE age > ?", (20,))
    
    # 한 행씩
    row = cursor.fetchone()    # 첫 번째 행 또는 None
    
    # 전체
    rows = cursor.fetchall()   # [(1, 'Alice', 30), ...]
    
    # 이터레이터로 (메모리 효율)
    for row in conn.execute("SELECT * FROM users"):
        print(row)
```

## row_factory로 dict처럼 접근

기본은 튜플로 반환되어 컬럼 이름 대신 인덱스를 써야 합니다. `sqlite3.Row`를 `row_factory`로 설정하면 컬럼 이름으로 접근 가능합니다.

```python
import sqlite3

with sqlite3.connect('app.db') as conn:
    conn.row_factory = sqlite3.Row   # 핵심 설정
    
    rows = conn.execute("SELECT id, name, age FROM users").fetchall()
    for row in rows:
        print(row['name'], row['age'])   # 컬럼명으로 접근
        print(dict(row))                  # 딕셔너리로 변환
```

![sqlite3 코드 패턴](/assets/posts/python-sqlite3-code.svg)

## executemany — 배치 삽입

```python
import sqlite3

users = [
    ('Charlie', 28),
    ('Diana',   32),
    ('Eve',     27),
]

with sqlite3.connect('app.db') as conn:
    conn.executemany(
        "INSERT INTO users (name, age) VALUES (?, ?)",
        users
    )
# conn.commit()은 with 블록에서 자동 처리
```

`executemany()`는 단건 `execute()`를 루프로 반복하는 것보다 훨씬 빠릅니다.

## 커스텀 타입 어댑터와 변환기

Python `datetime`처럼 SQLite가 지원하지 않는 타입을 저장할 때 씁니다.

```python
import sqlite3
import datetime

# 어댑터: Python → SQLite (저장 시)
sqlite3.register_adapter(datetime.date, lambda d: d.isoformat())

# 변환기: SQLite → Python (읽을 때)
sqlite3.register_converter(
    'DATE',
    lambda s: datetime.date.fromisoformat(s.decode())
)

with sqlite3.connect('app.db', detect_types=sqlite3.PARSE_DECLTYPES) as conn:
    conn.execute("CREATE TABLE events (name TEXT, date DATE)")
    conn.execute("INSERT INTO events VALUES (?, ?)", ('Launch', datetime.date(2026, 5, 21)))
    
    row = conn.execute("SELECT * FROM events").fetchone()
    print(type(row[1]))   # <class 'datetime.date'>
```

## 트랜잭션 격리 수준

```python
# isolation_level=None → autocommit 모드 (트랜잭션 없음)
conn = sqlite3.connect('app.db', isolation_level=None)

# isolation_level='DEFERRED' (기본)
# isolation_level='IMMEDIATE'
# isolation_level='EXCLUSIVE'
```

## 실전: 간단한 캐시 저장소

```python
import sqlite3
import json
from datetime import datetime

class LocalCache:
    def __init__(self, path='cache.db'):
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT
            )
        """)

    def set(self, key, value):
        with self.conn:
            self.conn.execute(
                "INSERT OR REPLACE INTO cache VALUES (?, ?, ?)",
                (key, json.dumps(value), datetime.now().isoformat())
            )

    def get(self, key):
        row = self.conn.execute(
            "SELECT value FROM cache WHERE key = ?", (key,)
        ).fetchone()
        return json.loads(row['value']) if row else None
```

`INSERT OR REPLACE`는 key가 이미 있으면 업데이트, 없으면 삽입합니다.

---

**지난 글:** [pickle: Python 객체 직렬화](/posts/python-pickle/)

**다음 글:** [uuid: 유일 식별자 생성](/posts/python-uuid/)

<br>
읽어주셔서 감사합니다. 😊
