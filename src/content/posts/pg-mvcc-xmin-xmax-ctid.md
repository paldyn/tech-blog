---
title: "MVCC — xmin, xmax, ctid로 이해하는 다중 버전 동시성"
description: "PostgreSQL MVCC의 핵심인 xmin(삽입 트랜잭션 ID), xmax(삭제/업데이트 트랜잭션 ID), ctid(물리 위치)의 역할, 튜플 버전 체인 구조, 스냅샷 기반 가시성 판단 알고리즘을 실무 쿼리와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["postgresql", "mvcc", "xmin", "xmax", "ctid", "snapshot", "visibility", "transaction-id", "heap-tuple"]
featured: false
draft: false
---

[지난 글](/posts/pg-table-inheritance/)에서 테이블 상속 구조를 살펴봤다. 이번에는 PostgreSQL의 동시성 제어의 심장부인 **MVCC(Multi-Version Concurrency Control)**를 xmin, xmax, ctid라는 시스템 컬럼으로 분해해 이해한다.

## MVCC의 핵심 아이디어

PostgreSQL은 UPDATE와 DELETE 시 기존 튜플을 즉시 지우지 않는다. 대신 **새 버전의 튜플을 추가**하고, 어떤 트랜잭션이 어느 버전을 볼 수 있는지를 트랜잭션 ID(XID)로 판단한다.

이 방식의 장점:
- **읽기가 쓰기를 차단하지 않음**: SELECT가 UPDATE를 기다리지 않는다.
- **쓰기가 읽기를 차단하지 않음**: UPDATE가 SELECT를 기다리지 않는다.
- **과거 버전 조회 가능**: 스냅샷 격리에서 트랜잭션 시작 시점의 데이터를 본다.

## 튜플 시스템 컬럼

각 튜플(행)은 사용자 컬럼 외에 숨겨진 시스템 컬럼을 가진다.

| 컬럼 | 의미 |
|------|------|
| `xmin` | 이 버전을 삽입한 트랜잭션 ID |
| `xmax` | 이 버전을 삭제/업데이트한 트랜잭션 ID (0=없음) |
| `ctid` | 튜플의 물리적 위치 (페이지번호, 슬롯번호) |
| `cmin` | 같은 트랜잭션 내 INSERT의 명령 순번 |
| `cmax` | 같은 트랜잭션 내 DELETE의 명령 순번 |

```sql
-- 시스템 컬럼 직접 조회
SELECT xmin, xmax, ctid, id, name, age
FROM person
WHERE id = 1;
--  xmin | xmax | ctid  | id | name  | age
-- ------+------+-------+----+-------+-----
--   102 |    0 | (0,3) |  1 | Alice |  32
```

![MVCC 튜플 버전 체인](/assets/posts/pg-mvcc-xmin-xmax-ctid-tuple.svg)

## 버전 체인 예시

```sql
-- Txn 100: INSERT
BEGIN;  -- xid = 100
INSERT INTO person (id, name, age) VALUES (1, 'Alice', 30);
COMMIT;
-- 튜플 (0,1): xmin=100, xmax=0

-- Txn 101: UPDATE
BEGIN;  -- xid = 101
UPDATE person SET age = 31 WHERE id = 1;
COMMIT;
-- 튜플 (0,1): xmin=100, xmax=101  ← Dead
-- 튜플 (0,2): xmin=101, xmax=0    ← Live

-- Txn 102: UPDATE again
BEGIN;  -- xid = 102
UPDATE person SET age = 32 WHERE id = 1;
COMMIT;
-- 튜플 (0,2): xmin=101, xmax=102  ← Dead
-- 튜플 (0,3): xmin=102, xmax=0    ← Live
```

`ctid`가 `(페이지, 슬롯)` 형태로 변경되는 것이 버전 체인을 나타낸다. Live 튜플의 ctid는 자기 자신을 가리키고, Dead 튜플의 ctid는 다음 버전을 가리킨다.

## 스냅샷과 가시성 판단

트랜잭션이 시작되면 **스냅샷**을 획득한다. 스냅샷은 세 값으로 표현된다.

```
xmin : xmax : xip_list
100  : 103  : 101,102
```

- `xmin`: 이 값보다 작은 XID는 모두 커밋됨 (볼 수 있음)
- `xmax`: 이 값 이상의 XID는 모두 미시작 (볼 수 없음)
- `xip_list`: 그 사이에서 아직 진행 중인 트랜잭션 목록

