---
title: "SQLite 단일 파일 구조와 페이지 레이아웃"
description: "SQLite가 모든 데이터를 단일 파일에 담는 방법, 100-byte 파일 헤더, 페이지 기반 B-Tree 구조, 셀 직렬화 포맷을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["SQLite", "파일구조", "B-Tree", "페이지", "스토리지"]
featured: false
draft: false
---

[지난 글](/posts/sqlite-library-form/)에서 SQLite가 라이브러리 형태로 동작한다는 것을 살펴봤다. 그렇다면 SQLite는 "단일 파일"에 데이터를 어떻게 저장할까? 이번에는 SQLite 파일 내부를 해부해 **페이지 레이아웃, B-Tree 구조, 레코드 직렬화** 방식을 들여다본다.

## 단일 파일의 의미

SQLite DB는 물리적으로 하나의 파일(기본 확장자 `.db` 또는 `.sqlite`)이다. 이 파일은:
- 스키마 정의 (`sqlite_master` / `sqlite_schema`)
- 모든 테이블 데이터
- 모든 인덱스 데이터
- 빈 공간 관리 정보(프리리스트)

를 모두 담는다. 데이터 이동, 백업, 배포가 **파일 복사 한 번**으로 끝난다.

```bash
# 파일 복사 = 완전한 백업
cp app.db app_backup.db

# 파일 크기 확인
ls -lh app.db
# -rw-r--r-- 1 user user 2.1M app.db

# 헥스 덤프로 매직 문자열 확인
xxd app.db | head -2
# 00000000: 5351 4c69 7465 2066 6f72 6d61 7420 3300  SQLite format 3.
```

## 파일 헤더 (100 bytes)

파일의 첫 100 바이트가 전역 헤더다. 항상 `SQLite format 3\000` 문자열(16 바이트)로 시작한다.

| 오프셋 | 크기 | 의미 |
|---|---|---|
| 0 | 16 | 매직 문자열 |
| 16 | 2 | 페이지 크기 (512~65536, 1=65536) |
| 18 | 1 | 파일 포맷 쓰기 버전 |
| 19 | 1 | 파일 포맷 읽기 버전 |
| 28 | 4 | 파일 변경 카운터 |
| 32 | 4 | 전체 페이지 수 |
| 36 | 4 | 프리리스트 트렁크 페이지 번호 |
| 40 | 4 | 프리리스트 전체 페이지 수 |
| 60 | 4 | 스키마 쿠키 |
| 64 | 4 | 스키마 포맷 번호 |

```sql
-- PRAGMA로 헤더 정보 조회
PRAGMA page_size;       -- 4096 (바이트)
PRAGMA page_count;      -- 전체 페이지 수
PRAGMA freelist_count;  -- 삭제 후 재사용 대기 페이지 수
PRAGMA schema_version;  -- 스키마 변경 카운터
PRAGMA user_version;    -- 애플리케이션 정의 버전 (0~2^31-1)
```

`user_version`은 SQLite 자체에서 사용하지 않는 4바이트 정수로, 애플리케이션이 DB 마이그레이션 버전을 추적하는 데 쓸 수 있다.

```python
import sqlite3

conn = sqlite3.connect("app.db")

# 스키마 버전을 마이그레이션 추적에 활용
version = conn.execute("PRAGMA user_version").fetchone()[0]
if version < 1:
    conn.execute("ALTER TABLE users ADD COLUMN created_at TEXT")
    conn.execute("PRAGMA user_version = 1")
    conn.commit()

conn.close()
```

## 페이지 구조

SQLite 파일은 동일 크기의 **페이지** 배열이다. 기본 페이지 크기는 4096 바이트이며, DB 생성 시 512 ~ 65536 바이트(2의 거듭제곱) 범위에서 한 번 설정할 수 있다.

![SQLite 단일 파일 레이아웃](/assets/posts/sqlite-single-file-page-layout.svg)

### 페이지 유형

