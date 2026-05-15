---
title: "통계 정보와 SQL 튜닝 어드바이저"
description: "Oracle CBO가 의존하는 옵티마이저 통계의 구조와 수집 방법, 그리고 SQL Tuning Advisor(STA)와 SQL Access Advisor(SAA)를 통해 나쁜 실행 계획을 진단하고 개선하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["oracle", "optimizer-statistics", "cbo", "dbms_stats", "sql-tuning-advisor", "sql-access-advisor", "sql-profile", "histogram", "stale-stats", "tuning-pack"]
featured: false
draft: false
---

[지난 글](/posts/oracle-awr-ash/)에서 AWR과 ASH로 병목 구간과 문제 SQL을 찾는 방법을 살펴봤다. 이번에는 그 SQL의 실행 계획이 왜 나빠질 수 있는지, 그리고 Oracle이 제공하는 **자동 진단 도구**로 어떻게 개선하는지 알아본다.

## 옵티마이저 통계란

CBO(Cost-Based Optimizer)는 SQL을 실행하기 전에 여러 실행 계획 후보의 비용(Cost)을 계산해 최적 경로를 선택한다. 이 비용 계산의 재료가 **옵티마이저 통계**다. 통계가 부정확하거나 오래되면 CBO는 잘못된 판단을 내리고 비효율적인 실행 계획을 사용한다.

주요 통계 항목은 다음과 같다.

| 뷰 | 주요 컬럼 |
|---|---|
| `DBA_TAB_STATISTICS` | num_rows, blocks, avg_row_len, last_analyzed |
| `DBA_COL_STATISTICS` | num_distinct, num_nulls, low_value, high_value |
| `DBA_HISTOGRAMS` | endpoint_number, endpoint_value (데이터 분포 히스토그램) |
| `DBA_IND_STATISTICS` | num_rows, distinct_keys, blevel, leaf_blocks |

## DBMS_STATS — 통계 수집

Oracle은 기본적으로 야간에 자동 통계 수집 작업(Auto Optimizer Stats Collection)을 실행한다. 하지만 대량 데이터 로딩 직후나 파티션 추가 후에는 수동으로 즉시 수집해야 한다.

```sql
-- 테이블 단위 수집 (인덱스 포함)
EXEC DBMS_STATS.gather_table_stats(
  ownname          => 'SCOTT',
  tabname          => 'ORDERS',
  estimate_percent => DBMS_STATS.auto_sample_size,
  method_opt       => 'FOR ALL COLUMNS SIZE AUTO',
  cascade          => TRUE);

-- 스키마 전체 수집
EXEC DBMS_STATS.gather_schema_stats(
  ownname          => 'SCOTT',
  estimate_percent => DBMS_STATS.auto_sample_size);

-- 통계 신선도 확인 (stale_stats = YES 이면 재수집 필요)
SELECT table_name, last_analyzed, num_rows, stale_stats
FROM   dba_tab_statistics
WHERE  owner = 'SCOTT'
ORDER  BY last_analyzed NULLS FIRST;
```

`method_opt => 'FOR ALL COLUMNS SIZE AUTO'`를 사용하면 Oracle이 데이터 분포를 보고 히스토그램 생성 여부를 자동 결정한다. **Skewed 컬럼(특정 값에 데이터가 집중된)에는 히스토그램이 반드시 있어야** CBO가 정확한 Selectivity를 계산할 수 있다.

![통계 정보 수집 & SQL 튜닝 어드바이저 흐름](/assets/posts/oracle-stats-advisor-flow.svg)

## 통계 잠금과 고정

운영 환경에서 자동 통계 수집이 오히려 실행 계획을 망치는 경우, 통계를 잠가서 변경을 방지할 수 있다.

