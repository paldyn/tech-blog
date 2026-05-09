---
title: "Oracle Data Guard"
description: "Oracle Data Guard의 Physical·Logical Standby 차이, Redo 전송 방식(SYNC/ASYNC), 보호 모드 3가지, Switchover·Failover 명령, 그리고 Active Data Guard 활용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["oracle", "data-guard", "standby", "redo-transport", "switchover", "failover", "active-data-guard", "dgmgrl", "disaster-recovery", "high-availability"]
featured: false
draft: false
---

[지난 글](/posts/oracle-rac-overview/)에서 RAC로 단일 클러스터 내 고가용성을 구현하는 방법을 살펴봤다. RAC는 같은 데이터센터 내 장애에는 강하지만, 데이터센터 전체가 재해(화재, 홍수, 정전)를 당하면 무용지물이다. **Data Guard**는 원격 지역에 동기화된 복제본을 두어 재해 복구(DR)를 보장한다.

## Data Guard 개요

Data Guard는 Primary Database의 모든 변경 사항을 Redo 데이터로 Standby Database에 전송하고 적용한다. Standby는 항상 Primary와 동기화된(또는 최소한의 지연으로) 상태를 유지한다. Primary 장애 시 Standby를 새 Primary로 전환(Failover)한다.

![Oracle Data Guard 아키텍처](/assets/posts/oracle-data-guard-arch.svg)

## Physical vs Logical Standby

**Physical Standby**: Redo Apply 방식으로 Primary의 블록 이미지를 그대로 복제한다. 데이터 파일 수준에서 Primary와 완전히 동일한 복사본이다. 가장 빠르고 안정적이며 Oracle의 권장 방식이다.

**Logical Standby**: SQL Apply 방식으로 Redo에서 SQL을 재생성해 적용한다. Standby에서 추가 테이블이나 인덱스를 생성하거나, Primary와 다른 스토리지 구조를 사용할 수 있다. 단, 모든 데이터 타입과 DDL을 지원하지는 않는다.

```sql
-- Physical Standby에서 Redo Apply 시작 (일반)
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE
  DISCONNECT FROM SESSION;

-- Real-Time Apply (Standby Redo Log 사용, 지연 최소화)
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE
  USING CURRENT LOGFILE
  DISCONNECT FROM SESSION;
```

## Redo 전송 방식

Primary가 Redo를 Standby에 보내는 방식은 두 가지다.

**SYNC (동기)**: LGWR가 Redo를 로컬 Redo Log와 Standby에 동시에 기록한다. Standby가 수신을 확인해야만 트랜잭션이 커밋된다. **데이터 손실 없음(RPO=0)**이지만 네트워크 지연이 성능에 영향을 준다.

**ASYNC (비동기)**: LGWR 또는 ARCH가 로컬 기록 후 별도로 Standby에 전송한다. Primary 성능에 영향 없이 최소한의 지연으로 전달하지만 약간의 데이터 손실 가능성이 있다.

## 보호 모드 3가지

![Data Guard 설정 & 전환 명령](/assets/posts/oracle-data-guard-modes.svg)

```sql
-- 보호 모드 설정 (Primary에서)
ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE AVAILABILITY;
-- 또는
ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE PERFORMANCE;
ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE PROTECTION;
```

| 보호 모드 | 전송 방식 | 데이터 손실 | Primary 영향 |
|---|---|---|---|
| Maximum Protection | SYNC + NOAFFIRM | 0 | Primary 정지 가능 |
| Maximum Availability | SYNC | 최소 | 네트워크 단절 시 ASYNC 전환 |
| Maximum Performance | ASYNC | 약간 가능 | 없음 |

운영 환경에서는 **Maximum Availability**가 가장 많이 쓰인다. 평상시는 SYNC로 데이터 손실을 방지하고, 네트워크 장애 시 자동으로 ASYNC로 전환해 Primary 가용성을 유지한다.

## Switchover vs Failover

**Switchover (계획된 역할 전환)**: 유지보수나 데이터센터 이전 시 사용한다. 데이터 손실 없이 Primary와 Standby 역할을 안전하게 교체한다.

