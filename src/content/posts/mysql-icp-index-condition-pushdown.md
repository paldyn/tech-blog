---
title: "MySQL Index Condition Pushdown — 스토리지 엔진 레벨 필터링"
description: "MySQL 5.6에서 도입된 Index Condition Pushdown(ICP)이 세컨더리 인덱스 스캔 시 필터링 위치를 스토리지 엔진으로 내려 I/O를 줄이는 원리, EXPLAIN에서 확인하는 방법, 효과적인 활용 조건을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 27
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "icp", "index-condition-pushdown", "optimizer", "explain", "인덱스최적화"]
featured: false
draft: false
---

[지난 글](/posts/mysql-leftmost-prefix/)에서 복합 인덱스의 Leftmost Prefix 규칙을 살펴봤습니다. 이번 글에서는 인덱스 조건 평가 위치를 스토리지 엔진으로 내리는 최적화인 **Index Condition Pushdown(ICP)**을 다룹니다.

## ICP 이전의 동작 방식

MySQL의 실행 구조는 두 레이어로 나뉩니다. 상위의 **MySQL Server 레이어**가 쿼리를 파싱·최적화하고, 하위의 **Storage Engine 레이어**(InnoDB)가 실제 데이터를 읽습니다.

ICP 이전에는 Storage Engine이 인덱스를 스캔해 범위에 해당하는 모든 행을 Server 레이어로 올려보내고, Server 레이어에서 WHERE 조건을 평가했습니다. 즉, 인덱스에 포함된 칼럼 조건이라도 스토리지 엔진에서는 평가하지 않고 클러스터드 인덱스를 모두 조회한 뒤 필터링했습니다.

```sql
-- 인덱스: (last_name, first_name)
SELECT * FROM people
WHERE last_name LIKE 'Kim%'
  AND first_name LIKE 'Min%';

-- ICP 이전:
-- ① last_name LIKE 'Kim%' → 인덱스 범위 스캔
-- ② Kim으로 시작하는 모든 행 → 클러스터드 인덱스 fetch (1,000행)
-- ③ Server에서 first_name LIKE 'Min%' 필터 → 50행 최종 반환
```

## ICP 동작 방식

MySQL 5.6부터 ICP가 기본 활성화되었습니다. ICP가 켜지면 Storage Engine이 인덱스를 스캔하면서 **인덱스에 포함된 칼럼 조건을 즉시 평가**합니다. 조건을 통과하지 못한 행은 클러스터드 인덱스 조회 없이 바로 버립니다.

```sql
-- ICP ON:
-- ① last_name LIKE 'Kim%' → 인덱스 범위 스캔
-- ② 인덱스에서 first_name LIKE 'Min%' 즉시 평가
-- ③ 조건 통과 50행만 → 클러스터드 인덱스 fetch
-- → I/O 95% 감소
```

![ICP OFF vs ON — 스토리지 엔진 필터링 위치 비교](/assets/posts/mysql-icp-flow.svg)

![ICP 효과 — 행 fetch 수 비교](/assets/posts/mysql-icp-example.svg)

## EXPLAIN에서 ICP 확인

```sql
EXPLAIN SELECT * FROM people
WHERE last_name LIKE 'Kim%'
  AND first_name LIKE 'Min%'\G

-- key: idx_name           ← 인덱스 사용
-- Extra: Using index condition  ← ICP 활용 중
-- Extra: Using index            ← 커버링 인덱스 (ICP 아님)
-- Extra: (없음)                 ← ICP 미사용
```

`Using index condition`은 스토리지 엔진이 인덱스에서 조건을 평가한다는 의미입니다. `Using index`(커버링 인덱스)와 구분해야 합니다.

## ICP가 효과적인 조건

ICP는 **세컨더리 인덱스**를 사용하면서 인덱스에 포함된 칼럼에 추가 필터 조건이 있을 때 효과적입니다. 다음 경우에는 ICP가 동작하지 않거나 효과가 없습니다.

- **클러스터드 인덱스(PRIMARY KEY) 직접 스캔**: 이미 전체 행 데이터가 리프에 있으므로 별도 fetch 단계 없음
- **커버링 인덱스**: 인덱스만으로 SELECT 칼럼 전체를 커버 → 클러스터드 fetch 자체가 없음
- **eq_ref 조인**: 단일 행 조회라 필터 비용이 미미
- **파티션 테이블 일부 경우**: 파티션 pruning이 먼저 작동

```sql
-- ICP 제어 (디버깅 목적)
SET optimizer_switch = 'index_condition_pushdown=off';
EXPLAIN SELECT * FROM people WHERE last_name LIKE 'Kim%' AND first_name LIKE 'Min%';
-- Extra: Using where  ← ICP 꺼진 상태

SET optimizer_switch = 'index_condition_pushdown=on';  -- 원복
```

## MRR(Multi-Range Read)과의 조합

ICP는 종종 **MRR(Multi-Range Read)**과 함께 동작합니다. MRR은 세컨더리 인덱스 스캔으로 얻은 PK 목록을 정렬한 뒤 클러스터드 인덱스를 순차적으로 읽어 랜덤 I/O를 줄이는 최적화입니다.

```sql
-- MRR 활성화 확인
SELECT @@optimizer_switch LIKE '%mrr=on%';

-- EXPLAIN Extra: Using MRR
-- MRR + ICP 조합: 인덱스 필터링(ICP) 후 PK 정렬(MRR) → 순차 I/O
```

ICP는 별도 인덱스 설계 없이 옵티마이저가 자동으로 적용하는 최적화입니다. 인덱스에 포함된 칼럼 조건이 많을수록 ICP의 효과가 커지므로, 커버링 인덱스와 함께 고려하면 쿼리 I/O를 크게 줄일 수 있습니다.

---

**지난 글:** [MySQL Leftmost Prefix 규칙 — 복합 인덱스 칼럼 순서 설계](/posts/mysql-leftmost-prefix/)

**다음 글:** [MySQL Invisible Index — 인덱스 비활성화와 안전한 삭제](/posts/mysql-invisible-index/)

<br>
읽어주셔서 감사합니다. 😊
