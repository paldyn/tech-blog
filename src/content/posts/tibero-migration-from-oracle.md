---
title: "Oracle에서 Tibero로 마이그레이션 — 단계별 실전 가이드"
description: "Oracle 데이터베이스를 Tibero로 전환하는 4단계(현황 분석·스키마 변환·데이터 이전·검증)를 비호환 항목 목록과 실제 스크립트 예시로 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["Tibero", "Oracle", "마이그레이션", "DB전환", "TMIG", "tbLoader"]
featured: false
draft: false
---

[지난 글](/posts/tibero-tsql-psm/)에서 tbPSM 절차형 언어를 살펴봤다. 이번에는 Oracle 시스템을 Tibero로 전환하는 실제 마이그레이션 과정을 단계별로 다룬다. 공공기관 Oracle 라이선스 비용 절감이나 국산 DB 정책 대응이 목적이라면 이 글이 체크리스트 역할을 할 수 있다.

## 마이그레이션 전 핵심 원칙

Oracle → Tibero 전환에서 가장 자주 범하는 실수는 "높은 호환성"을 믿고 검증을 생략하는 것이다. Tibero가 Oracle 문법을 대부분 지원하더라도, 내장 패키지·고급 기능·특정 힌트는 동작 방식이 달라 운영 중 예상치 못한 오류가 발생할 수 있다. **병행 운영(Parallel Run) 기간을 반드시 두고**, 기능·성능·데이터 정합성을 모두 검증해야 한다.

## 4단계 마이그레이션 프레임워크

![Oracle → Tibero 마이그레이션 단계](/assets/posts/tibero-migration-steps.svg)

### 1단계: 현황 분석

마이그레이션의 성패는 분석에서 결정된다. 현재 Oracle 환경에서 무엇을 사용 중인지 완전히 파악해야 한다.

```sql
-- 스키마 객체 목록 추출
SELECT object_type, COUNT(*) AS cnt
FROM   dba_objects
WHERE  owner = 'APP_SCHEMA'
GROUP  BY object_type
ORDER  BY cnt DESC;

-- Oracle 전용 패키지 사용 현황
SELECT DISTINCT name, object_type
FROM   dba_source
WHERE  owner = 'APP_SCHEMA'
  AND  (text LIKE '%DBMS_%' OR text LIKE '%UTL_%')
ORDER  BY name;

-- ROWNUM 사용 쿼리 수 (페이징 패턴 확인)
SELECT COUNT(*) FROM dba_source
WHERE  owner = 'APP_SCHEMA'
  AND  text LIKE '%ROWNUM%';
```

TmaxData가 제공하는 **TMIG(TmaxData Migration Tool)** 는 Oracle 스키마를 자동 분석해 비호환 항목 목록과 호환성 점수를 산출한다.

### 2단계: 스키마 변환

DDL 스크립트를 Tibero용으로 변환한다. 대부분은 자동 변환되지만 수동 검토가 필요한 패턴이 있다.

```sql
-- Oracle: NUMBER 타입 (Tibero에서 동일하게 지원)
CREATE TABLE orders (
    order_id   NUMBER(10)    NOT NULL,
    amount     NUMBER(12, 2) NOT NULL
);

-- Oracle 전용 스토리지 절: Tibero에서 일부 무시됨
-- Oracle:
CREATE TABLE big_table (id NUMBER) STORAGE (INITIAL 10M NEXT 5M);
-- Tibero: STORAGE 절 생략 또는 Tibero tablespace 설정으로 대체
CREATE TABLE big_table (id NUMBER(10));

-- 파티션 테이블: 로컬 파티션 인덱스 사용 필수
CREATE TABLE sales (
    sale_id   NUMBER,
    sale_date DATE,
    amount    NUMBER
) PARTITION BY RANGE (sale_date) (
    PARTITION p2024 VALUES LESS THAN (DATE '2025-01-01'),
    PARTITION p2025 VALUES LESS THAN (DATE '2026-01-01'),
    PARTITION p_max VALUES LESS THAN (MAXVALUE)
);
```

### 3단계: 데이터 이전

대용량 데이터 이전은 방법에 따라 다운타임 길이가 크게 달라진다.

