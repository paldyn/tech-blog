---
title: "스레드 안전 컬렉션 — ConcurrentHashMap부터 BlockingQueue까지"
description: "java.util.concurrent의 스레드 안전 컬렉션 완전 가이드 — ConcurrentHashMap, CopyOnWriteArrayList, BlockingQueue 계열, Collections.synchronizedXxx 함정"
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "ConcurrentHashMap", "BlockingQueue", "CopyOnWriteArrayList", "스레드안전", "concurrent", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/java-condition/)에서 `Condition` 변수로 생산자-소비자 패턴을 구현했다. 이번에는 JDK가 제공하는 **스레드 안전 컬렉션**을 체계적으로 정리한다. 직접 동기화 코드를 작성하지 않아도 되고, JDK 전문가들이 최적화한 구현을 그대로 활용할 수 있다.

## 왜 일반 컬렉션은 위험한가

`ArrayList`, `HashMap` 등은 스레드 안전하지 않다. 멀티스레드에서 동시 수정하면 `ConcurrentModificationException`, 무한 루프, 데이터 손실이 발생한다.

```java
// 위험 — HashMap 멀티스레드 사용
Map<String, Integer> map = new HashMap<>();
// 동시 put → 내부 resize 시 무한 루프 가능 (Java 7 이하)
// Java 8+에서도 데이터 손실 가능

// 구식 해결책 — 성능 나쁨
Map<String, Integer> synMap = Collections.synchronizedMap(map);
// 모든 메서드가 단일 락 → 처리량 낮음
```

`Collections.synchronizedXxx()` 래퍼는 단일 락으로 모든 메서드를 감싸므로 처리량이 낮다. `java.util.concurrent` 패키지의 전용 컬렉션을 사용하는 것이 올바른 접근이다.

## ConcurrentHashMap

가장 널리 쓰이는 동시성 맵이다.

**Java 8+의 구현**: 버킷(bucket) 단위로 락을 분리한다. 서로 다른 버킷에 대한 작업은 동시에 진행 가능하다. 읽기는 거의 잠금 없이 처리된다.

**핵심 제약**: `null` key와 `null` value를 허용하지 않는다. `get(key)` 결과가 `null`이면 명확히 "없음"을 의미한다(`null` 값이 있는 건지 키 자체가 없는 건지 구분 불필요).

![ConcurrentHashMap 원자적 연산](/assets/posts/java-thread-safe-collections-chm.svg)

```java
ConcurrentHashMap<String, List<String>> groupMap = new ConcurrentHashMap<>();

// computeIfAbsent로 안전한 그룹핑
groupMap.computeIfAbsent("group1", k -> new CopyOnWriteArrayList<>())
        .add("item");

// merge로 단어 카운팅
words.forEach(w -> groupMap.merge(w, 1, Integer::sum));

// ConcurrentHashMap의 집계
long sum = groupMap.reduceValues(4, list -> (long) list.size(), Long::sum);
```

`ConcurrentHashMap`도 **복합 연산의 원자성**을 보장하지 않는다. `get` 후 `put`처럼 두 개의 독립 연산을 조합하는 패턴은 여전히 레이스 컨디션이 발생한다. `compute`, `merge`, `putIfAbsent`를 사용해야 한다.

## CopyOnWriteArrayList

읽기가 압도적으로 많고 쓰기가 드문 시나리오에 최적화된 `List` 구현이다.

```java
CopyOnWriteArrayList<String> listeners = new CopyOnWriteArrayList<>();

// 쓰기: 기존 배열 전체를 복사한 새 배열에 추가
listeners.add("listener1");

// 읽기: 잠금 없음 — 이터레이션 중 ConcurrentModificationException 발생 안 함
for (String l : listeners) { // 스냅샷 이터레이터
    notifyListener(l);
}
```

이터레이터는 획득 시점의 스냅샷을 사용하므로, 이터레이션 중 다른 스레드가 요소를 추가/삭제해도 안전하다. 단 이터레이터는 `remove()`를 지원하지 않는다.

