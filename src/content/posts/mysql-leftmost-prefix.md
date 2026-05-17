---
title: "MySQL Leftmost Prefix 규칙 — 복합 인덱스 칼럼 순서 설계"
description: "InnoDB 복합 인덱스의 Leftmost Prefix 규칙, 등치·범위 조건에 따른 인덱스 활용 범위, 칼럼 순서 설계 4가지 원칙과 EXPLAIN으로 검증하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 26
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "composite-index", "leftmost-prefix", "explain", "index-design", "복합인덱스"]
featured: false
draft: false
---

[지난 글](/posts/mysql-bplus-tree/)에서 B+ Tree의 내부 구조와 페이지 분할 비용을 살펴봤습니다. 이번 글에서는 복합 인덱스를 설계할 때 반드시 알아야 하는 **Leftmost Prefix 규칙**을 다룹니다.

## Leftmost Prefix 규칙이란

복합 인덱스 `(a, b, c)`를 생성하면 실제로 다음 인덱스들을 동시에 갖는 것과 비슷합니다.

- `(a)`
- `(a, b)`
- `(a, b, c)`

그러나 `(b)`, `(c)`, `(b, c)` 단독으로는 이 인덱스를 활용할 수 없습니다. **항상 인덱스 왼쪽부터 순서대로 칼럼을 사용해야** 한다는 것이 Leftmost Prefix 규칙의 핵심입니다.

```sql
-- 인덱스: (status, country, amount)
CREATE INDEX idx_s_c_a ON orders (status, country, amount);

-- 인덱스 활용 가능
SELECT * FROM orders WHERE status = 'active';           -- status 사용
SELECT * FROM orders WHERE status = 'active'            -- status, country 사용
  AND country = 'KR';
SELECT * FROM orders WHERE status = 'active'            -- 전체 사용
  AND country = 'KR' AND amount > 100;

-- 인덱스 활용 불가 (Full Scan)
SELECT * FROM orders WHERE country = 'KR';              -- status 없음
SELECT * FROM orders WHERE amount > 100;                -- 앞 두 칼럼 없음
```

![Leftmost Prefix 규칙 — 복합 인덱스 활용 패턴](/assets/posts/mysql-leftmost-prefix-rules.svg)

## 범위 조건이 인덱스 활용을 차단하는 지점

등치 조건(`=`, `IN`)은 인덱스 활용을 다음 칼럼으로 이어줍니다. 반면 범위 조건(`>`, `<`, `BETWEEN`, `LIKE 'prefix%'`)은 그 칼럼 이후의 인덱스 활용을 차단합니다.

```sql
-- 인덱스: (status, country, amount)
-- status=? AND amount>? 조건 — country 건너뜀
SELECT * FROM orders
WHERE status = 'active'
  AND amount > 100;
-- → status까지만 인덱스 탐색, amount는 필터 단계에서 처리
-- EXPLAIN Extra: Using index condition

-- 더 잘 활용하려면 칼럼 순서 변경 또는 Index Condition Pushdown 확인
```

`IN (v1, v2, ...)` 조건은 등치 조건의 확장으로 처리되어, 그 다음 칼럼까지 인덱스가 이어집니다. 단, IN 목록 크기가 크면 옵티마이저가 인덱스를 포기하기도 합니다.

## 칼럼 순서 설계 원칙

![복합 인덱스 칼럼 순서 설계 원칙](/assets/posts/mysql-leftmost-prefix-design.svg)

**카디널리티 높은 칼럼을 앞에**: 탐색 공간을 빠르게 줄일 수 있습니다. `user_id`처럼 고유값이 많은 칼럼이 `status`처럼 3~5개 값을 갖는 칼럼보다 앞에 오는 것이 일반적으로 유리합니다.

**등치 조건 칼럼을 범위 조건 칼럼보다 앞에**: 범위 조건 이후 칼럼은 인덱스 탐색이 아닌 필터링으로 처리됩니다. 등치 조건들을 먼저 배치하고 범위 조건은 뒤에 두세요.

**ORDER BY / GROUP BY 칼럼 포함**: WHERE 조건 칼럼과 정렬 칼럼이 인덱스에 포함되면 `filesort`(별도 정렬 단계)를 피할 수 있습니다.

**커버링 인덱스 고려**: SELECT 자주 하는 칼럼을 인덱스에 포함하면 Double Lookup을 제거합니다.

## EXPLAIN으로 인덱스 사용 확인

```sql
-- EXPLAIN으로 인덱스 사용 여부 확인
EXPLAIN SELECT *
FROM orders
WHERE status = 'active'
  AND country = 'KR'
ORDER BY amount\G

-- key: idx_s_c_a          ← 인덱스 사용
-- key_len: 길이            ← 사용된 칼럼 바이트 수
-- Extra: Using index condition  ← ICP 사용
-- Extra: Using filesort         ← 별도 정렬 필요 (인덱스 ORDER BY 불가)
-- Extra: Using index            ← 커버링 인덱스

-- 8.0+: EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT * FROM orders WHERE status='active' AND country='KR'\G
```

`key_len` 값으로 복합 인덱스에서 몇 번째 칼럼까지 사용되는지 파악할 수 있습니다. 각 칼럼의 바이트 크기를 더해서 실제 활용 범위를 계산하세요.

## 실전 예시: 게시판 목록 쿼리

```sql
-- 게시판 목록: 카테고리별 최신순 정렬
SELECT id, title, created_at
FROM posts
WHERE category_id = 5
  AND status = 'published'
ORDER BY created_at DESC
LIMIT 20;

-- 좋은 인덱스 설계
CREATE INDEX idx_posts_list
  ON posts (category_id, status, created_at DESC);
-- → category_id=? (등치) → status=? (등치) → created_at 정렬 (인덱스 순서)
-- → filesort 없음, covering index 가능

-- SELECT에 id, title이 있으므로 title을 인덱스에 추가하면 커버링 인덱스
-- 단, title이 길면 인덱스 크기가 커져 득실 계산 필요
```

Leftmost Prefix 규칙을 이해하면 복합 인덱스 칼럼 순서 결정이 더 이상 직관적 판단이 아닌 논리적 근거를 갖게 됩니다. 다음 글에서는 MySQL 5.6에서 도입된 **Index Condition Pushdown(ICP)**을 다룹니다.

---

**지난 글:** [MySQL B+ Tree 인덱스 내부 구조](/posts/mysql-bplus-tree/)

**다음 글:** [MySQL Index Condition Pushdown — 스토리지 엔진 레벨 필터링](/posts/mysql-icp-index-condition-pushdown/)

<br>
읽어주셔서 감사합니다. 😊
