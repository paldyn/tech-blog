---
title: "Google Spanner — TrueTime과 글로벌 일관성"
description: "Google Spanner의 TrueTime API, 커밋 대기(commit-wait), Paxos 기반 분산 복제, INTERLEAVE TABLE, Stale 읽기를 설명하고, CockroachDB·YugabyteDB와의 차이를 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["GoogleSpanner", "TrueTime", "CommitWait", "Paxos", "분산SQL", "글로벌일관성"]
featured: false
draft: false
---

[지난 글](/posts/distsql-yugabytedb/)에서 YugabyteDB의 이중 API 아키텍처를 살펴봤다. 이번에는 현존하는 분산 SQL 중 가장 높은 수준의 일관성 보장을 구현한 Google Spanner를 다룬다. Spanner는 2012년 Google이 발표한 논문에서 처음 소개됐고, 현재는 Cloud Spanner로 GCP에서 완전 관리형 서비스로 제공된다. CockroachDB, YugabyteDB가 Spanner의 아이디어에서 영감을 받았지만, Spanner 자체는 전혀 다른 방법으로 글로벌 일관성을 달성한다.

## TrueTime: 원자시계로 만드는 물리적 타임스탬프

분산 시스템에서 가장 어려운 문제 중 하나는 노드마다 시계가 다르다는 것이다. NTP로 동기화해도 수십 ms의 오차가 남는다. Spanner는 이를 **TrueTime API**로 해결한다.

TrueTime은 각 Google 데이터센터에 배치된 GPS 수신기와 원자시계 조합으로 현재 시간을 `[earliest, latest]` 구간으로 제공한다. 오차 범위 ε(엡실론)은 보통 1~7ms다.

```
TT.now()  →  TTinterval { [t_earliest, t_latest] }
TT.after(t)  →  true if t has definitely passed
TT.before(t) →  true if t has definitely not arrived
```

이 구간 기반 시간 표현이 글로벌 트랜잭션 순서 보장의 핵심이다.

![Spanner TrueTime과 글로벌 트랜잭션 아키텍처](/assets/posts/distsql-spanner-truetime-arch.svg)

## Commit-Wait: 정확성을 위한 의도적인 지연

Spanner의 읽기-쓰기 트랜잭션은 **커밋 대기(commit-wait)** 메커니즘으로 외부 일관성을 보장한다.

커밋 절차는 이렇다. 트랜잭션이 커밋을 시작하면 Spanner는 `s = TT.now().latest`로 커밋 타임스탬프를 결정한다. 그리고 `TT.now().earliest > s`가 될 때까지, 즉 모든 노드의 시계가 `s`를 확실히 지났을 때까지 기다린다. 이 대기 시간이 바로 ε(최대 7ms)다.

이 메커니즘이 보장하는 것: 트랜잭션 T1이 T2보다 실제 시간상 먼저 커밋됐다면, T1의 타임스탬프가 T2보다 작다. 즉 **real-time ordering**을 보장한다. 이를 **외부 일관성(external consistency)** 또는 **linearizability**라고 한다.

```
트랜잭션 1 커밋: s1 = 100ms, commit-wait 7ms → 완료 at 107ms
트랜잭션 2 커밋: s2 = 108ms (T1 이후 시작) → s2 > s1 보장
```

HLC(CockroachDB)나 논리 시계(Lamport)는 이 수준의 보장을 제공할 수 없다. 오직 물리 시계의 정확성에 기반한 commit-wait만이 가능하다.

## Paxos 기반 복제

Spanner는 Raft 대신 **Paxos**를 사용한다. 각 디렉토리(데이터 조각)마다 독립적인 Paxos 그룹을 구성하고, 과반수 복제 후 커밋한다. Raft와 Paxos는 모두 과반수 합의 알고리즘이지만, Paxos는 더 일반적이고 유연한 반면 이해와 구현이 복잡하다.

## INTERLEAVE IN PARENT

Spanner의 독특한 DDL 기능이 **인터리브(INTERLEAVE IN PARENT)**다. 부모 테이블과 자식 테이블의 관련 행을 같은 물리적 스플릿(split)에 저장한다. PostgreSQL의 클러스터드 인덱스나 CockroachDB의 인터리브와 유사한 개념이다.

![Cloud Spanner SQL 특징](/assets/posts/distsql-spanner-truetime-sql.svg)

```sql
-- Spanner DDL: 인터리브 테이블
CREATE TABLE Singers (
    SingerId INT64 NOT NULL,
    FirstName STRING(1024),
    LastName  STRING(1024)
) PRIMARY KEY (SingerId);

CREATE TABLE Albums (
    SingerId  INT64 NOT NULL,
    AlbumId   INT64 NOT NULL,
    AlbumTitle STRING(MAX)
) PRIMARY KEY (SingerId, AlbumId),
INTERLEAVE IN PARENT Singers ON DELETE CASCADE;
```

Singer와 Albums 행이 같은 스플릿에 물리적으로 인접하므로, `WHERE SingerId = X`로 JOIN할 때 네트워크 통신 없이 로컬 읽기로 처리된다. 분산 JOIN의 비용을 제거하는 핵심 최적화다.

## Stale 읽기

Spanner는 **Stale 읽기(staleness)**를 지원한다. 특정 과거 타임스탬프 기준의 스냅샷을 읽으면, 현재 Paxos 리더가 아닌 가까운 복제본에서 바로 읽을 수 있다. 글로벌 환경에서 WAN 왕복 없이 읽기 지연을 크게 줄인다.

```python
# Python Spanner 클라이언트 (stale 읽기)
import datetime
from google.cloud import spanner

client = spanner.Client(project='my-project')
instance = client.instance('my-instance')
database = instance.database('my-db')

staleness = datetime.timedelta(seconds=15)
with database.snapshot(exact_staleness=staleness) as snapshot:
    results = snapshot.execute_sql(
        "SELECT SingerId, FirstName FROM Singers ORDER BY LastName"
    )
    for row in results:
        print(row)
```

## Spanner vs 오픈소스 분산 SQL

Spanner의 핵심 차별점은 **물리적 시계(GPS+원자시계)에 기반한 commit-wait**다. 이는 소프트웨어만으로는 구현 불가능하다. CockroachDB(HLC), YugabyteDB(HLC)는 이를 논리 시계로 근사하지만, 동일한 수학적 보장은 아니다. Spanner의 external consistency는 이론적으로 더 강력하다.

반면 Spanner는 GCP 완전 관리형 서비스이므로 온프레미스 배포가 불가능하고, 비용이 높다. 오픈소스 요구사항이 있다면 CockroachDB나 YugabyteDB가 현실적인 선택이다.

---

**지난 글:** [YugabyteDB — PostgreSQL과 Cassandra의 분산 결합](/posts/distsql-yugabytedb/)

**다음 글:** [Amazon Aurora — 스토리지 분리로 구현하는 분산 내구성](/posts/distsql-aurora-storage/)

<br>
읽어주셔서 감사합니다. 😊
