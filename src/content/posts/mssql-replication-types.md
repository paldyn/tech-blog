---
title: "SQL Server 복제 유형 — Snapshot · Transactional · Merge · P2P"
description: "SQL Server 네 가지 복제 유형(Snapshot, Transactional, Merge, Peer-to-Peer)의 동작 방식과 에이전트 구성, 사용 시나리오와 Always On AG와의 역할 분담을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "복제", "TransactionalReplication", "SnapshotReplication", "P2P", "HA"]
featured: false
draft: false
---

[지난 글](/posts/mssql-alwayson-availability-group/)에서 Always On 가용성 그룹으로 HA와 DR을 통합하는 방법을 살펴봤다. 이번에는 AG와 함께 SQL Server 데이터 배포의 양대 축을 이루는 **복제(Replication)** 를 다룬다. 복제는 AG가 처리하지 못하는 시나리오 — 이기종 타겟, 필터링 배포, 이단 방향 동기화 — 를 담당한다.

## 복제의 기본 역할 구조

SQL Server 복제는 출판-배포-구독 모델을 따른다.

- **Publisher**: 원본 데이터를 보유하며 복제 대상 아티클(테이블, 저장 프로시저 등)을 정의한다.
- **Distributor**: Publisher의 변경을 수집해 큐(Distribution DB)에 보관하고 Subscriber로 전달하는 중간 허브다.
- **Subscriber**: Publisher의 데이터를 수신하는 타겟이다. SQL Server 외에 Oracle, Azure SQL도 가능하다.

![SQL Server 복제 유형 비교](/assets/posts/mssql-replication-types-overview.svg)

## Snapshot 복제

주기적으로 Publication의 전체 데이터를 스냅샷으로 찍어 Subscriber에 전송한다. 초기 구성이 단순하고 전달 주기가 길어도 되는 코드 테이블, 가격표 등의 배포에 적합하다. 대용량 테이블에는 전송 비용이 크다는 단점이 있다.

```sql
-- Snapshot Agent 수동 실행 (Distribution 측)
USE distribution;
EXEC sys.sp_startpublication_snapshot
  @publication = N'PubProducts',
  @publisher   = N'SQL01';
```

## Transactional 복제

가장 널리 사용되는 복제 유형이다. Log Reader Agent가 Publisher의 트랜잭션 로그를 읽어 변경만 추출하고, Distribution Agent가 Subscriber에 적용한다. 지연이 초 단위로 낮고 대용량 데이터베이스에도 적합하다.

![Transactional 복제 에이전트 흐름](/assets/posts/mssql-replication-types-transactional.svg)

```sql
-- Publication 생성 (Publisher에서 실행)
EXEC sp_addpublication
  @publication = N'PubOrders',
  @status      = N'active',
  @sync_method = N'concurrent';

-- 아티클(테이블) 추가
EXEC sp_addarticle
  @publication = N'PubOrders',
  @article     = N'Orders',
  @source_object = N'Orders',
  @type          = N'logbased';

-- Subscriber 등록
EXEC sp_addsubscription
  @publication      = N'PubOrders',
  @subscriber       = N'SQL02',
  @destination_db   = N'ReportsDB',
  @subscription_type = N'push';
```

Transactional 복제는 Publisher에 Primary Key가 필수다. Subscriber에서 DML이 발생하면 충돌이 생기므로 Subscriber는 일반적으로 읽기 전용으로 운영한다.

## Merge 복제

Publisher와 Subscriber 양쪽에서 변경이 발생하고 주기적으로 병합하는 모드다. 오프라인 환경(현장 디바이스, 지점 PC)에서 작업 후 중앙에 동기화하는 시나리오에 역사적으로 사용됐다. 충돌 해결 정책을 별도로 설계해야 하고, 각 테이블에 rowguid 컬럼이 추가되는 오버헤드가 있다. 현대 아키텍처에서는 Cosmos DB나 Azure Sync 등으로 대체되는 추세다.

## Peer-to-Peer 복제

Transactional 복제의 확장으로, 모든 노드가 Publisher이자 Subscriber가 되어 양방향으로 변경을 복제한다. 지역별로 데이터 업데이트가 발생하는 글로벌 OLTP 시스템에서 읽기·쓰기 부하를 분산할 때 사용한다. Enterprise Edition 전용이며 충돌 방지를 애플리케이션 레벨에서 철저히 설계해야 한다.

## 복제 모니터링

```sql
-- 복제 에이전트 상태 확인
SELECT name, status, last_action_time, message
FROM   msdb.dbo.MSreplication_agents;

-- 복제 지연 (Tracer Token 방식)
EXEC sp_posttracertoken
  @publication      = N'PubOrders',
  @publisher        = N'SQL01',
  @publisher_db     = N'AdventureWorks';
-- 몇 분 후
SELECT * FROM distribution.dbo.MStracer_tokens
ORDER  BY tracer_id DESC;
```

## Always On AG vs 복제 역할 분담

현재 대부분의 HA·DR 요건은 AG로 처리한다. 복제는 다음 경우에 여전히 유효하다.

| 시나리오 | AG | 복제 |
|---|---|---|
| 같은 SQL Server 버전·인스턴스 내 HA | ✓ | — |
| Oracle·Azure SQL 등 이기종 타겟 | ✗ | ✓ |
| 테이블·행·열 단위 필터링 배포 | ✗ | ✓ |
| 오프라인 클라이언트 양방향 동기화 | ✗ | ✓ (Merge) |

## 정리

SQL Server 복제는 네 가지 유형 중 Transactional이 OLTP→보고서 배포의 표준이다. AG를 도입한 이후에도 이기종 타겟이나 필터 배포가 필요하면 Transactional 복제를 병행한다. 복제 구성 후에는 Replication Monitor와 Tracer Token으로 지연을 주기적으로 점검하는 것이 필수다.

---

**지난 글:** [SQL Server Always On 가용성 그룹 — HA와 DR의 통합](/posts/mssql-alwayson-availability-group/)

**다음 글:** [SQL Server DMV 진단 — 성능 병목 실시간 분석](/posts/mssql-dmv-diagnostics/)

<br>
읽어주셔서 감사합니다. 😊
