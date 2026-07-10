---
title: "교착 상태(Deadlock) 완전 분석과 예방 전략"
description: "Java 교착 상태 4가지 발생 조건, 고전적 패턴(락 순서 역전), 락 획득 순서 고정·tryLock 타임아웃으로 예방, jstack/ThreadMXBean으로 감지, 라이브락·기아 현상 구분"
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "Deadlock", "교착상태", "tryLock", "jstack", "ThreadMXBean", "동시성버그"]
featured: false
draft: false
---

[지난 글](/posts/java-thread-safe-collections/)에서 스레드 안전 컬렉션을 살펴봤다. 이번에는 멀티스레드 프로그래밍의 가장 치명적인 버그인 **교착 상태(Deadlock)**를 다룬다. 발생 원리를 이해하고, 코드에서 사전에 예방하는 방법과 발생 후 감지·진단하는 방법까지 정리한다.

## 교착 상태란

두 개 이상의 스레드가 서로 상대방이 보유한 자원을 기다리며 영원히 진행하지 못하는 상태다. **자동 해제 메커니즘이 없다**. 교착 상태가 발생하면 해당 스레드들은 JVM이 종료될 때까지 BLOCKED 상태를 유지한다.

![교착 상태 발생 원리](/assets/posts/java-deadlock-diagram.svg)

### 4가지 필요 조건

교착 상태는 아래 조건이 모두 성립할 때만 발생한다. 하나라도 깨면 교착이 불가능하다.

1. **상호 배제**: 자원을 한 번에 한 스레드만 사용한다.
2. **점유 대기**: 자원을 보유한 채 다른 자원을 기다린다.
3. **비선점**: 스레드는 자발적으로만 자원을 반환한다.
4. **순환 대기**: 스레드들이 원형으로 서로의 자원을 기다린다.

## 고전적 교착 패턴

### 락 획득 순서 역전

```java
Object lockA = new Object();
Object lockB = new Object();

// Thread 1: A 먼저, B 다음
new Thread(() -> {
    synchronized (lockA) {
        Thread.sleep(50);       // Thread 2에게 실행 기회
        synchronized (lockB) { // lockB 대기 → 교착
            doWork();
        }
    }
}).start();

// Thread 2: B 먼저, A 다음 — 순서 역전!
new Thread(() -> {
    synchronized (lockB) {
        synchronized (lockA) { // lockA 대기 → 교착
            doWork();
        }
    }
}).start();
```

두 스레드가 서로 상대방이 보유한 락을 기다리며 순환이 발생한다.

### 계좌 이체의 교착

```java
class Account {
    private double balance;
    private final Object lock = new Object();

    // 위험: 호출 순서에 따라 교착 발생
    void transfer(Account target, double amount) {
        synchronized (this.lock) {
            synchronized (target.lock) { // 다른 스레드가 target.lock을 먼저 잡으면 교착
                this.balance -= amount;
                target.balance += amount;
            }
        }
    }
}
```

`accountA.transfer(accountB, 100)`과 `accountB.transfer(accountA, 200)`이 동시에 실행되면 교착이 발생할 수 있다.

## 예방 전략 1: 락 획득 순서 고정

순환 대기 조건을 제거하는 가장 효과적인 방법이다. 모든 스레드가 동일한 순서로 락을 획득하면 순환이 불가능하다.

```java
class Account {
    private final long id; // 고유 ID
    private double balance;

    void transfer(Account target, double amount) {
        // ID 순서로 항상 같은 순서로 락 획득
        Account first  = this.id < target.id ? this : target;
        Account second = this.id < target.id ? target : this;

        synchronized (first) {
            synchronized (second) {
                this.balance -= amount;
                target.balance += amount;
            }
        }
    }
}
```

어떤 두 계좌 사이에도 항상 작은 ID를 가진 계좌의 락을 먼저 획득하므로 순환이 발생하지 않는다.

## 예방 전략 2: tryLock 타임아웃

`ReentrantLock.tryLock()`으로 타임아웃을 설정해 무한 대기를 방지한다. 교착을 예방하기보다 **발생 시 탈출**하는 방식이다.

