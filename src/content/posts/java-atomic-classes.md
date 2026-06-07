---
title: "Atomic 클래스 — Lock-Free 동기화"
description: "java.util.concurrent.atomic 패키지의 AtomicInteger, AtomicReference, LongAdder 등 CAS 기반 Lock-Free 동기화, ABA 문제와 해결책, LongAdder vs AtomicLong 성능 비교"
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "AtomicInteger", "CAS", "LockFree", "LongAdder", "ABA", "concurrent"]
featured: false
draft: false
---

[지난 글](/posts/java-volatile/)에서 `volatile`의 가시성 보장과 원자성 한계를 살펴봤다. 이번에는 **`java.util.concurrent.atomic` 패키지**의 Atomic 클래스들을 다룬다. 이 클래스들은 `synchronized` 없이 CPU 수준의 원자적 연산(CAS)을 사용해 스레드 안전성을 달성한다.

## CAS(Compare-And-Swap) 원리

Atomic 클래스의 핵심은 CPU가 제공하는 **CAS 명령(x86의 `CMPXCHG`)**이다. 단일 CPU 명령이므로 중간에 인터럽트될 수 없다.

```
if (메모리[addr] == expected) {
    메모리[addr] = newValue;
    return true;
} else {
    return false;  // 재시도(spin)
}
```

CAS 실패 시 루프로 재시도하는 **스핀(spin)** 방식이다. 경합이 적을 때는 `synchronized`보다 훨씬 빠르지만, 경합이 심해지면 CPU를 낭비하는 스핀이 증가한다.

![java.util.concurrent.atomic 클래스 계층](/assets/posts/java-atomic-classes-overview.svg)

## AtomicInteger / AtomicLong

가장 많이 사용하는 클래스다. 카운터, ID 생성기, 상태 플래그 등에 활용한다.

```java
AtomicInteger seq = new AtomicInteger(0);

// 원자적 증가 — 멀티스레드 환경에서 안전
int next = seq.incrementAndGet(); // ++seq

// CAS: 현재 값이 5면 10으로 변경, 성공 여부 반환
boolean swapped = seq.compareAndSet(5, 10);

// Java 8+: 함수 적용
seq.updateAndGet(x -> x * 2);                    // 현재값 × 2
seq.accumulateAndGet(3, (cur, delta) -> cur + delta); // 현재값 + 3
```

`getAndXxx()`는 변경 전 값, `xxxAndGet()`은 변경 후 값을 반환한다.

## AtomicBoolean

원자적 Boolean 플래그다. 멱등 초기화나 일회성 실행에 유용하다.

```java
AtomicBoolean initialized = new AtomicBoolean(false);

// 정확히 한 번만 실행되는 초기화
void ensureInitialized() {
    if (initialized.compareAndSet(false, true)) {
        // 최초 호출 스레드만 진입
        init();
    }
    // 이후 스레드는 CAS 실패 → 초기화 건너뜀
}
```

## AtomicReference

객체 참조를 원자적으로 교체한다.

```java
AtomicReference<Config> configRef = new AtomicReference<>(loadConfig());

// 새 설정으로 원자적 교체
Config oldConfig = configRef.get();
Config newConfig = buildNewConfig();
boolean success = configRef.compareAndSet(oldConfig, newConfig);
```

### ABA 문제

참조가 A → B → A로 변경될 때, CAS는 A를 보고 변경이 없다고 판단한다. 링크드 리스트 노드를 CAS로 조작할 때 이미 제거된 노드가 재사용되면 포인터가 꼬일 수 있다.

```java
// ABA 해결: AtomicStampedReference — 버전 스탬프 추가
AtomicStampedReference<Node> ref =
    new AtomicStampedReference<>(node, 0);

int[] stampHolder = new int[1];
Node current = ref.get(stampHolder);
int stamp = stampHolder[0];

// 값과 스탬프 모두 일치해야 교체 성공
ref.compareAndSet(current, newNode, stamp, stamp + 1);
```

![AtomicInteger 주요 메서드](/assets/posts/java-atomic-classes-usage.svg)

## LongAdder와 LongAccumulator

`AtomicLong`은 고경합 환경에서 많은 스레드가 동일 메모리 위치를 CAS하려 경합해 성능이 저하된다. `LongAdder`는 내부적으로 **여러 셀(Cell)**에 분산해 경합을 줄인다.

```java
LongAdder adder = new LongAdder();

// 스레드 다수가 동시 add — 내부 셀에 분산 기록
adder.add(1);
adder.increment();

// 합산 시 모든 셀 값을 더함 — 그 사이 변경이 있을 수 있음
long total = adder.sum();
adder.reset(); // 0으로 초기화
```

| 클래스 | 특성 | 사용처 |
|---|---|---|
| `AtomicLong` | 단일 셀, 경합 많으면 스핀 증가 | 경합 적은 카운터, CAS 필요 |
| `LongAdder` | 셀 분산, sum()은 비정확 가능 | 고경합 통계 카운터 |
| `LongAccumulator` | 커스텀 집계 함수 | max/min, 누적 합계 |

```java
// LongAccumulator: max 값 추적
LongAccumulator maxTracker = new LongAccumulator(Long::max, Long.MIN_VALUE);
maxTracker.accumulate(42);
maxTracker.accumulate(100);
System.out.println(maxTracker.get()); // 100
```

## 배열 원자 조작

배열의 개별 요소를 원자적으로 조작할 수 있다.

```java
AtomicIntegerArray arr = new AtomicIntegerArray(10);
arr.incrementAndGet(3);   // arr[3]++
arr.compareAndSet(3, 1, 2); // arr[3]이 1이면 2로
```

## 언제 Atomic 클래스를 사용하나

- **단순 카운터/ID**: `AtomicInteger`, `AtomicLong`
- **고경합 통계 수집**: `LongAdder`
- **일회성 초기화**: `AtomicBoolean.compareAndSet(false, true)`
- **불변 객체 참조 교체**: `AtomicReference`
- **복잡한 복합 연산**: `synchronized` 또는 `ReentrantLock` (Atomic만으론 부족)

Atomic 클래스는 단일 변수의 원자적 연산에 최적화되어 있다. 여러 변수를 함께 원자적으로 바꾸려면 `synchronized`가 필요하다.

```java
// 잘못된 예 — 두 변수의 일관성이 보장되지 않음
AtomicInteger x = new AtomicInteger();
AtomicInteger y = new AtomicInteger();
x.incrementAndGet(); // 여기서 다른 스레드가 읽으면 x++, y 미적용 상태
y.incrementAndGet();

// 올바른 예 — 두 변수를 항상 함께 변경
synchronized (lock) {
    x++;
    y++;
}
```

---

**지난 글:** [volatile 키워드와 메모리 가시성](/posts/java-volatile/)

**다음 글:** [Lock 인터페이스 — ReentrantLock 완전 가이드](/posts/java-locks/)

<br>
읽어주셔서 감사합니다. 😊
