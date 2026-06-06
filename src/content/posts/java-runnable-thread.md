---
title: "Runnable과 Thread — 스레드 생성과 제어"
description: "Java Runnable 인터페이스와 Thread 클래스 완전 가이드 — 스레드 생성 3가지 패턴, start vs run, sleep/join/interrupt, 데몬 스레드, Thread.ofVirtual()"
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "Thread", "Runnable", "스레드생성", "sleep", "join", "interrupt", "데몬스레드"]
featured: false
draft: false
---

[지난 글](/posts/java-threads-basics/)에서 스레드의 개념과 생명주기를 이해했다. 이번에는 **`Thread` 클래스와 `Runnable` 인터페이스**로 직접 스레드를 생성하고 제어하는 실전 패턴을 다룬다. `sleep()`, `join()`, `interrupt()` 동작 원리와 올바른 처리 방법까지 함께 정리한다.

## 스레드 생성 패턴

### 패턴 1: Thread 클래스 상속 (비권장)

```java
class Worker extends Thread {
    @Override
    public void run() {
        System.out.println("Thread: " + getName());
    }
}

new Worker().start();
```

`Thread`를 상속하면 다른 클래스를 상속할 수 없다. 작업 로직과 스레드 제어가 결합돼 재사용도 어렵다.

### 패턴 2: Runnable 구현 (권장)

`Runnable`은 함수형 인터페이스(`@FunctionalInterface`)라 람다로 표현할 수 있다.

```java
Runnable task = () -> {
    System.out.println("Running on: " + Thread.currentThread().getName());
};

Thread t = new Thread(task, "my-thread");
t.start();
```

같은 `Runnable`을 여러 스레드에 전달할 수 있고, `Callable`, `ExecutorService`와도 조합된다.

### 패턴 3: Thread.ofXxx() — Java 21+ 권장 API

Java 21에서 추가된 빌더 스타일 API다.

```java
// 플랫폼 스레드
Thread platform = Thread.ofPlatform()
    .name("platform-worker")
    .daemon(false)
    .start(() -> doWork());

// 가상 스레드
Thread virtual = Thread.ofVirtual()
    .name("virtual-worker")
    .start(() -> doWork());

// 스레드 팩토리로 여러 개 생성
ThreadFactory factory = Thread.ofVirtual().name("vt-", 0).factory();
Thread t1 = factory.newThread(task);
Thread t2 = factory.newThread(task);
```

![Thread 생성 3가지 패턴](/assets/posts/java-runnable-thread-patterns.svg)

## start() vs run()

가장 흔한 실수다. `run()`을 직접 호출하면 새 스레드가 생성되지 않는다.

```java
Thread t = new Thread(() -> System.out.println("Thread: "
    + Thread.currentThread().getName()));

t.run();   // 호출 스레드(main)에서 실행 — "Thread: main" 출력
t.start(); // 새 스레드 생성 후 실행 — "Thread: Thread-0" 출력
```

`start()`는 내부적으로 JVM에 새 OS 스레드 생성을 요청하고 `run()`을 그 스레드에서 실행한다.

## 스레드 이름 지정

스레드 덤프, 로그, 모니터링에서 이름이 있는 스레드는 디버깅이 훨씬 쉽다.

```java
Thread t = new Thread(task, "order-processor-1");

// Java 21 빌더 API (순번 자동 증가)
Thread.ofPlatform().name("db-worker-", 0).start(task); // db-worker-0
Thread.ofPlatform().name("db-worker-", 0).start(task); // db-worker-1 (다음 팩토리 호출)
```

## Thread.sleep() — 일시 정지

현재 스레드를 지정 시간 동안 `TIMED_WAITING` 상태로 만든다.

```java
try {
    Thread.sleep(2000); // 2초 대기
} catch (InterruptedException e) {
    // 인터럽트 플래그 복원 (중요!)
    Thread.currentThread().interrupt();
}
```

`sleep()` 중 다른 스레드가 `interrupt()`를 호출하면 `InterruptedException`이 발생한다. 이때 JVM은 인터럽트 플래그를 **자동으로 클리어**한다. `Thread.currentThread().interrupt()`를 호출해 플래그를 복원해야 상위 호출자가 인터럽트를 인식할 수 있다.

`Thread.sleep(0)`은 스레드 스케줄러에게 CPU를 양보하는 힌트다. 보장은 없지만 경쟁 조건 테스트에 종종 활용된다.

## join() — 완료 대기

한 스레드가 다른 스레드의 종료를 기다린다.

```java
Thread t = Thread.ofPlatform().start(() -> {
    expensiveComputation();
});

// main 스레드가 t 완료 대기
t.join();                 // 무한 대기
t.join(5000);             // 최대 5초 대기 (타임아웃 후 반환)
t.join(5, TimeUnit.SECONDS); // Java 19+ 오버로드

System.out.println("t finished, state: " + t.getState()); // TERMINATED
```

`join()` 후에도 `t.isAlive()`로 실제 종료 여부를 확인할 수 있다 (타임아웃 버전은 종료 전에 반환될 수 있으므로).

