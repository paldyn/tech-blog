---
title: "커서 vs 오프셋 — 페이지네이션 전략"
description: "LIMIT/OFFSET 페이지네이션의 성능 문제와 데이터 불일치 현상을 이해하고, 커서(Keyset) 페이지네이션으로 해결하는 방법, 복합 정렬 키 처리, 그리고 REST/GraphQL API에서의 응답 구조를 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["페이지네이션", "커서", "오프셋", "성능", "API 설계", "Keyset"]
featured: false
draft: false
---

[지난 글](/posts/orm-migration-flyway-liquibase-alembic/)에서 DB 마이그레이션 도구를 살펴봤습니다. 이제 실전 SQL 패턴 시리즈로 넘어갑니다. 첫 번째 주제는 **페이지네이션**입니다. 대부분의 API에는 목록 조회 엔드포인트가 있고, 거의 모든 목록 조회에는 페이지네이션이 필요합니다. 어떤 방식을 선택하느냐에 따라 성능과 데이터 정확성이 크게 달라집니다.

## LIMIT/OFFSET 페이지네이션

가장 직관적인 방법은 `LIMIT`과 `OFFSET`을 사용하는 것입니다.

```sql
-- Page 1: 처음 20개
SELECT id, title, created_at
FROM   posts
ORDER  BY created_at DESC
LIMIT  20 OFFSET 0;

-- Page 2: 다음 20개
SELECT id, title, created_at
FROM   posts
ORDER  BY created_at DESC
LIMIT  20 OFFSET 20;
```

직관적이고 임의 페이지로 이동하는 "7페이지로 이동" 기능도 쉽게 구현할 수 있습니다. 그러나 두 가지 심각한 문제가 있습니다.

**문제 1: 성능 저하** — `OFFSET N`은 DB가 처음 N개 행을 건너뛰어야 합니다. N이 클수록 실제로는 해당 행까지 스캔한 후 버립니다. 1만 번째 페이지는 20만 개 행을 스캔한 후 20개만 반환합니다.

```sql
-- 이 쿼리는 1,000,000 행을 스캔 후 20개만 반환 (매우 느림)
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 1000000;
```

**문제 2: 데이터 불일치** — 조회 중간에 새 데이터가 삽입되면 행이 밀립니다. Page 1에서 본 마지막 행이 Page 2의 첫 번째 행으로 다시 나타납니다(중복). 또는 삭제된 경우 행이 건너뛰어집니다(누락).

![오프셋 vs 커서 페이지네이션 비교](/assets/posts/pattern-pagination-cursor-vs-offset-comparison.svg)

## 커서(Keyset) 페이지네이션

커서 페이지네이션은 "마지막으로 본 행의 위치"를 기준으로 다음 페이지를 가져옵니다.

```sql
-- 첫 번째 페이지
SELECT id, title, created_at
FROM   posts
WHERE  created_at < NOW()  -- 또는 처음 요청 시 생략
ORDER  BY created_at DESC
LIMIT  20;
-- 마지막 행의 created_at과 id를 커서로 저장

-- 다음 페이지: 마지막으로 본 행 이후부터
SELECT id, title, created_at
FROM   posts
WHERE  created_at < '2024-03-15 10:23:45'  -- 커서 값
ORDER  BY created_at DESC
LIMIT  20;
```

`WHERE id < :cursor`나 `WHERE created_at < :cursor` 조건은 인덱스 seek로 처리됩니다. 테이블 전체를 스캔하지 않으므로 1억 개 행에서도 일정한 속도를 보장합니다.

## 복합 정렬의 Keyset 처리

`created_at` 값이 동일한 행이 여러 개 있을 때 커서가 불안정해집니다. `(created_at, id)` 복합 키로 문제를 해결합니다.

```sql
-- 복합 Keyset: (created_at, id) 조합
-- PostgreSQL row value comparison 문법
SELECT id, title, created_at
FROM   posts
WHERE  (created_at, id) < (:last_created_at, :last_id)
ORDER  BY created_at DESC, id DESC
LIMIT  :page_size;
```

복합 비교 조건 `(created_at, id) < (ts, id)`는 `created_at < ts OR (created_at = ts AND id < id)` 와 논리적으로 동일합니다. PostgreSQL은 이를 지원하지만 MySQL은 직접 풀어 써야 합니다.

```sql
-- MySQL에서 복합 커서
WHERE (created_at < :ts)
   OR (created_at = :ts AND id < :last_id)
```

![Keyset 페이지네이션 — 복합 정렬 처리](/assets/posts/pattern-pagination-cursor-vs-offset-keyset.svg)

## 커서 인코딩

API에서 커서를 노출할 때는 내부 구현을 숨기기 위해 Base64로 인코딩하는 것이 관례입니다. GraphQL의 Relay 스펙이 이 패턴을 표준화했습니다.

```javascript
// 커서 생성: JSON → Base64
function encodeCursor(id, createdAt) {
  return Buffer.from(JSON.stringify({ id, ts: createdAt }))
    .toString('base64');
}

// 커서 파싱
function decodeCursor(cursor) {
  return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
}

// 다음 페이지 쿼리
async function getNextPage(cursor, pageSize = 20) {
  const { id, ts } = cursor ? decodeCursor(cursor) : { id: null, ts: null };

  const rows = await db.query(`
    SELECT id, title, created_at
    FROM   posts
    WHERE  ($1::timestamptz IS NULL OR created_at < $1
         OR (created_at = $1 AND id < $2))
    ORDER  BY created_at DESC, id DESC
    LIMIT  $3 + 1
  `, [ts, id, pageSize]);

  const hasMore = rows.length > pageSize;
  const items = rows.slice(0, pageSize);
  const endCursor = items.length > 0
    ? encodeCursor(items.at(-1).id, items.at(-1).created_at)
    : null;

  return { items, hasNextPage: hasMore, endCursor };
}
```

`pageSize + 1`개를 가져와서 결과가 `pageSize`보다 많으면 다음 페이지가 있다고 판단하는 트릭은 커서 페이지네이션에서 자주 쓰입니다.

## 어떤 방식을 선택해야 하는가

| 조건 | 권장 방식 |
|---|---|
| 임의 페이지 이동 필요 ("5페이지로 이동") | OFFSET |
| 무한 스크롤 / SNS 피드 | 커서 |
| 데이터 추가가 빈번한 경우 | 커서 |
| 10만 행 이상 | 커서 |
| 관리자 화면, 소규모 데이터 | OFFSET도 무방 |

일반적으로 신규 프로젝트에서는 커서 페이지네이션을 기본으로 설계하고, "특정 페이지로 이동" 기능이 반드시 필요한 경우에만 OFFSET을 사용하는 것을 권장합니다. 다음 글에서는 중복 처리를 방지하는 멱등성 패턴을 살펴봅니다.

---

**지난 글:** [Flyway · Liquibase · Alembic — DB 마이그레이션 도구](/posts/orm-migration-flyway-liquibase-alembic/)

**다음 글:** [멱등성과 중복 처리 방지 패턴](/posts/pattern-idempotency-deduplication/)

<br>
읽어주셔서 감사합니다. 😊