```sql
-- 1. Primary에서 실행 (Standby로 전환 준비)
ALTER DATABASE COMMIT TO SWITCHOVER TO STANDBY
  WITH SESSION SHUTDOWN;

-- Primary가 SWITCHOVER PENDING 상태 확인
SELECT SWITCHOVER_STATUS FROM V$DATABASE;

-- 2. Standby에서 실행 (Primary로 전환)
ALTER DATABASE COMMIT TO SWITCHOVER TO PRIMARY;

-- 3. 새 Primary에서 서비스 시작
ALTER DATABASE OPEN;
```

**Failover (비계획 전환)**: Primary가 갑자기 불능 상태가 됐을 때 Standby를 즉시 Primary로 활성화한다. 데이터 손실이 발생할 수 있다(Maximum Protection 제외).

```sql
-- Standby에서 실행 (Primary가 완전히 다운됐을 때)
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE FINISH;
ALTER DATABASE ACTIVATE STANDBY DATABASE;
ALTER DATABASE OPEN;
```

## Active Data Guard

Oracle 11g부터 Physical Standby를 **읽기 전용으로 열면서 Redo Apply를 동시에 진행**할 수 있다. 이것이 **Active Data Guard**다. Primary의 부하를 Standby에서 받아낼 수 있어, 리포팅·배치·백업을 Standby에서 실행한다.

```sql
-- Active Data Guard로 열기 (Standby에서)
ALTER DATABASE OPEN READ ONLY;
-- Redo Apply 재시작
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE
  USING CURRENT LOGFILE DISCONNECT;

-- 현재 상태 확인
SELECT open_mode, database_role FROM v$database;
-- OPEN_MODE: READ ONLY WITH APPLY
-- DATABASE_ROLE: PHYSICAL STANDBY
```

Oracle 19c부터는 **DML Redirect** 기능이 추가됐다. Active Data Guard에서 DML이 발생하면 자동으로 Primary로 포워딩된다. 애플리케이션이 Standby와 Primary를 구분하지 않아도 된다.

## Data Guard Broker (DGMGRL)

DGMGRL은 Data Guard 구성 전체를 단일 인터페이스로 관리한다. Switchover/Failover 자동화, 상태 모니터링, **Fast-Start Failover(FSFO)** 등을 지원한다.

```bash
# DGMGRL 접속
dgmgrl sys/password@primary

DGMGRL> show configuration;
DGMGRL> show database verbose standby1;
DGMGRL> switchover to standby1;
DGMGRL> failover to standby1;
```

FSFO는 Primary 장애를 Observer가 감지하면 자동으로 Failover를 수행한다. RPO/RTO 요구사항이 엄격한 환경에서 인력 개입 없이 빠른 복구를 제공한다.

## Data Guard 지연(Lag) 모니터링

```sql
-- Primary에서 전송 지연 확인
SELECT dest_id, status, error,
       applied_scn, applied_time
FROM   v$archive_dest_status
WHERE  dest_id = 2;

-- Standby에서 적용 지연 확인
SELECT name, value, time_computed
FROM   v$dataguard_stats
WHERE  name IN ('apply lag', 'transport lag');
```

`apply lag`이 커지면 Standby가 Primary보다 많이 뒤처진 상태다. 네트워크 대역폭, Standby의 I/O 성능, Redo 볼륨을 점검한다.

## 정리

- Physical Standby: 블록 수준 복제, 가장 안정적
- SYNC: RPO=0 보장, ASYNC: 성능 우선
- Maximum Availability: 실무 표준 보호 모드
- Switchover: 계획 전환(무손실), Failover: 긴급 전환
- Active Data Guard: Standby에서 읽기 + Apply 동시 운영
- DGMGRL + FSFO: 자동화된 재해 복구

---

**지난 글:** [Oracle RAC 개요](/posts/oracle-rac-overview/)

**다음 글:** [RMAN 백업과 복구](/posts/oracle-rman-backup/)

<br>
읽어주셔서 감사합니다. 😊
