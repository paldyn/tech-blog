---
title: "MariaDB Aria & ColumnStore — 스토리지 엔진 심층 분석"
description: "MariaDB 전용 스토리지 엔진 Aria(충돌 복구 MyISAM 대안)와 ColumnStore(분산 컬럼 기반 OLAP)의 아키텍처, 적합한 사용 사례, 설정 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["MariaDB", "Aria", "ColumnStore", "스토리지엔진", "OLAP", "컬럼기반", "분석DB"]
featured: false
draft: false
---

[지난 글](/posts/mariadb-fork-from-mysql/)에서 MariaDB의 탄생 배경과 MySQL과의 차이를 살펴봤다. 이번 글에서는 MariaDB만의 두 가지 핵심 스토리지 엔진인 **Aria**와 **ColumnStore**를 자세히 들여다본다. 두 엔진은 서로 완전히 다른 사용 시나리오를 위해 설계됐다.

## 스토리지 엔진 비교 개요

![MariaDB 스토리지 엔진 비교](/assets/posts/mariadb-aria-columnstore-compare.svg)

MariaDB는 플러그인 방식의 스토리지 엔진 아키텍처를 지원한다. 같은 서버에서 테이블마다 다른 엔진을 사용할 수 있다.

```sql
-- 사용 가능한 스토리지 엔진 목록
SHOW ENGINES;

-- 특정 테이블의 엔진 확인
SELECT ENGINE FROM information_schema.TABLES
WHERE TABLE_NAME = 'orders' AND TABLE_SCHEMA = 'mydb';

-- 기본 엔진 변경 (InnoDB가 기본값)
SHOW VARIABLES LIKE 'default_storage_engine';
```

## Aria 스토리지 엔진

Aria는 MyISAM의 후계자로 MariaDB에서 개발했다. MyISAM의 치명적 약점인 **충돌 복구 불가**를 해결하기 위해 WAL(Write-Ahead Logging)을 추가했다. 트랜잭션은 지원하지 않지만 서버가 갑자기 종료되어도 데이터 파일이 손상되지 않는다.

### Aria의 특징

```sql
-- Aria 테이블 생성
CREATE TABLE article_index (
  id      INT         AUTO_INCREMENT PRIMARY KEY,
  title   VARCHAR(200),
  body    TEXT,
  tags    VARCHAR(500),
  FULLTEXT INDEX ft_content (title, body)
) ENGINE=Aria;

-- Aria 테이블 확인
SHOW TABLE STATUS LIKE 'article_index'\G
-- Engine: Aria
-- Row_format: Page  (Aria의 기본 행 형식)

-- MyISAM에서 Aria로 변환
ALTER TABLE old_myisam_table ENGINE=Aria;
```

Aria의 Row_format에는 두 종류가 있다.

```sql
-- PAGE 형식: 충돌 복구 지원 (기본값)
CREATE TABLE t1 (id INT, data VARCHAR(100)) ENGINE=Aria ROW_FORMAT=PAGE;

-- FIXED 형식: MyISAM 호환, 고정 길이 행
CREATE TABLE t2 (id INT, name CHAR(20)) ENGINE=Aria ROW_FORMAT=FIXED;

-- DYNAMIC 형식: 가변 길이 행, PAGE보다 빠른 특정 쿼리
CREATE TABLE t3 (id INT, data TEXT) ENGINE=Aria ROW_FORMAT=DYNAMIC;
```

### MariaDB 내부 임시 테이블과 Aria

Aria의 가장 중요한 역할은 **MariaDB 서버 내부 임시 테이블**로 사용된다는 것이다.

```sql
-- 내부 임시 테이블 엔진 확인
SHOW VARIABLES LIKE 'aria_pagecache_buffer_size';

-- Aria 페이지 캐시 크기 (임시 테이블 성능에 직결)
-- my.cnf에서 설정 (기본 128MB)
-- aria_pagecache_buffer_size = 512M

-- 내부 임시 테이블이 디스크로 나가는 빈도 확인
SHOW GLOBAL STATUS LIKE 'Created_tmp_disk_tables';
SHOW GLOBAL STATUS LIKE 'Created_tmp_tables';
```

`Created_tmp_disk_tables` 비율이 높으면 `aria_pagecache_buffer_size`와 `tmp_table_size`를 늘려 성능을 개선할 수 있다.

### Aria와 FULLTEXT

```sql
-- Aria FULLTEXT 검색
SELECT id, title,
  MATCH(title, body) AGAINST('MariaDB 스토리지' IN NATURAL LANGUAGE MODE) AS score
FROM article_index
WHERE MATCH(title, body) AGAINST('MariaDB 스토리지' IN NATURAL LANGUAGE MODE)
ORDER BY score DESC
LIMIT 10;

-- 불리언 모드 검색
SELECT * FROM article_index
WHERE MATCH(title, body) AGAINST(
  '+MariaDB -MySQL 엔진' IN BOOLEAN MODE
);

-- 인덱스 재구성 (업데이트 후 성능 저하 시)
OPTIMIZE TABLE article_index;
```

## ColumnStore 스토리지 엔진

ColumnStore는 MariaDB의 OLAP(Online Analytical Processing) 엔진이다. 전통적인 행(Row) 기반 저장 대신 컬럼별로 데이터를 저장해 대용량 집계 쿼리를 빠르게 처리한다.