```sql
-- 현재 스냅샷 조회
SELECT pg_current_snapshot();
-- 100:103:101,102

-- 특정 XID가 내 스냅샷 기준 커밋됐는지
SELECT pg_snapshot_xmin(pg_current_snapshot());  -- 100
SELECT pg_snapshot_xmax(pg_current_snapshot());  -- 103
```

![xmin·xmax·ctid 직접 조회](/assets/posts/pg-mvcc-xmin-xmax-ctid-query.svg)

## 가시성 알고리즘

튜플이 보이려면 두 조건을 모두 만족해야 한다.

1. **xmin이 커밋됨**: xmin < 스냅샷 xmin, 또는 xmin이 xip에 없고 xmin < 스냅샷 xmax
2. **xmax가 미커밋(또는 0)**: xmax = 0, 또는 xmax > 스냅샷 xmax, 또는 xmax가 xip에 있음

```sql
-- 가시성 확인 유틸리티 (pageinspect 확장)
CREATE EXTENSION pageinspect;

SELECT lp, t_xmin, t_xmax, t_ctid, t_infomask
FROM heap_page_items(get_raw_page('person', 0));
```

`t_infomask`의 비트 플래그로 xmin 커밋 여부, xmax 커밋 여부를 확인할 수 있다.

## UPDATE는 DELETE + INSERT

PostgreSQL의 UPDATE는 내부적으로 **기존 튜플을 Dead로 표시 + 새 튜플 삽입**이다.

```sql
-- UPDATE 전
SELECT ctid, xmin, xmax, age FROM person WHERE id = 1;
-- (0,3) | 102 | 0 | 32

-- UPDATE 실행
UPDATE person SET age = 33 WHERE id = 1;

-- UPDATE 후
SELECT ctid, xmin, xmax, age FROM person WHERE id = 1;
-- (0,4) | 103 | 0 | 33

-- 이전 위치 (Dead 튜플, VACUUM 전까지 남음)
-- (0,3): xmin=102, xmax=103
```

이 때문에 UPDATE가 많으면 Dead 튜플이 쌓이고, VACUUM이 이를 회수한다.

## HOT Update — 같은 페이지면 ctid 체인

같은 힙 페이지 내에 업데이트가 가능하면 인덱스를 수정하지 않고 **ctid 체인**만 연결한다. 이를 HOT(Heap Only Tuple) Update라 한다.

```sql
-- HOT 통계 확인
SELECT n_tup_upd, n_tup_hot_upd,
       round(n_tup_hot_upd::numeric / NULLIF(n_tup_upd, 0) * 100, 1) AS hot_pct
FROM pg_stat_user_tables
WHERE relname = 'person';
```

`hot_pct`가 높을수록 인덱스 업데이트 비용이 절감된다. 빈번하게 UPDATE하는 컬럼에 인덱스를 많이 걸면 HOT이 불가능해져 성능이 저하된다.

## 트랜잭션 ID 래핑 (XID Wraparound)

XID는 32비트 정수다. 약 21억 건을 넘으면 **래핑(Wraparound)** 위험이 발생한다. 오래된 트랜잭션이 "미래"로 보여 가시성 오류가 생긴다.

```sql
-- 가장 오래된 XID 확인
SELECT datname,
       age(datfrozenxid) AS xid_age,
       datfrozenxid
FROM pg_database
ORDER BY age(datfrozenxid) DESC;
```

`age(datfrozenxid)`가 2억을 넘으면 경고, 20억이면 강제 종료. VACUUM FREEZE로 오래된 튜플의 xmin을 `FrozenXID`로 교체해 예방한다.

```sql
-- 강제 freeze
VACUUM FREEZE VERBOSE person;
```

## 정리

PostgreSQL MVCC는 "잠금 없는 읽기"를 위해 모든 변경을 새 버전 튜플로 추가하는 방식으로 동작한다. xmin은 이 버전을 만든 트랜잭션, xmax는 이 버전을 폐기한 트랜잭션, ctid는 현재 버전의 물리 주소다. 스냅샷 기준으로 xmin이 커밋됐고 xmax가 미커밋이면 그 튜플이 보인다. Dead 튜플은 VACUUM이 회수한다 — 이것이 다음 글의 주제다.

---

**지난 글:** [테이블 상속 — INHERITS와 파티셔닝의 뿌리](/posts/pg-table-inheritance/)

**다음 글:** [VACUUM과 Dead 튜플 — 더티 공간 회수의 원리](/posts/pg-vacuum-dead-tuple/)

<br>
읽어주셔서 감사합니다. 😊
