---
title: "synchronized 키워드 완전 분석 — 모니터 락과 메모리 가시성"
description: "Java synchronized 키워드의 모니터 락 동작 원리, 메서드/블록 형태, 재진입성, wait/notify, JVM Lock 최적화(Biased→Thin→Fat), 성능 고려 사항"
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "synchronized", "Monitor", "모니터락", "wait", "notify", "재진입", "스레드동기화"]
featured: false
draft: false
---

[지난 글](/posts/java-thread-priority-daemon/)에서 스레드 우선순위와 데몬 스레드 속성을 살펴봤다. 이번에는 Java 동기화의 가장 기본 메커니즘인 **`synchronized` 키워드**를 깊이 분석한다. 모니터 락의 동작 원리, 메모리 가시성 보장, `wait()`/`notify()` 패턴, JVM의 락 최적화까지 전 범위를 다룬다.

## 모니터 락

Java의 모든 객체는 내부적으로 **모니터(monitor)**를 하나씩 갖는다. 모니터는 세 가지 구성 요소로 이루어진다.

1. **소유권(ownership)**: 한 번에 하나의 스레드만 모니터를 소유할 수 있다.
2. **진입 집합(entry set)**: 모니터를 획득하려고 대기 중인 BLOCKED 스레드들의 집합이다.
3. **대기 집합(wait set)**: `wait()`를 호출해 WAITING 상태로 들어간 스레드들의 집합이다.

`synchronized` 블록에 진입하면 JVM은 해당 객체의 모니터를 획득하려 시도한다. 모니터가 다른 스레드에게 소유되어 있으면 BLOCKED 상태로 진입 집합에서 대기한다.

![Monitor Lock 동작 원리](/assets/posts/java-synchronized-monitor.svg)

## synchronized 사용 형태

### 인스턴스 메서드

```java
public class Counter {
    private int count;

    public synchronized void increment() {
        count++; // this 객체가 모니터
    }

    public synchronized int get() {
        return count;
    }
}
```

`this` 객체를 모니터로 사용한다. 같은 인스턴스의 다른 `synchronized` 메서드도 같은 락을 공유한다.

### 정적 메서드

```java
public class IdGenerator {
    private static int nextId;

    public static synchronized int generate() {
        return ++nextId; // Class 객체가 모니터
    }
}
```

`IdGenerator.class` 객체를 모니터로 사용한다. 인스턴스 메서드의 `this` 락과는 별개다.

### synchronized 블록

```java
public class SafeList {
    private final Object lock = new Object(); // 전용 락 객체
    private final List<String> items = new ArrayList<>();

    public void add(String item) {
        synchronized (lock) {   // lock 객체가 모니터
            items.add(item);
        }
    }

    public int size() {
        synchronized (lock) {
            return items.size();
        }
    }
}
```

`this`를 락으로 노출하면 외부에서 같은 락을 획득해 교착 상태를 유발할 수 있다. 전용 `private final Object`를 사용하는 것이 안전하다.

## 메모리 가시성 보장

`synchronized`는 상호 배제뿐 아니라 **메모리 가시성(visibility)**도 보장한다.

- **진입 시**: 메인 메모리에서 최신 값을 읽어온다(읽기 장벽).
- **탈출 시**: 변경된 모든 값을 메인 메모리에 플러시한다(쓰기 장벽).

```java
class SharedData {
    private int value; // volatile 없어도 됨

    synchronized void set(int v) {
        value = v; // synchronized 탈출 시 메인 메모리에 반영
    }

    synchronized int get() {
        return value; // synchronized 진입 시 메인 메모리에서 읽음
    }
}
```

## wait() / notify() 패턴

`wait()`와 `notify()`는 모니터와 결합된 조건 변수 메커니즘이다. 반드시 `synchronized` 블록 안에서 호출해야 한다.

```java
class BoundedBuffer<T> {
    private final Queue<T> queue = new LinkedList<>();
    private final int capacity;

    BoundedBuffer(int capacity) { this.capacity = capacity; }

    synchronized void put(T item) throws InterruptedException {
        while (queue.size() == capacity) {
            wait(); // 락을 반환하고 WAITING 진입
        }
        queue.add(item);
        notifyAll(); // 대기 중인 소비자 깨우기
    }

    synchronized T take() throws InterruptedException {
        while (queue.isEmpty()) {
            wait(); // 락을 반환하고 WAITING 진입
        }
        T item = queue.poll();
        notifyAll(); // 대기 중인 생산자 깨우기
        return item;
    }
}
```

`if` 대신 `while`로 조건을 검사하는 이유: `notifyAll()`은 모든 대기 스레드를 깨우므로, 깨어난 스레드가 다시 조건을 확인해야 한다(**spurious wakeup** 방어).

## 재진입성(Reentrancy)

같은 스레드가 이미 소유한 모니터를 다시 획득할 수 있다. JVM은 내부적으로 **보유 카운트(hold count)**를 유지한다.

```java
synchronized void outer() {
    inner(); // 같은 this 락 재진입 — 교착 안 됨
}

synchronized void inner() {
    // hold count 증가 후 실행
    // outer 탈출 시 hold count 감소
}
```

![JVM Lock 최적화 단계](/assets/posts/java-synchronized-lock-types.svg)

## JVM Lock 최적화

JVM(HotSpot)은 경합 수준에 따라 락을 자동으로 최적화한다.

| 단계 | 조건 | 비용 |
|---|---|---|
| Biased Lock | 단일 스레드가 반복 획득 | 거의 없음 (Java 15+ deprecated) |
| Thin Lock | 경합 없을 때 CAS 시도 | 낮음 |
| Fat Lock | 경합 발생 시 팽창 | OS mutex 비용 |

JVM은 경합이 없으면 자동으로 가벼운 락을 사용하고, 경합이 발생하면 중량 락으로 승격한다.

## synchronized vs java.util.concurrent.locks

`synchronized`는 간결하고 오류 가능성이 낮지만 다음 기능을 제공하지 않는다.

| 기능 | synchronized | ReentrantLock |
|---|---|---|
| 타임아웃 락 획득 | 불가 | `tryLock(timeout)` |
| 인터럽트 가능한 대기 | 불가 | `lockInterruptibly()` |
| 공정성(fairness) | 보장 없음 | 생성자 매개변수 |
| 복수 조건 변수 | 불가 | `newCondition()` |

단순 상호 배제에는 `synchronized`, 고급 기능이 필요하면 `java.util.concurrent.locks`를 사용한다.

## 성능 주의사항

- `synchronized` 메서드 전체를 잠그면 락 범위가 너무 커질 수 있다. 꼭 필요한 코드만 `synchronized` 블록으로 감싸라.
- 락 안에서 I/O나 장시간 연산을 하면 다른 스레드를 오래 블로킹한다.
- `String` 인터닝이나 박싱된 `Integer`를 락으로 쓰면 뜻밖의 경합이 발생한다.

```java
// 잘못된 예 — 같은 리터럴 문자열은 동일 객체
synchronized ("lock") { ... } // 다른 클래스도 같은 락을 획득할 수 있음

// 올바른 예
private static final Object LOCK = new Object();
synchronized (LOCK) { ... }
```

---

**지난 글:** [스레드 우선순위와 데몬 스레드](/posts/java-thread-priority-daemon/)

**다음 글:** [volatile 키워드와 메모리 가시성](/posts/java-volatile/)

<br>
읽어주셔서 감사합니다. 😊