![ColumnStore 아키텍처](/assets/posts/mariadb-columnstore-architecture.svg)

### 행 기반 vs 컬럼 기반

```sql
-- 같은 테이블에서 집계 쿼리 비교
-- InnoDB: 모든 컬럼을 읽어야 함
SELECT COUNT(*), SUM(amount), AVG(amount)
FROM orders;   -- id, customer_id, product_id, amount, ... 전부 읽음

-- ColumnStore: amount 컬럼 파일만 읽음
-- → I/O가 컬럼 수분의 1로 줄어듦
-- → 같은 값이 연속 저장 → 압축률 극대화
```

ColumnStore는 동일한 값이 연속 저장되므로 RLE(Run-Length Encoding) 압축 효율이 극적으로 높다. 실제로 InnoDB 대비 5~20배 압축률을 달성하기도 한다.

### ColumnStore 설치 및 설정

```bash
# MariaDB ColumnStore 플러그인 설치 (Community Edition)
# MariaDB 10.5+ 기준

# 저장소에서 설치
apt-get install mariadb-plugin-columnstore

# 또는 Docker
docker run -e MARIADB_ROOT_PASSWORD=secret \
  mariadb/columnstore:latest
```

```sql
-- ColumnStore 엔진 활성화 확인
SHOW ENGINES WHERE Engine = 'ColumnStore'\G

-- ColumnStore 테이블 생성
CREATE TABLE sales_fact (
  sale_id     BIGINT       NOT NULL,
  sale_date   DATE         NOT NULL,
  product_id  INT          NOT NULL,
  region      VARCHAR(50),
  amount      DECIMAL(15,2),
  quantity    INT
) ENGINE=ColumnStore;

-- 대량 데이터 로드 (cpimport 명령어가 빠름)
-- mysql 클라이언트로도 LOAD DATA 가능
LOAD DATA INFILE '/data/sales.csv'
INTO TABLE sales_fact
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n';
```

### ColumnStore HTAP (Hybrid Transactional/Analytical Processing)

MariaDB의 강점은 InnoDB(OLTP)와 ColumnStore(OLAP)를 같은 서버에서 혼합할 수 있다는 점이다.

```sql
-- OLTP 테이블 (InnoDB)
CREATE TABLE orders (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  amount     DECIMAL(15,2),
  created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB;

-- OLAP 복제본 (ColumnStore)
CREATE TABLE orders_analytics (
  id         BIGINT,
  customer_id INT,
  amount     DECIMAL(15,2),
  created_at DATETIME
) ENGINE=ColumnStore;

-- OLTP에서 OLAP으로 데이터 이전 (배치 or 트리거)
INSERT INTO orders_analytics
SELECT * FROM orders WHERE created_at >= CURDATE() - INTERVAL 1 DAY;

-- 분석 쿼리는 ColumnStore에서 실행 (InnoDB에 부하 없음)
SELECT
  DATE(created_at) AS sale_date,
  COUNT(*)         AS order_count,
  SUM(amount)      AS daily_revenue
FROM orders_analytics
WHERE created_at >= '2026-01-01'
GROUP BY DATE(created_at)
ORDER BY sale_date;
```

### ColumnStore 제약 사항

```sql
-- ColumnStore 제약 사항 확인
-- 1. AUTO_INCREMENT 불가
-- CREATE TABLE t (id INT AUTO_INCREMENT PRIMARY KEY) ENGINE=ColumnStore;
-- → ERROR: ColumnStore doesn't support AUTO_INCREMENT

-- 2. FK 제약 불가
-- ALTER TABLE orders_analytics ADD FOREIGN KEY (customer_id) REFERENCES customers(id);
-- → ERROR

-- 3. UPDATE/DELETE 성능 나쁨 (ColumnStore는 INSERT-heavy 워크로드에 최적)
-- 대규모 UPDATE 대신 새 데이터 INSERT + 파티셔닝으로 오래된 데이터 제거 권장

-- 4. 인덱스 없음 (컬럼 파일 전체 스캔이 기본)
-- 단, 쿼리 최적화기가 컬럼 pruning을 자동으로 수행
```

## 어떤 엔진을 선택할까

```
워크로드 분류:
├── OLTP (INSERT/UPDATE/DELETE, 단건 조회)
│   └── InnoDB (기본값, 대부분의 애플리케이션)
├── 전문 검색 + 읽기 위주
│   └── Aria (FULLTEXT가 필요하고 트랜잭션 불필요)
├── 대용량 집계/분석 (SUM, AVG, GROUP BY on 수억 건)
│   └── ColumnStore
└── 내부 임시 테이블 성능
    └── Aria (자동 사용, aria_pagecache_buffer_size 조정)
```

실제로는 InnoDB 하나로 대부분의 요구사항을 충족하지만, 데이터 웨어하우스나 실시간 분석 기능이 필요할 때 ColumnStore를 함께 운용하는 HTAP 구성이 MariaDB의 차별화 포인트다.

---

**지난 글:** [MariaDB — MySQL에서 포크된 이유와 차별화 기능](/posts/mariadb-fork-from-mysql/)

**다음 글:** [MariaDB Galera Cluster — 동기식 다중 Primary 클러스터](/posts/mariadb-galera-cluster/)

<br>
읽어주셔서 감사합니다. 😊
