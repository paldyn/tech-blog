---
title: "Oracle B-Tree 인덱스"
description: "Oracle B-Tree 인덱스의 구조(Root, Branch, Leaf 블록), Index Split, Index Range Scan vs Full Scan 비용 모델을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["oracle", "btree-index", "index", "leaf-block", "index-range-scan", "index-split", "clustering-factor", "rowid", "index-rebuild"]
featured: false
draft: false
---

[지난 글](/posts/oracle-enqueue-latch-mutex/)에서 Oracle의 직렬화 장치를 살펴봤다. 이번에는 Oracle 성능 최적화의 핵심인 **B-Tree 인덱스**의 내부 구조와 비용 모델을 다룬다.

## B-Tree 인덱스 구조

Oracle B-Tree 인덱스는 세 종류의 블록으로 구성된 균형 트리(Balanced Tree)다.

![Oracle B-Tree 인덱스 구조](/assets/posts/oracle-btree-index-structure.svg)

- **Root Block**: 트리의 최상단. 모든 범위의 분기 포인터를 가진다
- **Branch Block**: 중간 분기 노드. 키 범위에 따라 하위 노드를 가리킨다
- **Leaf Block**: 실제 인덱스 엔트리가 저장되는 최하단. `Key값 + ROWID`를 저장하며, 이전·다음 Leaf 블록과 **이중 연결 리스트**로 연결된다

`ROWID`는 데이터 블록의 물리적 위치(파일 번호, 블록 번호, 행 슬롯)를 표현하는 Oracle 고유 식별자다.

```sql
-- ROWID 구성 확인
SELECT rowid,
       dbms_rowid.rowid_object(rowid) AS obj#,
       dbms_rowid.rowid_file_number(rowid) AS file#,
       dbms_rowid.rowid_block_number(rowid) AS block#,
       dbms_rowid.rowid_row_number(rowid) AS row#
FROM   orders
WHERE  rownum = 1;
```

---

## Leaf 블록의 특성

Leaf 블록은 B-Tree 인덱스에서 가장 중요하다.

- **정렬 저장**: 인덱스 키 기준으로 오름차순 정렬 유지
- **이중 연결**: Range Scan 시 다음 Leaf 블록으로 체인을 따라 이동
- **NULL 미저장**: 인덱스 키가 NULL인 행은 B-Tree에 저장되지 않는다 → `IS NULL` 조건은 인덱스를 사용할 수 없다

```sql
-- NULL이 포함된 컬럼 인덱스: IS NULL 처리
-- 방법 1: 더미 컬럼 추가 복합 인덱스
CREATE INDEX idx_orders_status_null
ON orders (status, 0); -- 상수 포함 시 NULL 행도 저장

-- 방법 2: 함수 기반 인덱스
CREATE INDEX idx_orders_status_nvl
ON orders (NVL(status, 'UNKNOWN'));
```

---

## Clustering Factor

`CLUSTERING_FACTOR`는 인덱스 순서와 테이블 행의 물리적 배치가 얼마나 일치하는지를 나타내는 통계다.

| 값 범위 | 의미 |
|---------|------|
| ≈ 블록 수 | 최적 — 인덱스 순서 = 테이블 물리 순서 |
| ≈ 행 수 | 최악 — 인덱스 순서 ≠ 테이블 물리 순서 |

Clustering Factor가 나쁘면 Index Range Scan에서 Random I/O가 폭발적으로 증가해 Full Table Scan보다 느려질 수 있다.

```sql
-- Clustering Factor 확인
SELECT index_name, blevel, leaf_blocks,
       distinct_keys, clustering_factor,
       num_rows
FROM   dba_indexes
WHERE  table_name = 'ORDERS';
```

---

## Index Split

B-Tree Leaf 블록이 꽉 차면 **Index Split**이 발생한다. 블록의 절반 엔트리를 새 블록으로 이동하고 Branch 블록에 포인터를 추가한다.

두 가지 Split 유형:
- **90-10 Split**: 가장 큰 키 값에서 INSERT 발생 시 (Right-growing 패턴). 기존 블록 유지, 새 블록에 신규 엔트리만 저장
- **50-50 Split**: 중간 값에서 INSERT 발생 시. 양쪽에 50%씩 분배

단조 증가하는 시퀀스 기반 PK는 90-10 Split을 유발해 인덱스 공간 낭비를 최소화한다. 반면 RAC 환경에서는 여러 노드가 동일 Right-side 블록에 동시 INSERT해 경합이 발생한다(Reverse Key 인덱스로 해결).

---

## Index Range Scan vs Full Table Scan

옵티마이저가 인덱스를 사용할지 결정하는 핵심 요소는 **선택도(Selectivity)**다.

```sql
-- 실행 계획 확인
EXPLAIN PLAN FOR
SELECT * FROM orders
WHERE  customer_id = 1001;

SELECT * FROM TABLE(dbms_xplan.display);

-- Autotrace
SET AUTOTRACE TRACEONLY EXPLAIN STATISTICS;
SELECT * FROM orders WHERE customer_id = 1001;
SET AUTOTRACE OFF;
```

일반적으로 선택된 행이 전체 행의 5~10% 이하이면 인덱스가 유리하다. 그 이상이면 Full Table Scan이 더 효율적일 수 있다. 정확한 임계값은 `CLUSTERING_FACTOR`와 블록 크기에 따라 다르다.

---

## Index Rebuild

인덱스 블록 낭비가 심하거나 Split이 많이 발생했을 때 재빌드를 검토한다.

```sql
-- 인덱스 분석 (블록 낭비 확인)
ANALYZE INDEX idx_orders_cust VALIDATE STRUCTURE;

SELECT blocks, lf_rows, lf_blks, del_lf_rows,
       ROUND(del_lf_rows * 100 / NULLIF(lf_rows, 0), 1) AS del_pct
FROM   index_stats;

-- Online Rebuild (서비스 영향 없음)
ALTER INDEX idx_orders_cust REBUILD ONLINE;
```

`del_pct`가 20% 이상이면 재빌드를 고려한다. 단, 재빌드는 임시 정렬 공간을 사용하므로 TEMP 테이블스페이스 여유를 확인해야 한다.

![인덱스 생성·모니터링 쿼리](/assets/posts/oracle-btree-index-sql.svg)

---

## 인덱스 사용을 막는 흔한 패턴

| 패턴 | 결과 |
|------|------|
| `WHERE UPPER(name) = 'JOHN'` | Full Scan (함수 기반 인덱스로 해결) |
| `WHERE status != 'DONE'` | Full Scan (선택도 낮을 때) |
| `WHERE NVL(col, 'X') = 'Y'` | Full Scan |
| `WHERE col LIKE '%SEARCH%'` | Full Scan (앞 `%` 패턴) |
| `WHERE col + 0 = 1` | Full Scan (산술 연산) |

---

**지난 글:** [Oracle Enqueue·래치·뮤텍스](/posts/oracle-enqueue-latch-mutex/)

**다음 글:** [Oracle 비트맵 인덱스](/posts/oracle-bitmap-index/)

<br>
읽어주셔서 감사합니다. 😊