| 유형 | 역할 |
|---|---|
| B-Tree 인테리어 노드 | 자식 페이지 포인터 + 분기 키 |
| B-Tree 리프 노드 | 실제 행 데이터(테이블) 또는 키(인덱스) |
| 오버플로 페이지 | 4096 바이트를 초과하는 BLOB/TEXT 저장 |
| 프리리스트 트렁크 | 삭제된 페이지의 번호 목록 |
| 프리리스트 리프 | 프리리스트 페이지 번호 오버플로 |

## B-Tree와 페이지 탐색

SQLite의 테이블은 **rowid 순서의 B-Tree**로 저장된다(`WITHOUT ROWID` 옵션 제외). 인덱스도 별도 B-Tree로 관리된다.

![SQLite B-Tree 페이지 탐색](/assets/posts/sqlite-single-file-page-btree.svg)

### 리프 페이지 내부

리프 페이지는 **셀 포인터 배열 + 셀 콘텐츠 영역**으로 나뉜다. 셀 포인터는 페이지 앞쪽에서 뒤로 성장하고, 셀 콘텐츠는 페이지 뒤쪽에서 앞으로 성장한다. 둘이 만나면 페이지가 꽉 찬 것이다.

### 레코드 직렬화

각 셀(행)은 SQLite 고유의 바이너리 포맷으로 직렬화된다. varint(가변 길이 정수)를 사용해 작은 값을 적은 바이트로 인코딩한다.

```sql
-- 레코드 타입 코드 예시
-- 0: NULL
-- 1: 1-byte INTEGER
-- 2: 2-byte INTEGER
-- ...
-- 7: IEEE-754 REAL
-- 8: INTEGER 0
-- 9: INTEGER 1
-- N>=12 even: BLOB (길이 = (N-12)/2)
-- N>=13 odd:  TEXT (길이 = (N-13)/2)
```

## 오버플로 페이지

셀 콘텐츠가 페이지에 다 들어가지 않으면 **오버플로 페이지 체인**으로 이어진다. 오버플로 페이지 첫 4바이트는 다음 오버플로 페이지 번호(0이면 마지막)다.

```sql
-- 큰 BLOB/TEXT가 많은 테이블: 오버플로 페이지 증가
CREATE TABLE docs (
    id      INTEGER PRIMARY KEY,
    content TEXT    -- 수 MB 크기
);

-- 오버플로를 줄이기 위해 페이지 크기를 늘릴 수 있음 (DB 생성 시에만)
-- PRAGMA page_size = 8192;  -- 새 DB에서만 효과
-- CREATE TABLE docs (...);

-- 현재 오버플로 현황 확인
PRAGMA dbstat;
-- type, name, path, pageno, pagetype, ncell, payload, unused, mx_payload
```

## 프리리스트와 VACUUM

행을 삭제하거나 테이블을 DROP하면 해당 페이지들이 **프리리스트**에 등록된다. SQLite는 새 데이터를 쓸 때 프리리스트에서 페이지를 재사용한다. 하지만 파일 크기는 자동으로 줄어들지 않는다.

```sql
-- 파일 크기를 실제 데이터 크기에 맞게 축소
VACUUM;

-- 자동 VACUUM 설정
PRAGMA auto_vacuum = INCREMENTAL;  -- 증분 방식 (삽입 시 조금씩 정리)
PRAGMA incremental_vacuum(100);    -- 100페이지씩 정리

-- 무결성 검사
PRAGMA integrity_check;  -- 이상 없으면 "ok" 반환
PRAGMA quick_check;      -- 빠른 버전 (B-Tree 구조만)
```

파일 구조를 이해하면 `PRAGMA page_size`, `PRAGMA cache_size`, `VACUUM` 같은 튜닝 명령의 효과를 직관적으로 이해할 수 있다. 특히 WAL 모드에서는 파일이 `.db`, `.db-wal`, `.db-shm` 세 개로 나뉘는데, 이는 다음 글에서 다룬다.

---

**지난 글:** [SQLite — 라이브러리 형태와 임베디드 DB의 의미](/posts/sqlite-library-form/)

**다음 글:** [SQLite 타입 어파이니티 — 유연한 타입 시스템 이해하기](/posts/sqlite-type-affinity/)

<br>
읽어주셔서 감사합니다. 😊
