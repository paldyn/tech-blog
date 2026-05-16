---
title: "InnoDB Adaptive Hash Index — 자동으로 만들어지는 해시 인덱스"
description: "InnoDB가 반복되는 B+Tree 탐색을 감지해 자동으로 만드는 Adaptive Hash Index의 원리, 구축 조건, 적합한 워크로드, 그리고 경합 시 비활성화 판단 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 17
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "adaptive-hash-index", "AHI", "해시인덱스", "성능최적화"]
featured: false
draft: false
---

[지난 글](/posts/innodb-doublewrite-buffer/)에서 InnoDB Doublewrite Buffer가 데이터 손상을 막는 방법을 살펴봤습니다. 이번에는 InnoDB의 독특한 자동 최적화 기능인 **Adaptive Hash Index(AHI)** 를 다룹니다. AHI는 DBA가 직접 만드는 인덱스가 아닙니다. InnoDB가 쿼리 패턴을 분석해서 B+Tree 탐색을 해시 조회로 단축시키는 인덱스를 자동으로 구축합니다.

## B+Tree의 비용

모든 InnoDB 인덱스는 B+Tree 구조입니다. 키를 찾으려면 Root에서 Leaf까지 트리를 내려가야 합니다. 트리 높이가 3이라면 최소 3번의 페이지 접근이 필요합니다. 각 페이지 접근마다 Buffer Pool을 조회하고, 없으면 디스크에서 읽어야 합니다.

동일한 값을 초당 수만 번 조회하는 핫스팟이 있다면, 이 탐색 비용이 누적됩니다.

## AHI의 원리

InnoDB는 B+Tree 탐색 패턴을 모니터링합니다. 특정 인덱스 값을 충분히 자주 탐색한다고 판단하면, 해당 값을 키로 하고 리프 페이지 포인터를 값으로 하는 **해시 테이블을 Buffer Pool 내에 구축**합니다.

이후 동일한 값을 조회하면 B+Tree를 통하지 않고, 해시 테이블에서 **O(1)** 으로 리프 페이지 위치를 찾아 바로 이동합니다.

![Adaptive Hash Index — B+Tree vs Hash](/assets/posts/innodb-adaptive-hash-index-concept.svg)

**중요한 특성:**

- AHI는 항상 Buffer Pool 내 페이지에 대해서만 구축됩니다. 디스크 접근을 없애는 것이 아니라, 이미 메모리에 올라온 페이지를 더 빠르게 찾는 것입니다.
- DBA가 직접 생성하거나 관리하지 않습니다. InnoDB가 자동으로 구축하고, 테이블이 변경되면 자동으로 무효화합니다.
- 전체 인덱스가 아니라, 자주 탐색되는 부분만 해시에 올립니다.

## 구축 조건

InnoDB가 AHI를 구축하는 조건을 정확히 명시하지는 않지만, 일반적으로 다음과 같습니다.

- 동일한 인덱스 범위(또는 정확히 같은 키)가 짧은 시간 내에 여러 번 접근될 것
- Buffer Pool에 해당 리프 페이지가 상주하고 있을 것

`innodb_adaptive_hash_index_parts`(기본 8) 파라미터로 AHI를 여러 파티션으로 분할해 RW Latch 경합을 줄입니다.

## 모니터링과 결정

```sql
-- AHI 활성화 상태
SHOW VARIABLES LIKE 'innodb_adaptive_hash_index';
SHOW VARIABLES LIKE 'innodb_adaptive_hash_index_parts';

-- AHI 성능 통계
SHOW ENGINE INNODB STATUS\G
-- "INSERT BUFFER AND ADAPTIVE HASH INDEX" 섹션에서:
-- Hash table size N cells, used M cells
-- A hash searches/s, B non-hash searches/s
-- A/(A+B) → AHI 적중률

-- 런타임 ON/OFF 전환 (재시작 불필요)
SET GLOBAL innodb_adaptive_hash_index = OFF;
SET GLOBAL innodb_adaptive_hash_index = ON;
```

![AHI 모니터링 — 언제 끄고 언제 켤 것인가](/assets/posts/innodb-adaptive-hash-index-monitor.svg)

## 언제 비활성화하는가

AHI가 유해한 상황도 있습니다.

**RW Latch 경합**: AHI 해시 테이블은 내부적으로 RW Latch로 보호됩니다. 동시성이 매우 높은 OLTP 환경에서 AHI Latch가 병목이 되는 경우가 있습니다. `SHOW ENGINE INNODB STATUS`의 SEMAPHORES 섹션에서 AHI 관련 대기가 보이면 파티션 수를 늘리거나 AHI를 끄는 것을 고려합니다.

**랜덤 조회 패턴**: 매번 다른 키를 조회한다면 AHI는 구축만 되고 사용되지 않습니다. 구축 비용이 낭비입니다.

**JOIN 위주 OLAP**: 대용량 조인은 AHI 혜택을 받기 어렵습니다.

반대로 **동일한 PK나 인덱스 컬럼을 반복 조회하는 read-heavy OLTP** 워크로드에서는 AHI가 뚜렷한 효과를 냅니다. 기본값은 ON이며, 특별한 문제가 없다면 켜둔 상태를 유지합니다.

---

**지난 글:** [InnoDB Doublewrite Buffer — 부분 쓰기(Partial Page Write) 방지](/posts/innodb-doublewrite-buffer/)

**다음 글:** [InnoDB Change Buffer — Secondary Index 쓰기 최적화](/posts/innodb-change-buffer/)

<br>
읽어주셔서 감사합니다. 😊
