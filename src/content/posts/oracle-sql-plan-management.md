---
title: "Oracle SQL Plan Management (SPM)"
description: "플랜 기준선(Baseline)을 통해 실행 계획 변동을 방지하는 SPM의 아키텍처, 캡처·수락·진화 라이프사이클, 그리고 실무 활용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["oracle", "spm", "sql-plan-management", "baseline", "dbms-spm", "optimizer", "plan-stability", "evolution", "sql-profile"]
featured: false
draft: false
---

[지난 글](/posts/oracle-optimizer-hints/)에서 힌트로 CBO 결정을 재정의하는 방법을 다뤘다. 이번에는 더 체계적인 접근, **SQL Plan Management(SPM)**을 살펴본다. SPM은 특정 SQL의 실행 계획을 "기준선(Baseline)"으로 고정해 통계 변경·패치·업그레이드로 인한 계획 변동을 방지한다.

## 왜 SPM이 필요한가

DBA가 성능 튜닝을 마친 뒤 이틀 후 통계가 자동 수집되면서 실행 계획이 변경되어 성능이 수십 배 떨어지는 상황은 흔하다. 힌트는 코드를 수정해야 적용되지만, SPM은 SQL 텍스트를 변경하지 않고 **데이터베이스 레이어에서** 플랜을 고정한다.

## SPM 아키텍처

SPM의 핵심 저장소는 SYSAUX 테이블스페이스 내 **SQL Management Base(SMB)**다.

- **SQL Plan Baselines**: 수락(ACCEPTED=YES)된 플랜 목록. 쿼리 실행 시 이 플랜이 우선 사용된다.
- **SQL Plan History**: 새 플랜이 발견됐지만 아직 검증되지 않은 후보 플랜.
- **SQL Profiles**: Tuning Advisor가 생성하는 통계 보정 정보. 플랜 구조를 바꾸지 않고 카디널리티 추정을 보정한다.

실행 흐름은 단순하다. CBO가 플랜을 생성한 뒤 해당 SQL의 Baseline이 존재하면 Baseline 플랜을 사용하고, 없으면 CBO 플랜을 그대로 사용한다.

![Oracle SPM 아키텍처](/assets/posts/oracle-spm-arch.svg)

---

## Baseline 라이프사이클

### 1단계: 캡처

Baseline에 플랜을 등록하는 방법은 두 가지다.

**자동 캡처**: `OPTIMIZER_CAPTURE_SQL_PLAN_BASELINES = TRUE`로 설정하면 두 번 이상 실행된 SQL의 플랜을 자동으로 History에 캡처한다.

```sql
ALTER SYSTEM SET optimizer_capture_sql_plan_baselines = TRUE;
ALTER SYSTEM SET optimizer_use_sql_plan_baselines    = TRUE;
```

**수동 캡처**: `DBMS_SPM.LOAD_PLANS_FROM_CURSOR_CACHE`로 현재 캐시에 있는 특정 플랜을 즉시 Baseline으로 등록한다.

```sql
DECLARE
  l_plans PLS_INTEGER;
BEGIN
  l_plans := DBMS_SPM.LOAD_PLANS_FROM_CURSOR_CACHE(
    sql_id          => 'abc1234xyz789',
    plan_hash_value => 3456789012
  );
  DBMS_OUTPUT.PUT_LINE(l_plans || ' plan(s) loaded as baseline');
END;
/
```

### 2단계: 검증 (Evolution)

새로운 플랜이 발견되면 History에 `ACCEPTED=NO` 상태로 저장된다. 이 플랜이 기존 Baseline보다 빠르다는 것이 검증되어야 Baseline으로 승격된다.

```sql
-- SPM 진화 수동 실행 (Tuning Pack 라이선스 필요)
DECLARE
  l_report CLOB;
BEGIN
  l_report := DBMS_SPM.EVOLVE_SQL_PLAN_BASELINE(
    sql_handle => 'SQL_abc123',
    time_limit => 60,   -- 초
    verify     => 'YES',
    commit     => 'YES'
  );
  DBMS_OUTPUT.PUT_LINE(l_report);
END;
/
```

자동 진화는 Oracle 12c의 **Auto SPM Evolve Task**가 야간에 실행한다. 수동으로도 즉시 실행할 수 있다.

### 3단계: 수락

수락된 Baseline은 `ACCEPTED=YES, ENABLED=YES` 상태가 된다.

```sql
-- Baseline 상태 조회
SELECT sql_handle, plan_name, sql_text,
       enabled, accepted, fixed,
       origin, last_executed
FROM   dba_sql_plan_baselines
WHERE  sql_text LIKE '%orders%'
ORDER  BY created DESC;
```

`FIXED=YES`로 설정하면 더 빠른 플랜이 발견돼도 Baseline이 바뀌지 않는다. 패치 전후 플랜을 절대 변경하고 싶지 않을 때 사용한다.

![SPM Baseline 캡처 및 관리](/assets/posts/oracle-spm-sql.svg)

---

## STORED OUTLINE과의 차이

SPM 이전에는 **Stored Outline**으로 플랜을 고정했다. Stored Outline은 힌트의 직접적인 집합으로 유지 관리가 어렵고 Oracle 11g에서 deprecated됐다. SPM은 Stored Outline의 기능적 후계자이며 자동화된 진화, 플랜 히스토리, AWR 연동 등 훨씬 강력한 기능을 제공한다.

---

## 실무 활용 시나리오

**Oracle 업그레이드 전 플랜 고정**: 업그레이드 전 주요 쿼리의 플랜을 Baseline에 캡처해두면 옵티마이저 버전이 바뀌어도 플랜이 유지된다.

**대량 통계 수집 후 검증**: 야간 통계 수집 후 플랜이 바뀐 SQL을 `V$SQL`에서 탐지하고, 기존 플랜을 Baseline으로 등록한다.

```sql
-- 플랜 변경 감지: AWR 기반
SELECT s.sql_id, s.plan_hash_value, s.elapsed_time / s.executions avg_elapsed
FROM   v$sql s
WHERE  s.executions > 10
AND    s.sql_id IN (
    SELECT sql_id FROM dba_sql_plan_baselines
)
ORDER  BY avg_elapsed DESC;
```

---

**지난 글:** [Oracle 옵티마이저 힌트](/posts/oracle-optimizer-hints/)

**다음 글:** [PL/SQL 블록 구조](/posts/plsql-block-structure/)

<br>
읽어주셔서 감사합니다. 😊
