---
title: "Tibero Active Cluster(TAC) 구조와 동작 원리"
description: "Tibero의 고가용성 클러스터 솔루션 TAC의 아키텍처, Cache Fusion, GCS/GES, 장애 조치(Failover) 메커니즘을 Oracle RAC와 비교하며 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["Tibero", "TAC", "클러스터", "HighAvailability", "CacheFusion", "GCS", "GES"]
featured: false
draft: false
---

[지난 글](/posts/tibero-architecture-oracle-compat/)에서 Tibero의 전체 아키텍처와 Oracle 호환성을 살펴봤다. 이번 글에서는 Tibero의 고가용성 솔루션인 **TAC(Tibero Active Cluster)** 를 다룬다. 금융·공공 시스템처럼 중단이 허용되지 않는 환경에서 TAC가 어떻게 여러 서버를 하나처럼 운영하는지 알아본다.

## TAC란

TAC는 Oracle RAC(Real Application Clusters)에 대응하는 Tibero의 **Active-Active 클러스터** 솔루션이다. 여러 서버(노드)가 하나의 공유 스토리지를 동시에 마운트해 운영하는 Shared-Disk 아키텍처로, 모든 노드가 읽기·쓰기 모두 처리한다.

- **Active-Active**: 모든 노드가 동시에 서비스 가능 (Active-Standby와 달리 대기 노드 없음)
- **Shared-Disk**: 스토리지를 여러 노드가 공유하므로 데이터 복제 없이 일관성 유지
- **Scale-Out**: 노드 추가만으로 처리량 증가

![Tibero Active Cluster 구조](/assets/posts/tibero-tac-architecture.svg)

## Cache Fusion

TAC의 핵심 기술은 **Cache Fusion**이다. 여러 노드가 각자의 Buffer Cache를 갖지만, 어떤 블록이 어느 노드에 있는지 전역적으로 추적한다.

**문제**: Node 1이 수정한 dirty buffer를 Node 2가 필요로 할 때, 디스크에 기록하고 다시 읽으면 성능이 크게 저하된다.

**Cache Fusion 해결책**: dirty buffer를 디스크 경유 없이 노드 간 고속 인터커넥트(InfiniBand 또는 10GbE)로 직접 전송한다.

```sql
-- 예시 시나리오
-- Node 1에서 트랜잭션 실행 (account_id=100 블록이 Node 1 캐시에 있음)
-- Node 1:
UPDATE accounts SET balance = 9000 WHERE account_id = 100;
-- 이 블록은 Node 1 Buffer Cache에 dirty 상태

-- Node 2에서 같은 블록 조회 요청 발생
-- Cache Fusion: Node 1 → Node 2로 블록 직접 전송 (디스크 미경유)
SELECT balance FROM accounts WHERE account_id = 100;
-- Node 2는 Node 1에서 받은 블록으로 읽기 일관성 스냅샷 반환
```

## GCS와 GES

Cache Fusion이 동작하려면 두 가지 전역 서비스가 필요하다.

### GCS (Global Cache Service)

**블록 소유권(ownership)** 을 전역 관리한다. 각 블록에 대해 현재 어떤 노드가 "현재 버전"을 갖고 있는지, 어떤 노드가 수정 중인지 추적한다.

```
블록 #1234:
  현재 소유자: Node 1 (dirty, write lock)
  공유 독자: Node 2, Node 3 (read 가능)
  → Node 2가 수정 요청 시: Node 1이 flush 또는 전송 후 소유권 이전
```

### GES (Global Enqueue Service)

**잠금(lock)** 을 전역 조정한다. 같은 행(row)을 두 노드가 동시에 수정하려 할 때 직렬화한다. Oracle RAC의 GES와 역할이 동일하다.

| 서비스 | 관리 대상 | Oracle RAC 대응 |
|---|---|---|
| GCS | 버퍼 블록 소유권 | GCS (Global Cache Service) |
| GES | DML 잠금·DDL 잠금 | GES (Global Enqueue Service) |

## 장애 조치 (Failover)

![TAC 장애 조치 흐름](/assets/posts/tibero-tac-failover.svg)

한 노드가 다운되면 TAC는 자동으로 복구한다.

1. **감지**: 살아있는 노드들이 Heartbeat 타임아웃으로 장애 감지
2. **인스턴스 복구**: 다운된 노드가 처리 중이던 트랜잭션을 다른 노드가 리두 로그를 이용해 복구(미완료 트랜잭션 롤백, 완료된 트랜잭션 리두)
3. **연결 재라우팅**: JDBC/ODBC 드라이버의 TAC 지원 기능이 클라이언트 연결을 살아있는 노드로 자동 재연결
4. **계속 서비스**: 남은 노드들이 서비스를 이어받아 정상 운영

```xml
<!-- JDBC URL에 TAC 연결 설정 예시 (tibero-jdbc) -->
<!-- jdbc:tibero:thin:@(DESCRIPTION=
       (LOAD_BALANCE=ON)
       (FAILOVER=ON)
       (ADDRESS=(PROTOCOL=TCP)(HOST=node1)(PORT=8629))
       (ADDRESS=(PROTOCOL=TCP)(HOST=node2)(PORT=8629))
       (ADDRESS=(PROTOCOL=TCP)(HOST=node3)(PORT=8629))
       (CONNECT_DATA=(SID=tibero))) -->
```

## TAC vs Oracle RAC

두 솔루션은 개념은 동일하지만 구현 세부사항이 다르다.

| 항목 | Oracle RAC | Tibero TAC |
|---|---|---|
| 클러스터 방식 | Shared Disk, Active-Active | Shared Disk, Active-Active |
| 인터커넥트 | InfiniBand / GbE | InfiniBand / 10GbE |
| 블록 공유 | Cache Fusion | Cache Fusion (동일 명칭) |
| 전역 잠금 | GCS / GES | GCS / GES (동일 명칭) |
| 클러스터 SW | Oracle Clusterware | TmaxCluster |
| 최대 노드 수 | 100+ | 일반적으로 8노드 미만 권장 |
| 라이선스 | 매우 고비용 | 저비용 (국산) |

## TAC 도입 시 고려사항

```sql
-- TAC 상태 확인 (클러스터 노드 목록)
SELECT inst_id, instance_name, host_name, status
FROM   gv$instance
ORDER BY inst_id;

-- 전역 잠금 경합 확인
SELECT inst_id, event, total_waits, time_waited
FROM   gv$system_event
WHERE  event LIKE 'gc%'   -- global cache 관련 대기
ORDER BY time_waited DESC;
```

TAC는 단일 노드 대비 인터커넥트 통신 오버헤드가 발생하므로, 단순 조회 위주(읽기 집중) 워크로드보다 **혼합 워크로드**에서 효율이 높다. 같은 블록을 여러 노드가 자주 수정하는 Hot Block 패턴은 Cache Fusion 경합을 일으키므로 애플리케이션 설계 단계에서 데이터 파티셔닝으로 경합을 줄여야 한다.

---

**지난 글:** [Tibero RDBMS 아키텍처와 Oracle 호환성](/posts/tibero-architecture-oracle-compat/)

**다음 글:** [Tibero tbPSM — PL/SQL 호환 절차형 언어](/posts/tibero-tsql-psm/)

<br>
읽어주셔서 감사합니다. 😊
