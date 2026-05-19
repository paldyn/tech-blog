---
title: "MariaDB — MySQL에서 포크된 이유와 차별화 기능"
description: "MariaDB의 탄생 배경, MySQL과의 차이점, 시스템 버저닝·Galera Cluster 등 고유 기능, 마이그레이션 고려사항, 선택 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["MariaDB", "MySQL", "포크", "Galera", "시스템버저닝", "오픈소스", "RDBMS"]
featured: false
draft: false
---

[지난 글](/posts/mysql-my-cnf-tuning/)에서 MySQL my.cnf 파라미터 튜닝을 다뤘다. 이번 글부터는 MariaDB를 살펴본다. MariaDB는 MySQL의 창시자가 직접 포크한 프로젝트로 "진정한 오픈소스 MySQL의 계승자"를 표방한다. 단순한 MySQL 복제본이 아니라 고유한 기능과 방향성을 가진 독자적인 RDBMS로 발전했다.

## MariaDB가 탄생한 이유

MySQL은 2000년대 초 오픈소스 DB 생태계를 주도했다. 그러나 2008년 Sun Microsystems가 MySQL AB를 인수하고, 2010년 Oracle이 Sun을 인수하면서 커뮤니티는 불안해졌다. Oracle이 MySQL을 자사 상용 제품과 경쟁하게 만들 수 있다는 우려가 커졌다.

MySQL을 만든 Michael "Monty" Widenius는 2009년 MySQL 5.1을 기반으로 **MariaDB**를 포크했다. 이름은 그의 딸 Maria에서 따왔다. Monty Program AB(현 MariaDB Corporation)가 주도하는 완전한 GPL 오픈소스 프로젝트로, "항상 무료·항상 오픈소스"가 핵심 원칙이다.

![MariaDB 역사 & 분기점](/assets/posts/mariadb-fork-timeline.svg)

초기에는 MySQL과 바이너리 호환을 유지했지만 10.0(2013)부터 독자적인 기능을 빠르게 추가하면서 완전한 별개 DBMS로 진화했다.

## MySQL과의 호환성

MariaDB는 MySQL 클라이언트 프로토콜을 호환하므로 MySQL 드라이버로 연결 가능하다. DDL·DML 대부분도 동일하게 동작한다. 그러나 두 제품은 10년 이상 독자 발전했으므로 완전히 동일하지 않다.

```sql
-- MariaDB 버전 확인
SELECT VERSION();
-- 10.11.x 또는 11.x 형식 (MySQL의 8.x와 다름)

-- 버전별 기능 차이를 내부적으로 구분
SELECT @@version_comment;
-- MariaDB는 'mariadb.org binary distribution' 포함
```

주요 비호환 사항:
- **MySQL 8.0의 `caching_sha2_password`**: MariaDB 기본 인증 플러그인과 다름
- **`information_schema` 구조**: 일부 컬럼명·행 내용 차이
- **JSON 구현**: MariaDB는 JSON을 TEXT 별칭으로 처리 (MySQL은 네이티브 타입)
- **InnoDB 내부 구현**: 독립적으로 발전, 특히 MariaDB 10.8+ Atomic DDL

## MariaDB 고유 기능

![MariaDB vs MySQL 차별화 기능](/assets/posts/mariadb-fork-features.svg)

### 시스템 버저닝 (Temporal Tables)

MariaDB 10.3에서 도입한 SQL:2011 표준 기반 기능이다. 테이블에 시간 이력을 자동으로 유지해 과거 데이터를 쉽게 조회할 수 있다.

```sql
-- 시스템 버저닝 테이블 생성
CREATE TABLE employee (
  id      INT PRIMARY KEY,
  name    VARCHAR(100),
  salary  DECIMAL(12,2)
) WITH SYSTEM VERSIONING;

-- 데이터 변경
UPDATE employee SET salary = 6000000 WHERE id = 1;

-- 현재 데이터
SELECT * FROM employee WHERE id = 1;

-- 과거 시점 데이터 조회
SELECT * FROM employee
FOR SYSTEM_TIME AS OF '2026-01-01 00:00:00'
WHERE id = 1;

-- 변경 이력 전체 조회
SELECT *, ROW_START, ROW_END
FROM employee
FOR SYSTEM_TIME ALL
WHERE id = 1
ORDER BY ROW_START;
```

데이터 감사(audit), 이력 추적, 실수 복구에 강력하다. MySQL에는 없는 기능으로 MariaDB 선택의 주요 이유 중 하나다.

