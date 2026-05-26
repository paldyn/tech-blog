---
title: "Vitess — MySQL 위에 쌓는 수평 샤딩 미들웨어"
description: "Vitess의 아키텍처(VTGate·VTTablet·Topology), VSchema로 정의하는 샤딩 키, 핫스팟 회피, 크로스 샤드 쿼리 제약, MoveTables를 통한 무중단 리샤딩을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["Vitess", "MySQL샤딩", "VTGate", "VSchema", "수평확장", "분산SQL"]
featured: false
draft: false
---

[지난 글](/posts/distsql-aurora-storage/)에서 Amazon Aurora의 스토리지 분리 아키텍처를 살펴봤다. 이번에는 전혀 다른 접근 방식의 분산 MySQL 솔루션인 **Vitess**를 다룬다. Vitess는 새로운 데이터베이스가 아니라 기존 MySQL 위에 샤딩 레이어를 추가하는 미들웨어다. YouTube가 MySQL 단일 노드의 한계를 돌파하기 위해 만들었고, 현재는 PlanetScale 등이 상용화해 CNCF 졸업 프로젝트가 됐다.

## 핵심 아이디어: MySQL은 그대로, 라우팅만 추가

Vitess의 철학은 단순하다. MySQL을 교체하지 않는다. 기존 MySQL 클러스터를 그대로 두고, 그 앞에 라우팅 레이어(VTGate)를 추가해 여러 MySQL 인스턴스를 하나처럼 보이게 만든다. 애플리케이션은 기존 MySQL 드라이버와 SQL 문법을 그대로 사용한다.

![Vitess 아키텍처](/assets/posts/distsql-vitess-arch.svg)

## 주요 구성요소

**VTGate**: 클라이언트가 연결하는 단일 진입점이다. MySQL 프로토콜을 지원하므로 기존 드라이버로 접속한다. 쿼리를 분석해 어느 샤드로 라우팅할지 결정하고, 결과를 합쳐 반환한다.

**VTTablet**: 각 MySQL 인스턴스 옆에서 실행되는 프록시다. 쿼리 규칙 적용, 연결 풀링, 슬로우 쿼리 차단, 헬스체크를 담당한다.

**Topology Server**: etcd나 ZooKeeper를 사용해 샤드 맵, 라우팅 정보, 리더 정보를 저장한다.

## VSchema: 샤딩 키 정의

Vitess 샤딩의 핵심 설정 파일이 **VSchema**다. 어떤 컬럼을 기준으로 샤딩할지(vindex), 각 테이블의 샤딩 키가 무엇인지 정의한다.

![VSchema 샤딩 설계](/assets/posts/distsql-vitess-vschema.svg)

```sql
-- Vitess 통해 접속 (기존 MySQL 클라이언트 그대로)
mysql -h vtgate-host -P 3306 -u user -p

-- 단일 샤드 라우팅: WHERE에 샤딩 키 포함
SELECT * FROM users WHERE user_id = 12345;
-- VTGate가 hash(12345) → Shard A로만 라우팅

-- 샤드 조인: 같은 user_id 기준 샤딩이면 단일 샤드
SELECT u.name, o.amount
FROM users u JOIN orders o ON u.user_id = o.user_id
WHERE u.user_id = 12345;
-- 두 테이블 모두 user_id로 샤딩됐으면 같은 샤드 → 로컬 JOIN

-- 스캐터 쿼리 (비용 높음): 샤딩 키 없는 집계
SELECT COUNT(*) FROM orders WHERE status = 'PENDING';
-- 모든 샤드에 쿼리 후 결과 합산 → 샤드 수만큼 MySQL 쿼리 발생
```

## 크로스 샤드 제약

Vitess는 크로스 샤드 트랜잭션을 **2PC로 지원**하지만, 성능 비용이 크다. 따라서 도메인 설계 시 한 트랜잭션에 필요한 데이터가 같은 샤드에 있도록 샤딩 키를 결정하는 것이 핵심이다. 사용자 데이터와 주문 데이터를 모두 `user_id`로 샤딩하면, 한 사용자의 모든 작업이 같은 샤드에서 처리된다.

```sql
-- 크로스 샤드 트랜잭션 (user_id 다른 두 샤드)
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE user_id = 100;  -- Shard A
UPDATE accounts SET balance = balance + 100 WHERE user_id = 900000;  -- Shard B
COMMIT;
-- 2PC로 처리되지만 성능 오버헤드 큼 → 가능하면 피할 것
```

## MoveTables: 무중단 리샤딩

데이터가 커지면 샤드를 늘려야 한다(리샤딩). 기존 샤딩 시스템은 리샤딩 중 서비스 중단이 필수였지만, Vitess의 **MoveTables**와 **Reshard** 워크플로는 트래픽을 받으면서 백그라운드에서 데이터를 이전한다.

```bash
# vtctlclient로 리샤딩 시작
vtctlclient -server vtctld:15999 \
  Reshard -source_shards=- -target_shards=-80,80- \
  commerce.orders

# 상태 확인
vtctlclient -server vtctld:15999 Workflow commerce.orders show

# 트래픽 전환 (읽기 먼저)
vtctlclient -server vtctld:15999 \
  SwitchReads -tablet_type=replica commerce.orders

# 쓰기 트래픽 전환
vtctlclient -server vtctld:15999 \
  SwitchWrites commerce.orders

# 완료 후 정리
vtctlclient -server vtctld:15999 \
  Complete commerce.orders
```

## Vitess 선택 기준

Vitess는 MySQL에 이미 큰 투자를 한 조직이 수평 확장이 필요할 때 적합하다. PlanetScale은 Vitess를 기반으로 한 완전 관리형 서비스를 제공한다. 반면 처음부터 설계하는 시스템이라면 CockroachDB(PostgreSQL 호환)나 TiDB(MySQL 호환)가 운영 부담이 더 적을 수 있다. Vitess는 기존 MySQL 인프라 위에서 동작하므로 MySQL 운영 경험이 그대로 활용되는 장점이 있다.

---

**지난 글:** [Amazon Aurora — 스토리지 분리로 구현하는 분산 내구성](/posts/distsql-aurora-storage/)

**다음 글:** [OLAP vs OLTP — 두 워크로드의 근본적 차이](/posts/olap-vs-oltp/)

<br>
읽어주셔서 감사합니다. 😊
