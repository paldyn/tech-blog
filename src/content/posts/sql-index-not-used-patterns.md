---
title: "인덱스가 사용되지 않는 패턴"
description: "컬럼에 함수 적용, 암묵적 타입 변환, 전방 와일드카드 LIKE, OR 분기, 낮은 선택도 등 인덱스를 무력화하는 대표 패턴을 정리하고 EXPLAIN으로 확인하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["sql", "index", "explain", "full-scan", "performance", "selectivity", "optimization", "btree"]
featured: false
draft: false
---

[지난 글](/posts/sql-hash-index/)에서 해시 인덱스의 등치 조건 전용 특성을 살펴봤다. 이번에는 인덱스가 있음에도 옵티마이저가 **사용하지 않거나 사용할 수 없는 패턴**을 정리한다. 패턴을 알면 쿼리를 조금 수정해 인덱스를 되살릴 수 있다.

---

## 5가지 대표 패턴

![인덱스가 사용되지 않는 주요 원인](/assets/posts/sql-index-not-used-patterns-causes.svg)

### ① 컬럼에 함수 적용

인덱스는 컬럼 원본 값에 대해 만들어진다. WHERE 절에서 컬럼을 함수로 변환하면 옵티마이저는 인덱스와 조건을 대응시키지 못한다.

```sql
-- ✗ 인덱스(created_at) 미사용
WHERE YEAR(created_at) = 2025

-- ✓ 범위 조건으로 변환
WHERE created_at >= '2025-01-01'
  AND created_at <  '2026-01-01'
```

함수가 반드시 필요하다면 **함수 기반 인덱스**를 생성하는 것이 해법이다.

### ② 암묵적 타입 변환

컬럼 타입과 파라미터 타입이 다르면 데이터베이스가 컬럼 쪽에 형변환을 자동 적용한다. 이 형변환이 인덱스를 무효화한다.

```sql
-- phone_no가 VARCHAR인데 숫자 리터럴 전달
-- ✗ 내부적으로 CAST(phone_no AS INT) 발생
WHERE phone_no = 01012345678

-- ✓ 문자열 리터럴 사용
WHERE phone_no = '01012345678'
```

ORM이나 바인딩 파라미터에서 타입을 명확히 지정하지 않으면 이 문제가 자주 발생한다.

### ③ 전방 와일드카드 LIKE

B-Tree 인덱스는 키를 왼쪽부터 정렬 저장한다. 앞쪽이 `%`로 시작하면 첫 글자를 알 수 없어 범위를 좁힐 수 없다.

```sql
-- ✗ Full Scan
WHERE name LIKE '%alice'

-- ✓ 후방 와일드카드만 있으면 Index Scan 가능
WHERE name LIKE 'alice%'
```

전방 와일드카드 검색이 필요하다면 **Full-Text Index**나 역방향 인덱스(`REVERSE(name)`)를 고려한다.

### ④ OR 조건 분기

서로 다른 컬럼에 OR 조건이 걸리면 각 조건마다 별도 인덱스를 사용해 결과를 합쳐야 한다(Index Merge). 이 비용이 Full Scan보다 비쌀 때 옵티마이저는 Full Scan을 선택한다.

```sql
-- ✗ 두 인덱스 병합 비용 가능성
WHERE id = 1 OR status = 'active'

-- ✓ 가능하면 UNION ALL로 분리
SELECT * FROM orders WHERE id = 1
UNION ALL
SELECT * FROM orders WHERE status = 'active' AND id != 1
```

같은 컬럼의 OR는 `IN`으로 대체한다.

### ⑤ 낮은 선택도 — 옵티마이저 판단

선택도(Selectivity)가 낮은 컬럼은 인덱스를 타도 결국 대부분의 행을 읽어야 한다. 이럴 때 옵티마이저는 랜덤 I/O가 많은 인덱스 스캔 대신 순차 Full Scan을 선택한다.

```sql
-- gender IN ('M','F') 같이 고유값이 2개뿐인 컬럼
-- 인덱스가 있어도 Full Scan 선택 가능
SELECT * FROM users WHERE gender = 'M'
```

이 경우 인덱스가 필요 없는 게 맞다. 복합 인덱스의 선행 컬럼에 두거나, 부분 인덱스로 특정 값 하나만 인덱싱하는 방향을 검토한다.

---

## EXPLAIN으로 진단

![EXPLAIN 결과 비교](/assets/posts/sql-index-not-used-patterns-explain.svg)

```sql
-- 실행 계획 확인
EXPLAIN SELECT * FROM users WHERE LOWER(name) = 'alice';
-- → Seq Scan on users (Full Scan)

-- 함수 기반 인덱스 생성 후
CREATE INDEX idx_lower_name ON users(LOWER(name));

EXPLAIN SELECT * FROM users WHERE LOWER(name) = 'alice';
-- → Index Scan using idx_lower_name
```

`EXPLAIN ANALYZE`를 추가하면 예상(cost) 뿐 아니라 실제 실행 시간(actual time)까지 확인할 수 있다. 예상과 실제 차이가 크면 통계(`ANALYZE`)가 오래됐을 가능성이 높다.

---

## 기타 주의 패턴

| 패턴 | 문제 |
|------|------|
| `IS NOT NULL` 조건 단독 | 선택도 낮으면 Full Scan |
| `!=`, `<>` 조건 | B-Tree 범위 양쪽 모두 스캔 |
| 복합 인덱스 선행 컬럼 누락 | `INDEX(a, b)`에서 `WHERE b = ?` 단독 → 미사용 |
| 통계 갱신 누락 | 옵티마이저가 낡은 통계로 잘못된 비용 계산 |

---

**지난 글:** [해시 인덱스](/posts/sql-hash-index/)

**다음 글:** [비용 기반 옵티마이저(CBO)](/posts/sql-cost-based-optimizer/)

<br>
읽어주셔서 감사합니다. 😊
