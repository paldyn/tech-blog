---
title: "MySQL B+ Tree 인덱스 내부 구조 — 페이지, 높이, 분할"
description: "InnoDB가 B+ Tree를 사용하는 이유, 16KB 페이지 단위 저장 구조, 내부 노드와 리프 노드의 역할, 페이지 분할 비용과 순차 삽입의 중요성을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 25
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "b-plus-tree", "index", "page-split", "페이지", "인덱스"]
featured: false
draft: false
---

[지난 글](/posts/mysql-clustered-secondary-index/)에서 클러스터드 인덱스와 세컨더리 인덱스의 구조 차이를 살펴봤습니다. 이번 글에서는 InnoDB 인덱스의 실제 저장 단위인 **B+ Tree 페이지 구조**를 다룹니다.

## B+ Tree를 선택한 이유

데이터베이스 인덱스에는 B-Tree 계열, Hash, LSM-Tree 등 여러 구조가 있습니다. InnoDB가 B+ Tree를 선택한 이유는 세 가지입니다.

첫째, **범위 검색에 최적화**되어 있습니다. 리프 노드가 이중 연결 리스트로 연결되어 있어, 특정 키를 찾은 뒤 연속된 리프를 따라가는 범위 스캔이 매우 효율적입니다.

둘째, **I/O 회수를 최소화**합니다. 내부 노드는 키 분기 정보만 저장하므로 분기 계수(fan-out)가 크고, 트리 높이가 낮습니다. 16KB 페이지 기준으로 내부 노드 하나가 수백 개의 자식을 가질 수 있어, 높이 3~4의 트리로 수억 개 행을 커버합니다.

셋째, **정렬 순서를 유지**합니다. ORDER BY, BETWEEN, GROUP BY 등 정렬·집계 쿼리가 인덱스를 활용할 수 있습니다.

![B+ Tree 구조 — InnoDB 인덱스 페이지](/assets/posts/mysql-bplus-tree-structure.svg)

## InnoDB 페이지 구조

InnoDB는 데이터를 **16KB 단위 페이지**로 관리합니다. B+ Tree의 각 노드가 하나의 페이지에 대응합니다.

```sql
-- 페이지 크기 확인 (기본 16384 bytes = 16KB)
SHOW VARIABLES LIKE 'innodb_page_size';

-- 테이블 인덱스 정보 확인
SELECT table_name, index_name, stat_name, stat_value
FROM mysql.innodb_index_stats
WHERE database_name = 'mydb'
  AND table_name    = 'orders';
-- stat_name = 'n_leaf_pages'  → 리프 페이지 수
-- stat_name = 'size'          → 전체 페이지 수 (리프 + 내부)
```

**내부 노드(Internal Node)**에는 키 값과 자식 페이지 포인터만 저장됩니다. 16KB 페이지에 4바이트 INT 키 + 6바이트 포인터를 담으면 약 1,170개의 분기 포인터가 들어갑니다. 높이 3의 트리는 1,170² × 리프 크기(수백 행) = 수억 행을 커버합니다.

**리프 노드(Leaf Node)**에는 실제 데이터(클러스터드 인덱스) 또는 키 + PK(세컨더리 인덱스)가 저장됩니다. 리프 노드는 prev/next 포인터로 연결되어 범위 스캔이 연속적인 페이지 읽기로 처리됩니다.

## 페이지 분할과 성능 영향

페이지가 가득 찬 상태에서 새 항목이 중간에 삽입되면 **페이지 분할**이 발생합니다.

![페이지 분할 — 무작위 삽입 문제](/assets/posts/mysql-bplus-tree-split.svg)

분할 과정은 다음과 같습니다.

1. 새 페이지 할당
2. 기존 페이지 항목을 약 50%씩 두 페이지로 분배
3. 부모 내부 노드에 새 키 추가 (부모도 가득 찼으면 재귀 분할)
4. 리프 연결 리스트 포인터 갱신
5. undo/redo 로그 기록

이 과정은 디스크 I/O와 잠금을 수반하므로, 무작위 삽입이 많으면 성능이 크게 저하됩니다. 또한 분할 후 각 페이지가 50% 채워지므로 인덱스 공간 활용 효율이 낮아집니다(인덱스 단편화).

## 인덱스 단편화 해소

```sql
-- 인덱스 통계 확인 (단편화 지표)
SELECT
  table_name,
  data_free,
  data_length,
  index_length
FROM information_schema.tables
WHERE table_schema = 'mydb'
  AND table_name   = 'orders';

-- 인덱스 단편화 정리 (테이블 재구성 — 잠금 주의)
OPTIMIZE TABLE orders;
-- MySQL 5.6+: InnoDB는 ALTER TABLE ... ENGINE=InnoDB 로 온라인 재구성 가능

ALTER TABLE orders ENGINE = InnoDB;
-- pt-online-schema-change나 gh-ost로 무중단 재구성 권장
```

## 높이와 I/O 비용

B+ Tree 탐색 비용은 트리 높이에 비례합니다. 루트와 상위 내부 노드는 자주 접근되므로 버퍼 풀에 항상 캐시됩니다. 실질적인 I/O는 리프 노드 접근 시에만 발생하는 경우가 많습니다.

```sql
-- B-Tree 높이 추정 (직접 조회는 불가, 통계로 추산)
SELECT
  stat_value AS num_leaf_pages
FROM mysql.innodb_index_stats
WHERE database_name = 'mydb'
  AND table_name    = 'orders'
  AND stat_name     = 'n_leaf_pages';

-- 높이 = ceil(log_{fan-out}(num_leaf_pages)) + 1
-- 리프 1,000,000 페이지 / fan-out ~1000 → 높이 3~4
```

B+ Tree 구조를 이해하면 인덱스 선택 이유, 범위 쿼리 최적화, 복합 인덱스 칼럼 순서의 근거가 명확해집니다. 다음 글에서는 복합 인덱스의 **Leftmost Prefix** 규칙을 다룹니다.

---

**지난 글:** [MySQL 클러스터드 인덱스와 세컨더리 인덱스](/posts/mysql-clustered-secondary-index/)

**다음 글:** [MySQL Leftmost Prefix 규칙 — 복합 인덱스 활용법](/posts/mysql-leftmost-prefix/)

<br>
읽어주셔서 감사합니다. 😊
