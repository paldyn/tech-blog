---
title: "SQLite — 라이브러리 형태와 임베디드 DB의 의미"
description: "SQLite가 왜 '라이브러리'인지, 클라이언트-서버 DB와 무엇이 다른지, C API 구조와 주요 언어 바인딩, 그리고 실제 사용 시나리오를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["SQLite", "임베디드DB", "라이브러리", "C API", "Python", "모바일"]
featured: false
draft: false
---

[지난 글](/posts/mssql-ssrs-reporting/)에서 SQL Server의 보고서 플랫폼을 살펴봤다면, 이번부터는 방향을 완전히 바꿔 **SQLite** 시리즈를 시작한다. SQLite는 세상에서 가장 많이 배포된 데이터베이스 엔진이지만, "설치"나 "서버 설정" 없이 쓸 수 있는 이유가 바로 **라이브러리 형태**에 있다.

## 라이브러리 형태란 무엇인가

일반적인 데이터베이스(PostgreSQL, MySQL, SQL Server)는 **독립 프로세스**로 동작한다. 애플리케이션은 TCP/IP 소켓 또는 IPC로 DB 서버에 연결하고, 쿼리를 텍스트로 전송하며, 결과를 네트워크를 통해 받는다. 이는 서버 설치·설정·인증·연결 풀 관리 등의 인프라를 수반한다.

SQLite는 전혀 다른 모델을 택한다. 전체 데이터베이스 엔진이 **단일 C 라이브러리**(`libsqlite3.so` / `sqlite3.dll` / `libsqlite3.a`)로 패키징되어, 애플리케이션 코드와 **같은 프로세스 내**에 링크된다. DB 작업은 함수 호출이고, 네트워크는 없다.

![SQLite — 라이브러리 임베딩 구조](/assets/posts/sqlite-library-form-architecture.svg)

### 핵심 특징 요약

| 특성 | SQLite | PostgreSQL / MySQL |
|---|---|---|
| 동작 형태 | 라이브러리 (같은 프로세스) | 독립 서버 프로세스 |
| 설치 | 없음 (헤더+라이브러리 링크) | DB 서버 설치 필요 |
| 연결 | 파일 open / 인메모리 create | TCP 소켓 / Unix 소켓 |
| 인증 | 없음 (파일 권한으로 제어) | 사용자/패스워드/역할 |
| 다중 접속 | 단일 프로세스 + WAL | 수천 개 동시 접속 |
| 배포 | 파일 복사 | DB 서버 설치 + 마이그레이션 |

## SQLite의 물리적 크기

SQLite 전체 소스 코드는 `sqlite3.c` 단일 파일 ("amalgamation") 약 23만 줄이다. 컴파일된 바이너리는 약 1 MB 미만이다. 이 덕분에 모든 플랫폼에서 빌드하거나 앱 번들에 포함하기 쉽다.

```bash
# Ubuntu에서 SQLite 설치 (이미 대부분 기본 포함)
sudo apt install sqlite3 libsqlite3-dev

# 소스에서 빌드 (amalgamation 단일 파일)
wget https://sqlite.org/2026/sqlite-amalgamation-3450000.zip
unzip sqlite-amalgamation-3450000.zip
gcc -o sqlite3 sqlite3.c shell.c -lpthread -ldl

# Python은 표준 라이브러리에 포함 — 별도 설치 없음
python3 -c "import sqlite3; print(sqlite3.sqlite_version)"
# 3.45.0
```

## C API 구조

SQLite의 모든 언어 바인딩은 내부적으로 C API를 래핑한다. C API를 이해하면 어느 언어 바인딩을 쓰든 동작 원리가 명확해진다.

![SQLite C API 흐름과 언어 바인딩](/assets/posts/sqlite-library-form-api.svg)

### 준비된 문(Prepared Statement) 사용이 필수

SQLite에서는 파라미터 바인딩(`?` 플레이스홀더)을 항상 사용해야 한다. 문자열 접합으로 SQL을 만들면 SQL 인젝션과 타입 변환 오류가 동시에 발생한다.