```sql
-- 테이블 통계 잠금 (자동 수집 차단)
EXEC DBMS_STATS.lock_table_stats('SCOTT', 'ORDERS');

-- 잠금 해제
EXEC DBMS_STATS.unlock_table_stats('SCOTT', 'ORDERS');

-- 잠금 상태 확인
SELECT table_name, stattype_locked
FROM   dba_tab_statistics
WHERE  owner = 'SCOTT'
  AND  stattype_locked IS NOT NULL;
```

## SQL Tuning Advisor (STA)

STA는 특정 SQL에 대해 심층 분석을 수행하고 다음 중 하나 이상을 권고한다.

- **Statistics**: 관련 테이블/인덱스 통계를 재수집하면 실행 계획이 개선될 가능성
- **SQL Profile**: CBO의 잘못된 비용 추정을 보정하는 힌트 세트를 자동 생성·적용
- **Index**: 새 인덱스를 생성하면 성능 향상 예상
- **Restructure SQL**: SQL 자체의 재작성 권고

STA는 **Oracle Tuning Pack** 라이선스가 필요하다.

```sql
-- STA 태스크 생성 및 실행
DECLARE
  l_task VARCHAR2(100);
BEGIN
  l_task := DBMS_SQLTUNE.create_tuning_task(
    sql_id    => 'abc123xyz',   -- V$SQL에서 확인한 SQL_ID
    scope     => DBMS_SQLTUNE.scope_comprehensive,
    time_limit => 300,
    task_name  => 'tune_orders_sql');
  DBMS_SQLTUNE.execute_tuning_task(task_name => 'tune_orders_sql');
END;
/

-- 권고 리포트 출력
SELECT DBMS_SQLTUNE.report_tuning_task('tune_orders_sql') FROM dual;

-- SQL Profile 적용 (권고를 실제로 반영)
EXEC DBMS_SQLTUNE.accept_sql_profile(
  task_name => 'tune_orders_sql',
  force_match => TRUE);
```

![DBMS_STATS & DBMS_SQLTUNE 실무 SQL](/assets/posts/oracle-stats-advisor-sql.svg)

## SQL Profile vs SQL Plan Baseline

두 개념은 혼동하기 쉽다.

| 항목 | SQL Profile | SQL Plan Baseline (SPM) |
|---|---|---|
| 목적 | CBO 비용 추정 보정 | 특정 실행 계획 고정 |
| 생성 주체 | STA 자동 생성 | DBA 수동 또는 자동 캡처 |
| 동작 | 힌트 세트로 계획 유도 | 화이트리스트로 계획 제한 |
| 라이선스 | Tuning Pack | 기본 포함 |

프로덕션에서 검증된 계획을 고정하려면 SPM을 우선 고려하고, 계획 자체는 좋지만 CBO가 잘못된 비용을 계산하는 경우에는 SQL Profile을 사용한다.

## SQL Access Advisor (SAA)

STA가 단일 SQL을 분석한다면, **SAA(SQL Access Advisor)**는 전체 워크로드를 분석해 인덱스·Materialized View 생성을 일괄 권고한다.

```sql
-- 워크로드 기반 SAA 실행
EXEC DBMS_ADVISOR.quick_tune(
  advisor_name => DBMS_ADVISOR.sqlaccess_advisor,
  task_name    => 'saa_task_01',
  attr1        => 'SELECT /* ... */ ...');
```

## 정리

좋은 실행 계획의 첫 번째 조건은 정확한 통계다. 통계가 정확해야 CBO가 올바른 비용을 계산하고, 비로소 STA·SAA 같은 어드바이저도 의미 있는 권고를 낼 수 있다. 통계 수집 → 실행 계획 확인 → 어드바이저 적용의 순서를 지키는 것이 Oracle SQL 튜닝의 기본 흐름이다.

---

**지난 글:** [AWR과 ASH — Oracle 성능 진단의 양대 축](/posts/oracle-awr-ash/)

**다음 글:** [NLS와 한국어 환경 설정](/posts/oracle-nls-korean/)

<br>
읽어주셔서 감사합니다. 😊
