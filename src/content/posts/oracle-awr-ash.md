---
title: "AWR과 ASH — Oracle 성능 진단의 양대 축"
description: "Oracle AWR(Automatic Workload Repository)과 ASH(Active Session History)의 구조, MMON 프로세스의 역할, 스냅샷 관리, 그리고 AWR Report·ASH Report를 활용한 실무 성능 진단 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["oracle", "awr", "ash", "performance", "mmon", "snapshot", "wait-event", "addm", "sysaux", "dba_hist"]
featured: false
draft: false
---

[지난 글](/posts/oracle-rman-backup/)에서 RMAN으로 물리적 백업을 다뤘다. 이번에는 시각을 바꿔, 운영 중인 데이터베이스의 **성능 문제를 찾아내는 두 가지 핵심 도구** — AWR과 ASH — 를 살펴본다.

## AWR이란

**AWR(Automatic Workload Repository)**은 Oracle DB가 주기적으로 성능 통계를 수집·저장하는 인프라다. 기본적으로 1시간마다 MMON 백그라운드 프로세스가 **스냅샷(Snapshot)**을 찍어 SYSAUX 테이블스페이스의 `DBA_HIST_*` 뷰 집합에 저장한다. 두 스냅샷 사이의 델타(Δ) 값을 비교하면 그 시간 구간의 부하 특성, 상위 SQL, Wait Event 등을 파악할 수 있다.

AWR 데이터는 기본 8일간 보존된다. 이 기간·간격은 `DBMS_WORKLOAD_REPOSITORY` 패키지로 조정한다.

## ASH란

**ASH(Active Session History)**는 Active 세션(CPU를 쓰거나 특정 이벤트를 기다리는 세션)을 **1초마다 샘플링**하는 메모리 내 원형 버퍼다. 메모리 뷰는 `V$ACTIVE_SESSION_HISTORY`로 조회하며 최근 약 30분 분량이 유지된다. MMNL 프로세스가 이 샘플의 1/10을 디스크(`DBA_HIST_ACTIVE_SESS_HISTORY`)에 플러시해 장기 보관한다.

AWR이 "1시간 단위 평균 통계"를 제공한다면, ASH는 "그 안에서 특정 5분 동안 무슨 일이 있었는가"를 1초 해상도로 드릴다운할 수 있게 한다.

![AWR · ASH 아키텍처](/assets/posts/oracle-awr-ash-architecture.svg)

## MMON과 MMNL

MMON(Manageability Monitor)과 MMNL(MMON Light)은 AWR/ASH를 구동하는 Oracle 백그라운드 프로세스다.

| 프로세스 | 역할 |
|---|---|
| MMON | AWR 스냅샷 생성, ADDM 분석 트리거, 통계 집계 |
| MMNL | ASH 메모리 버퍼 → SYSAUX 디스크 플러시 |

평소에는 조용히 돌아가지만, 수동으로 스냅샷을 강제할 수 있다.

```sql
-- 수동 스냅샷 생성 (예: 부하 테스트 직전/직후)
EXEC DBMS_WORKLOAD_REPOSITORY.create_snapshot();

-- AWR 보존 기간 14일 / 간격 30분으로 변경
EXEC DBMS_WORKLOAD_REPOSITORY.modify_snapshot_settings(
  retention => 20160,  -- 14 * 24 * 60 분
  interval  => 30);

-- 현재 설정 확인
SELECT snap_interval, retention
FROM   dba_hist_wr_control;
```

## AWR Report 읽기

`awrrpt.sql`을 실행하면 두 Snap ID를 입력받아 HTML 또는 텍스트 리포트를 생성한다. 리포트의 핵심 섹션은 다음과 같다.

- **DB Time vs Elapsed Time**: 전체 DB Time이 경과 시간의 몇 배인지로 병렬도를 파악
- **Top 5 Timed Events**: Wait Event 관점의 병목 Top 5
- **Top SQL**: Elapsed Time, CPU, Disk Read 기준 상위 SQL
- **Instance Activity Stats**: Parse, Execute, Logical Reads 등 핵심 지표

```sql
-- 최근 스냅샷 목록 확인 (Report 생성 전 snap_id 확인용)
SELECT snap_id,
       TO_CHAR(begin_interval_time, 'MM/DD HH24:MI') AS begin_time,
       TO_CHAR(end_interval_time,   'MM/DD HH24:MI') AS end_time
FROM   dba_hist_snapshot
WHERE  begin_interval_time > SYSDATE - 1
ORDER  BY snap_id DESC;
```

## ASH로 드릴다운

AWR Report에서 이상 시간대를 확인했다면, ASH로 그 구간을 초 단위로 파고든다.

```sql
-- 특정 시간대 상위 Wait Event
SELECT event,
       COUNT(*)            AS samples,
       wait_class
FROM   v$active_session_history
WHERE  sample_time BETWEEN TO_DATE('2026-05-11 14:00', 'YYYY-MM-DD HH24:MI')
                       AND TO_DATE('2026-05-11 14:30', 'YYYY-MM-DD HH24:MI')
  AND  session_state = 'WAITING'
GROUP  BY event, wait_class
ORDER  BY samples DESC
FETCH  FIRST 10 ROWS ONLY;
```

`session_state = 'ON CPU'`로 필터하면 대기 없이 CPU만 소비한 세션을 확인할 수 있고, `sql_id`로 그룹핑하면 특정 SQL의 CPU 소비 시간을 추정할 수 있다.

![AWR 스냅샷 관리 & ASH 쿼리](/assets/posts/oracle-awr-ash-sql.svg)

## ADDM — 자동 진단

**ADDM(Automatic Database Diagnostic Monitor)**은 매 AWR 스냅샷 생성 직후 MMON이 자동으로 실행하는 AI 진단 엔진이다. AWR 데이터를 분석해 "이 시간대 병목은 SQL X입니다, 인덱스를 추가하세요" 수준의 권고를 생성한다.

```sql
-- ADDM 태스크 결과 조회
SELECT task_name, status, description
FROM   dba_advisor_tasks
WHERE  advisor_name = 'ADDM'
ORDER  BY created DESC
FETCH  FIRST 5 ROWS ONLY;

-- 특정 태스크 상세 권고
SELECT finding_name, type, message
FROM   dba_addm_findings
WHERE  task_name = :task_name
ORDER  BY impact_db_time DESC;
```

## 라이선스 주의

AWR, ASH, ADDM은 **Oracle Diagnostics Pack** 라이선스가 필요하다. Enterprise Edition 사용자가 해당 팩 없이 `DBA_HIST_*` 뷰나 ASH를 사용하면 라이선스 위반이 된다. 라이선스 여부는 DBA 또는 라이선스 담당자에게 반드시 확인해야 한다.

```sql
-- Diagnostics Pack 사용 여부 확인
SELECT value
FROM   v$parameter
WHERE  name = 'control_management_pack_access';
-- DIAGNOSTIC+TUNING 이면 AWR/ASH/ADDM 모두 사용 가능
```

## 정리

AWR은 1시간 주기의 통계 스냅샷으로 추세를 파악하고, ASH는 1초 샘플링으로 특정 시간대의 세션 활동을 드릴다운한다. ADDM은 이 둘의 데이터를 자동 분석해 권고를 제시한다. 세 가지를 조합하면 "언제, 어떤 SQL이, 왜 느렸는가"를 체계적으로 추적할 수 있다.

---

**다음 글:** [통계 정보와 SQL 튜닝 어드바이저](/posts/oracle-stats-tuning-advisor/)

<br>
읽어주셔서 감사합니다. 😊
