---
title: "volatile 키워드와 메모리 가시성"
description: "Java volatile 키워드의 CPU 캐시 가시성 문제 해결, happens-before 보장, 명령어 재정렬 방지, synchronized와의 차이, 이중 검사 잠금(DCL) 패턴"
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "volatile", "메모리가시성", "happens-before", "JMM", "이중검사잠금", "DCL"]
featured: false
draft: false
---

[지난 글](/posts/java-synchronized/)에서 `synchronized`의 모니터 락과 메모리 가시성 보장을 살펴봤다. 이번에는 `synchronized`보다 가볍지만 그만큼 제한적인 **`volatile` 키워드**를 다룬다. 언제 사용해야 하고 언제 사용하면 안 되는지, 흔한 오해와 함께 정리한다.

## 왜 volatile이 필요한가

멀티코어 CPU는 메인 메모리보다 빠른 **CPU 레지스터와 캐시(L1/L2/L3)**를 사용한다. JVM과 JIT 컴파일러는 성능을 위해 변수 값을 캐시에 저장하고 메인 메모리 쓰기를 지연시킬 수 있다. 그 결과, 한 스레드가 변수를 변경해도 다른 스레드가 변경된 값을 보지 못하는 **가시성(visibility) 문제**가 발생한다.

```java
class Task {
    boolean running = true; // volatile 없음

    void stop() {
        running = false; // CPU1 캐시에만 쓰일 수 있음
    }

    void run() {
        while (running) { // CPU2 캐시에서 true를 계속 읽을 수 있음
            // 무한 루프 가능
        }
    }
}
```

이론적으로 `stop()`을 호출해도 `run()`이 무한 루프를 탈출하지 않을 수 있다.

![volatile — 메모리 가시성 보장](/assets/posts/java-volatile-visibility.svg)

## volatile 선언과 보장

`volatile`을 선언하면 JVM이 두 가지를 보장한다.

1. **가시성**: 변수를 쓸 때 즉시 메인 메모리에 flush, 읽을 때 항상 메인 메모리에서 읽는다.
2. **명령어 재정렬 방지**: 컴파일러와 CPU가 `volatile` 변수 접근을 기준으로 전후 명령어 순서를 바꾸지 않는다(메모리 펜스 삽입).

```java
class Task {
    volatile boolean running = true;

    void stop() {
        running = false; // 즉시 메인 메모리에 반영
    }

    void run() {
        while (running) { // 항상 메인 메모리에서 읽음
            doWork();
        }
    }
}
```

## happens-before 규칙

Java 메모리 모델(JMM)은 `volatile` 쓰기 → 읽기에 **happens-before** 관계를 부여한다.

> `volatile` 변수에 쓰기는 그 변수를 이후에 읽는 모든 행위보다 먼저 일어난다.

이는 `volatile` 변수보다 앞서 쓴 값들도 읽기 스레드에게 보인다는 의미다.

```java
class OneTimePublisher {
    volatile boolean initialized = false;
    Object data; // volatile 아님

    void init() {
        data = new Object(); // 1
        initialized = true;  // 2: volatile write
    }

    Object get() {
        if (initialized) {   // 3: volatile read → 1이 happens-before 보장
            return data;     // 4: 최신 data 보장
        }
        return null;
    }
}
```

`initialized = true` 쓰기가 `initialized` 읽기보다 happens-before이므로, `data = new Object()` 도 읽기 쪽에서 보인다.

## volatile이 보장하지 않는 것: 원자성

`volatile`은 **단순 읽기/쓰기**만 원자적이다. 복합 연산(`count++`, `check-then-act`)은 여전히 레이스 컨디션이 발생한다.

```java
volatile int count = 0;

// 여러 스레드에서 동시 실행 — 여전히 레이스 컨디션
count++; // 실제로: 읽기 + 덧셈 + 쓰기 (세 단계)
```

`count++`는 원자적이지 않다. `AtomicInteger`나 `synchronized`를 사용해야 한다.

```java
AtomicInteger count = new AtomicInteger(0);
count.incrementAndGet(); // 원자적
```

![volatile vs synchronized 비교](/assets/posts/java-volatile-vs-sync.svg)

## 이중 검사 잠금(Double-Checked Locking)

싱글톤 패턴에서 `volatile` 없이 DCL을 구현하면 **불완전하게 초기화된 객체가 반환될 수** 있다. 이는 객체 생성이 세 단계(메모리 할당 → 초기화 → 참조 대입)이고, JVM이 재정렬해 참조 대입이 초기화보다 먼저 보일 수 있기 때문이다.

```java
// 잘못된 DCL — volatile 없이
class Singleton {
    private static Singleton instance; // 위험

    static Singleton getInstance() {
        if (instance == null) {         // 1: null 체크
            synchronized (Singleton.class) {
                if (instance == null) {
                    instance = new Singleton(); // 2: 초기화 전 참조 노출 가능
                }
            }
        }
        return instance;
    }
}
```

```java
// 올바른 DCL — volatile 사용
class Singleton {
    private static volatile Singleton instance; // volatile 필수

    static Singleton getInstance() {
        if (instance == null) {
            synchronized (Singleton.class) {
                if (instance == null) {
                    instance = new Singleton(); // volatile write → 재정렬 방지
                }
            }
        }
        return instance;
    }
}
```

더 간결한 방법은 **홀더 클래스 패턴**을 쓰는 것이다.

```java
class Singleton {
    private Singleton() {}

    private static class Holder {
        static final Singleton INSTANCE = new Singleton();
    }

    static Singleton getInstance() {
        return Holder.INSTANCE; // 클래스 로딩 시 초기화 — 스레드 안전
    }
}
```

## volatile의 올바른 사용 사례

| 사용처 | 이유 |
|---|---|
| 중단 플래그 (`boolean running`) | 단순 read/write, 원자성 불필요 |
| 1:1 게시/구독 | happens-before로 객체 게시 |
| 상태 전환 신호 | 단방향 플래그 변경 |
| DCL 싱글톤 | 재정렬 방지 |

volatile이 **부적절한** 사례:

- 카운터 (`count++`) → `AtomicInteger`
- 복합 조건 (`if (a != null && a.ready)`) → `synchronized`
- 컬렉션 요소 → `CopyOnWriteArrayList`, `ConcurrentHashMap`

## 정리

- `volatile`은 **가시성과 순서 보장**이지, 원자성 보장이 아니다.
- 단순 플래그 변수, happens-before 게시 패턴에 적합하다.
- 복합 연산이 필요하면 `AtomicXxx` 또는 `synchronized`를 사용한다.
- `volatile`은 블로킹 없이 가볍지만, 잘못 사용하면 조용한 버그를 만든다.

---

**지난 글:** [synchronized 키워드 완전 분석](/posts/java-synchronized/)

**다음 글:** [Atomic 클래스 — Lock-Free 동기화](/posts/java-atomic-classes/)

<br>
읽어주셔서 감사합니다. 😊
