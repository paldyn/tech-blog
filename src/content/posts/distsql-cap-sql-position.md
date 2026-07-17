---
title: "분산 SQL에서 CAP 이론의 위치 — NewSQL은 어디에 있는가"
description: "CAP 정리의 세 속성(Consistency·Availability·Partition tolerance)과 PACELC 모델을 통해 전통 RDBMS, NoSQL, NewSQL(CockroachDB·Spanner)의 설계 트레이드오프를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["분산SQL", "CAP이론", "PACELC", "NewSQL", "CockroachDB", "Spanner", "일관성"]
featured: false
draft: false
---

[지난 글](/posts/cubrid-java-integration/)에서 CUBRID Java 연동을 살펴봤다. 이번 글부터는 분산 환경에서의 SQL 시리즈를 시작한다. 첫 주제는 분산 데이터베이스 설계의 근본적인 트레이드오프를 설명하는 **CAP 정리**와, 분산 SQL(NewSQL)이 이 정리에서 어디에 위치하는지다.

## CAP 정리란

2000년 Eric Brewer가 제시하고 2002년 Gilbert·Lynch가 수학적으로 증명한 **CAP 정리**는 분산 시스템에서 세 가지 속성을 동시에 완전히 만족할 수 없다는 것이다.

- **C (Consistency)**: 모든 노드가 같은 데이터를 읽는다. 쓰기 후 읽기는 반드시 최신값을 반환
- **A (Availability)**: 모든 요청에 응답을 반환한다. 단, 반환값이 최신이 아닐 수 있음
- **P (Partition tolerance)**: 네트워크 분할(일부 노드 간 통신 단절)이 발생해도 시스템이 계속 동작

![CAP 정리와 분산 데이터베이스의 위치](/assets/posts/distsql-cap-theorem.svg)

핵심은 **분산 시스템에서 P는 피할 수 없다**는 점이다. 네트워크는 언제든 분할될 수 있다. 따라서 실제 선택은 **C vs A**: 분할이 발생했을 때 일관성과 가용성 중 무엇을 포기하느냐다.

```text
네트워크 분할 발생:
Node A ←╳→ Node B

CP 선택: Node B에 쓰기 요청 → 거부 (C 유지, A 희생)
         "서비스 일시 중단, 그러나 데이터 오염 없음"

AP 선택: Node B에 쓰기 요청 → 수락 (A 유지, C 희생)
         "서비스 계속, 그러나 Node A와 데이터 불일치 가능"
```

## 전통 RDBMS의 위치

Oracle, PostgreSQL, MySQL 같은 단일 노드 RDBMS는 **CA** 로 분류된다. 네트워크 분할이 발생하지 않는 단일 서버 환경에서는 완전한 일관성과 가용성을 제공한다.

```sql
-- 단일 RDBMS: 트랜잭션으로 완벽한 C 보장
BEGIN;
UPDATE accounts SET balance = balance - 1000 WHERE id = 1;
UPDATE accounts SET balance = balance + 1000 WHERE id = 2;
COMMIT;
-- 두 UPDATE 중 하나만 성공하는 경우 없음 (ACID)
```

그러나 이 RDBMS를 수평 확장(sharding)하면 더 이상 단일 노드가 아니므로 CAP 트레이드오프가 적용된다.

## NoSQL의 위치

**AP 선택** (Cassandra, DynamoDB): 분할 시 모든 노드에서 읽기/쓰기를 허용하지만, 일관성을 최종 일관성(Eventual Consistency)으로 낮춘다.

**CP 선택** (HBase, MongoDB w/ WriteConcern): 분할 시 일부 노드를 비활성화해 일관성을 지키지만 가용성이 낮아진다.

```javascript
// Cassandra: 일관성 수준을 쿼리마다 조정
session.execute(
  "INSERT INTO orders(id, user_id, amount) VALUES(?, ?, ?)",
  [orderId, userId, amount],
  { consistency: cassandra.types.consistencies.quorum }  // 과반수 노드 확인
);

session.execute(
  "SELECT * FROM products WHERE id = ?",
  [productId],
  { consistency: cassandra.types.consistencies.one }  // 1개 노드 응답으로 충분
);
```

## NewSQL (분산 SQL)의 위치

NewSQL은 SQL 인터페이스와 ACID 트랜잭션을 유지하면서 수평 확장하는 데이터베이스다. **CP** 를 선택한다.

```sql
-- CockroachDB: 표준 SQL + 분산 ACID
-- 여러 노드에 샤딩되어 있지만 단일 RDBMS처럼 사용
BEGIN;

INSERT INTO orders(order_id, user_id, amount)
VALUES(gen_random_uuid(), $1, $2);

UPDATE user_balance
SET    balance = balance - $2
WHERE  user_id = $1
  AND  balance >= $2;  -- 잔고 부족 방지

COMMIT;
-- 분산 환경에서도 ACID 보장 (Raft 합의 프로토콜 사용)
```

NewSQL이 강한 일관성을 분산 환경에서 구현하는 방법은 **합의 프로토콜(Raft/Paxos)** 이다. 쓰기 연산을 과반수 노드가 합의해야 커밋된다. 이 과정에서 단일 노드 RDBMS보다 지연이 증가하는 것이 불가피하다.

## PACELC: CAP의 한계를 보완하는 모델

CAP은 분할 상황만 다루는데, **PACELC** 모델은 정상 상황(분할 없음)에서도 트레이드오프가 있음을 명시한다.

![PACELC 모델](/assets/posts/distsql-pacelc.svg)

> **If Partition → (A vs C), Else → (L vs C)**
> 분할 없을 때도 지연(Latency)과 일관성(Consistency) 중 하나를 택해야 한다.

분산 SQL이 강한 일관성을 유지하면 쓰기마다 과반수 노드 합의 지연이 발생한다. 이 지연을 줄이려면 일관성 수준을 낮춰야 한다.

```sql
-- CockroachDB: 읽기 일관성 수준 조정
-- 강한 일관성 (기본, 높은 지연)
SET transaction_read_only = false;
SELECT balance FROM accounts WHERE id = 1;

-- 약한 일관성 (follower read, 낮은 지연)
SELECT balance
FROM   accounts AS OF SYSTEM TIME follower_read_timestamp()
WHERE  id = 1;
-- 약간 오래된 데이터를 읽을 수 있지만 지연이 훨씬 낮음
```

## SQL 개발자가 알아야 할 핵심

| 상황 | 추천 선택 | 이유 |
|---|---|---|
| 금융·주문·재고 | CP (강한 일관성) | 데이터 오염 불가 |
| 사용자 피드·카운터 | AP (최종 일관성) | 약간의 불일치 허용 가능 |
| 글로벌 서비스 + ACID | NewSQL (분산 SQL) | 수평 확장 + 일관성 |
| 단일 리전 대용량 | 단일 RDBMS + 복제 | CAP 필요 없음 |

분산 SQL을 도입하기 전에 "내 서비스가 정말 글로벌 분산이 필요한가?"를 먼저 질문하자. 단일 리전 RDBMS에 읽기 복제본(read replica)을 추가하는 것만으로 대부분의 확장 요구를 충족할 수 있다. CAP 트레이드오프는 정말 필요할 때만 마주하는 것이 좋다.

---

**지난 글:** [CUBRID Java 연동 완전 가이드](/posts/cubrid-java-integration/)

**다음 글:** [2PC와 Saga 패턴 — 분산 트랜잭션 전략](/posts/distsql-2pc-saga/)

<br>
읽어주셔서 감사합니다. 😊
