---
title: "Virtual Thread Pinning 심화 분석과 해결 전략"
description: "Virtual Thread가 Carrier 스레드에 고정(Pinned)되는 조건, JFR로 Pinning을 탐지하는 방법, ReentrantLock 교체 및 Java 23 JEP 491 업그레이드 전략을 상세히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "Virtual Threads", "Pinning", "JFR", "ReentrantLock", "JEP491", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/java-structured-concurrency/)에서 Structured Concurrency로 여러 Virtual Thread를 안전하게 묶어 관리하는 방법을 살펴봤습니다. Virtual Thread의 가장 큰 장점은 I/O 블로킹 시 Carrier 스레드를 해방해 다른 작업을 처리하는 것인데, **Pinning**이 발생하면 이 메커니즘이 깨져 처리량이 급격히 떨어집니다. 이번 글에서는 Pinning이 발생하는 정확한 조건과 이를 탐지하고 해결하는 전략을 깊이 있게 다룹니다.

## Pinning이란

Virtual Thread는 실행 중 I/O 블로킹이 발생하면 **Carrier Thread(OS 스레드)에서 분리(unmount)** 되고, 블로킹이 끝나면 다시 올라탑니다(mount). 이 덕분에 소수의 Carrier 스레드로 수백만 개의 Virtual Thread를 처리할 수 있습니다.

**Pinning**은 Virtual Thread가 Carrier에서 분리되지 못하고 **고정된 채로 블로킹**되는 상태입니다. Carrier 스레드 전체가 함께 묶여 버려, 해당 스레드가 다른 Virtual Thread를 처리하지 못하게 됩니다.

![Virtual Thread Pinning 메커니즘](/assets/posts/java-virtual-thread-pinning-mechanism.svg)

### Pinning 발생 조건

Pinning은 두 가지 상황에서 발생합니다.

**1. `synchronized` 블록/메서드 내 블로킹 (Java 21~22)**

```java
// ❌ Carrier Thread가 함께 블로킹됨 (Java 21~22)
synchronized (lock) {
    byte[] buf = new byte[4096];
    socket.getInputStream().read(buf); // I/O → Carrier 고정
}
```

`synchronized`는 JVM 내부적으로 monitor 잠금을 사용하는데, Java 21~22까지는 monitor 보유 중에 Virtual Thread를 unmount할 수 없었습니다.

**2. Native Frame (JNI 코드)의 존재**

```java
// ❌ native 메서드 호출 스택에서 블로킹 — 버전 무관
nativeMethod(); // native frame 포함 스택 → 항상 Pinned
```

JNI native frame이 콜 스택에 존재하면 스택 포인터를 안전하게 교체할 수 없어 unmount가 불가능합니다. Java 버전에 관계없이 이 제약은 유지됩니다.

## Pinning 탐지 방법

![Pinning 탐지 및 해결 전략](/assets/posts/java-virtual-thread-pinning-detection.svg)

### JVM 플래그로 스택 추적

개발 환경에서는 다음 플래그로 Pinning 발생 즉시 스택 트레이스를 출력할 수 있습니다.

```bash
# full: 전체 스택, short: 핵심 프레임만
java -Djdk.tracePinnedThreads=full -jar app.jar
```

출력 예시:

```text
Thread[#22,ForkJoinPool-1-worker-1,5,main]
    java.base/java.lang.VirtualThread$PinnedScope.block(VirtualThread.java)
    com.example.UserService.loadUser(UserService.java:42)
    ...
    <== monitors:1
```

`<== monitors:1`이 표시되면 `synchronized` 잠금이 Pinning 원인입니다.

### JFR(Java Flight Recorder) 이벤트 수집

프로덕션 환경에서는 JFR의 `jdk.VirtualThreadPinned` 이벤트를 활용합니다.

```bash
# JFR 수집 시작
jcmd <pid> JFR.start name=pin duration=60s \
  settings=profile filename=pinning.jfr

# 덤프 후 분석
jcmd <pid> JFR.dump name=pin filename=pinning.jfr
```

JFR 파일 분석 코드:

