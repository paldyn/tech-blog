---
title: "Condition 변수로 구현하는 생산자-소비자 패턴"
description: "java.util.concurrent.locks.Condition 인터페이스, await/signal/signalAll, 생산자-소비자 BoundedBuffer 구현, wait/notifyAll과의 비교, 스퍼리어스 웨이크업 처리"
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "Condition", "생산자소비자", "await", "signal", "ReentrantLock", "동시성패턴"]
featured: false
draft: false
---

[지난 글](/posts/java-stamped-lock/)에서 `StampedLock`의 낙관적 읽기를 살펴봤다. 이번에는 `Lock`의 `newCondition()`으로 생성하는 **`Condition` 변수**를 다룬다. `synchronized`와 함께 쓰는 `wait()`/`notify()` 보다 표현력이 높고, 생산자-소비자처럼 여러 대기 조건이 있는 패턴에서 성능상 이점을 제공한다.

## Condition 기본 개념

`Condition`은 `Lock`에 연결된 조건 변수(condition variable)다. 특정 조건이 만족될 때까지 스레드를 대기시키고, 조건이 충족되면 대기 중인 스레드를 깨운다.

```java
ReentrantLock lock = new ReentrantLock();
Condition notFull  = lock.newCondition(); // 생산자 대기 조건
Condition notEmpty = lock.newCondition(); // 소비자 대기 조건
```

`Object.wait()`와 달리 하나의 락에 여러 `Condition`을 만들 수 있다. 이를 통해 생산자와 소비자를 분리된 조건 집합에서 대기시키고, `signal()`로 필요한 그룹만 깨울 수 있다.

![Condition 기반 생산자-소비자 흐름](/assets/posts/java-condition-producer-consumer.svg)

## Condition API

![Condition API 메서드](/assets/posts/java-condition-api.svg)

핵심 메서드는 세 가지다.

- `await()`: 락을 반환하고 WAITING 상태로 진입. 인터럽트 발생 시 `InterruptedException`.
- `signal()`: 해당 조건에서 대기 중인 스레드 하나를 깨움.
- `signalAll()`: 해당 조건에서 대기 중인 스레드 전부를 깨움.

**주의**: `await()`와 `signal()`은 반드시 락을 보유한 상태에서 호출해야 한다. 그렇지 않으면 `IllegalMonitorStateException`이 발생한다.

## 완전한 BoundedBuffer 구현

```java
import java.util.concurrent.locks.*;

class BoundedBuffer<E> {
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull  = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();

    private final Object[] items;
    private int putIndex, takeIndex, count;

    BoundedBuffer(int capacity) {
        items = new Object[capacity];
    }

    public void put(E e) throws InterruptedException {
        lock.lock();
        try {
            while (count == items.length)
                notFull.await(); // 가득 찼으면 생산자 대기
            items[putIndex] = e;
            putIndex = (putIndex + 1) % items.length;
            count++;
            notEmpty.signal(); // 소비자 하나 깨우기
        } finally {
            lock.unlock();
        }
    }

    @SuppressWarnings("unchecked")
    public E take() throws InterruptedException {
        lock.lock();
        try {
            while (count == 0)
                notEmpty.await(); // 비었으면 소비자 대기
            E x = (E) items[takeIndex];
            items[takeIndex] = null;
            takeIndex = (takeIndex + 1) % items.length;
            count--;
            notFull.signal(); // 생산자 하나 깨우기
            return x;
        } finally {
            lock.unlock();
        }
    }
}
```

`signal()` 하나면 충분한 이유: 생산자 조건(`notFull`)과 소비자 조건(`notEmpty`)이 분리되어 있으므로, 소비가 발생하면 대기 중인 생산자 하나만 깨워도 된다. `synchronized` + `notifyAll()`은 모든 대기자를 깨웠지만 여기서는 불필요한 스레드를 깨우지 않는다.

## 스퍼리어스 웨이크업(Spurious Wakeup)

JVM 명세는 `await()`에서 신호 없이 깨어날 수 있다고 명시한다. 이를 스퍼리어스 웨이크업이라 한다. `if` 대신 `while`로 조건을 재확인하는 이유다.

```java
// 잘못된 예 — 스퍼리어스 웨이크업 취약
if (count == 0)
    notEmpty.await();
return items[takeIndex]; // count가 여전히 0일 수 있음

// 올바른 예
while (count == 0)
    notEmpty.await(); // 항상 루프로 재확인
```

## 타임아웃 대기

무한 대기 대신 시간 제한을 둘 수 있다.

```java
lock.lock();
try {
    // 최대 500ms 대기
    boolean signaled = notEmpty.await(500, TimeUnit.MILLISECONDS);
    if (!signaled) {
        // 타임아웃 — 여전히 비어있음
        return Optional.empty();
    }
    return Optional.of(take_internal());
} finally {
    lock.unlock();
}
```

`await(long, TimeUnit)`은 신호를 받으면 `true`, 타임아웃이면 `false`를 반환한다.

## awaitUninterruptibly()

인터럽트를 무시하고 반드시 신호를 받을 때까지 대기한다. 인터럽트를 받아도 `InterruptedException` 없이 계속 대기하고, 신호를 받은 후 스레드의 인터럽트 플래그를 설정한다.

```java
lock.lock();
try {
    while (queue.isEmpty())
        notEmpty.awaitUninterruptibly(); // 인터럽트 무시
    return queue.poll();
} finally {
    lock.unlock();
}
```

셧다운 절차가 복잡하거나 특정 작업이 반드시 완료되어야 하는 경우에 사용한다.

## 실무 패턴: 작업 큐와 워커 풀

```java
class WorkQueue {
    private final Deque<Runnable> queue = new ArrayDeque<>();
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition hasWork = lock.newCondition();
    private volatile boolean shutdown = false;

    void submit(Runnable task) {
        lock.lock();
        try {
            queue.addLast(task);
            hasWork.signal(); // 대기 중인 워커 하나 깨우기
        } finally {
            lock.unlock();
        }
    }

    Runnable take() throws InterruptedException {
        lock.lock();
        try {
            while (queue.isEmpty() && !shutdown)
                hasWork.await();
            if (shutdown && queue.isEmpty()) return null;
            return queue.pollFirst();
        } finally {
            lock.unlock();
        }
    }

    void shutdown() {
        lock.lock();
        try {
            shutdown = true;
            hasWork.signalAll(); // 모든 워커 깨우기 (종료 처리)
        } finally {
            lock.unlock();
        }
    }
}
```

셧다운 시에는 `signalAll()`을 사용해 모든 대기 워커가 종료 조건을 확인하게 한다.

---

**지난 글:** [StampedLock — 낙관적 읽기와 락 변환](/posts/java-stamped-lock/)

**다음 글:** [스레드 안전 컬렉션 — ConcurrentHashMap부터 BlockingQueue까지](/posts/java-thread-safe-collections/)

<br>
읽어주셔서 감사합니다. 😊
