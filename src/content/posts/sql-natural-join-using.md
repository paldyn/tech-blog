---
title: "NATURAL JOIN과 USING 절"
description: "동명 컬럼으로 자동 조인하는 NATURAL JOIN과 USING 절의 문법, 두 방식이 실무에서 기피되는 이유, ON 절을 명시하는 것이 권장되는 배경, 그리고 USING의 제한적 활용 사례를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["sql", "natural-join", "using", "on", "조인", "안티패턴", "스키마"]
featured: false
draft: false
---

[지난 글](/posts/sql-self-join-hierarchical/)에서 같은 테이블을 두 번 조인하는 셀프 조인과 계층형 데이터 탐색을 살펴봤다. 이번에는 ON 절 없이 조인 조건을 암묵적으로 지정하는 NATURAL JOIN과 USING 절을 다룬다. 두 문법이 왜 실무에서 지양되는지 이해하면 ON의 가치를 더 잘 알 수 있다.

---

## NATURAL JOIN

NATURAL JOIN은 두 테이블에서 **이름이 같은 컬럼을 자동으로 찾아 조인 조건**으로 사용한다. ON 절을 쓰지 않아 쿼리가 짧아 보인다.

```sql
-- NATURAL JOIN 기본 문법
SELECT *
FROM orders
NATURAL JOIN users;

-- 내부적으로 동명 컬럼 전부를 AND로 조인
-- orders와 users에 id, status가 모두 있으면:
-- ON orders.id = users.id AND orders.status = users.status
```

처음 보면 편리해 보이지만 실무에서는 사용하지 말아야 한다.

![NATURAL JOIN vs USING vs ON 비교](/assets/posts/sql-natural-join-using-comparison.svg)

---

## NATURAL JOIN이 위험한 이유

### 스키마 변경에 의한 묵시적 조인 조건 변경

NATURAL JOIN의 조인 조건은 쿼리가 아닌 **테이블 스키마**가 결정한다. 테이블에 컬럼이 추가되거나 이름이 바뀌면 동일한 쿼리가 다른 결과를 반환한다.

![NATURAL JOIN의 숨겨진 위험](/assets/posts/sql-natural-join-using-pitfall.svg)

```sql
-- orders:  id, user_id, amount
-- users:   id, name, email
-- NATURAL JOIN → id 컬럼으로 조인 (orders.id = users.id)
-- → 의도: user_id = users.id 인데 실제로는 id = id로 잘못 조인

-- 나중에 두 테이블 모두에 status 컬럼 추가 시
-- orders:  id, user_id, amount, status
-- users:   id, name, email, status
-- NATURAL JOIN → id AND status 두 조건으로 바뀜 → 버그!
```

코드를 바꾸지 않았는데 DDL 변경만으로 쿼리 결과가 달라지는 이 문제는 운영 중에 발견하기가 매우 어렵다.

### 가독성 문제

NATURAL JOIN을 보면 어떤 컬럼으로 조인하는지 쿼리만 읽어서는 알 수 없다. 스키마를 별도로 확인해야 한다. 코드 리뷰와 유지보수가 어려워진다.

---

## USING 절

USING은 NATURAL JOIN의 자동 매핑 문제를 해결한다. 조인에 사용할 컬럼 이름을 **명시적으로 지정**한다. 단, 양쪽 테이블에 동일한 이름의 컬럼이 존재해야 한다.

```sql
-- USING 기본 문법
SELECT o.id, u.name, o.amount
FROM orders o
JOIN users u USING (user_id);

-- 복수 컬럼 지정 가능
SELECT *
FROM order_items oi
JOIN products p USING (product_id, warehouse_id);
```

NATURAL JOIN과 달리 어떤 컬럼으로 조인하는지 명확히 드러난다. 그러나 USING에도 제약이 있다.

---

## USING의 제약사항

```sql
-- ✗ USING 컬럼에 테이블 접두사 사용 불가
SELECT o.user_id  -- 오류: USING 컬럼에 별칭 접두사 금지
FROM orders o
JOIN users u USING (user_id);

-- ✓ 접두사 없이 사용
SELECT user_id, o.amount, u.name  -- user_id는 접두사 없이
FROM orders o
JOIN users u USING (user_id);
```

USING 절로 조인된 컬럼은 결과에서 **하나로 병합**된다. `o.user_id`나 `u.user_id`로 접근할 수 없고 그냥 `user_id`로만 참조해야 한다. 이 제약 때문에 복잡한 쿼리에서는 혼란을 줄 수 있다.

또한 컬럼명이 양쪽 테이블에서 달라지면 (예: `orders.user_id` vs `users.id`) USING을 사용할 수 없다.

---

## ON 절이 항상 권장되는 이유

```sql
-- ✓ ON으로 항상 명시적으로 작성
SELECT o.id, u.name, o.amount
FROM orders o
JOIN users u ON u.id = o.user_id;

-- 컬럼명이 달라도 OK
-- 복합 조건도 OK
JOIN discounts d
  ON d.user_id = u.id
 AND d.valid_until >= CURRENT_DATE

-- 테이블 접두사 자유롭게 사용
-- 가독성 최고
```

ON은 조인 조건을 완전히 제어할 수 있고, 컬럼명 불일치나 복합 조건에도 대응하며, 스키마 변경의 영향을 받지 않는다. 모든 상황에서 ON이 가장 안전하고 명확하다.

---

## 정리 — 언제 무엇을 쓸까

| 방식 | 권장 여부 | 이유 |
|------|-----------|------|
| `NATURAL JOIN` | ✗ 금지 | 스키마 의존, 버그 위험, 가독성 나쁨 |
| `USING (col)` | △ 제한적 | 컬럼명 동일 보장 시 가능, 단 접두사 제약 주의 |
| `ON a.col = b.col` | ✓ 항상 권장 | 명확, 유연, 안전 |

표준 SQL 스펙에 NATURAL JOIN과 USING이 있으므로 레거시 코드나 타인의 코드에서 마주칠 수 있다. 그 의미를 알아야 읽을 수 있지만, 새로 작성할 때는 항상 ON을 사용한다.

---

**지난 글:** [셀프 조인과 계층형 데이터](/posts/sql-self-join-hierarchical/)

**다음 글:** [다중 JOIN 쿼리 가독성](/posts/sql-multi-join-readability/)

<br>
읽어주셔서 감사합니다. 😊
