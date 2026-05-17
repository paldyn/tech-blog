---
title: "MySQL 클러스터드 인덱스와 세컨더리 인덱스 — InnoDB 인덱스 구조의 핵심"
description: "InnoDB의 클러스터드 인덱스가 행 데이터를 리프 노드에 직접 저장하는 구조, 세컨더리 인덱스가 PK를 포인터로 사용하는 방식, Double Lookup 비용과 PK 선택 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 24
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "clustered-index", "secondary-index", "primary-key", "covering-index", "b-tree"]
featured: false
draft: false
---

[지난 글](/posts/mysql-autocommit-transaction/)에서 트랜잭션 제어 방법을 살펴봤습니다. 이번 글에서는 InnoDB의 인덱스 구조에서 가장 중요한 개념인 **클러스터드 인덱스**와 **세컨더리 인덱스**의 차이를 다룹니다.

## 클러스터드 인덱스란

InnoDB는 모든 테이블을 클러스터드 인덱스(Clustered Index) 형태로 저장합니다. 클러스터드 인덱스는 B-Tree의 **리프 노드에 실제 행 데이터를 직접 보관**하는 구조입니다. 즉, 데이터 자체가 인덱스입니다.

클러스터드 인덱스의 키는 다음 순서로 결정됩니다.

1. 정의된 PRIMARY KEY
2. 첫 번째 UNIQUE NOT NULL 칼럼
3. 위 둘 다 없으면 InnoDB가 자동으로 6바이트 rowid를 생성

```sql
CREATE TABLE orders (
    id        BIGINT      NOT NULL AUTO_INCREMENT,
    customer  VARCHAR(50) NOT NULL,
    amount    DECIMAL(10,2),
    PRIMARY KEY (id)   -- id가 클러스터드 인덱스 키
);
-- id 기준으로 정렬된 B-tree에 전체 행 데이터가 리프에 저장됨
```

![클러스터드 인덱스 vs 세컨더리 인덱스 구조](/assets/posts/mysql-clustered-secondary-index-structure.svg)

## 세컨더리 인덱스와 Double Lookup

PRIMARY KEY 이외 칼럼에 생성한 인덱스를 세컨더리 인덱스(보조 인덱스)라고 합니다. InnoDB 세컨더리 인덱스의 리프 노드는 인덱스 키 값과 함께 해당 행의 **PK 값**을 저장합니다. 물리적 주소(row offset)가 아닌 PK를 포인터로 사용하는 것이 핵심입니다.

세컨더리 인덱스로 행을 조회할 때는 두 단계 탐색이 발생합니다.

```
SELECT * FROM orders WHERE customer = 'Alice';

① 세컨더리 인덱스 B-tree 탐색
   → customer='Alice' 인 리프 노드 발견
   → PK = 42 획득

② 클러스터드 인덱스 B-tree 재탐색 (Double Lookup)
   → id=42 에서 전체 행 데이터 읽기
```

이 이중 탐색을 **Double Lookup** 또는 **Back to Table**이라 부릅니다. 클러스터드 인덱스를 한 번 더 탐색하므로 I/O 비용이 추가됩니다.

## 커버링 인덱스로 Double Lookup 제거

SELECT 하는 모든 칼럼이 인덱스에 포함되어 있으면 클러스터드 인덱스 재탐색이 필요 없습니다. 이를 커버링 인덱스라 합니다.

```sql
-- Double Lookup 발생: SELECT *는 인덱스에 없는 칼럼 포함
SELECT * FROM orders WHERE customer = 'Alice';

-- 커버링 인덱스: customer와 amount가 인덱스에 포함
CREATE INDEX idx_cust_amt ON orders (customer, amount);
SELECT customer, amount FROM orders WHERE customer = 'Alice';
-- → 세컨더리 인덱스만으로 해결 (Using index)

-- EXPLAIN으로 확인
EXPLAIN SELECT customer, amount FROM orders WHERE customer = 'Alice'\G
-- Extra: Using index  ← 커버링 인덱스 사용 중
```

## PK 선택 전략

클러스터드 인덱스 구조에서 PK 선택은 삽입 성능과 인덱스 크기에 직접 영향을 미칩니다.

![PK 선택이 성능에 미치는 영향](/assets/posts/mysql-clustered-secondary-index-pk-choice.svg)

**AUTO_INCREMENT BIGINT**를 PK로 사용하면 새 행이 항상 B-Tree의 오른쪽 끝에 추가됩니다. 페이지 분할이 최소화되고 버퍼 풀의 핫 페이지를 효율적으로 활용합니다.

**UUID v4** 같은 무작위 값을 PK로 쓰면 새 행이 기존 B-Tree의 임의 위치에 삽입됩니다. 잦은 페이지 분할, 임의 I/O, 버퍼 풀 오염이 발생해 삽입 성능이 크게 떨어집니다.

순서 보장이 필요한 전역 유일 식별자라면 **UUIDv7** 또는 **ULID**를 사용하세요. 시간 기반 정렬 덕분에 AUTO_INCREMENT에 가까운 삽입 성능을 발휘합니다.

```sql
-- PK 크기가 세컨더리 인덱스 크기에 미치는 영향
-- PK가 4B(INT) vs 16B(UUID): 세컨더리 인덱스 리프 행 크기가 4B vs 16B 차이
-- 인덱스 10개 × 10M 행 × 12B 차이 = 약 1.2GB 차이

-- PK 없는 테이블: InnoDB가 숨긴 rowid(6B) 사용
-- → 외부 노출이 안 되므로 세컨더리 인덱스 크기 계산에 불리
CREATE TABLE no_pk (v INT);  -- 권장하지 않음
```

## HEAP 구조를 쓰는 MYISAM과의 차이

MyISAM은 데이터를 별도 .MYD 파일의 힙(heap)에 저장하고, 모든 인덱스 리프에 행의 물리적 오프셋을 저장합니다. 클러스터드 인덱스가 없으므로 PRIMARY KEY 조회도 오프셋 참조를 통한 두 단계 과정입니다.

InnoDB의 클러스터드 인덱스는 MyISAM 대비 범위 검색(ORDER BY, BETWEEN, LIKE 'prefix%')이 빠르고, 트랜잭션·MVCC를 지원합니다. 그 대신 PK가 모든 세컨더리 인덱스에 포함되어 인덱스 크기가 더 큽니다.

클러스터드 인덱스 구조를 이해하면 커버링 인덱스 설계, 복합 인덱스 칼럼 순서 결정, PK 선택 근거가 모두 논리적으로 연결됩니다. 다음 글에서는 InnoDB B-Tree의 내부 구조를 더 깊이 살펴봅니다.

---

**지난 글:** [MySQL autocommit과 트랜잭션 제어](/posts/mysql-autocommit-transaction/)

**다음 글:** [MySQL B+ Tree 인덱스 내부 구조](/posts/mysql-bplus-tree/)

<br>
읽어주셔서 감사합니다. 😊