```java
boolean transferWithTimeout(ReentrantLock fromLock, ReentrantLock toLock,
                             double amount, long timeout, TimeUnit unit)
        throws InterruptedException {

    boolean acquiredFrom = fromLock.tryLock(timeout, unit);
    if (!acquiredFrom) return false;

    try {
        boolean acquiredTo = toLock.tryLock(timeout, unit);
        if (!acquiredTo) {
            return false; // from 락 자동 해제 (finally)
        }
        try {
            doTransfer(amount);
            return true;
        } finally {
            toLock.unlock();
        }
    } finally {
        fromLock.unlock();
    }
}
```

타임아웃 후 재시도 사이에 약간의 랜덤 지연을 추가하면 **라이브락**을 방지할 수 있다.

![교착 상태 예방 전략](/assets/posts/java-deadlock-prevention.svg)

## 예방 전략 3: 락 범위 최소화

락을 보유하는 동안 다른 객체의 메서드를 호출하면(`alien call`) 예상치 못한 교착이 발생할 수 있다.

```java
// 위험 — 락 보유 중 listener 호출 (listener가 다른 락을 획득할 수 있음)
synchronized (this) {
    notifyListeners(); // 내부에서 다른 락 획득 가능 → 교착 위험
}

// 안전 — 락 밖에서 호출
List<Listener> snapshot;
synchronized (this) {
    snapshot = new ArrayList<>(listeners); // 데이터만 복사
}
snapshot.forEach(Listener::onEvent); // 락 밖에서 호출
```

## 교착 상태 감지

### jstack으로 스레드 덤프 분석

```bash
# PID 확인
jps -l

# 스레드 덤프 생성
jstack <PID> > thread_dump.txt
```

스레드 덤프에서 교착 상태를 발견하면 다음과 같이 표시된다.

```text
Found one Java-level deadlock:
"Thread-1":
  waiting to lock monitor 0x... (object 0x..., a java.lang.Object)
  which is held by "Thread-2"
"Thread-2":
  waiting to lock monitor 0x... (object 0x..., a java.lang.Object)
  which is held by "Thread-1"
```

### ThreadMXBean으로 프로그래밍 감지

```java
ThreadMXBean bean = ManagementFactory.getThreadMXBean();
long[] deadlockedIds = bean.findDeadlockedThreads();

if (deadlockedIds != null) {
    ThreadInfo[] infos = bean.getThreadInfo(deadlockedIds, true, true);
    for (ThreadInfo info : infos) {
        System.err.println("교착 스레드: " + info.getThreadName());
        System.err.println("대기 중인 락: " + info.getLockName());
        System.err.println("락 소유자: " + info.getLockOwnerName());
    }
}
```

## 라이브락(Livelock)과 기아(Starvation)

교착 상태와 다른 두 가지 동시성 문제다.

| 문제 | 상태 | 증상 |
|---|---|---|
| **교착(Deadlock)** | BLOCKED | 완전히 멈춤 |
| **라이브락(Livelock)** | RUNNABLE | 실행 중이지만 진행 없음 |
| **기아(Starvation)** | BLOCKED/WAITING | 특정 스레드가 영원히 자원 획득 못 함 |

라이브락 예: 두 스레드가 서로 양보하며 계속 상태를 변경하지만 실제 작업은 진행되지 않음. 재시도 로직에 랜덤 지연을 추가해 해결한다.

기아 예: 비공정 락에서 우선순위가 낮은 스레드가 계속 락 획득에 실패. `ReentrantLock(true)` 공정 락이나 `PriorityBlockingQueue`로 완화한다.

## 실무 체크리스트

- [ ] 여러 락을 획득하는 경우 전역적으로 일관된 획득 순서가 있는가?
- [ ] 락 보유 중 외부 객체 메서드를 호출하지 않는가?
- [ ] `synchronized` 메서드 안에서 또 다른 `synchronized` 메서드를 호출하지 않는가?
- [ ] `ReentrantLock`을 사용한다면 `tryLock` 타임아웃이 있는가?
- [ ] 교착 감지를 위한 모니터링(JFR, VisualVM)이 설정되어 있는가?

---

**지난 글:** [스레드 안전 컬렉션 — ConcurrentHashMap부터 BlockingQueue까지](/posts/java-thread-safe-collections/)

**다음 글:** [라이브락과 기아 현상: 교착 상태의 사촌들](/posts/java-livelock-starvation/)

<br>
읽어주셔서 감사합니다. 😊