```java
Path jfrPath = Path.of("pinning.jfr");
try (RecordingFile rf = new RecordingFile(jfrPath)) {
    rf.readAllEvents().stream()
        .filter(e -> "jdk.VirtualThreadPinned"
                     .equals(e.getEventType().getName()))
        .forEach(e -> {
            System.out.println("Duration: " + e.getDuration());
            System.out.println("Stack: " + e.getStackTrace());
        });
}
```

이벤트에는 스레드 ID, 지속 시간, 스택 트레이스가 포함되어 있어 어느 코드 경로에서 Pinning이 발생하는지 정확히 파악할 수 있습니다.

## 해결 전략

### 전략 1 — `synchronized` → `ReentrantLock` 교체 (Java 21~22)

Java 21~22를 사용 중이라면 `synchronized` 대신 `java.util.concurrent.locks.ReentrantLock`을 사용합니다.

```java
import java.util.concurrent.locks.ReentrantLock;

public class UserService {
    private final ReentrantLock lock = new ReentrantLock();

    public User loadUser(long id) {
        lock.lock();
        try {
            // I/O 블로킹이 발생해도 Carrier Thread 해방 가능
            return repository.findById(id);
        } finally {
            lock.unlock();
        }
    }
}
```

`ReentrantLock`은 `LockSupport.park()`를 사용하므로 Virtual Thread가 정상적으로 unmount됩니다.

### 전략 2 — Java 23 이상으로 업그레이드 (JEP 491)

Java 23에서 **JEP 491**이 구현되어 `synchronized` 블록/메서드 내 블로킹 I/O에서도 Pinning이 발생하지 않게 됐습니다. `synchronized`의 monitor 잠금을 Virtual Thread가 unmount되는 동안에도 보유할 수 있도록 JVM 내부를 재설계했습니다.

```java
// Java 23+에서는 아무 문제 없음
synchronized (lock) {
    socket.getInputStream().read(buf); // Pinning 없음
}
```

신규 프로젝트라면 Java 23+(또는 LTS 관점에서 Java 25) 사용을 권장합니다.

### 전략 3 — native/JNI 코드 격리

native frame 기반 Pinning은 어느 버전에서도 해결되지 않습니다. native 메서드를 호출해야 할 때는 Virtual Thread 대신 **Platform Thread 전용 풀**을 사용합니다.

```java
ExecutorService nativePool = Executors.newFixedThreadPool(
    Runtime.getRuntime().availableProcessors()
);

CompletableFuture.supplyAsync(() -> {
    // native 코드 실행 — platform thread에서
    return nativeLibrary.process(data);
}, nativePool).thenAccept(result -> {
    // Virtual Thread에서 후속 처리
    virtualPool.execute(() -> handleResult(result));
});
```

### 전략 4 — Carrier Pool 크기 임시 조정

근본 해결이 아닌 임시방편이지만, Pinning이 발생하더라도 다른 Virtual Thread가 실행될 Carrier를 확보할 수 있습니다.

```bash
-Djdk.virtualThreadScheduler.maxPoolSize=256
```

기본값은 CPU 코어 수이며, Pinning이 많은 환경에서는 이 값을 늘려 처리량 저하를 완화할 수 있습니다. 단, 이는 OS 스레드 수를 늘리는 것이므로 메모리 부담이 증가합니다.

## Pinning 위험도 판단 기준

모든 Pinning이 위험한 것은 아닙니다. 짧은 CPU-bound 연산 중 Pinning은 실질적 영향이 미미합니다. 문제가 되는 경우는 다음과 같습니다.

- Pinning 지속 시간이 **수십 ms 이상**인 경우
- 동시 Pinning 수가 **Carrier Pool 크기에 근접**하는 경우
- Pinning 중 추가 Virtual Thread 생성이 **큐에서 대기**하는 경우

JFR의 `jdk.VirtualThreadPinned` 이벤트 `duration` 필드를 기준으로 임계값(`>20ms`)을 초과하는 이벤트에 집중하는 것이 효과적입니다.

---

**지난 글:** [Structured Concurrency로 안전한 비동기 구조 만들기](/posts/java-structured-concurrency/)

**다음 글:** [Virtual Thread 운영 모범 사례](/posts/java-virtual-thread-best-practices/)

<br>
읽어주셔서 감사합니다. 😊