```python
import sqlite3

conn = sqlite3.connect("app.db")
cur = conn.cursor()

# 안전: 파라미터 바인딩
cur.execute(
    "INSERT INTO users (name, email) VALUES (?, ?)",
    ("홍길동", "hong@example.com")
)

# 위험: 문자열 접합 (절대 사용 금지)
# name = "'; DROP TABLE users; --"
# cur.execute(f"INSERT INTO users (name) VALUES ('{name}')")

conn.commit()
conn.close()
```

### 인메모리 데이터베이스

파일 경로 대신 `:memory:`를 전달하면 디스크를 쓰지 않는 **인메모리 DB**가 만들어진다. 프로세스 종료 시 자동 소멸하므로 테스트·캐싱·임시 계산에 유용하다.

```python
import sqlite3

# 인메모리 DB — 테스트에 활용
conn = sqlite3.connect(":memory:")
conn.execute("""
    CREATE TABLE orders (
        id      INTEGER PRIMARY KEY,
        item    TEXT    NOT NULL,
        qty     INTEGER NOT NULL,
        amount  REAL    NOT NULL
    )
""")
conn.executemany(
    "INSERT INTO orders VALUES (?, ?, ?, ?)",
    [(1, "사과", 3, 4500.0),
     (2, "바나나", 5, 6750.0)]
)
total = conn.execute("SELECT SUM(amount) FROM orders").fetchone()[0]
print(f"합계: {total:,.0f}원")  # 합계: 11,250원
conn.close()
```

## 언어별 사용법 비교

### Java (xerial sqlite-jdbc)

```java
// pom.xml: org.xerial:sqlite-jdbc
import java.sql.*;

try (Connection conn =
         DriverManager.getConnection("jdbc:sqlite:app.db");
     PreparedStatement ps = conn.prepareStatement(
         "SELECT * FROM users WHERE id = ?")) {
    ps.setInt(1, 42);
    try (ResultSet rs = ps.executeQuery()) {
        while (rs.next()) {
            System.out.println(rs.getString("name"));
        }
    }
}
```

### JavaScript (better-sqlite3)

```javascript
const Database = require('better-sqlite3');
const db = new Database('app.db');

// better-sqlite3는 동기 API — 동시성 이슈 없음
const stmt = db.prepare(
    'SELECT * FROM users WHERE email = ?'
);
const user = stmt.get('hong@example.com');
console.log(user);

db.close();
```

### Rust (rusqlite)

```rust
use rusqlite::{Connection, params};

fn main() -> rusqlite::Result<()> {
    let conn = Connection::open("app.db")?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS items (
             id    INTEGER PRIMARY KEY,
             name  TEXT NOT NULL
         )",
        [],
    )?;
    conn.execute(
        "INSERT INTO items (name) VALUES (?1)",
        params!["사과"],
    )?;
    Ok(())
}
```

## SQLite가 적합하지 않은 경우

SQLite는 단일 writer 모델이라 **쓰기가 많은 다중 프로세스 환경**에서 성능이 급격히 떨어진다. 다음 상황에서는 서버형 DB를 선택해야 한다.

- 여러 프로세스가 동시에 많은 쓰기 수행
- 수 GB를 넘는 대용량 데이터에 복잡한 쿼리
- 네트워크를 통한 다중 클라이언트 동시 접속
- 세밀한 권한 제어 (행 수준 보안 등)

그러나 조회 중심·단일 프로세스 쓰기·로컬 스토리지 요구사항이라면 SQLite는 서버 DB보다 훨씬 단순하고 빠르다.

---

**지난 글:** [SQL Server SSRS — 보고서 서버와 구독 보고서 설계](/posts/mssql-ssrs-reporting/)

**다음 글:** [SQLite 단일 파일과 페이지 구조](/posts/sqlite-single-file-page/)

<br>
읽어주셔서 감사합니다. 😊
