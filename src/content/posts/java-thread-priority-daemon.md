---
title: "스레드 우선순위와 데몬 스레드"
description: "Java Thread 우선순위(MIN/NORM/MAX_PRIORITY), OS 스케줄러와의 관계, 데몬 스레드 개념과 JVM 종료 메커니즘, ThreadFactory 패턴, 가상 스레드의 데몬 특성"
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "Thread", "Priority", "DaemonThread", "ThreadFactory", "스레드우선순위"]
featured: false
draft: false
---

[지난 글](/posts/java-thread-lifecycle/)에서 스레드의 6가지 상태와 전이 조건을 살펴봤다. 이번에는 스레드를 더 세밀하게 제어하는 두 가지 속성인 **우선순위(priority)**와 **데몬 여부(daemon)**를 다룬다. 두 속성 모두 실무에서 자주 오해하는 개념이므로, 동작 원리와 한계를 함께 이해하는 것이 중요하다.

## 스레드 우선순위

### 기본 개념

`Thread` 클래스는 1~10 범위의 정수 우선순위를 제공한다. JDK가 정의한 상수 세 가지를 사용하는 것이 관례다.

```java
Thread.MIN_PRIORITY  // 1
Thread.NORM_PRIORITY // 5 (기본값)
Thread.MAX_PRIORITY  // 10

Thread t = new Thread(() -> { /* 작업 */ });
t.setPriority(Thread.MAX_PRIORITY);
t.start();
System.out.println(t.getPriority()); // 10
```

새 스레드는 부모 스레드의 우선순위를 상속한다. 메인 스레드의 기본 우선순위는 5이므로, 직접 설정하지 않으면 자식 스레드도 5로 생성된다.

### 우선순위의 한계

Java 우선순위는 **OS 스케줄러에 대한 힌트**일 뿐이다. OS와 JVM 구현에 따라 무시될 수 있다.

- **Linux(CFS 스케줄러)**: Java 우선순위를 `nice` 값으로 매핑하지만 영향이 미미하다.
- **Windows**: 7단계 우선순위 클래스에 10단계를 매핑하므로 여러 Java 우선순위가 동일한 OS 우선순위가 된다.
- **가상 스레드(Java 21)**: 우선순위 설정이 무시된다.

실무에서 우선순위로 실행 순서를 보장하려는 것은 잘못된 접근이다. 순서 제어가 필요하면 명시적인 동기화 메커니즘을 사용해야 한다.

![Thread Priority &amp; Daemon Thread](/assets/posts/java-thread-priority-daemon-overview.svg)

## 데몬 스레드

### JVM 종료 조건

JVM은 **모든 사용자(non-daemon) 스레드가 종료될 때** 자동으로 종료된다. 이때 살아있는 데몬 스레드는 `finally` 블록 실행 없이 강제 종료된다.

```java
Thread daemon = new Thread(() -> {
    try {
        while (true) {
            System.out.println("데몬 작업 중...");
            Thread.sleep(200);
        }
    } finally {
        // 보장 안 됨 — JVM이 강제 종료하면 실행 안 됨
        System.out.println("정리");
    }
});
daemon.setDaemon(true); // start() 전에 설정
daemon.start();

// 메인 스레드(사용자 스레드)가 종료되면 JVM도 종료
System.out.println("메인 종료");
```

### 대표적인 데몬 스레드

JVM 내부에서 자동으로 데몬 스레드로 실행되는 것들이 있다.

| 스레드 | 역할 |
|---|---|
| GC 스레드들 | 가비지 컬렉션 |
| JIT 컴파일러 스레드 | 바이트코드 → 네이티브 코드 |
| Finalizer 스레드 | `finalize()` 메서드 실행 |
| Reference Handler | 약한 참조 처리 |

### 데몬 스레드 사용 패턴

데몬 스레드는 주 작업을 보조하는 **백그라운드 서비스**에 적합하다. 주 작업이 끝나면 함께 종료되어야 하는 작업들이다.

```java
// 주기적으로 캐시를 정리하는 백그라운드 스레드
Thread cacheEvictor = new Thread(() -> {
    while (!Thread.currentThread().isInterrupted()) {
        try {
            Thread.sleep(30_000); // 30초마다
            evictExpiredEntries();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
});
cacheEvictor.setDaemon(true);
cacheEvictor.setName("cache-evictor");
cacheEvictor.start();
```

### ThreadFactory로 데몬 스레드 풀 구성

`ExecutorService`에 데몬 스레드를 사용하려면 `ThreadFactory`를 커스터마이징한다.

![ThreadFactory로 데몬 스레드 풀 구성](/assets/posts/java-thread-priority-daemon-threadfactory.svg)

```java
ExecutorService bgPool = Executors.newFixedThreadPool(4, r -> {
    Thread t = new Thread(r);
    t.setDaemon(true);
    t.setName("bg-worker-" + t.getId());
    return t;
});
```

## 가상 스레드와 데몬

Java 21의 가상 스레드는 **항상 데몬 스레드**다. `setDaemon(false)`를 호출해도 `IllegalArgumentException`이 발생한다.

```java
Thread vt = Thread.ofVirtual()
    .name("my-virtual")
    .unstarted(() -> System.out.println("가상 스레드"));
System.out.println(vt.isDaemon()); // true (항상)
System.out.println(vt.getPriority()); // 5 (설정 무시됨)
```

이 때문에 가상 스레드만 사용하는 애플리케이션에서는 JVM이 조기 종료되지 않도록 메인 스레드를 적절히 제어해야 한다.

## 정리

| 속성 | 기본값 | 설정 시점 | 보장 여부 |
|---|---|---|---|
| 우선순위 | 5 (NORM) | 언제든지 | OS 힌트일 뿐, 보장 없음 |
| 데몬 여부 | false | start() 전 | JVM 종료 시 강제 중단됨 |

- 우선순위는 실행 순서 보장 수단이 아니다. 경쟁 조건 해결에 사용하지 말 것.
- 데몬 스레드의 `finally` 실행은 보장되지 않는다. 자원 반납이 필요하면 사용자 스레드로 실행하거나 `ShutdownHook`을 등록한다.
- 가상 스레드는 항상 데몬이다.

---

**지난 글:** [Java 스레드 생명주기 — 6가지 상태와 전이 조건](/posts/java-thread-lifecycle/)

**다음 글:** [synchronized 키워드 완전 분석](/posts/java-synchronized/)

<br>
읽어주셔서 감사합니다. 😊