쓰기가 잦으면 배열 복사 비용이 크므로 `CopyOnWriteArrayList`는 부적합하다.

## BlockingQueue 계열

생산자-소비자 패턴의 표준 솔루션이다. `put()`과 `take()`는 공간/요소가 생길 때까지 블로킹된다.

![스레드 안전 컬렉션 분류](/assets/posts/java-thread-safe-collections-overview.svg)

### ArrayBlockingQueue

고정 크기 배열 기반. 생성 시 용량을 지정해야 한다.

```java
BlockingQueue<Task> queue = new ArrayBlockingQueue<>(100);

// 생산자
queue.put(task);       // 가득 차면 블로킹
queue.offer(task, 1, TimeUnit.SECONDS); // 타임아웃

// 소비자
Task t = queue.take(); // 비어 있으면 블로킹
Task t2 = queue.poll(500, TimeUnit.MILLISECONDS); // 타임아웃
```

### LinkedBlockingQueue

동적 크기(선택적 상한). `ThreadPoolExecutor`의 기본 작업 큐로 사용된다.

```java
// 무제한 (메모리 주의)
BlockingQueue<Task> queue = new LinkedBlockingQueue<>();

// 상한 설정
BlockingQueue<Task> bounded = new LinkedBlockingQueue<>(1000);
```

put/take가 분리된 락을 사용해 `ArrayBlockingQueue`보다 처리량이 높다.

### SynchronousQueue

용량 0인 큐. `put()`은 `take()`를 호출하는 스레드가 나타날 때까지 블로킹된다. `Executors.newCachedThreadPool()`이 이 큐를 사용한다.

```java
SynchronousQueue<Request> handoff = new SynchronousQueue<>();

// 핸드오프 패턴: 생산자가 소비자에게 직접 전달
// 생산자
handoff.put(request); // 소비자 take() 대기

// 소비자
Request r = handoff.take();
```

### PriorityBlockingQueue

`Comparable` 또는 `Comparator`로 정렬된 순서로 요소를 꺼내는 무한 크기 큐다.

```java
BlockingQueue<Task> pq = new PriorityBlockingQueue<>(11,
    Comparator.comparingInt(Task::priority).reversed());

pq.put(new Task("low", 1));
pq.put(new Task("high", 10));
pq.take(); // "high" 우선 반환
```

## ConcurrentLinkedQueue

블로킹 없는(non-blocking) CAS 기반 FIFO 큐다. `size()`가 O(n)이므로 크기 확인이 잦으면 다른 큐를 선택한다.

```java
Queue<Event> events = new ConcurrentLinkedQueue<>();
events.offer(event); // 항상 성공 (무제한)
Event e = events.poll(); // 비어 있으면 null 반환 (블로킹 없음)
```

## 올바른 선택 가이드

| 시나리오 | 권장 클래스 |
|---|---|
| 범용 스레드 안전 맵 | `ConcurrentHashMap` |
| 이벤트 리스너 목록 | `CopyOnWriteArrayList` |
| 생산자-소비자 (유계) | `LinkedBlockingQueue` |
| 메모리 예측 가능 큐 | `ArrayBlockingQueue` |
| 스레드 간 직접 핸드오프 | `SynchronousQueue` |
| 우선순위 작업 처리 | `PriorityBlockingQueue` |
| 고속 비블로킹 큐 | `ConcurrentLinkedQueue` |

`Collections.synchronizedList()` 같은 래퍼는 이터레이션 시 외부에서 직접 락을 잡아야 하는 함정이 있다. 동시성 컬렉션으로 교체하는 것이 낫다.

---

**지난 글:** [Condition 변수로 구현하는 생산자-소비자 패턴](/posts/java-condition/)

**다음 글:** [교착 상태(Deadlock) 완전 분석과 예방 전략](/posts/java-deadlock/)

<br>
읽어주셔서 감사합니다. 😊
