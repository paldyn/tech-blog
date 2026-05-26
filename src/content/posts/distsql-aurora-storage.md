---
title: "Amazon Aurora — 스토리지 분리로 구현하는 분산 내구성"
description: "Amazon Aurora의 컴퓨트-스토리지 분리 아키텍처, 6/4 쿼럼 쓰기, Log-only 복제, Aurora Global Database, Serverless v2를 MySQL/PostgreSQL 호환 관점에서 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["AmazonAurora", "Aurora", "분산스토리지", "쿼럼", "GlobalDatabase", "Serverless"]
featured: false
draft: false
---

[지난 글](/posts/distsql-spanner-truetime/)에서 Google Spanner의 TrueTime 기반 글로벌 일관성을 살펴봤다. 이번에는 클라우드 매니지드 데이터베이스 중 가장 널리 쓰이는 Amazon Aurora를 다룬다. Aurora는 Spanner나 CockroachDB처럼 완전히 새로운 쿼리 엔진을 만드는 방향 대신, 기존 MySQL/PostgreSQL 엔진을 유지하면서 **스토리지 레이어만 분산화**하는 전략을 택했다.

## 핵심 아이디어: 스토리지만 분산

전통적인 데이터베이스는 컴퓨트(CPU/메모리)와 스토리지(디스크)가 같은 서버에 있다. MySQL의 읽기 복제본을 만들려면 binlog를 전송해 복제하는데, 페이지 단위 I/O가 많아서 복제 지연이 발생한다.

Aurora는 이를 거꾸로 뒤집었다. **컴퓨트(DB 인스턴스)와 스토리지를 완전히 분리**하고, 스토리지를 독립적인 분산 시스템으로 만들었다. DB 인스턴스는 Redo Log만 스토리지에 보내고, 스토리지 노드가 이 로그를 Apply해서 데이터 페이지를 재구성한다.

![Aurora 컴퓨트-스토리지 분리 아키텍처](/assets/posts/distsql-aurora-storage-arch.svg)

## 6/4 쿼럼 복제

Aurora 스토리지는 한 리전의 3개 가용 영역(AZ)에 걸쳐 **6개 복제본**을 유지한다. 각 AZ에 2개씩 배치된다.

- **쓰기**: 6개 중 4개에 로그 기록 확인 → 커밋 (4/6 쿼럼)
- **읽기**: 4개에서 일관된 응답 → 성공 (4/6 쿼럼)

이 설계가 보장하는 내구성: AZ 하나가 완전히 다운(2개 손실) + 다른 AZ의 노드 하나 추가 장애(1개 손실) = 총 3개 손실 상황에서도 나머지 3개로 읽기는 계속된다(3/6 → 쿼럼 미달이지만 실제로는 쿼럼 미달 상태를 별도 처리). 실질적으로 동시 2개 손실까지 무중단이다.

## Log-only 복제의 장점

기존 MySQL 복제는 `binlog → 복제본 SQL replay`라서 지연이 발생한다. Aurora는 인스턴스가 로그만 쓰고, 스토리지 노드가 직접 Apply하기 때문에 복제 지연이 극히 적다. 읽기 복제본 최대 15개를 추가해도 모두 같은 스토리지를 공유하므로, 복제본이 늘어도 복제 지연이 증가하지 않는다. 복제본 추가 시 스토리지 복사도 필요 없다.

```sql
-- Aurora MySQL: 읽기 복제본 엔드포인트 사용
-- 쓰기: cluster writer endpoint
-- mysql -h my-cluster.cluster-xxxx.ap-northeast-2.rds.amazonaws.com

-- 읽기: cluster reader endpoint (모든 복제본에 부하 분산)
-- mysql -h my-cluster.cluster-ro-xxxx.ap-northeast-2.rds.amazonaws.com

-- 특정 읽기 복제본 직접 연결
-- mysql -h my-cluster-instance-1.xxxx.ap-northeast-2.rds.amazonaws.com

-- Aurora 버전 확인
SELECT @@aurora_version;
-- 예: 3.04.1 (MySQL 8.0 호환)

-- PostgreSQL 호환 Aurora도 동일한 쿼럼 스토리지 사용
-- psql -h my-pg-cluster.cluster-xxxx.ap-northeast-2.rds.amazonaws.com -U postgres
```

## Aurora Global Database

리전 간 재해 복구와 글로벌 읽기 성능을 위해 **Aurora Global Database**를 사용한다. 하나의 Primary 리전과 최대 5개의 Secondary 리전으로 구성한다. 리전 간 복제 지연은 1초 이내이며, 재해 시 Secondary를 Primary로 승격(failover)하는 시간은 1분 이내다.

![Aurora 주요 기능](/assets/posts/distsql-aurora-storage-sql.svg)

```sql
-- Aurora PostgreSQL: 스냅샷 복원 (특정 시점 복구)
-- RDS 콘솔 또는 CLI로 수행
-- aws rds restore-db-cluster-to-point-in-time \
--   --source-db-cluster-identifier my-cluster \
--   --db-cluster-identifier my-cluster-restored \
--   --restore-to-time 2026-05-26T10:00:00Z

-- Backtrack (Aurora MySQL 전용): 트랜잭션 롤백 없이 시간 되돌리기
-- aws rds backtrack-db-cluster \
--   --db-cluster-identifier my-cluster \
--   --backtrack-to "2026-05-26T09:50:00+00:00"
```

## Serverless v2: 즉시 스케일

Aurora Serverless v2는 0.5 ACU(Aurora Capacity Unit) 단위로 CPU/메모리를 즉시 확장/축소한다. 초당 수준의 응답 속도로 트래픽 급증을 처리하고, 유휴 시에는 최소 ACU까지 줄어든다. 개발·테스트 환경이나 예측 불가능한 트래픽 패턴에 적합하다.

## Aurora vs 전통 RDS

Aurora는 RDS MySQL/PostgreSQL보다 비용이 비싸지만, 스토리지 자동 성장(최대 128TiB), 높은 내구성(6중 복제), 빠른 페일오버(30초), 읽기 복제본 최대 15개라는 장점이 있다. 동일한 데이터를 여러 복제본이 공유하므로 복제본 추가 비용이 낮다. 단, Spanner나 CockroachDB처럼 진정한 수평 쓰기 분산은 아니다. 쓰기는 여전히 단일 Primary에 집중된다.

---

**지난 글:** [Google Spanner — TrueTime과 글로벌 일관성](/posts/distsql-spanner-truetime/)

**다음 글:** [Vitess — MySQL 위에 쌓는 수평 샤딩 미들웨어](/posts/distsql-vitess/)

<br>
읽어주셔서 감사합니다. 😊
