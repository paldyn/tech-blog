---
title: "Oracle RAC 개요"
description: "Oracle Real Application Clusters(RAC)의 아키텍처, Cache Fusion 동작 원리, GCS/GES 역할, Interconnect 중요성, 그리고 RAC 운영 시 주의사항을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["oracle", "rac", "cache-fusion", "gcs", "ges", "interconnect", "high-availability", "asm", "cluster", "real-application-clusters"]
featured: false
draft: false
---

[지난 글](/posts/oracle-advanced-queueing/)에서 AQ로 트랜잭션 보장 메시징을 구현하는 방법을 다뤘다. 이번에는 Oracle의 대표적인 고가용성·확장성 솔루션인 **RAC(Real Application Clusters)**의 아키텍처를 살펴본다.

## RAC란

일반적인 Oracle 단일 인스턴스 구성은 하나의 서버에서 하나의 인스턴스가 하나의 데이터베이스를 관리한다. RAC는 다르다. **여러 서버(노드)에서 여러 인스턴스가 동시에 하나의 공유 데이터베이스에 접근**한다. 사용자 입장에서는 단일 DB처럼 보이지만, 내부적으로는 여러 서버가 부하를 나눠 처리한다.

![Oracle RAC 아키텍처](/assets/posts/oracle-rac-overview-arch.svg)

## 핵심 구성 요소

### 공유 스토리지

모든 노드가 동일한 데이터파일, 컨트롤 파일, Redo Log에 접근한다. Oracle은 **ASM(Automatic Storage Management)**을 통해 이 스토리지를 관리한다. ASM은 미러링과 스트라이핑을 자동으로 처리하며, 노드가 추가되거나 제거될 때 데이터를 자동으로 재배치한다.

### 인터커넥트 (Private Interconnect)

각 노드 간의 전용 고속 네트워크다. **Cache Fusion** 트래픽이 이 인터커넥트를 통해 흐른다. 인터커넥트 성능이 RAC 전체 성능에 결정적인 영향을 미친다. Oracle은 10GbE 이상, 또는 InfiniBand를 권장한다.

인터커넥트가 느리거나 손실이 발생하면 노드 간 블록 전송 지연이 발생하고, 심한 경우 노드가 클러스터에서 강제 축출(Eviction)된다.

### GCS와 GES

RAC의 핵심 인프라는 두 가지 글로벌 서비스다.

**GCS(Global Cache Service)**: 전체 노드에 걸쳐 Buffer Cache의 블록 상태를 관리한다. 어느 노드가 어떤 블록을 어떤 모드로 보유하고 있는지 추적한다.

**GES(Global Enqueue Service)**: 전체 노드에 걸쳐 Lock과 래치를 조율한다. 단일 인스턴스에서 로컬로 처리되는 엔큐를 클러스터 전체로 확장한다.

이 두 서비스를 담당하는 백그라운드 프로세스가 LMS, LMD, LMON, LCK다.

## Cache Fusion 동작 원리

Cache Fusion은 RAC의 핵심 성능 기술이다. Node 2가 Node 1의 Buffer Cache에 있는 블록을 필요로 할 때, 디스크에서 읽지 않고 **인터커넥트를 통해 직접 Node 1의 메모리에서 Node 2의 메모리로 블록을 전송**한다.

![Cache Fusion — 인터커넥트 블록 전송](/assets/posts/oracle-rac-overview-cache-fusion.svg)

```sql
-- GCS 현황 확인 (v$bh 대신 v$gc_element 또는 아래 동적 뷰)
SELECT gc_buffer_busy, cr_blocks_served, current_blocks_served
FROM   v$cr_block_server;

-- 인터커넥트 통계 확인
SELECT name, value
FROM   v$sysstat
WHERE  name LIKE 'gc%'
ORDER BY name;
```

`gc current blocks received` — 다른 노드에서 받은 Current 블록 수
`gc cr blocks received` — 다른 노드에서 받은 CR(Consistent Read) 블록 수