### Aria 스토리지 엔진

MyISAM의 후계자로 설계된 충돌 복구 가능한 스토리지 엔진이다. 트랜잭션을 지원하지 않지만 전문 검색(FULLTEXT)과 공간 인덱스(SPATIAL)에서 InnoDB보다 빠른 경우가 있다.

```sql
-- Aria 엔진으로 테이블 생성
CREATE TABLE search_index (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  body TEXT,
  FULLTEXT INDEX ft_body (body)
) ENGINE=Aria;

-- MariaDB 내부 임시 테이블은 Aria 사용
SHOW VARIABLES LIKE 'aria_pagecache_buffer_size';
```

### 동적 컬럼

스키마가 행마다 다를 수 있는 EAV(Entity-Attribute-Value) 패턴을 내장 함수로 지원한다. JSON이 도입되기 전의 대안으로 설계됐다.

```sql
-- 동적 컬럼 저장 (BLOB에 직렬화)
INSERT INTO product (id, attrs)
VALUES (1, COLUMN_CREATE(
  'color', 'red',
  'size',  'L',
  'weight', 0.5
));

-- 값 읽기
SELECT id,
  COLUMN_GET(attrs, 'color' AS CHAR) AS color,
  COLUMN_GET(attrs, 'size'  AS CHAR) AS size
FROM product WHERE id = 1;

-- 동적 컬럼에 인덱스 불가 (JSON 또는 가상 컬럼이 더 나은 경우 많음)
```

## 마이그레이션 고려사항

MySQL에서 MariaDB로 전환하거나 반대 방향으로 갈 때 확인해야 할 항목이 있다.

```sql
-- MariaDB로 마이그레이션 시 체크리스트

-- 1. 인증 플러그인 확인
SELECT plugin FROM mysql.user WHERE user = 'myapp';
-- mysql_native_password → MariaDB와 호환
-- caching_sha2_password → 변경 필요

-- MariaDB에서 mysql_native_password로 변경
ALTER USER 'myapp'@'%' IDENTIFIED VIA mysql_native_password
  USING PASSWORD('new_password');

-- 2. JSON 컬럼 사용 확인
SELECT TABLE_NAME, COLUMN_NAME
FROM information_schema.COLUMNS
WHERE DATA_TYPE = 'json' AND TABLE_SCHEMA = 'mydb';
-- MariaDB에서 JSON = LONGTEXT + 유효성 검사 (완전 동일하지 않음)

-- 3. 윈도우 함수 문법 (MariaDB 10.2+부터 지원)
SELECT id, name,
  ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS rn
FROM employee;
```

## MariaDB vs MySQL 선택 기준

| 상황 | 추천 |
|---|---|
| 시스템 버저닝(이력 테이블) 필요 | MariaDB |
| Galera 기반 Active-Active 클러스터 | MariaDB |
| ColumnStore(대용량 분석) | MariaDB |
| Oracle 공식 지원·호환성 최우선 | MySQL |
| InnoDB Cluster + MySQL Shell | MySQL |
| AWS RDS, Aurora 사용 | MySQL (Aurora는 MySQL 호환) |
| 완전 무료 오픈소스 라이선스 강조 | MariaDB |

MariaDB는 Red Hat Enterprise Linux의 기본 MySQL 대체재로 채택되었고, Wikipedia, 다양한 오픈소스 프로젝트에서 활발히 사용된다. MySQL Enterprise의 Thread Pool, Audit Log 같은 기능을 무료로 제공한다는 점도 비용 측면의 이점이다.

```bash
# 설치 (RHEL/CentOS 계열)
dnf install mariadb-server
systemctl enable --now mariadb
mysql_secure_installation

# Debian/Ubuntu
apt-get install mariadb-server

# 초기 접속
mariadb -u root -p
```

MariaDB 개발 속도는 빠르다. 윈도우 함수, CTE, 병렬 리플리케이션, JSON 등 SQL 표준 기능을 MySQL보다 먼저 도입한 사례도 많다. 다음 글에서는 MariaDB의 핵심 스토리지 엔진인 Aria와 ColumnStore를 자세히 살펴본다.

---

**지난 글:** [MySQL my.cnf 튜닝 — InnoDB·연결·리플리케이션 핵심 파라미터](/posts/mysql-my-cnf-tuning/)

**다음 글:** [MariaDB Aria & ColumnStore — 스토리지 엔진 심층 분석](/posts/mariadb-aria-columnstore/)

<br>
읽어주셔서 감사합니다. 😊
