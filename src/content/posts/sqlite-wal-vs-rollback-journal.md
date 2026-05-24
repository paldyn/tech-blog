---
title: "SQLite WAL 모드와 롤백 저널 — 트랜잭션 내구성 구현"
description: "SQLite 롤백 저널과 WAL 모드의 동작 원리, 파일 구조(.db-wal, .db-shm), 체크포인트 전략, 동시성 특성을 비교하고 실용적인 설정 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["SQLite", "WAL", "트랜잭션", "저널", "동시성", "체크포인트"]
featured: false
draft: false
---

[지난 글](/posts/sqlite-type-affinity/)에서 타입 어파이니티를 살펴봤다. 이번에는 SQLite가 **트랜잭션 내구성(Durability)** 과 **충돌 복구(Crash Recovery)** 를 어떻게 구현하는지, 두 가지 저널 모드의 차이를 다룬다.

## 저널 모드란

SQLite는 DB 파일을 직접 수정하기 전에 **저널(journal)** 파일을 통해 변경 내역을 관리한다. 이 메커니즘으로 트랜잭션 원자성(Atomicity)과 내구성(Durability)을 보장한다. 기본 모드는 **롤백 저널**, 권장 모드는 **WAL(Write-Ahead Log)** 이다.

## 롤백 저널 (기본)

롤백 저널은 "변경 전 원본을 백업한다"는 방식이다.

```
트랜잭션 시작
  └─ 수정할 페이지 원본을 app.db-journal에 저장
  └─ 수정된 페이지를 app.db에 직접 씀
COMMIT
  └─ app.db-journal 파일 삭제
ROLLBACK
  └─ app.db-journal에서 원본 페이지 복원
  └─ journal 파일 삭제
```

**크래시 복구**: 프로세스가 비정상 종료되면 `app.db-journal` 파일이 남는다. 다음 SQLite 연결 시 journal 파일을 발견하면 자동으로 롤백 복구를 수행한다.

**문제점**: 쓰기 트랜잭션 중 DB 파일 전체에 배타적 잠금이 걸린다. **읽기도 차단**된다.

![SQLite 저널 모드 비교 — Rollback vs WAL](/assets/posts/sqlite-wal-vs-rollback-journal-comparison.svg)

## WAL 모드 — 권장

WAL(Write-Ahead Logging) 모드는 "변경 내용을 별도 파일에 추가 기록한다"는 방식이다.

```
트랜잭션 시작
  └─ 현재 WAL 끝 위치(WAL read lock)를 기록
  └─ 변경된 페이지를 app.db-wal에 추가(append)
COMMIT
  └─ WAL 파일에 커밋 마커 추가
  └─ app.db는 아직 수정 안 됨
읽기 요청
  └─ SHM(공유 메모리)에서 WAL 인덱스 확인
  └─ 최신 커밋 버전 WAL 프레임 → DB 파일 순서로 읽음
체크포인트 (자동 또는 수동)
  └─ WAL 프레임들을 app.db에 반영
  └─ WAL 파일 재사용
```

![WAL 모드 동작 흐름](/assets/posts/sqlite-wal-vs-rollback-journal-wal.svg)

### WAL 파일 세 개

WAL 모드를 켜면 파일이 3개가 된다.

| 파일 | 역할 |
|---|---|
| `app.db` | 실제 DB (체크포인트 이전 버전) |
| `app.db-wal` | Write-Ahead Log (커밋된 변경 프레임) |
| `app.db-shm` | 공유 메모리 WAL 인덱스 (프레임 위치) |

`app.db-shm`은 운영체제의 공유 메모리로, 같은 DB를 여는 여러 프로세스가 WAL 프레임 위치를 공유한다. 이 때문에 NFS 같은 원격 파일시스템에서는 WAL이 불안정할 수 있다.

## WAL 설정

