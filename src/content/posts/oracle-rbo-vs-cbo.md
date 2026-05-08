---
title: "Oracle RBO vs. CBO"
description: "규칙 기반(RBO)과 비용 기반(CBO) 옵티마이저의 차이, CBO의 통계 활용 방식, 그리고 OPTIMIZER_MODE 파라미터를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["oracle", "rbo", "cbo", "optimizer", "statistics", "dbms-stats", "optimizer-mode", "explain-plan", "query-plan"]
featured: false
draft: false
---

[지난 글](/posts/oracle-index-organized-table/)에서 IOT의 구조와 적합한 사용 시나리오를 다뤘다. 이번에는 Oracle이 SQL을 받아 실행 계획을 결정하는 핵심 엔진, **옵티마이저**의 두 가지 방식을 비교한다.

## RBO: 규칙 기반 옵티마이저

**RBO(Rule-Based Optimizer)**는 Oracle 7 이전부터 존재했던 방식이다. 실행 계획을 결정할 때 **데이터의 실제 분포를 전혀 고려하지 않고**, 미리 정해진 15단계 우선순위 규칙만 적용한다.

규칙 번호가 낮을수록 우선순위가 높다.

- **규칙 1**: ROWID에 의한 단일 행 접근
- **규칙 4**: Unique 인덱스를 통한 등치 검색
- **규칙 9**: Non-unique 인덱스 Range Scan
- **규칙 11**: 인덱스 없는 등치 조건 (Sort-Merge)
- **규칙 15**: Full Table Scan (최저 우선순위)

RBO의 문제는 명확하다. 테이블에 1,000만 건이 있어도 컬럼에 인덱스가 존재하면 무조건 인덱스를 사용한다. 해당 컬럼의 선택도가 10%여서 Index Range Scan이 오히려 느려도 규칙을 따른다.

**Oracle 10g부터 RBO는 공식 미지원**이다. `OPTIMIZER_MODE = RULE`로 설정해도 내부적으로 CBO가 동작한다. RBO는 역사적 맥락으로만 이해하면 충분하다.

![Oracle RBO vs. CBO 비교](/assets/posts/oracle-rbo-vs-cbo-compare.svg)

---

## CBO: 비용 기반 옵티마이저

**CBO(Cost-Based Optimizer)**는 여러 후보 실행 계획을 생성하고, 각 계획의 **예상 비용(I/O + CPU)**을 계산해 가장 낮은 비용의 계획을 선택한다.

비용 계산의 핵심은 **통계(Statistics)**다. 아무리 정교한 비용 모델도 통계가 잘못되면 엉뚱한 계획을 선택한다.

### CBO가 활용하는 통계

| 통계 항목 | 설명 |
|-----------|------|
| `NUM_ROWS` | 테이블 행 수 → 조인 순서·Full Scan 비용 결정 |
| `NUM_DISTINCT` | 컬럼 고유값 수(NDV) → 선택도 계산 |
| `HISTOGRAM` | 값 분포 → 데이터 편향 감지 |
| `CLUSTERING_FACTOR` | 인덱스와 테이블 정렬 일치도 → 인덱스 스캔 비용 |
| `BLOCKS` | 테이블 블록 수 → Full Scan I/O 비용 |

`CLUSTERING_FACTOR`가 높을수록(테이블 행 수에 근접) 인덱스를 통한 테이블 접근 시 랜덤 I/O가 많다는 의미다. 이 값이 매우 높으면 CBO는 Index Scan 대신 Full Scan을 선택할 수 있다.

---

## 통계 수집

통계 수집은 `DBMS_STATS` 패키지로 수행한다.

```sql
-- 단일 테이블 통계 수집
BEGIN
  DBMS_STATS.GATHER_TABLE_STATS(
    ownname          => 'HR',
    tabname          => 'EMPLOYEES',
    estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
    method_opt       => 'FOR ALL COLUMNS SIZE AUTO',
    cascade          => TRUE   -- 인덱스 통계도 함께 수집
  );
END;
/

-- 스키마 전체 수집
EXEC DBMS_STATS.GATHER_SCHEMA_STATS(ownname => 'HR');

-- 자동 통계 수집 작업 확인 (Oracle 10g+)
SELECT client_name, status
FROM   dba_autotask_client
WHERE  client_name = 'auto optimizer stats collection';
```

Oracle 10g부터 **자동 통계 수집(Automatic Stats Collection)** 작업이 기본으로 활성화되어 야간 유지보수 윈도우에 실행된다. 그러나 대량 DML 직후나 파티션 교체 후에는 수동으로 즉시 수집이 필요하다.

![CBO 통계 수집 및 옵티마이저 모드](/assets/posts/oracle-rbo-vs-cbo-stats.svg)

---

## OPTIMIZER_MODE 파라미터

| 값 | 설명 |
|----|------|
| `ALL_ROWS` | 전체 처리량 최적화 (기본값, 배치 작업에 적합) |
| `FIRST_ROWS_1/10/100/1000` | 첫 N행 반환 최적화 (OLTP 조회에 적합) |
| `CHOOSE` | 통계 있으면 CBO, 없으면 RBO (deprecated) |
| `RULE` | RBO 강제 (10g 이후 실제로는 CBO 동작) |

```sql
-- 세션 수준 변경 (OLTP 조회 최적화)
ALTER SESSION SET optimizer_mode = FIRST_ROWS_10;

-- 쿼리 수준 힌트로 지정
SELECT /*+ FIRST_ROWS(10) */ *
FROM   orders
WHERE  customer_id = 123
ORDER BY order_date DESC;
```

---

## 통계 부재 시 CBO 동작

통계가 전혀 없는 테이블에 대해 CBO는 **동적 샘플링(Dynamic Sampling)**으로 런타임에 통계를 수집하거나, 고정 기본값을 사용한다. 이 기본값은 현실과 동떨어질 수 있어 예측 불가한 실행 계획이 만들어진다.

```sql
-- 동적 샘플링 설정 (0=없음, 1~10=레벨)
ALTER SESSION SET optimizer_dynamic_sampling = 4;

-- 통계 수집 시점 확인
SELECT table_name, last_analyzed, num_rows, blocks
FROM   user_tables
ORDER  BY last_analyzed DESC NULLS LAST;
```

`LAST_ANALYZED`가 NULL이거나 오래된 테이블이 있다면 즉시 통계를 수집해야 한다.

---

## 실행 계획 비용 읽기

```sql
EXPLAIN PLAN FOR
SELECT e.last_name, d.department_name
FROM   employees e JOIN departments d
       ON e.department_id = d.department_id
WHERE  e.salary > 8000;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'TYPICAL'));
```

출력의 `Cost` 열이 CBO가 예측한 I/O + CPU 비용 합산이다. `Rows` 열은 예상 행 수(카디널리티)로, 실제 실행 후 `A-Rows`(Actual Rows)와 크게 차이 나면 통계가 부정확하다는 신호다.

---

**지난 글:** [Oracle Index-Organized Table (IOT)](/posts/oracle-index-organized-table/)

**다음 글:** [Oracle 옵티마이저 힌트](/posts/oracle-optimizer-hints/)

<br>
읽어주셔서 감사합니다. 😊
