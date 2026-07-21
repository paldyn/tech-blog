---
title: "충돌 해결 — 분리 체이닝 (Collision Resolution: Separate Chaining)"
description: "해시 테이블의 충돌을 분리 체이닝으로 해결하는 방법, 링크드 리스트 기반 구현, 부하율과 성능의 관계를 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 1
type: "knowledge"
category: "Algorithm"
tags: ["충돌 해결", "분리 체이닝", "해시 테이블", "separate chaining", "부하율"]
featured: false
draft: false
---

[지난 글](/posts/dsa-hash-function/)에서 해시 함수가 같은 버킷으로 서로 다른 키를 보낼 때 **충돌(collision)**이 발생한다는 점을 다뤘습니다. 이번 글에서는 가장 직관적인 충돌 해결 전략인 **분리 체이닝(Separate Chaining)**을 집중 분석합니다. 각 버킷이 링크드 리스트를 통해 여러 원소를 수용하는 방식이며, Java의 `HashMap`이 이 방식을 기반으로 합니다.

## 충돌이 왜 피할 수 없는가

비둘기집 원리(Pigeonhole Principle)에 따르면, 버킷 수보다 원소가 많아지면 적어도 하나의 버킷에 둘 이상의 원소가 들어가야 합니다. 실제로는 버킷이 충분히 있어도 해시 함수의 균등 분포가 완벽하지 않아 훨씬 일찍 충돌이 생깁니다. **생일 역설(Birthday Paradox)**에 의하면 m개의 버킷에 √m 개의 원소만 삽입해도 충돌 확률이 50%를 넘습니다.

## 분리 체이닝 구조

![분리 체이닝 시각화](/assets/posts/dsa-collision-resolution-chaining.svg)

각 버킷은 하나의 **헤드 포인터**를 가지며, 같은 해시값을 갖는 모든 원소가 그 버킷의 링크드 리스트에 연결됩니다.

```text
버킷 인덱스 = h(key) % capacity
```

충돌이 발생하면 새 노드를 리스트 앞(prepend)이나 뒤(append)에 추가합니다. 검색 시에는 해당 버킷의 리스트를 순차 탐색합니다.

## Python으로 구현하기

```python
class Node:
    def __init__(self, key, value):
        self.key = key
        self.value = value
        self.next = None

class SeparateChainingHashMap:
    def __init__(self, capacity=16):
        self.capacity = capacity
        self.size = 0
        self.buckets = [None] * capacity

    def _hash(self, key):
        return hash(key) % self.capacity

    def put(self, key, value):
        idx = self._hash(key)
        node = self.buckets[idx]
        while node:
            if node.key == key:
                node.value = value   # 키 존재 시 업데이트
                return
            node = node.next
        new_node = Node(key, value)
        new_node.next = self.buckets[idx]
        self.buckets[idx] = new_node  # prepend O(1)
        self.size += 1
        if self.size / self.capacity > 0.75:
            self._resize()

    def get(self, key):
        idx = self._hash(key)
        node = self.buckets[idx]
        while node:
            if node.key == key:
                return node.value
            node = node.next
        raise KeyError(key)

    def delete(self, key):
        idx = self._hash(key)
        prev, node = None, self.buckets[idx]
        while node:
            if node.key == key:
                if prev:
                    prev.next = node.next
                else:
                    self.buckets[idx] = node.next
                self.size -= 1
                return
            prev, node = node, node.next
        raise KeyError(key)

    def _resize(self):
        old_buckets = self.buckets
        self.capacity *= 2
        self.buckets = [None] * self.capacity
        self.size = 0
        for head in old_buckets:
            node = head
            while node:
                self.put(node.key, node.value)
                node = node.next
```

## 부하율(Load Factor)과 성능

**부하율 α = n / m** (n: 저장된 원소 수, m: 버킷 수)

- 평균 검색 시간 ≈ O(1 + α)
- α = 0.75일 때: 리스트 평균 길이 0.75 → 검색 1.75번 비교
- α = 3.0일 때: 리스트 평균 길이 3.0 → 검색 4.0번 비교

이 때문에 Java `HashMap`은 α > 0.75이면 자동으로 용량을 2배로 늘리고 전체를 재해시합니다.

## 충돌 해결 전략 비교

![충돌 해결 전략 비교](/assets/posts/dsa-collision-resolution-complexity.svg)

분리 체이닝의 핵심 장점은 **α > 1을 허용**한다는 점입니다. 버킷 수보다 많은 원소를 넣어도 동작하며(단, 성능 저하), 메모리 사전 예약이 불필요합니다. 반면 각 노드가 포인터를 가져 메모리 오버헤드가 있고, 포인터 추적으로 CPU 캐시 효율이 떨어집니다.

## Java HashMap의 트리 최적화

Java 8+ 에서는 하나의 버킷 리스트 길이가 **8개 이상**이 되면 링크드 리스트를 **Red-Black Tree**로 자동 전환합니다. 이로써 최악의 경우 검색이 O(n)에서 O(log n)으로 개선됩니다. 원소가 6개 이하로 줄면 다시 리스트로 전환합니다.

```java
// Java HashMap 내부 treeifyBin 임계값
static final int TREEIFY_THRESHOLD = 8;
static final int UNTREEIFY_THRESHOLD = 6;
```

이 트릭은 해시 충돌 공격(Hash Flooding Attack)에 대한 방어책이기도 합니다. 공격자가 의도적으로 같은 버킷에 많은 키를 몰아넣어도 O(log n)으로 제한됩니다.

## 정리

- 분리 체이닝은 각 버킷에 링크드 리스트를 연결해 충돌을 처리
- 삽입 O(1), 검색·삭제 평균 O(1+α)
- 부하율 0.75 초과 시 리사이징으로 성능 유지
- Java HashMap이 이 방식을 사용하며, 체인 길이 8 이상 시 트리로 전환

다음 글에서는 충돌 해결의 또 다른 주요 전략인 **개방 주소법(Open Addressing)**을 다룹니다.

---

**지난 글:** [해시 함수 (Hash Function)](/posts/dsa-hash-function/)

**다음 글:** [개방 주소법 (Open Addressing)](/posts/dsa-open-addressing/)

<br>
읽어주셔서 감사합니다. 😊
