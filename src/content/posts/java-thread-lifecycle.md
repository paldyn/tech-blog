---
title: "Java 스레드 생명주기 — 6가지 상태와 전이 조건"
description: "Java Thread.State 열거형의 6가지 상태(NEW, RUNNABLE, BLOCKED, WAITING, TIMED_WAITING, TERMINATED)와 각 상태 전이 조건, getState() 활용, interrupt 처리 패턴"
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "Thread", "스레드생명주기", "Thread.State", "RUNNABLE", "BLOCKED", "WAITING", "interrupt"]
featured: false
draft: false
---

[지난 글](/posts/java-runnable-thread/)에서 `Runnable`과 `Thread`로 스레드를 생성하고 `start()`, `sleep()`, `join()`을 호출하는 방법을 살펴봤다. 이번에는 스레드가 생성부터 종료까지 거치는 **6가지 상태(Thread.State)**와 각 상태 사이의 전이 조건을 체계적으로 정리한다. 상태 흐름을 이해하면 데드락·기아 현상 디버깅과 스레드 덤프 분석이 훨씬 쉬워진다.

## Thread.State 열거형

JDK는 `java.lang.Thread.State` 열거형으로 6가지 상태를 정의한다. 런타임에 `thread.getState()`로 현재 상태를 조회할 수 있다.

```java
Thread t = new Thread(() -> System.out.println("hello"));
System.out.println(t.getState()); // NEW
t.start();
System.out.println(t.getState()); // RUNNABLE (또는 이미 TERMINATED)
```

![Java Thread State Diagram](/assets/posts/java-thread-lifecycle-state-diagram.svg)

### NEW

`new Thread(r)` 호출 후 `start()`를 부르기 전 상태다. JVM 내부에 스레드 객체만 존재하고 OS 스레드는 아직 생성되지 않았다.

```java
Thread t = new Thread(() -> {});
assert t.getState() == Thread.State.NEW;
```

### RUNNABLE

`start()`를 호출하면 OS 스레드가 생성되고 스레드는 RUNNABLE 상태가 된다. RUNNABLE은 **현재 CPU에서 실행 중**인 경우와 **스케줄러 큐에서 실행 대기 중**인 경우를 모두 포함한다. JVM은 OS 스케줄링 세부 사항을 추상화하기 때문에 두 경우를 구분하지 않는다.

### BLOCKED

`synchronized` 블록이나 메서드에 진입하려 할 때 다른 스레드가 이미 해당 모니터를 보유하고 있으면 BLOCKED 상태가 된다. 모니터를 획득하는 순간 다시 RUNNABLE로 전이한다.

```java
Object lock = new Object();

Thread t1 = new Thread(() -> {
    synchronized (lock) {
        Thread.sleep(2000); // 2초 동안 lock 보유
    }
});

Thread t2 = new Thread(() -> {
    synchronized (lock) { // t1이 lock 보유 중이면 BLOCKED
        System.out.println("t2 진입");
    }
});
```

### WAITING

`Object.wait()`, `Thread.join()`, `LockSupport.park()` 호출 시 WAITING 상태가 된다. 다른 스레드가 명시적으로 깨워줄 때(`notify()`, `notifyAll()`, `unpark()`)까지 무기한 대기한다.

| 메서드 | WAITING 진입 | 탈출 조건 |
|---|---|---|
| `Object.wait()` | `synchronized` 블록 안 | `notify()` / `notifyAll()` |
| `Thread.join()` | 어디서든 | 대상 스레드 종료 |
| `LockSupport.park()` | 어디서든 | `LockSupport.unpark(t)` |

### TIMED_WAITING

시간 제한이 있는 대기 메서드를 호출하면 TIMED_WAITING 상태가 된다. 시간이 만료되거나 조건이 충족되면 자동으로 RUNNABLE로 돌아온다.

```java
Thread t = new Thread(() -> {
    try {
        Thread.sleep(1000);          // TIMED_WAITING
        Object o = new Object();
        synchronized (o) {
            o.wait(500);             // TIMED_WAITING
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
});
```

| 메서드 | 탈출 조건 |
|---|---|
| `Thread.sleep(n)` | 시간 만료 / `interrupt()` |
| `Object.wait(n)` | 시간 만료 / `notify()` / `interrupt()` |
| `Thread.join(n)` | 시간 만료 / 대상 스레드 종료 |
| `LockSupport.parkNanos(n)` | 시간 만료 / `unpark()` |

### TERMINATED

`run()` 메서드가 정상 종료되거나 예외로 종료되면 TERMINATED 상태가 된다. 한번 TERMINATED가 된 스레드는 다시 시작할 수 없다(`start()` 재호출 시 `IllegalThreadStateException`).

## interrupt() 메커니즘

`interrupt()`는 스레드에게 "중단 요청"을 보내는 협력적 신호다. 강제 종료가 아니라는 점이 중요하다.

- **WAITING·TIMED_WAITING 상태**: `InterruptedException`이 발생하며 RUNNABLE로 전이된다.
- **RUNNABLE 상태**: 인터럽트 플래그만 설정되고 예외는 발생하지 않는다. `Thread.interrupted()` 또는 `isInterrupted()`로 플래그를 직접 확인해야 한다.

```java
Thread worker = new Thread(() -> {
    while (!Thread.currentThread().isInterrupted()) {
        // 작업 수행
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); // 플래그 복원 필수
            break;
        }
    }
    System.out.println("정상 종료");
});

worker.start();
Thread.sleep(500);
worker.interrupt(); // 종료 요청
```

`InterruptedException`을 catch한 직후 `Thread.currentThread().interrupt()`로 플래그를 복원하는 패턴은 관용구다. 예외를 삼켜버리면 상위 호출자가 인터럽트 사실을 알 수 없다.

![스레드 상태 전이 코드 예시](/assets/posts/java-thread-lifecycle-code.svg)

## getState()로 상태 모니터링

```java
Thread t = new Thread(() -> {
    try { Thread.sleep(2000); }
    catch (InterruptedException e) { Thread.currentThread().interrupt(); }
});

System.out.println(t.getState()); // NEW
t.start();
Thread.sleep(100); // t가 sleep에 진입할 시간을 줌
System.out.println(t.getState()); // TIMED_WAITING
t.join();
System.out.println(t.getState()); // TERMINATED
```

스레드 덤프(`jstack`, JFR)를 분석할 때 BLOCKED 상태 스레드가 많으면 락 경합을, WAITING 상태가 많으면 `notify()` 누락이나 조건 변수 오용을 의심한다.

## 핵심 정리

- **RUNNABLE**: 실행 중 + 실행 대기 모두 포함. OS 스케줄러가 선택권을 가짐.
- **BLOCKED vs WAITING**: BLOCKED는 `synchronized` 진입 실패, WAITING은 명시적 `wait()`/`join()` 호출.
- **인터럽트**: 협력적 신호. `InterruptedException` 처리 후 반드시 플래그를 복원하거나 재전파한다.
- **TERMINATED** 재시작 불가: 한번 종료된 스레드는 재사용할 수 없다. `ExecutorService`나 스레드 풀을 사용하는 이유가 여기 있다.

---

**지난 글:** [Runnable과 Thread — 스레드 생성과 제어](/posts/java-runnable-thread/)

**다음 글:** [스레드 우선순위와 데몬 스레드](/posts/java-thread-priority-daemon/)

<br>
읽어주셔서 감사합니다. 😊
