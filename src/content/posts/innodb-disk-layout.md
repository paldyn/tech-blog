---
title: "InnoDB 디스크 레이아웃 — 테이블스페이스, 세그먼트, 익스텐트, 페이지"
description: "InnoDB가 디스크에 데이터를 저장하는 계층 구조를 설명합니다. Tablespace → Segment → Extent → Page의 4단계 구조, 16KB 페이지 내부 레이아웃, 파일 종류별 역할을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 13
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "디스크레이아웃", "tablespace", "페이지", "extent", "segment"]
featured: false
draft: false
---

[지난 글](/posts/mysql-query-cache-removed/)에서 MySQL 쿼리 캐시가 제거된 이유를 살펴봤습니다. 이번 글부터는 InnoDB 엔진 내부로 깊이 들어갑니다. 데이터가 디스크에 어떻게 저장되는지를 이해하면, 인덱스 설계·I/O 튜닝·파일 관리의 근거가 명확해집니다. InnoDB의 디스크 레이아웃은 **Tablespace → Segment → Extent → Page**의 4단계 계층으로 이루어집니다.

## 4단계 계층 구조

![InnoDB 디스크 레이아웃 계층 구조](/assets/posts/innodb-disk-layout-hierarchy.svg)

### Tablespace (테이블스페이스)

테이블스페이스는 디스크 저장 공간의 최상위 논리 단위입니다. InnoDB는 여러 종류의 테이블스페이스를 관리합니다.

| 테이블스페이스 | 파일 | 역할 |
|----------------|------|------|
| System | ibdata1 | Data Dictionary, Change Buffer, 일부 Undo |
| File-per-Table | 테이블명.ibd | 개별 테이블 데이터+인덱스 |
| Temporary | ibtmp1 | 임시 테이블 (재시작 시 초기화) |
| Undo | undo_001, undo_002 | MVCC용 Undo 레코드 (8.0+ 분리) |
| General | 사용자 지정 | 여러 테이블 공유 가능 |

```sql
-- File-per-Table 확인 (MySQL 8.0 기본 ON)
SHOW VARIABLES LIKE 'innodb_file_per_table';

-- 테이블스페이스 목록 조회
SELECT name, file_type, file_name
FROM   information_schema.FILES
WHERE  file_type LIKE '%TABLESPACE%'
LIMIT  10;

-- 특정 테이블의 .ibd 경로 확인
SELECT name, file_name
FROM   information_schema.INNODB_TABLESPACES ts
JOIN   information_schema.FILES f ON ts.name = f.file_name
WHERE  ts.name LIKE 'mydb/%';
```

`innodb_file_per_table=ON`(기본값)이면 각 테이블이 독립 `.ibd` 파일을 갖습니다. 테이블 삭제 시 파일이 즉시 제거돼 디스크 공간을 반환합니다. OFF라면 모든 테이블이 `ibdata1`에 누적되어 공간을 반환하기가 매우 어렵습니다.

### Segment (세그먼트)

Tablespace 내부는 Segment로 나뉩니다. InnoDB에서 하나의 테이블은 보통 두 개의 세그먼트를 갖습니다.

- **Leaf Segment**: B+Tree의 리프 노드 페이지들. 실제 행 데이터가 여기에 저장됩니다.
- **Non-Leaf Segment**: B+Tree의 내부 노드 페이지들. 키와 자식 포인터만 저장합니다.

세그먼트는 Extent를 묶어 관리하며, Free·Full·Fragmented 상태를 Segment Header에 기록합니다.

### Extent (익스텐트)

Extent는 **연속된 64개의 페이지(= 1MB)** 묶음입니다. InnoDB가 세그먼트에 공간을 추가할 때 한 번에 1MB씩 할당합니다. 이렇게 연속 할당을 하면 Sequential I/O가 가능해져 대량 삽입 시 디스크 헤드 이동이 줄어듭니다.

