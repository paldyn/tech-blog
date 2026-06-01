---
title: "일관된 해싱 (Consistent Hashing)"
description: "분산 시스템에서 노드 추가·제거 시 최소한의 키만 재배치하는 일관된 해싱의 원리, 가상 노드, Python 구현을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 3
type: "knowledge"
category: "Algorithm"
tags: ["consistent hashing", "일관된 해싱", "분산 시스템", "가상 노드", "해시 링"]
featured: false
draft: false
---

[지난 글](/posts/dsa-open-addressing/)에서 해시 테이블의 충돌 해결 방식을 마무리했습니다. 이번 글은 단일 서버의 해시 테이블을 넘어, **여러 서버에 데이터를 분산**하는 문제를 다룹니다. 일관된 해싱(Consistent Hashing)은 Memcached, Redis Cluster, Amazon DynamoDB, Cassandra 등 대형 분산 시스템에서 데이터 파티셔닝의 핵심 원리로 사용됩니다.

## 전통적 모듈러 해싱의 문제

단순히 `서버 인덱스 = hash(key) % N`을 쓰면, 서버가 1대라도 추가·제거될 때 N이 바뀌어 **거의 모든 키의 담당 서버가 달라집니다**. 예를 들어 서버 3대 → 4대로 늘면 key의 75%가 재배치되어야 하며, 이는 캐시 서버라면 대규모 캐시 무효화(Cache Stampede)로 이어집니다.

## 해시 링(Hash Ring) 개념

![일관된 해싱 링](/assets/posts/dsa-consistent-hashing-ring.svg)

일관된 해싱은 0부터 2³²-1까지의 해시 공간을 **원형 링**으로 표현합니다. 서버와 키 모두 동일한 해시 함수로 링 위에 배치됩니다. 각 키의 담당 서버는 "시계 방향으로 가장 가까운 서버"입니다.

**서버 추가 시**: 새 서버와 인접한 (시계 반대 방향) 서버의 키 일부만 새 서버로 이전합니다.

**서버 제거 시**: 제거된 서버의 키만 다음 서버(시계 방향)로 이전합니다.

이 두 경우 모두 전체 키의 **1/N**만 재배치됩니다 (N: 서버 수).

## 가상 노드(Virtual Nodes)

서버를 링 위에 하나의 점으로만 배치하면 서버 간 부하가 불균등해집니다. 이를 해결하기 위해 각 물리 서버를 **여러 개의 가상 노드**로 링에 분산 배치합니다. 가상 노드 수가 많을수록 부하 분포가 균등해집니다. 일반적으로 서버당 100~200개의 가상 노드를 사용합니다.

## Python 구현

![일관된 해싱 구현](/assets/posts/dsa-consistent-hashing-code.svg)

```python
import hashlib, bisect

class ConsistentHash:
    def __init__(self, vnodes=150):
        self.ring = {}
        self.sorted_keys = []
        self.vnodes = vnodes

    def _hash(self, key: str) -> int:
        return int(hashlib.md5(key.encode()).hexdigest(), 16)

    def add_node(self, node: str):
        for i in range(self.vnodes):
            vkey = self._hash(f"{node}#{i}")
            self.ring[vkey] = node
            bisect.insort(self.sorted_keys, vkey)

    def remove_node(self, node: str):
        for i in range(self.vnodes):
            vkey = self._hash(f"{node}#{i}")
            del self.ring[vkey]
            idx = bisect.bisect_left(self.sorted_keys, vkey)
            self.sorted_keys.pop(idx)

    def get_node(self, key: str) -> str:
        if not self.ring:
            raise RuntimeError("No nodes available")
        hval = self._hash(key)
        idx = bisect.bisect(self.sorted_keys, hval)
        # 링을 넘어서면 첫 번째 노드 (wrapping)
        if idx == len(self.sorted_keys):
            idx = 0
        return self.ring[self.sorted_keys[idx]]

# 사용 예
ch = ConsistentHash(vnodes=150)
ch.add_node("server-A")
ch.add_node("server-B")
ch.add_node("server-C")

print(ch.get_node("user:1001"))   # server-B
print(ch.get_node("session:xyz")) # server-A

ch.remove_node("server-B")        # B 담당 키만 이전
print(ch.get_node("user:1001"))   # server-C (재배치됨)
```

## 핵심 복잡도

| 연산 | 복잡도 |
|---|---|
| 노드 추가/제거 | O(V log V) — V: 가상 노드 수 |
| 키 → 노드 조회 | O(log VN) — N: 실제 노드 수 |
| 키 재배치 비율 | 1/N (최적) |

## 실제 사용 사례

- **Memcached 클러스터**: 캐시 서버 추가 시 전체 재배치 방지
- **DynamoDB**: 파티션 키로 데이터 분산, 파티션 분할/병합에 활용
- **Redis Cluster**: 16384개의 해시 슬롯을 노드에 분산
- **카산드라(Cassandra)**: 링 기반 데이터 복제 (replication factor와 결합)

일관된 해싱은 "어떤 서버가 이 키를 담당하는가?"라는 질문에 **확장 가능하고 재배치 비용이 최소화된** 답을 제공합니다.

---

**지난 글:** [개방 주소법 (Open Addressing)](/posts/dsa-open-addressing/)

**다음 글:** [블룸 필터 (Bloom Filter)](/posts/dsa-bloom-filter/)

<br>
읽어주셔서 감사합니다. 😊