## interrupt() — 스레드 중단 신호

`interrupt()`는 스레드를 즉시 종료하지 않는다. 인터럽트 플래그를 세우거나, 대기 중인 `sleep()`/`wait()`/`join()`에서 `InterruptedException`을 발생시킨다.

```java
Thread worker = Thread.ofPlatform().start(() -> {
    while (!Thread.currentThread().isInterrupted()) {
        processItem();
    }
    cleanup(); // 정상 종료 로직
});

// 다른 스레드에서 종료 요청
worker.interrupt();
```

![인터럽트 처리 패턴](/assets/posts/java-runnable-thread-interrupt.svg)

### 인터럽트 처리 황금률

```java
// ① InterruptedException을 잡으면 반드시 플래그 복원
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    Thread.currentThread().interrupt(); // 복원
    return; // 또는 break
}

// ② 메서드 시그니처에 선언 (호출자에게 위임)
void waitForEvent() throws InterruptedException {
    Thread.sleep(1000); // 예외 전파
}
```

`InterruptedException`을 catch하고 아무것도 하지 않으면 인터럽트 신호가 사라져 스레드가 종료 요청을 무시하게 된다.

## 데몬 스레드

JVM은 모든 **사용자 스레드(non-daemon)**가 종료될 때 종료된다. 데몬 스레드는 사용자 스레드가 모두 끝나면 JVM이 강제 종료한다.

```java
Thread bg = new Thread(this::periodicCleanup, "cleanup-daemon");
bg.setDaemon(true); // start() 전에 호출해야 함
bg.start();

// bg.setDaemon(true) — start() 후 호출 시 IllegalThreadStateException
```

가비지 컬렉터, JIT 컴파일러, 모니터링 스레드가 데몬 스레드다. 비즈니스 로직은 사용자 스레드에서 실행해야 한다.

## Thread 정보 조회

```java
Thread t = Thread.currentThread();

t.getId();           // 스레드 고유 ID (long)
t.getName();         // 스레드 이름
t.getPriority();     // 우선순위 (1~10, 기본 5)
t.getState();        // Thread.State 열거값
t.isAlive();         // 시작됐고 아직 종료 안 됨
t.isDaemon();        // 데몬 여부
t.isInterrupted();   // 인터럽트 플래그 (클리어하지 않음)
Thread.interrupted(); // 인터럽트 플래그 확인 + 클리어 (정적)
```

`isInterrupted()`와 `Thread.interrupted()`의 차이: 후자는 플래그를 확인 후 **클리어**한다.

## UncaughtExceptionHandler — 예외 처리

`run()`에서 체크 예외는 던질 수 없다. 런타임 예외가 전파되면 스레드가 종료되고 기본적으로 콘솔에 출력만 된다.

```java
Thread t = Thread.ofPlatform().start(() -> {
    throw new RuntimeException("worker failed");
});

t.setUncaughtExceptionHandler((thread, exc) -> {
    log.error("Thread {} failed: {}", thread.getName(), exc.getMessage());
    alertSystem.notify(exc);
});
```

스레드 팩토리와 결합하면 모든 스레드에 기본 핸들러를 설정할 수 있다.

```java
Thread.setDefaultUncaughtExceptionHandler((thread, exc) -> {
    System.err.println("Unhandled: " + thread.getName() + " -> " + exc);
});
```

## 실전 권장 패턴

```java
// 단순 백그라운드 작업 (Java 21+)
Thread.ofVirtual().name("bg-task").start(() -> {
    try {
        doBackgroundWork();
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
});

// 여러 작업을 병렬로 실행하고 모두 완료 대기
List<Thread> threads = new ArrayList<>();
for (int i = 0; i < 4; i++) {
    int idx = i;
    Thread t = Thread.ofVirtual().name("worker-" + idx)
        .start(() -> processChunk(idx));
    threads.add(t);
}
for (Thread t : threads) t.join();
```

실전에서는 `Thread`를 직접 생성하기보다 `ExecutorService` 또는 가상 스레드 기반 풀을 사용한다. 그러나 `Thread` 클래스의 기본 동작을 이해해야 `ExecutorService`와 동시성 문제를 올바르게 다룰 수 있다.

## 핵심 정리

- `start()` = 새 스레드 생성 + run() 호출, `run()` 직접 호출 = 새 스레드 없음
- `sleep(ms)` → `TIMED_WAITING`, `InterruptedException` 발생 시 플래그 자동 클리어
- `interrupt()` = 플래그 설정 + 대기 중 예외 발생 — 즉시 종료 아님
- `InterruptedException` catch → 반드시 `Thread.currentThread().interrupt()`
- 데몬 스레드 = 사용자 스레드 모두 종료 시 JVM이 강제 종료
- Java 21+: `Thread.ofPlatform()` / `Thread.ofVirtual()` 권장

---

**지난 글:** [스레드 기초 — 동시성 프로그래밍의 시작](/posts/java-threads-basics/)

<br>
읽어주셔서 감사합니다. 😊
