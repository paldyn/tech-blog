---
title: "ConcurrentHashMap — 고성능 동시성 맵"
description: "ConcurrentHashMap의 Java 7 세그먼트 락과 Java 8 버킷 단위 CAS/synchronized 구조, null 불허 이유, putIfAbsent/computeIfAbsent/merge 원자 연산, Hashtable 대비 성능 비교, 그리고 올바른 동시성 패턴"
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "Map", "ConcurrentHashMap", "동시성", "스레드 안전", "Java 8"]
featured: false
draft: false
---

[지난 글](/posts/java-map-treemap/)에서 TreeMap의 NavigableMap API와 범위 쿼리를 살펴봤다. 이번에는 **`ConcurrentHashMap`**을 다룬다. 멀티스레드 환경에서 `HashMap`의 빠른 성능을 유지하면서 스레드 안전을 보장하는 Java 최선의 Map 구현체다.

## HashMap이 멀티스레드에서 위험한 이유

`HashMap`은 동기화가 없다. 여러 스레드가 동시에 쓰기 작업을 수행하면:

- Java 7 이하: resize 중 순환 체인 형성 → `get`이 무한 루프
- Java 8 이상: 데이터 손실 및 비일관성 가능

`Hashtable`은 모든 메서드에 `synchronized`를 붙여 스레드 안전을 보장하지만, 읽기·쓰기 모두 단일 락이므로 멀티스레드 환경에서 심각한 병목이 된다.

## ConcurrentHashMap 내부 구조

![ConcurrentHashMap — 버킷 단위 잠금](/assets/posts/java-map-concurrenthashmap-structure.svg)

**Java 7**: `Segment` 배열(기본 16개)로 분할하고 각 세그먼트가 독립 락을 보유. 최대 16개 스레드가 동시에 쓰기 가능.

**Java 8+**: 세그먼트를 제거하고 버킷(노드) 단위로 더 세밀하게 동기화.
- 빈 버킷: **CAS(Compare-And-Swap)** 연산으로 락 없이 삽입
- 체인이 있는 버킷: **버킷 head 노드에만 `synchronized`** 적용
- 읽기: `volatile`로 선언된 노드를 락 없이 읽음

결과적으로 서로 다른 버킷에 접근하는 스레드들은 전혀 경합하지 않는다.

## 원자 연산 메서드

```java
import java.util.concurrent.ConcurrentHashMap;

ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

// check-then-put 원자적 수행 (별도 synchronized 불필요)
map.putIfAbsent("key", 1);

// 없으면 계산하여 삽입 (한 번만 계산 보장)
map.computeIfAbsent("userId", id -> fetchFromDB(id));

// 동시성 안전 카운터 (read-modify-write 원자적)
map.merge("word", 1, Integer::sum);

// 조건부 교체
map.replace("key", oldVal, newVal); // CAS 방식
```

`putIfAbsent`, `computeIfAbsent`, `merge`는 내부적으로 원자적으로 수행된다. 수동으로 `synchronized` 블록을 추가할 필요가 없다.

## 잘못된 패턴 vs 올바른 패턴

```java
ConcurrentHashMap<String, Integer> freq = new ConcurrentHashMap<>();

// 잘못된 패턴: check-then-act 비원자적
if (!freq.containsKey("x")) {
    freq.put("x", 1);           // 두 스레드가 동시에 통과 가능!
}

// 올바른 패턴 1: putIfAbsent
freq.putIfAbsent("x", 1);

// 올바른 패턴 2: merge (값 갱신 포함)
freq.merge("x", 1, Integer::sum);

// 올바른 패턴 3: compute
freq.compute("x", (k, v) -> v == null ? 1 : v + 1);
```

## null 불허

`ConcurrentHashMap`은 키와 값 모두 null을 허용하지 않는다.

```java
map.put(null, "value"); // NullPointerException
map.put("key", null);   // NullPointerException
```

이유: 동시성 환경에서 `get("key") == null`이 **"키가 없음"**인지 **"값이 null"**인지 구분할 수 없어 모호성이 생기기 때문이다. HashMap에서는 단일 스레드이므로 `containsKey`로 확인할 수 있지만, 멀티스레드 환경에서는 두 연산 사이에 상태가 바뀔 수 있다.

## size() vs mappingCount()

```java
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();
// ...

int s = map.size();           // int — 2^31 이상에서 잘림
long c = map.mappingCount();  // long — 정확한 카운트 (Java 8+)
```

`size()`는 여러 카운터 셀의 합산이므로 근사값일 수 있다. 큰 맵에서 정확한 수를 얻으려면 `mappingCount()`를 사용한다.

## 동시성 Map 비교

![동시성 Map 구현체 비교](/assets/posts/java-map-concurrenthashmap-comparison.svg)

## 벌크 연산

Java 8부터 병렬 처리 메서드가 추가됐다.

```java
// 병렬 forEach
map.forEach(2, (k, v) -> process(k, v));

// 병렬 reduce
int total = map.reduceValues(2, Integer::sum);

// 병렬 search (첫 번째 매칭 반환)
String found = map.searchKeys(2, k -> k.startsWith("user"));
```

첫 번째 파라미터 `parallelismThreshold`가 원소 수보다 크면 단일 스레드로 수행되고, 작으면 `ForkJoinPool.commonPool()`에서 병렬 처리한다.

---

**지난 글:** [TreeMap — 정렬과 범위 쿼리를 지원하는 맵](/posts/java-map-treemap/)

**다음 글:** [Queue와 Deque — 큐와 양방향 큐 인터페이스](/posts/java-queue-deque/)

<br>
읽어주셔서 감사합니다. 😊
