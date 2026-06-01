---
title: "HashMap — 해시 맵의 내부 구조와 성능"
description: "HashMap 버킷 배열·Entry 체이닝·트리 전환 구조, Java 8 보조 해시 함수, getOrDefault/computeIfAbsent/merge 등 Java 8+ API, load factor와 capacity 최적화, 그리고 thread-safe 대안"
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "Map", "HashMap", "해시", "버킷", "성능", "Java 8"]
featured: false
draft: false
---

[지난 글](/posts/java-set-treeset/)에서 TreeSet의 Red-Black Tree 구조를 살펴봤다. 이번에는 Java에서 가장 많이 쓰이는 Map 구현체인 **`HashMap`**을 깊이 파헤친다. 내부 구조를 이해하면 성능 함정을 피하고 올바른 튜닝 결정을 내릴 수 있다.

## 내부 구조: 버킷 배열 + 연결 리스트/트리

`HashMap`은 **버킷 배열(table)**과 각 버킷에 연결된 **Entry 체인**으로 구성된다. Entry는 `(hash, key, value, next)` 4개의 필드를 보유한다.

```java
// java.util.HashMap 내부 (간략화)
static class Node<K, V> implements Map.Entry<K, V> {
    final int hash;
    final K key;
    V value;
    Node<K, V> next;
}

transient Node<K, V>[] table; // 버킷 배열
int size;                      // 실제 원소 수
int threshold;                 // size > threshold 시 rehash
float loadFactor;              // 기본 0.75
```

`put(key, value)` 흐름:
1. `key.hashCode()` 계산 후 보조 해시 적용: `h ^ (h >>> 16)`
2. 버킷 인덱스 = `hash & (capacity - 1)` (capacity는 항상 2의 거듭제곱)
3. 해당 버킷이 비어 있으면 새 Node 삽입
4. 충돌 시 기존 체인에 append (같은 키면 값 교체)

![HashMap 내부 구조 — 버킷 배열 + 체이닝](/assets/posts/java-map-hashmap-structure.svg)

## Java 8 트리화

버킷 하나에 원소가 `TREEIFY_THRESHOLD`(=8)개를 초과하면 해당 버킷의 연결 리스트를 **Red-Black Tree**로 변환한다. 이로써 최악의 경우 O(n) 검색이 O(log n)으로 개선된다. 원소가 `UNTREEIFY_THRESHOLD`(=6) 이하로 줄면 다시 연결 리스트로 되돌아간다.

```java
static final int TREEIFY_THRESHOLD = 8;
static final int UNTREEIFY_THRESHOLD = 6;
static final int MIN_TREEIFY_CAPACITY = 64; // 배열 크기가 64 미만이면 트리화 대신 resize
```

## Java 8+ API

![HashMap Java 8+ 주요 API](/assets/posts/java-map-hashmap-api.svg)

```java
import java.util.HashMap;
import java.util.Map;

// Map.of — 불변 맵 (Java 9+)
Map<String, Integer> immutable = Map.of("a", 1, "b", 2);

// Map.copyOf — 불변 복사본
Map<String, Integer> copy = Map.copyOf(immutable);

// merge: 단어 빈도 집계 (null 처리 자동)
Map<String, Integer> freq = new HashMap<>();
String[] words = {"hello", "world", "hello", "java"};
for (String w : words) {
    freq.merge(w, 1, Integer::sum);
}
System.out.println(freq); // {hello=2, world=1, java=1}
```

`merge`는 기존 값이 `null`이면 새 값을, 기존 값이 있으면 `remappingFunction` 결과로 교체한다. 카운터 패턴에서 `getOrDefault` + `put` 조합보다 간결하다.

## 성능과 튜닝

**load factor**: 기본 0.75는 공간과 충돌률의 균형점이다. 낮게 설정(예: 0.5)하면 충돌이 줄어 검색이 빨라지지만 메모리를 더 사용한다.

**initialCapacity**: 원소 수를 미리 알면 rehash 비용을 줄일 수 있다.

```java
// 예상 원소 수가 N이면 capacity = (int)(N / loadFactor) + 1
int expectedSize = 1000;
Map<String, String> map = new HashMap<>(
    (int)(expectedSize / 0.75) + 1  // ~1334
);
```

**hashCode 품질**: 모든 키의 hashCode가 동일하면 단일 버킷에 모든 원소가 몰려 O(n) 또는 O(log n) 성능이 된다. 고른 분포가 중요하다.

## 멀티스레드 환경

`HashMap`은 동기화되지 않는다. 여러 스레드가 동시에 접근하면 무한 루프(Java 7 이하의 resize 경합)나 데이터 손실이 발생할 수 있다.

```java
// 단순 동기화: Collections.synchronizedMap
Map<String, Integer> syncMap =
    Collections.synchronizedMap(new HashMap<>());

// 높은 동시성: ConcurrentHashMap (권장)
Map<String, Integer> concurrent =
    new java.util.concurrent.ConcurrentHashMap<>();
```

복합 연산(check-then-act)은 `ConcurrentHashMap`의 atomic 메서드(`putIfAbsent`, `computeIfAbsent`, `merge`)를 사용해야 한다.

## 성능 요약

| 연산 | 평균 | 최악 |
|---|---|---|
| `put` | O(1) | O(log n) |
| `get` | O(1) | O(log n) |
| `remove` | O(1) | O(log n) |
| `containsKey` | O(1) | O(log n) |
| 순회 | O(capacity + n) | O(capacity + n) |

---

**지난 글:** [TreeSet — 정렬과 범위 쿼리를 지원하는 Set](/posts/java-set-treeset/)

**다음 글:** [LinkedHashMap — 순서를 기억하는 맵](/posts/java-map-linkedhashmap/)

<br>
읽어주셔서 감사합니다. 😊
