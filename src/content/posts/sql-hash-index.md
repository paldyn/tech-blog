---
title: "해시 인덱스"
description: "해시 함수로 버킷을 결정하는 해시 인덱스(Hash Index)의 내부 구조, 등치 조건에서 O(1) 조회가 가능한 이유, B-Tree와의 비교, 그리고 범위 조건이나 정렬에 사용할 수 없는 이유를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["sql", "hash-index", "btree", "index", "postgresql", "performance", "equality", "collision"]
featured: false
draft: false
---

[지난 글](/posts/sql-partial-functional-index/)에서 조건부·표현식 인덱스를 다뤘다. 이번에는 B-Tree와 전혀 다른 구조로 동작하는 **해시 인덱스**를 살펴본다.

---

## 해시 인덱스의 원리

해시 인덱스는 인덱스 키를 **해시 함수**에 통과시켜 버킷 번호를 계산한 뒤, 해당 버킷에 `(키, 힙 포인터)` 쌍을 저장한다.

```
bucket = hash(key) mod N
Bucket[bucket] → [(key, tid), ...]
```

조회 시 같은 해시 함수를 적용해 버킷을 바로 찾으므로 **O(1)** 평균 조회가 가능하다. 트리를 타고 내려가는 B-Tree의 O(log n)보다 이론적으로 빠르다.

![해시 인덱스 구조](/assets/posts/sql-hash-index-structure.svg)

---

## 충돌(Collision) 처리

서로 다른 키가 같은 버킷 번호로 매핑되는 **충돌**이 발생하면 버킷 내부를 **체인(링크드 리스트)** 또는 **오버플로 페이지**로 확장한다.

- 충돌이 적으면 버킷당 항목이 1~2개 → O(1) 유지
- 충돌이 많아지면 체인이 길어져 O(n)으로 악화될 수 있음
- PostgreSQL의 해시 인덱스는 버킷 분할(split)로 로드 팩터를 자동 관리한다

---

## 적합·부적합 사례

![해시 인덱스 적합/부적합 사례](/assets/posts/sql-hash-index-usecases.svg)

해시 인덱스는 **등치 조건(`=`)** 에만 활용된다. 버킷 구조는 순서 정보가 없기 때문에 범위(`>`, `<`, `BETWEEN`), 정렬(`ORDER BY`), 패턴 일치(`LIKE`) 조건에서는 Full Scan이 불가피하다.

### 적합한 패턴

```sql
-- 세션 토큰 룩업
SELECT user_id FROM sessions
WHERE token = 'a8f3c1d2...';

-- API 키 검증 JOIN
SELECT * FROM requests r
JOIN api_keys k ON r.key_id = k.id;
```

### 부적합한 패턴

```sql
-- 범위 조건 → B-Tree 필요
WHERE score BETWEEN 80 AND 100

-- 정렬 → B-Tree 필요
ORDER BY created_at DESC
```

---

## B-Tree vs 해시 인덱스 비교

| 특성 | B-Tree | 해시 |
|------|--------|------|
| 등치 조회 | O(log n) | O(1) 평균 |
| 범위 조회 | ✓ | ✗ |
| 정렬 지원 | ✓ | ✗ |
| NULL 처리 | ✓ | 데이터베이스마다 다름 |
| 크기 | 키 값 저장 | 해시 값 저장 (더 작을 수 있음) |
| 충돌 취약성 | 없음 | 많은 중복 키 시 성능 저하 |

---

## 데이터베이스별 지원 현황

**PostgreSQL**: `CREATE INDEX ... USING HASH`. 버전 10부터 WAL 로깅을 지원해 크래시 복구가 가능하다.

```sql
CREATE INDEX idx_session_token
ON sessions USING HASH (token);
```

**MySQL/InnoDB**: 명시적 해시 인덱스는 MEMORY 엔진에서만 지원한다. InnoDB는 내부적으로 **Adaptive Hash Index(AHI)** 를 자동으로 관리한다.

**Oracle**: Explicit hash index는 없고, 해시 클러스터(Hash Cluster)나 In-Memory 해시 조인 최적화가 이를 대체한다.

---

## 실전 권고

- UUID, API 키, 세션 토큰처럼 **긴 랜덤 문자열의 등치 조회**가 많고 범위 검색이 전혀 없는 컬럼에 사용한다.
- 대부분의 일반적인 컬럼에는 **B-Tree가 더 안전**하다. B-Tree는 등치·범위·정렬 모두 커버하기 때문이다.
- `EXPLAIN`으로 해시 인덱스가 실제로 선택되는지 확인하는 습관을 가진다.

---

**지난 글:** [부분 인덱스와 함수 기반 인덱스](/posts/sql-partial-functional-index/)

**다음 글:** [인덱스가 사용되지 않는 패턴](/posts/sql-index-not-used-patterns/)

<br>
읽어주셔서 감사합니다. 😊
