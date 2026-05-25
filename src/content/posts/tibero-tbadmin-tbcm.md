---
title: "Tibero 관리 도구 — tbAdmin GUI와 tbcm CLI 완전 정리"
description: "Tibero의 GUI 관리 도구 tbAdmin과 CLI 관리 도구 tbcm의 주요 기능, 사용법, 모니터링 쿼리를 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["Tibero", "tbAdmin", "tbcm", "DB관리", "모니터링", "DBA"]
featured: false
draft: false
---

[지난 글](/posts/tibero-migration-from-oracle/)에서 Oracle → Tibero 마이그레이션을 다뤘다. Tibero 환경에서 DBA가 일상적으로 사용하는 두 가지 관리 도구를 알아본다. GUI 환경의 **tbAdmin**과 명령줄 환경의 **tbcm**이다.

## tbAdmin

tbAdmin은 TmaxData가 제공하는 Tibero용 웹 기반 GUI 관리 도구다. Oracle Enterprise Manager(OEM)와 유사한 역할을 한다.

![tbAdmin 주요 기능 구성](/assets/posts/tibero-tbadmin-ui.svg)

### 주요 기능

**모니터링**: 실시간 성능 지표를 대시보드로 표시한다. Buffer Hit Ratio, 활성 세션 수, TPS(Transaction Per Second), 대기 이벤트 분포를 한눈에 확인할 수 있다.

**SQL 작업실**: SQL을 작성·실행하고 결과를 확인하는 쿼리 에디터. 실행 계획(Explain Plan) 조회와 SQL 저장 기능을 포함한다.

**스키마 관리**: 테이블·인덱스·뷰·시노님 등 객체를 GUI로 생성·수정·삭제한다.

**성능 분석**: AWR(자동 워크로드 리포지토리) 상당의 성능 스냅샷을 수집하고 Top SQL을 분석한다.

### 주요 모니터링 쿼리

tbAdmin 내부에서 사용하는 것과 동일한 쿼리를 tbSQL에서 직접 실행해 모니터링할 수 있다.

```sql
-- 1. 현재 대기 이벤트 분포
SELECT event, count(*) AS cnt
FROM   v$session_wait
WHERE  wait_class != 'Idle'
GROUP  BY event
ORDER  BY cnt DESC;

-- 2. 버퍼 히트율
SELECT ROUND(
         (1 - (phys.value / (logi.value + DECODE(logi.value, 0, 1, 0))))
         * 100, 2
       ) AS buffer_hit_ratio
FROM   v$sysstat phys,
       v$sysstat logi
WHERE  phys.name = 'physical reads'
  AND  logi.name = 'session logical reads';

-- 3. Top SQL (실행 횟수 기준)
SELECT sql_id,
       executions,
       ROUND(elapsed_time / 1000000, 2) AS elapsed_sec,
       ROUND(elapsed_time / DECODE(executions, 0, 1, executions) / 1000000, 4)
           AS avg_elapsed_sec,
       sql_text
FROM   v$sql
ORDER  BY executions DESC
FETCH  FIRST 10 ROWS ONLY;
```

## tbcm — CLI 관리 도구

**tbcm(Tibero Cluster Manager)** 은 Tibero 인스턴스와 TAC 클러스터를 명령줄에서 제어하는 도구다. 운영 자동화 스크립트, 원격 서버 관리, CI/CD 파이프라인 통합에 필수다.

![tbcm 주요 명령어](/assets/posts/tibero-tbcm-monitoring.svg)

### 인스턴스 기동/종료

```bash
# DB 기동 (MOUNT → OPEN 단계 자동)
tbcm -s $TB_SID boot

# 정상 종료 (진행 중 트랜잭션 완료 대기)
tbcm -s $TB_SID down

# 즉시 종료 (트랜잭션 강제 롤백, -t 0)
tbcm -s $TB_SID down -t 0

# RESTRICT 모드 (DBA 전용, 일반 사용자 접속 차단)
tbcm -s $TB_SID down restrict
tbcm -s $TB_SID boot restrict
```

### 파라미터 관리

```bash
# 현재 파라미터 값 조회
tbcm -s $TB_SID getparam DB_BLOCK_SIZE
tbcm -s $TB_SID getparam MAX_SESSION_COUNT

# 동적 파라미터 변경 (재시작 불필요)
tbcm -s $TB_SID setparam CURSOR_SHARING=FORCE
tbcm -s $TB_SID setparam _SORT_AREA_SIZE=67108864

# 변경 내용을 tibero.tip 파일에 영구 저장
tbcm -s $TB_SID setparam -p MAX_SESSION_COUNT=300
# -p 옵션: 현재 세션 + tibero.tip 파일 모두 변경
```

### TAC 클러스터 관리

```bash
# 클러스터 노드 상태 확인
tbcm -s $TB_SID cluster node

# 특정 노드를 클러스터에서 제외 (유지보수)
tbcm -s $TB_SID cluster node remove 2

# 클러스터 재조인
tbcm -s $TB_SID cluster node join 2
```

### 통계 수집

```bash
# 스키마 통계 수집 (옵티마이저가 사용하는 통계)
tbcm -s $TB_SID analyze schema APP_SCHEMA
```

## DBA 일상 관리 패턴

tbAdmin과 tbcm을 조합한 일상 DBA 작업 예시다.

```sql
-- 잠금 대기 세션 찾기
SELECT w.sid         AS waiting_sid,
       w.username    AS waiting_user,
       w.event       AS wait_event,
       h.sid         AS holding_sid,
       h.username    AS holding_user,
       h.sql_id
FROM   v$session w
JOIN   v$session h
  ON   w.blocking_session = h.sid
WHERE  w.wait_class != 'Idle'
  AND  w.blocking_session IS NOT NULL;

-- 잠금 대기 세션 강제 종료
ALTER SYSTEM KILL SESSION '87,4231';
-- (SID, SERIAL# 값은 v$session에서 확인)

-- 테이블스페이스 사용률 확인
SELECT tablespace_name,
       ROUND(used_space * 8192 / 1024 / 1024, 0) AS used_mb,
       ROUND(tablespace_size * 8192 / 1024 / 1024, 0) AS total_mb,
       ROUND(used_percent, 1) AS used_pct
FROM   dba_tablespace_usage_metrics
ORDER  BY used_pct DESC;
```

## tibero.tip 파라미터 파일

Tibero의 구성 파일은 `$TB_HOME/config/$TB_SID.tip`에 위치한다. Oracle의 `spfile`/`pfile` 역할을 한다.

```bash
# tibero.tip 주요 파라미터 예시
DB_NAME=tibero
LISTENER_PORT=8629
MAX_SESSION_COUNT=300
TOTAL_SHM_SIZE=4G        # 공유 메모리 총량 (SGA 상당)
_BUFFER_POOL_SIZE=2G     # DB Buffer Cache 크기
LOG_BUFFER=32M           # Redo Log Buffer
DB_BLOCK_SIZE=8192       # 블록 크기 (기본 8KB, 변경 불가)
```

tbAdmin의 GUI 직관성과 tbcm의 스크립트 자동화 능력을 함께 익히면 Tibero DBA 업무의 대부분을 효율적으로 처리할 수 있다.

---

**지난 글:** [Oracle에서 Tibero로 마이그레이션](/posts/tibero-migration-from-oracle/)

**다음 글:** [Altibase 인메모리 데이터베이스 아키텍처](/posts/altibase-in-memory-architecture/)

<br>
읽어주셔서 감사합니다. 😊
