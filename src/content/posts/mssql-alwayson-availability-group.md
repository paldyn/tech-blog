---
title: "SQL Server Always On 가용성 그룹 — HA와 DR의 통합"
description: "SQL Server Always On 가용성 그룹의 구성 요소(AG Listener, Primary/Secondary 레플리카, WSFC), 동기·비동기 커밋 모드, 읽기 전용 라우팅, 자동 장애 조치 설정을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "AlwaysOn", "가용성그룹", "HA", "DR", "WSFC", "고가용성"]
featured: false
draft: false
---

[지난 글](/posts/mssql-backup-restore/)에서 백업·복원으로 재해 복구를 준비하는 방법을 살펴봤다. 이번에는 백업보다 한 단계 위의 고가용성(HA)·재해 복구(DR) 솔루션인 **Always On 가용성 그룹(Availability Group, AG)** 을 다룬다. AG는 SQL Server 2012에 도입된 이후 엔터프라이즈 환경의 표준 HA 솔루션이 됐다.

## AG가 해결하는 문제

전통적인 SQL Server 클러스터링(FCI, Failover Cluster Instance)은 공유 스토리지에 의존한다. 한 노드가 장애를 일으켜도 공유 디스크에서 다른 노드가 이어받지만, 공유 디스크 자체가 단일 장애점이다. DR을 위해 지리적으로 분리된 사이트를 구성하기도 어렵다.

AG는 공유 스토리지 없이 **로그 스트림 복제** 방식으로 데이터를 여러 레플리카에 유지한다. 같은 데이터센터 내 HA와 다른 사이트 DR을 하나의 AG 구성으로 동시에 해결할 수 있다.

![Always On 가용성 그룹 아키텍처](/assets/posts/mssql-alwayson-availability-group-arch.svg)

## 핵심 구성 요소

**AG Listener**는 애플리케이션이 연결하는 가상 네트워크 이름(VNN)과 IP 주소다. 장애 조치 시 Primary가 바뀌어도 애플리케이션은 Listener 주소만 알면 자동으로 새 Primary로 연결된다. 연결 문자열에 `ApplicationIntent=ReadOnly`를 지정하면 Listener가 읽기 전용 Secondary로 라우팅한다.

**Primary 레플리카**는 AG에서 유일하게 읽기·쓰기를 모두 허용한다. 트랜잭션 커밋 시 로그를 생성하고 Secondary에 전송한다.

**Secondary 레플리카**는 Primary로부터 로그를 받아 Redo 적용한다. 동기 레플리카는 자동 장애 조치 대상이 되고 읽기 전용 쿼리도 허용할 수 있다.

**WSFC(Windows Server Failover Cluster)**는 모든 AG 노드의 상태를 감지하고 장애 조치를 조율하는 기반 인프라다. SQL Server 2019 이상에서는 Linux AG도 가능하다(Pacemaker 사용).

## 동기 vs 비동기 커밋 모드

![동기 vs 비동기 커밋 모드](/assets/posts/mssql-alwayson-availability-group-modes.svg)

동기 모드에서는 Primary가 트랜잭션을 커밋하기 전에 Secondary가 로그를 수신해 하드닝(디스크 기록)했다는 ACK를 기다린다. 데이터 손실이 없지만 네트워크 지연이 커밋 지연으로 직결된다. 같은 데이터센터 또는 지연이 1ms 이하인 고속 전용선에서만 실용적이다.

비동기 모드는 ACK를 기다리지 않고 즉시 커밋한다. Primary 장애 시 Secondary에 아직 전달되지 않은 로그가 있을 수 있어 RPO > 0이다. WAN을 통한 DR 사이트나 보고서용 읽기 Secondary에 적합하다.

```sql
-- 현재 AG 상태 확인
SELECT ag.name, ar.replica_server_name,
       ar.availability_mode_desc, ar.failover_mode_desc,
       ars.synchronization_state_desc, ars.synchronization_health_desc
FROM   sys.availability_groups ag
JOIN   sys.availability_replicas ar ON ar.group_id = ag.group_id
JOIN   sys.dm_hadr_availability_replica_states ars
         ON ars.replica_id = ar.replica_id;
```

## 읽기 전용 라우팅

Secondary 레플리카를 보고서 쿼리나 SSRS 데이터 소스로 활용하면 Primary 부하를 분산할 수 있다.

```sql
-- 읽기 전용 라우팅 설정 (Primary에서 실행)
ALTER AVAILABILITY GROUP [AGPROD]
  MODIFY REPLICA ON N'SQL01'
    WITH (SECONDARY_ROLE (ALLOW_CONNECTIONS = READ_ONLY,
                          READ_ONLY_ROUTING_URL = N'TCP://sql01.corp.com:1433'));

ALTER AVAILABILITY GROUP [AGPROD]
  MODIFY REPLICA ON N'SQL02'
    WITH (PRIMARY_ROLE (READ_ONLY_ROUTING_LIST = (N'SQL02', N'SQL03')));

-- 애플리케이션 연결 문자열
-- Server=ag-listener;Database=AdventureWorks;ApplicationIntent=ReadOnly;
```

## 모니터링

```sql
-- AG 동기화 지연 (초 단위)
SELECT ar.replica_server_name,
       drs.database_id,
       drs.log_send_queue_size       AS send_queue_kb,
       drs.redo_queue_size           AS redo_queue_kb,
       drs.last_commit_time
FROM   sys.dm_hadr_database_replica_states drs
JOIN   sys.availability_replicas ar ON ar.replica_id = drs.replica_id
WHERE  drs.is_local = 0;  -- Secondary 레플리카만
```

## 정리

Always On AG는 공유 스토리지 없이 여러 레플리카에 데이터를 유지해 HA와 DR을 통합한다. 동기 레플리카로 RPO=0·자동 장애 조치를 구현하고, 비동기 레플리카로 지리적 DR 사이트를 구성하는 것이 일반적인 엔터프라이즈 패턴이다. AG Listener와 읽기 전용 라우팅을 활용하면 읽기 부하 분산까지 하나의 구성으로 달성할 수 있다.

---

**지난 글:** [SQL Server 백업과 복원 — 전략과 실전 절차](/posts/mssql-backup-restore/)

**다음 글:** [SQL Server 복제 유형 — Snapshot · Transactional · Merge](/posts/mssql-replication-types/)

<br>
읽어주셔서 감사합니다. 😊