단, 작은 테이블은 Extent 단위 할당이 낭비일 수 있습니다. 그래서 처음에는 단일 페이지를 Fragmented 상태로 할당하다가 일정 크기가 되면 Full Extent 할당으로 전환합니다.

### Page (페이지)

Page는 InnoDB I/O의 **최소 단위**입니다. 기본 크기는 **16KB**이며, `innodb_page_size` 파라미터로 변경할 수 있습니다(4K/8K/16K/32K/64K, 서버 초기화 시 결정).

![InnoDB 페이지(16 KB) 내부 구조](/assets/posts/innodb-disk-layout-page.svg)

## 페이지 내부 구조

```
[File Header   38 bytes] ← Checksum, PageNo, Prev/Next, LSN, Type
[Page Header   56 bytes] ← 레코드 수, Free Space Offset, 최근 INSERT 위치
[Infimum       13 bytes] ← 레코드 링크의 시작 경계
[Supremum      13 bytes] ← 레코드 링크의 끝 경계
[User Records  가변]     ← 실제 행 데이터 (키 순으로 정렬된 단방향 링크드 리스트)
[Free Space    가변]     ← 아직 사용되지 않은 영역
[Page Directory 가변]   ← 슬롯 배열 (Binary Search용, 역방향 저장)
[File Trailer  8 bytes]  ← Checksum 재검증
```

User Records는 `primary key` 순으로 정렬된 단방향 링크드 리스트입니다. Page Directory는 일정 간격으로 레코드에 대한 포인터(슬롯)를 저장해 Binary Search를 가능하게 합니다. 페이지 내에서 레코드를 찾을 때 전체를 선형 탐색하지 않아도 됩니다.

## 실용적 관리 명령

```sql
-- 테이블의 실제 디스크 사용량 조회
SELECT table_name,
       ROUND(data_length / 1024 / 1024, 2)  AS data_mb,
       ROUND(index_length / 1024 / 1024, 2) AS index_mb,
       ROUND((data_length + index_length) / 1024 / 1024, 2) AS total_mb
FROM   information_schema.tables
WHERE  table_schema = 'mydb'
ORDER  BY total_mb DESC;

-- InnoDB 페이지 크기 확인
SHOW VARIABLES LIKE 'innodb_page_size';

-- 조각화(Fragmentation) 확인 및 최적화
SELECT table_name, data_free
FROM   information_schema.tables
WHERE  table_schema = 'mydb' AND data_free > 0;

-- 조각화 해소 (주의: 테이블 잠금 발생)
OPTIMIZE TABLE orders;

-- 온라인 재구성 (MySQL 5.6+ / DDL Online)
ALTER TABLE orders ENGINE=InnoDB;
```

`OPTIMIZE TABLE`은 실제로 `ALTER TABLE ... ENGINE=InnoDB`와 동일하게 동작합니다. 새 .ibd 파일을 만들고, 데이터를 정렬된 순서로 다시 쓴 뒤 이름을 바꿉니다. 대용량 테이블에서는 많은 I/O와 디스크 여유 공간이 필요합니다.

## 정리

InnoDB의 디스크 계층은 **Tablespace(논리 컨테이너) → Segment(B+Tree 트리 단위) → Extent(1MB 연속 블록) → Page(16KB I/O 단위)** 입니다. 이 구조를 이해하면 왜 페이지 크기가 인덱스 성능에 영향을 주는지, 왜 File-per-Table이 권장되는지, 조각화가 어디서 발생하는지를 직관적으로 알 수 있습니다.

---

**지난 글:** [MySQL 쿼리 캐시가 사라진 이유 — 글로벌 Mutex의 함정](/posts/mysql-query-cache-removed/)

**다음 글:** [InnoDB Buffer Pool과 LRU — 페이지 교체 알고리즘](/posts/innodb-buffer-pool-lru/)

<br>
읽어주셔서 감사합니다. 😊
