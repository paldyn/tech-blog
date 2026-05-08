---
title: "B-Tree 인덱스 구조"
description: "관계형 DB 기본 인덱스인 B-Tree의 루트·브랜치·리프 노드 구조, O(log N) 탐색 원리, 리프 연결 리스트를 이용한 범위 스캔, Index Scan vs Index Only Scan vs Bitmap Scan 유형을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["sql", "btree", "index", "index-scan", "index-only-scan", "bitmap-scan", "optimizer", "performance", "explain"]
featured: false
draft: false
---

[지난 글](/posts/sql-fullscan-cost/)에서 풀스캔 비용 모델을 살펴봤다. 이번에는 RDBMS 기본 인덱스 구조인 **B-Tree(Balanced Tree)**의 내부 동작을 분해한다.

---

## B-Tree 구조 개요

B-Tree 인덱스는 세 종류의 노드로 이루어진다.

| 노드 유형 | 역할 |
|----------|------|
| **루트(Root)** | 트리의 시작점, 분기 키 보유 |
| **브랜치(Branch/Internal)** | 루트와 리프 사이, 탐색 경로 안내 |
| **리프(Leaf)** | 실제 인덱스 키 + 힙(데이터 블록) 포인터 |

![B-Tree 인덱스 구조](/assets/posts/sql-btree-structure-tree.svg)

---

## O(log N) 탐색

키 값 `35`를 찾는 탐색 경로:

```
루트 (25 | 50 | 75)
  → 35 > 25 이고 35 < 50 → 두 번째 브랜치로
브랜치 (30 | 40)
  → 35 > 30 이고 35 < 40 → 두 번째 브랜치 자식으로
리프 (32, 35, 39)
  → 35 발견 → 힙 포인터로 실제 행 접근
```

탐색은 항상 **트리 높이(H)**만큼의 블록 I/O가 발생한다. B-Tree에서 각 노드는 수백~수천 개의 키를 담을 수 있기 때문에, 1억 행 테이블도 높이 약 7 수준이다. 7번의 블록 읽기로 임의의 행을 찾는다.

```
N = 1억 행
각 노드 평균 200개 키
높이 = log₂₀₀(100,000,000) ≈ 4.4 → 실제 약 5~7
```

---

## 범위 스캔과 리프 연결 리스트

리프 노드는 **이중 연결 리스트**로 연결되어 있다. 범위 스캔(`BETWEEN`, `>`, `<`)에서 첫 키를 트리 탐색으로 찾은 뒤, 이후 키들은 리프 노드를 순서대로 이동하며 읽는다.

```sql
-- 범위 스캔
SELECT * FROM orders WHERE id BETWEEN 100 AND 200;

-- 내부 동작:
-- 1. B-Tree 탐색으로 id=100 리프 노드 도달 (트리 높이 번 I/O)
-- 2. 리프 연결 리스트를 따라 순방향 스캔
-- 3. id=200 초과 시 탐색 종료
```

`ORDER BY` 없이도 인덱스 키 순서로 결과가 나오는 이유가 바로 리프 연결 리스트 때문이다.

---

## 인덱스 생성과 선택

```sql
-- 기본 B-Tree 인덱스
CREATE INDEX idx_orders_created ON orders (created_at);

-- 내림차순 인덱스 (PostgreSQL, MySQL 8.0+)
CREATE INDEX idx_orders_created_desc ON orders (created_at DESC);

-- 유니크 인덱스 (B-Tree + UNIQUE 제약)
CREATE UNIQUE INDEX idx_users_email ON users (email);

-- 복합 인덱스 (다음 글에서 자세히)
CREATE INDEX idx_orders_status_created ON orders (status, created_at);
```

---

## 스캔 유형 3가지

![B-Tree 스캔 유형](/assets/posts/sql-btree-structure-scan-types.svg)

### Index Scan

리프 노드에서 힙 포인터를 꺼내 **매 행마다** 힙(테이블 블록)에 접근한다. 행이 많으면 랜덤 I/O가 많아진다.

```sql
-- PostgreSQL EXPLAIN 출력
-- Index Scan using idx_orders_id on orders
--   (cost=0.42..8.44 rows=1 width=120)
--   Index Cond: (id = 12345)
```

### Index Only Scan

SELECT 컬럼이 모두 인덱스 안에 있으면 힙을 전혀 읽지 않는다. 가장 빠른 스캔이다.

```sql
-- email 인덱스, SELECT id, email → 힙 접근 없음
CREATE INDEX idx_users_email_id ON users (email) INCLUDE (id);  -- PG 11+

SELECT id, email FROM users WHERE email LIKE 'a%';
-- Index Only Scan (힙 접근 0회)
```

PostgreSQL에서는 Visibility Map(VM) 체크로 인해 완전한 힙 회피가 항상 보장되지는 않는다. `VACUUM` 후 VM 갱신이 필요하다.

### Bitmap Index Scan

중간 선택도(5~20%)에서 옵티마이저가 선택한다. 먼저 비트맵을 생성해 어떤 힙 블록이 필요한지 파악한 뒤, 힙 블록을 **블록 순서대로 일괄** 읽는다. 랜덤 I/O를 순차 I/O에 가깝게 변환한다.

```sql
-- Bitmap Index Scan이 발생하는 전형적 쿼리
SELECT * FROM orders WHERE status = 'pending' AND region = 'KR';
-- 두 인덱스 Bitmap AND로 결합 가능
-- BitmapAnd(Bitmap(idx_status), Bitmap(idx_region))
```

---

## 인덱스가 효과 없는 패턴

```sql
-- 1. 컬럼에 함수 적용
WHERE LOWER(email) = 'test@example.com'  -- 인덱스 무력화
-- 해결: CREATE INDEX ON users (LOWER(email));  -- 함수 기반 인덱스

-- 2. LIKE 앞 와일드카드
WHERE name LIKE '%홍길동%'  -- 인덱스 사용 불가
-- 해결: GIN FTS 또는 ILIKE 인덱스 사용

-- 3. OR 조건 (MySQL 특히)
WHERE status = 'A' OR region = 'KR'  -- 두 컬럼 각각 인덱스여도 비효율
-- 해결: UNION 또는 두 인덱스를 Bitmap OR로 결합 (PG 자동)

-- 4. 타입 불일치
WHERE user_id = '12345'  -- user_id가 INT인데 문자열 비교
-- 해결: 타입 일치 확인
```

---

**지난 글:** [풀스캔 비용 이해](/posts/sql-fullscan-cost/)

**다음 글:** [복합 인덱스 컬럼 순서](/posts/sql-composite-index-column-order/)

<br>
읽어주셔서 감사합니다. 😊