이 값이 높다는 것은 Cache Fusion 전송이 자주 발생한다는 의미다. 이를 줄이려면 **애플리케이션 파티셔닝**(특정 작업을 특정 노드에 고정)이나 파티셔닝을 통한 데이터 분리를 고려한다.

## 서비스와 부하 분산

RAC에서 클라이언트는 특정 노드에 직접 연결하지 않는다. **SCAN(Single Client Access Name)**을 통해 접속하며, Oracle Clusterware가 현재 부하를 고려해 최적 노드로 연결을 라우팅한다.

```sql
-- 현재 서비스 현황 확인
SELECT inst_id, service_name, status
FROM   gv$active_services
ORDER BY inst_id;

-- SCAN 리스너 확인 (OS 명령)
-- srvctl status scan_listener
-- srvctl config scan
```

애플리케이션별로 서비스를 분리해 특정 서비스는 Node 1에, 다른 서비스는 Node 2에 배치하면 Cache Fusion 충돌을 줄이고 성능을 최적화할 수 있다.

```sql
-- 서비스 생성 (srvctl 명령)
-- srvctl add service -db orcl -service oltp_svc -preferred "orcl1" -available "orcl2"
-- srvctl add service -db orcl -service report_svc -preferred "orcl2" -available "orcl1"
```

## 노드 장애와 Failover

노드 하나가 다운되면 **LMON 프로세스**가 장애를 감지하고 클러스터 재구성(Reconfiguration)을 시작한다. 장애 노드의 미완료 트랜잭션은 살아있는 노드가 롤백을 담당한다(Instance Recovery). 클라이언트 연결은 TAF(Transparent Application Failover) 또는 AC(Application Continuity)로 다른 노드로 자동 전환된다.

```sql
-- TAF 설정 예시 (tnsnames.ora)
-- ORCL =
--   (DESCRIPTION =
--     (CONNECT_TIMEOUT=10)
--     (FAILOVER=ON)
--     (ADDRESS_LIST =
--       (LOAD_BALANCE=ON)
--       (ADDRESS=(PROTOCOL=TCP)(HOST=scan-host)(PORT=1521)))
--     (CONNECT_DATA =
--       (SERVICE_NAME=orcl_svc)
--       (FAILOVER_MODE=(TYPE=SELECT)(METHOD=BASIC)(RETRIES=180)(DELAY=5))))
```

## RAC 운영 주의사항

**인터커넥트는 생명줄**: 인터커넥트 장애는 클러스터 분리(Split Brain)를 유발한다. Oracle Clusterware가 `CSS(Cluster Synchronization Services)`로 이를 감지하고, 네트워크 투표(Network Voting) 또는 디스크 투표(Voting Disk)로 어느 노드가 살아남을지 결정한다.

**핫 블록 충돌**: 여러 노드가 같은 블록을 자주 수정하면 Cache Fusion 트래픽이 폭증한다. 시퀀스 캐시를 노드 수의 배수로 늘리거나, 인덱스 블록 충돌은 Reverse Key Index로 완화한다.

```sql
-- 시퀀스 캐시 조정 (각 노드가 독립적인 캐시 범위를 가짐)
ALTER SEQUENCE order_seq CACHE 200;

-- AWR에서 TOP 글로벌 캐시 이벤트 확인
SELECT event, total_waits, time_waited
FROM   v$system_event
WHERE  event LIKE 'gc%'
ORDER BY time_waited DESC
FETCH FIRST 10 ROWS ONLY;
```

## 정리

- RAC = 여러 인스턴스 + 공유 스토리지 → 단일 DB처럼 동작
- Cache Fusion: 디스크 없이 인터커넥트로 블록 교환 → I/O 감소
- GCS/GES: 클러스터 전체의 캐시와 락을 조율
- SCAN + 서비스: 부하 분산 + 자동 Failover
- 인터커넥트 품질과 핫 블록 최소화가 RAC 성능의 핵심

---

**지난 글:** [Advanced Queuing (AQ)](/posts/oracle-advanced-queueing/)

**다음 글:** [Oracle Data Guard](/posts/oracle-data-guard/)

<br>
읽어주셔서 감사합니다. 😊
