---
title: "스레드 기초 — 동시성 프로그래밍의 시작"
description: "Java Thread 기초 완전 가이드 — 프로세스 vs 스레드, JVM 메모리 구조, Thread.State 6가지, 스레드가 필요한 이유, 플랫폼 스레드 vs 가상 스레드"
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "Thread", "동시성", "스레드", "멀티스레딩", "Thread.State", "플랫폼스레드", "가상스레드"]
featured: false
draft: false
---

[지난 글](/posts/java-record-serialization/)에서 레코드와 직렬화를 마무리했다. 이번부터는 Java 동시성 프로그래밍을 다룬다. **스레드(Thread)**는 Java 동시성의 가장 기본 단위다 — 멀티코어를 활용하고, I/O 대기 중 다른 작업을 계속하며, 응답성 높은 애플리케이션을 만들기 위한 핵심 기법이다.

## 프로세스 vs 스레드

**프로세스**는 독립된 메모리 공간을 가진 실행 단위다. 프로세스 간에는 메모리를 공유하지 않으므로 통신에 IPC(파이프, 소켓, 공유 메모리)가 필요하다. **스레드**는 프로세스 안에서 실행되는 경량 실행 단위다. 같은 프로세스의 스레드들은 힙 메모리와 클래스 로딩 정보를 공유하되, 스택과 PC 레지스터는 각자 독립적으로 가진다.

![프로세스 vs 스레드 구조](/assets/posts/java-threads-basics-arch.svg)

## JVM과 스레드 메모리 구조

JVM 명세는 스레드마다 독립적인 세 가지 메모리 영역을 정의한다.

| 영역 | 스코프 | 내용 |
|------|--------|------|
| PC Register | 스레드 고유 | 다음 실행할 명령 주소 |
| JVM Stack | 스레드 고유 | 메서드 호출 프레임, 지역 변수 |
| Native Method Stack | 스레드 고유 | JNI 메서드 실행용 |

힙, 메서드 영역(클래스 정보), 런타임 상수 풀은 모든 스레드가 공유한다. **공유 힙에서 동시 접근이 경쟁 조건(Race Condition)의 원인**이 된다.

## Thread.State — 6가지 상태

JDK의 `Thread.State` 열거형은 스레드 생명주기를 6가지로 정의한다.

![Thread 상태 전이도](/assets/posts/java-threads-basics-lifecycle.svg)

```java
Thread t = Thread.ofPlatform().start(() -> {
    try { Thread.sleep(1000); } catch (InterruptedException e) {}
});

// 현재 상태 조회
Thread.State state = t.getState();
System.out.println(state); // TIMED_WAITING
```

`Thread.getState()`는 스레드 덤프·모니터링 도구에서 병목 진단에 활용된다. 스레드 대부분이 `BLOCKED` 또는 `WAITING` 상태라면 락 경쟁이나 대기 문제를 의심한다.

## 왜 스레드를 사용하는가

### 1. 멀티코어 CPU 활용

단일 스레드 프로그램은 코어 하나만 사용한다. 8코어 CPU에서 CPU 집약 작업을 8개 스레드로 분할하면 이론적으로 8배 처리량을 얻는다.

### 2. I/O 대기 중 다른 작업 수행

파일 읽기, DB 쿼리, 네트워크 요청 중 스레드는 대부분 블로킹 대기한다. 별도 스레드에서 I/O를 처리하면 메인 스레드가 다른 요청을 계속 처리할 수 있다.

```java
// I/O를 별도 스레드에서 수행
Thread ioThread = Thread.ofPlatform().start(() -> {
    byte[] data = Files.readAllBytes(Path.of("large.dat")); // 블로킹 OK
    processData(data);
});

// 메인 스레드는 계속 요청 처리
handleOtherRequests();
```

### 3. 응답성 (UI, 서버)

GUI 애플리케이션에서 무거운 작업을 메인 스레드에서 실행하면 UI가 멈춘다. 웹 서버에서 각 요청을 독립 스레드에서 처리하면 다른 요청이 지연되지 않는다.

## 플랫폼 스레드 vs 가상 스레드 (Java 21+)

Java는 두 종류의 스레드를 제공한다.

| 항목 | 플랫폼 스레드 | 가상 스레드 |
|------|-------------|------------|
| OS 스레드 | 1:1 매핑 | M:N (다수 → 소수) |
| 스택 크기 | ~1MB | 작고 동적 |
| 최대 수 | 수천 개 | 수백만 개 |
| 블로킹 | OS 스레드 블로킹 | 캐리어 스레드 해방 |
| 사용 API | 동일 (`Thread`) | 동일 (`Thread`) |

```java
// 플랫폼 스레드 (Java 21 새 API)
Thread platform = Thread.ofPlatform()
    .name("worker-1")
    .start(() -> doWork());

// 가상 스레드 (Java 21)
Thread virtual = Thread.ofVirtual()
    .name("vt-1")
    .start(() -> doWork());
```

가상 스레드는 블로킹 I/O 시 OS 스레드를 점유하지 않고 해방한다. 이 덕분에 요청 수 = 스레드 수 모델(thread-per-request)을 가상 스레드로 구현해도 수천만 동시 요청을 처리할 수 있다.

## 동시성의 위험

스레드 간 공유 힙 접근은 경쟁 조건을 만든다.

```java
int count = 0; // 힙에 저장

// Thread 1: count++
// Thread 2: count++

// 예상: count = 2
// 실제(경쟁 조건): count = 1 가능
// 이유: count++ = 읽기 + 증가 + 쓰기 (3단계, 원자적이지 않음)
```

이 문제를 해결하기 위해 `synchronized`, `volatile`, `AtomicInteger`, `Lock` 등의 동기화 도구가 필요하다. 다음 포스트에서 `Thread` 클래스와 `Runnable` 인터페이스로 스레드를 직접 생성하고 다루는 방법을 다룬다.

## 스레드 생성 API 미리보기

스레드를 만드는 방법은 크게 세 가지다.

```java
// 1. Thread 클래스 직접
Thread t1 = new Thread(() -> System.out.println("Hello"));
t1.start();

// 2. Runnable 구현
Runnable task = () -> System.out.println("Hello");
new Thread(task).start();

// 3. 스레드 팩토리 (Java 21, 권장)
Thread t3 = Thread.ofPlatform().name("my-thread").start(task);
Thread t4 = Thread.ofVirtual().name("vt").start(task);
```

실전에서는 직접 `Thread`를 만들기보다 `ExecutorService`나 가상 스레드 풀을 사용한다. 하지만 기본 원리를 이해하기 위해 `Thread` 클래스부터 시작한다.

## 핵심 정리

- 스레드는 프로세스 내 경량 실행 단위 — 힙 공유, 스택은 독립
- `Thread.State` 6가지: NEW → RUNNABLE → BLOCKED/WAITING/TIMED_WAITING → TERMINATED
- 스레드가 필요한 이유: 멀티코어 활용, I/O 대기 시간 활용, 응답성 향상
- 플랫폼 스레드: OS 스레드 1:1, 가상 스레드(Java 21+): M:N, 수백만 개 가능
- 공유 힙 = 경쟁 조건의 온상 → 동기화 필수

---

**지난 글:** [레코드와 직렬화 — Record Serialization](/posts/java-record-serialization/)

**다음 글:** [Runnable과 Thread — 스레드 생성과 제어](/posts/java-runnable-thread/)

<br>
읽어주셔서 감사합니다. 😊
