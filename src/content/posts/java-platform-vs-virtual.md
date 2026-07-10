---
title: "플랫폼 스레드 vs Virtual Thread 심층 비교"
description: "플랫폼 스레드와 Virtual Thread의 OS 매핑 방식, 메모리 모델, 스케줄링 차이, Pinning 문제, ThreadLocal vs ScopedValue, 그리고 각각의 적합한 사용 시나리오를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "Virtual Threads", "플랫폼 스레드", "Pinning", "ThreadLocal", "동시성 비교"]
featured: false
draft: false
---

[지난 글](/posts/java-virtual-threads/)에서 Virtual Thread의 기본 동작 원리와 생성 방법을 살펴봤습니다. 이번에는 기존 플랫폼 스레드와의 차이를 더 깊이 비교하고, Virtual Thread 도입 시 반드시 알아야 할 `Pinning` 문제와 `ThreadLocal` 대체 방법을 다룹니다.

## 핵심 차이 비교표

![플랫폼 스레드 vs Virtual Thread 비교](/assets/posts/java-platform-vs-virtual-compare.svg)

## 스택 메모리 모델 차이

**플랫폼 스레드**: OS가 스레드 생성 시 고정 크기 스택을 연속 메모리에 할당합니다. JVM 기본값은 `-Xss512k`(Windows)~`-Xss1m`(Linux). 10만 개 스레드는 50~100GB를 요구합니다.

**Virtual Thread**: JVM이 관리하는 **연속 스택(Continuation Stack)**을 힙에 동적으로 저장합니다. 초기 크기는 수백 바이트에 불과하며, 필요에 따라 청크 단위로 확장됩니다. 블로킹 시 스택 전체가 힙으로 직렬화되어 캐리어 스레드에서 분리됩니다.

```java
// 스택 크기 비교 시뮬레이션
long before = Runtime.getRuntime().freeMemory();
List<Thread> vts = IntStream.range(0, 100_000)
    .mapToObj(i -> Thread.ofVirtual().unstarted(() -> {
        LockSupport.park(); // parked 상태 유지
    }))
    .peek(Thread::start)
    .toList();
long after = Runtime.getRuntime().freeMemory();
System.out.println("10만 VT 메모리: " + (before - after) / 1024 / 1024 + "MB");
// 플랫폼 스레드: ~수십 GB vs Virtual Thread: ~수십 MB
```

## Pinning(피닝): Virtual Thread의 함정

Virtual Thread가 블로킹 상태에서 캐리어 스레드를 **해제하지 못하는** 현상이 Pinning입니다.

### Pinning이 발생하는 경우

1. `synchronized` 블록 또는 메서드 안에서 블로킹 I/O
2. `Object.wait()` 호출
3. JNI(네이티브) 코드 실행 중

![Pinning 방지: synchronized → ReentrantLock](/assets/posts/java-platform-vs-virtual-pinning.svg)

```java
// Pinning 발생 — synchronized 내 I/O
synchronized (this) {
    data = socket.read(); // 캐리어 고정!
}

// Pinning 없음 — ReentrantLock 사용
lock.lock();
try {
    data = socket.read(); // VT park, 캐리어 반환
} finally {
    lock.unlock();
}
```

### Pinning 진단

```bash
# JVM 시작 시 pinning 경고 활성화
java -Djdk.tracePinnedThreads=full -jar app.jar
```

출력 예:
```text
Thread[#123,ForkJoinPool-1-worker-1,5,CarrierThreads]
    com.example.MyService.processRequest(MyService.java:45)
    ...
```

## ThreadLocal vs ScopedValue

Virtual Thread는 `ThreadLocal`을 사용할 수 있지만, 수백만 개가 생성되면 각각 자신만의 `ThreadLocal` 값을 갖게 되어 메모리 부담이 커집니다.

```java
// ThreadLocal: 수백만 VT에서 각각 값 보유 — 메모리 부담
static final ThreadLocal<User> currentUser = new ThreadLocal<>();

// ScopedValue (Java 21, JEP 446): 불변, 상속 안 됨 → 메모리 효율적
static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

// 사용
ScopedValue.where(CURRENT_USER, user)
    .run(() -> handleRequest());
```

`ScopedValue`는 불변이며 특정 실행 범위 안에서만 유효합니다. 재진입 가능하고 VT에 최적화되어 있습니다.

## 스케줄링 차이

| | 플랫폼 스레드 | Virtual Thread |
|---|---|---|
| 스케줄러 | OS 커널 스케줄러 | JVM 내부 (`ForkJoinPool`) |
| 우선순위 | OS가 결정 | 지원하지 않음(항상 NORM) |
| 컨텍스트 스위치 | OS 수준 (~수μs) | JVM 수준 (~수십ns) |
| 데몬 여부 | 설정 가능 | 항상 데몬 |

`Thread.setPriority()`는 Virtual Thread에서 무시됩니다. Virtual Thread는 공정 스케줄링을 JVM이 직접 관리합니다.

## 사용 시나리오 가이드

**Virtual Thread가 효과적인 경우**
- 수천 ~ 수백만 개의 동시 HTTP 요청 처리 (서버)
- 데이터베이스 쿼리 동시 실행
- 외부 API 병렬 호출
- 기존 블로킹 코드 재사용

**플랫폼 스레드가 더 적합한 경우**
- CPU 집약 연산 (행렬 계산, 이미지 처리)
- 스레드 우선순위 제어가 필요한 RT 시스템
- JNI 집중 사용 코드

## 기존 코드 마이그레이션

```java
// Before: 고정 크기 스레드 풀
ExecutorService executor = Executors.newFixedThreadPool(200);

// After: Virtual Thread (한 줄 교체)
ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
```

Spring Boot 3.2+에서는 `spring.threads.virtual.enabled=true` 설정만으로 모든 요청 처리를 Virtual Thread로 전환할 수 있습니다.

---

**지난 글:** [Virtual Threads: Java 21의 경량 동시성 혁신](/posts/java-virtual-threads/)

**다음 글:** [Virtual Thread 생성과 관리 심화](/posts/java-virtual-thread-creation/)

<br>
읽어주셔서 감사합니다. 😊
