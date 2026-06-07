---
title: "Lock 인터페이스 — ReentrantLock 완전 가이드"
description: "java.util.concurrent.locks.Lock 인터페이스, ReentrantLock 공정성, tryLock 타임아웃, lockInterruptibly, ReadWriteLock, Condition 변수, synchronized와의 선택 기준"
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "ReentrantLock", "Lock", "ReadWriteLock", "Condition", "tryLock", "동기화"]
featured: false
draft: false
---

[지난 글](/posts/java-atomic-classes/)에서 CAS 기반 Atomic 클래스들을 살펴봤다. 이번에는 `synchronized`보다 풍부한 기능을 제공하는 **`java.util.concurrent.locks` 패키지**의 `Lock` 인터페이스와 주요 구현체들을 다룬다. 언제, 어떻게 사용해야 하는지 실전 패턴과 함께 정리한다.

## Lock 인터페이스

```java
public interface Lock {
    void lock();
    void lockInterruptibly() throws InterruptedException;
    boolean tryLock();
    boolean tryLock(long time, TimeUnit unit) throws InterruptedException;
    void unlock();
    Condition newCondition();
}
```

`Lock`은 `synchronized`를 대체할 수 있는 인터페이스다. 가장 중요한 차이는 `unlock()`을 **명시적으로 호출**해야 한다는 점이다.

![ReentrantLock vs synchronized](/assets/posts/java-locks-reentrantlock.svg)

## ReentrantLock

`synchronized`처럼 재진입 가능한 뮤텍스다. `synchronized`가 제공하지 않는 세 가지 핵심 기능을 제공한다.

### 1. tryLock() — 타임아웃

```java
ReentrantLock lock = new ReentrantLock();

// 즉시 획득 시도 — 실패 시 false 반환 (블로킹 없음)
if (lock.tryLock()) {
    try {
        doWork();
    } finally {
        lock.unlock();
    }
} else {
    // 락 획득 실패 → 대체 로직
    fallback();
}

// 최대 2초 대기
boolean acquired = lock.tryLock(2, TimeUnit.SECONDS);
if (acquired) {
    try { doWork(); } finally { lock.unlock(); }
} else {
    handleTimeout();
}
```

### 2. lockInterruptibly() — 인터럽트 가능한 대기

```java
try {
    lock.lockInterruptibly(); // 대기 중 interrupt() 호출 시 예외
    try {
        doWork();
    } finally {
        lock.unlock();
    }
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
    // 락 획득 포기
}
```

### 3. 공정성(Fairness)

```java
// true: FIFO 순서로 스레드에게 락 부여 (기아 방지)
// false: 성능 우선, 순서 보장 없음 (기본값)
ReentrantLock fairLock = new ReentrantLock(true);
```

공정 락은 대기 큐 순서를 보장하지만 처리량(throughput)이 낮아질 수 있다. 대부분의 경우 비공정 락이 적합하다.

## ReentrantReadWriteLock

읽기는 동시에, 쓰기는 배타적으로 허용하는 읽기-쓰기 락이다. 읽기가 훨씬 많고 쓰기가 드문 자료구조(캐시, 설정 등)에 효과적이다.

![ReentrantReadWriteLock 동시성 모델](/assets/posts/java-locks-readwrite.svg)

```java
class CacheMap<K, V> {
    private final Map<K, V> map = new HashMap<>();
    private final ReadWriteLock rwl = new ReentrantReadWriteLock();
    private final Lock r = rwl.readLock();
    private final Lock w = rwl.writeLock();

    V get(K key) {
        r.lock();
        try {
            return map.get(key);
        } finally {
            r.unlock();
        }
    }

    void put(K key, V value) {
        w.lock();
        try {
            map.put(key, value);
        } finally {
            w.unlock();
        }
    }
}
```

**읽기-쓰기 락 규칙:**
- 읽기 락은 여러 스레드가 동시에 보유 가능
- 쓰기 락은 한 스레드만 보유 가능
- 읽기 락이 보유된 상태에서 쓰기 락 획득 불가 (읽기 락 해제 대기)
- 쓰기 락이 보유된 상태에서 읽기 락 획득 불가

## Condition 변수

`Condition`은 `synchronized`의 `wait()`/`notify()`를 대체하는 더 강력한 조건 변수다. 하나의 `Lock`에 여러 `Condition`을 만들 수 있다.

```java
class BoundedBuffer<T> {
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull = lock.newCondition();   // 생산자 대기
    private final Condition notEmpty = lock.newCondition();  // 소비자 대기
    private final Object[] items;
    private int head, tail, count;

    BoundedBuffer(int capacity) { items = new Object[capacity]; }

    @SuppressWarnings("unchecked")
    T take() throws InterruptedException {
        lock.lock();
        try {
            while (count == 0)
                notEmpty.await(); // 비었으면 소비자 대기
            T x = (T) items[head];
            items[head] = null;
            head = (head + 1) % items.length;
            --count;
            notFull.signal(); // 생산자 하나 깨우기
            return x;
        } finally {
            lock.unlock();
        }
    }

    void put(T x) throws InterruptedException {
        lock.lock();
        try {
            while (count == items.length)
                notFull.await(); // 가득 차면 생산자 대기
            items[tail] = x;
            tail = (tail + 1) % items.length;
            ++count;
            notEmpty.signal(); // 소비자 하나 깨우기
        } finally {
            lock.unlock();
        }
    }
}
```

`synchronized`의 `notify()`는 wait set에서 임의 선택하므로, 생산자/소비자 양쪽이 같은 wait set을 쓰면 `notifyAll()`이 필요했다. `Condition`을 분리하면 `signal()`로 정확한 대기자만 깨울 수 있어 성능이 개선된다.

## Lock 선택 기준

| 상황 | 권장 |
|---|---|
| 단순 상호 배제 | `synchronized` |
| 타임아웃 락 획득 필요 | `ReentrantLock.tryLock()` |
| 인터럽트 가능한 대기 | `lockInterruptibly()` |
| 읽기 다수, 쓰기 소수 | `ReentrantReadWriteLock` |
| 생산자/소비자 분리 | `Condition` 다중 변수 |
| 고성능 읽기-쓰기 | `StampedLock` (다음 글) |

## 주의사항

`ReentrantLock`을 사용할 때 `unlock()`을 잊으면 영구 교착 상태가 된다. 반드시 `try-finally` 패턴을 사용한다.

```java
// 잘못된 예 — 예외 시 unlock 누락
lock.lock();
doWork(); // 예외 발생 시 unlock 안 됨
lock.unlock();

// 올바른 예
lock.lock();
try {
    doWork();
} finally {
    lock.unlock(); // 항상 실행
}
```

`lock()` 호출이 `try` 블록 밖에 있어야 한다. `lock()` 자체가 예외를 던지는 경우는 거의 없지만, `try` 안에 넣으면 락을 획득하지 못했음에도 `finally`에서 `unlock()`이 호출되어 `IllegalMonitorStateException`이 발생할 수 있다.

---

**지난 글:** [Atomic 클래스 — Lock-Free 동기화](/posts/java-atomic-classes/)

**다음 글:** [StampedLock — 낙관적 읽기와 락 변환](/posts/java-stamped-lock/)

<br>
읽어주셔서 감사합니다. 😊