```bash
# tbLoader를 이용한 CSV 방식 이전
# 1. Oracle에서 데이터 추출
expdp APP_SCHEMA/pass@orcl \
  DIRECTORY=DATA_PUMP_DIR \
  DUMPFILE=app_schema.dmp \
  LOGFILE=expdp.log

# 2. 추출된 데이터를 Tibero tbLoader로 로드
# (Oracle의 impdp 대신 tbLoader 사용)
tbloader USERID=app_schema/pass@tibero \
  CONTROL=load.ctl \
  LOG=tbloader.log

# load.ctl 예시
# LOAD DATA
# INFILE 'employees.csv'
# INTO TABLE employees
# FIELDS TERMINATED BY ','
# (employee_id, name, hire_date DATE "YYYY-MM-DD", salary)
```

**DB Link 방식**: Oracle과 Tibero를 DB Link로 연결해 `INSERT INTO tibero_table SELECT * FROM oracle_table@oracle_link` 형태로 이전하면 CSV 변환 없이 직접 이전할 수 있다.

### 4단계: 검증 및 전환

![주요 비호환 항목 및 대응](/assets/posts/tibero-migration-incompatible.svg)

```sql
-- 데이터 건수 검증 (Oracle vs Tibero)
-- Oracle에서:
SELECT 'employees' AS tbl, COUNT(*) AS cnt FROM employees
UNION ALL
SELECT 'orders', COUNT(*) FROM orders;

-- Tibero에서 동일 쿼리 실행 후 결과 비교

-- 컴파일 실패 객체 확인
SELECT object_name, object_type, status
FROM   dba_objects
WHERE  status = 'INVALID'
  AND  owner  = 'APP_SCHEMA';

-- 핵심 쿼리 실행 계획 비교
EXPLAIN PLAN FOR
SELECT u.name, COUNT(o.order_id) AS order_cnt
FROM   users u
JOIN   orders o ON u.user_id = o.user_id
WHERE  u.join_date >= DATE '2024-01-01'
GROUP  BY u.name
HAVING COUNT(o.order_id) > 5;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```

## 자주 발생하는 문제와 해결

**문제 1**: `ORA-00942: table or view does not exist`처럼 보이는 Tibero 오류
- 원인: 시노님(SYNONYM) 미생성 또는 권한 누락
- 해결: `CREATE SYNONYM` 재실행, `GRANT SELECT` 확인

**문제 2**: `NLS_DATE_FORMAT` 차이로 날짜 표시 다름
- 원인: Oracle 기본값 `DD-MON-YY`, Tibero 기본값이 다를 수 있음

```sql
-- Tibero에서 NLS 설정 확인 및 변경
SELECT parameter, value FROM nls_session_parameters
WHERE  parameter LIKE 'NLS_DATE%';

ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS';
```

**문제 3**: 파티션 인덱스 타입 미지원
- 원인: Oracle의 Global Partitioned Index는 Tibero에서 미지원
- 해결: Local Partitioned Index로 재설계

## 전환 체크리스트

```
□ DBA_OBJECTS 내 모든 객체 VALID 상태 확인
□ 핵심 트랜잭션 시나리오 기능 테스트 완료
□ 응답 시간 벤치마크 (Oracle 대비 ±20% 이내)
□ 배치 작업 성능 검증
□ 장애 복구 시나리오 드릴
□ JDBC/ODBC 드라이버 교체 완료
□ 모니터링·백업 스크립트 재설정
□ 롤백 계획 수립 (Oracle 원복 절차)
```

마이그레이션 성공의 핵심은 "호환된다"는 믿음보다 **실증 검증**이다. 자동화 도구로 초기 변환을 마친 뒤, 반드시 실제 트래픽 기반의 병행 운영 기간을 거쳐 차이점을 발견·해소해야 한다.

---

**지난 글:** [Tibero tbPSM — PL/SQL 호환 절차형 언어](/posts/tibero-tsql-psm/)

**다음 글:** [Tibero 관리 도구 — tbAdmin과 tbcm](/posts/tibero-tbadmin-tbcm/)

<br>
읽어주셔서 감사합니다. 😊