```python
import sqlite3

conn = sqlite3.connect("app.db")

# WAL 모드 활성화 (DB별로 지속, 프로세스 재시작 후에도 유지)
conn.execute("PRAGMA journal_mode = WAL")

# WAL 임계값: WAL 프레임이 1000개 넘으면 자동 체크포인트 실행
conn.execute("PRAGMA wal_autocheckpoint = 1000")

# synchronous 설정 (WAL에서는 NORMAL도 충분히 안전)
conn.execute("PRAGMA synchronous = NORMAL")
# DELETE(롤백): FULL 권장
# WAL: NORMAL(기본) — 체크포인트 시 fsync, 커밋 시 생략

conn.close()
```

```sql
-- 현재 저널 모드 확인
PRAGMA journal_mode;
-- wal

-- WAL 파일 크기 확인
PRAGMA wal_checkpoint(PASSIVE);
-- busy_count, log, checkpointed
```

## 체크포인트 전략

체크포인트는 WAL 프레임을 DB 파일에 반영하는 작업이다. 4가지 모드가 있다.

```sql
-- PASSIVE: 읽기/쓰기 트랜잭션이 없는 프레임만 반영 (차단 없음)
PRAGMA wal_checkpoint(PASSIVE);

-- FULL: 모든 writer가 끝날 때까지 기다린 후 전체 반영
PRAGMA wal_checkpoint(FULL);

-- RESTART: FULL + WAL 파일 시작부터 재사용 (파일 축소 없음)
PRAGMA wal_checkpoint(RESTART);

-- TRUNCATE: RESTART + WAL 파일 크기를 0으로 축소 (디스크 회수)
PRAGMA wal_checkpoint(TRUNCATE);
```

일반적으로:
- **WAL 파일이 너무 커지면**: `TRUNCATE` 체크포인트
- **읽기 부하 중**: `PASSIVE`로 조금씩
- **유지보수 창**: `TRUNCATE`로 완전 반영

## 동시성 특성

WAL의 핵심 장점은 **읽기와 쓰기가 서로를 차단하지 않는다**는 점이다.

```
Writer    : [쓰기 중 ─────────────]
Reader 1  :       [읽기 ────]
Reader 2  :            [읽기 ──────]
Checkpt   :                          [체크포인트]
```

단, **여전히 단일 writer**다. 동시에 두 개의 write 트랜잭션은 불가능하며, 두 번째 writer는 첫 번째가 끝날 때까지 `SQLITE_BUSY` 에러를 받는다.

```python
import sqlite3
import time

conn = sqlite3.connect("app.db")

# busy_timeout: SQLITE_BUSY 시 ms 동안 재시도
conn.execute("PRAGMA busy_timeout = 5000")  # 5초 대기

# 또는 isolation_level=None으로 autocommit 활용
conn2 = sqlite3.connect("app.db", timeout=5.0)
```

## 언제 WAL을 쓰면 안 되는가

```text
1. 원격 파일시스템 (NFS, SMB): SHM 파일 공유 메커니즘 불안정
2. 단일 접근, 쓰기 집중: 롤백 저널도 충분
3. 파일 개수 제약 환경: WAL은 3개 파일 필요
4. Android SQLite (구버전): WAL API 지원 여부 확인 필요
```

## 실용 설정 템플릿

```python
import sqlite3

def open_db(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.execute("PRAGMA cache_size = -32000")   # 32MB 캐시
    conn.execute("PRAGMA temp_store = MEMORY")
    conn.execute("PRAGMA mmap_size = 134217728")  # 128MB mmap
    conn.row_factory = sqlite3.Row  # 딕셔너리처럼 접근
    return conn
```

WAL 모드는 모바일 앱, 데스크탑 앱, 웹 서버 로컬 캐시 등 대부분의 시나리오에서 기본 롤백 저널보다 우수하다. 특히 읽기가 잦고 가끔 쓰기가 발생하는 패턴에서 체감 성능 차이가 크다.

---

**지난 글:** [SQLite 타입 어파이니티 — 유연한 타입 시스템 이해하기](/posts/sqlite-type-affinity/)

**다음 글:** [SQLite 동시성과 단일 writer 모델](/posts/sqlite-concurrency-single-writer/)

<br>
읽어주셔서 감사합니다. 😊
