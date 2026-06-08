---
title: "Java 메모리 모델(JMM) 완전 이해"
description: "JMM이 정의하는 가시성·원자성·순서 재배치 세 가지 문제와 volatile·synchronized·happens-before 규칙으로 멀티스레드 코드를 안전하게 작성하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "JMM", "메모리모델", "volatile", "happens-before", "동시성", "멀티스레드"]
featured: false
draft: false
---

[지난 글](/posts/java-livelock-starvation/)에서 라이브락과 기아 현상을 살펴봤습니다. 이번에는 Java 동시성의 가장 근본적인 기반인 **Java 메모리 모델(Java Memory Model, JMM)** 을 다룹니다. JMM을 이해해야만 `volatile`이 왜 필요한지, `synchronized`가 실제로 무엇을 보장하는지, 그리고 멀티스레드 코드에서 발생하는 수수께끼 같은 버그들의 원인을 설명할 수 있습니다.

## JMM이란?

**Java 메모리 모델(JMM)** 은 Java 프로그램이 멀티스레드 환경에서 공유 메모리에 접근할 때 어떤 규칙을 따르는지 정의한 명세입니다. JDK 5와 함께 JSR-133(Java Specification Request 133)으로 대폭 개정되어 현재 형태를 갖췄습니다.

JMM이 등장한 배경은 **하드웨어의 현실** 때문입니다. 현대 CPU는 성능을 위해 다음 세 가지를 적극 활용합니다.

1. **캐시**: 메인 메모리 접근 비용을 줄이기 위해 레지스터, L1/L2/L3 캐시를 사용
2. **쓰기 버퍼**: 쓰기 연산을 모아서 한꺼번에 플러시
3. **명령어 재배치(Reordering)**: 컴파일러·JIT·CPU 모두 의존성이 없는 명령은 순서를 바꿔 실행

단일 스레드에서는 이런 최적화가 결과를 바꾸지 않지만, **멀티스레드에서는 한 스레드의 쓰기가 다른 스레드에게 언제, 어떤 순서로 보이는지를 보장할 수 없게 됩니다.**

![Java 메모리 모델 개요](/assets/posts/java-memory-model-jmm-overview.svg)

## 세 가지 핵심 문제

### 1. 가시성(Visibility)

한 스레드에서 쓴 값이 다른 스레드에서 즉시 보이지 않을 수 있습니다.

```java
class VisibilityProblem {
    // volatile 없으면 Thread2에서 변경이 보이지 않을 수 있음
    private boolean stopRequested = false;

    void startWorker() {
        Thread worker = new Thread(() -> {
            while (!stopRequested) { // 무한 루프 위험
                // 작업 수행
            }
        });
        worker.start();
    }

    void stop() {
        stopRequested = true; // 메인 스레드의 캐시에만 반영될 수 있음
    }
}
```

`stopRequested`가 `volatile`이 아니면, JIT 컴파일러가 `while (!stopRequested)` 루프를 최적화해서 `while (true)`로 바꿔버릴 수 있습니다. 실제로 자주 보고되는 버그입니다.

### 2. 원자성(Atomicity)

Java에서 `int`, `boolean`, 참조 타입에 대한 읽기·쓰기는 원자적이지만, **`long`과 `double`은 64비트 값이라 32비트 플랫폼에서 두 번의 32비트 연산으로 분할될 수 있습니다.** 또한 복합 연산(`i++`)은 읽기-수정-쓰기 세 단계로 나뉘어 절대로 원자적이지 않습니다.

```java
// i++는 원자적이지 않음
// 실제로는: int temp = i; temp = temp + 1; i = temp;
// 두 스레드가 동시에 실행하면 증가 하나가 사라질 수 있음
private int counter = 0;
void increment() { counter++; } // 위험!

// AtomicInteger로 해결
private AtomicInteger counter = new AtomicInteger(0);
void increment() { counter.incrementAndGet(); } // 안전
```

### 3. 순서 재배치(Reordering)

컴파일러와 CPU는 의존성이 없다고 판단하면 명령 순서를 바꿉니다. 단일 스레드에서는 결과가 같지만, 멀티스레드에서는 심각한 문제가 됩니다.

![명령어 재배치와 volatile 해결](/assets/posts/java-memory-model-jmm-reordering.svg)

## volatile: 가시성과 재배치 방지

`volatile` 키워드는 두 가지를 보장합니다.

1. **가시성**: volatile 변수에 대한 쓰기는 즉시 메인 메모리에 플러시되고, 읽기는 항상 메인 메모리에서 가져옴
2. **재배치 금지**: volatile 쓰기 이전의 모든 쓰기는 volatile 쓰기 이후에 다른 스레드에서 반드시 보임 (메모리 펜스)

```java
class PublicationSafe {
    private int data;
    private volatile boolean initialized = false;

    void init(int value) {
        this.data = value;          // happens-before
        this.initialized = true;    // volatile write (펜스)
    }

    int read() {
        if (initialized) {          // volatile read
            return data;            // data = value 보장
        }
        return -1;
    }
}
```

`volatile`은 단일 변수의 읽기·쓰기에 대한 원자성을 보장하지만, **복합 연산(check-then-act)에는 충분하지 않습니다.** 그런 경우에는 `synchronized`나 `Atomic` 클래스를 사용해야 합니다.

## synchronized: 원자성 + 가시성 + 순서 모두 보장

`synchronized` 블록은 훨씬 강한 보장을 제공합니다.

```java
class Counter {
    private int value = 0;

    synchronized void increment() {
        value++;
    }

    synchronized int get() {
        return value;
    }
}
```

`synchronized`가 보장하는 것:
- **모니터 획득 시**: 다른 스레드의 최신 쓰기를 모두 가시화 (invalidate cache)
- **모니터 해제 시**: 현재 스레드의 모든 쓰기를 메인 메모리에 플러시

이 때문에 `synchronized`를 쓰면 `volatile`은 별도로 필요하지 않습니다. 단, 성능 비용이 있으므로 필요 범위를 좁히는 것이 중요합니다.

## JMM의 형식적 정의: happens-before

JMM은 `happens-before`라는 개념으로 스레드 간 연산 순서를 정의합니다. "A happens-before B"란 A의 결과가 B에서 반드시 보인다는 의미입니다. 주요 규칙은 다음과 같습니다.

```
1. 프로그램 순서 규칙:
   동일 스레드 내에서 앞선 연산 → 뒤따르는 연산

2. 모니터 잠금 규칙:
   unlock → 이후의 같은 모니터 lock

3. volatile 변수 규칙:
   volatile 쓰기 → 이후의 volatile 읽기

4. 스레드 시작 규칙:
   Thread.start() → 새 스레드의 모든 연산

5. 스레드 종료 규칙:
   스레드의 모든 연산 → Thread.join() 반환

6. 인터럽트 규칙:
   interrupt() 호출 → interrupted() 감지

7. 초기화 규칙:
   final 필드 초기화 → 객체 참조 공개 이후 읽기
```

```java
// happens-before 체인 예시
Thread t = new Thread(() -> {
    // Thread.start() happens-before 여기의 모든 코드
    System.out.println(sharedValue); // 안전하게 읽을 수 있음
});
sharedValue = 42;    // start() 이전 쓰기
t.start();           // start() → 스레드 내부 happens-before
t.join();            // 스레드 내부 → join() 이후 happens-before
System.out.println(result); // 스레드에서 쓴 결과를 안전하게 읽음
```

## final 필드의 특별한 보장

`final` 필드는 JMM에서 특별하게 다뤄집니다. 생성자 내에서 `final` 필드에 쓴 값은, 생성자가 완료된 후 객체 참조를 받은 모든 스레드에서 올바르게 보입니다. 이 보장은 추가적인 동기화 없이도 유효합니다.

```java
class ImmutablePoint {
    final int x;
    final int y;

    ImmutablePoint(int x, int y) {
        this.x = x; // final 필드 초기화
        this.y = y; // 생성자 완료 후 다른 스레드에서 안전하게 읽힘
    }
}
// 참조 공개만 안전하게 하면 x, y는 항상 올바름
```

## 정리: 언제 무엇을 쓸까?

| 요구사항 | 해결책 |
|---------|--------|
| 단순 플래그 공유 | `volatile boolean` |
| 카운터 (단일 연산) | `AtomicInteger` |
| 복합 연산 (읽기+쓰기) | `synchronized` |
| 여러 변수의 일관성 | `synchronized` (같은 모니터) |
| 불변 공유 객체 | `final` 필드 |

JMM은 처음에는 추상적으로 느껴지지만, 결국 **"어떤 쓰기가 어떤 읽기에 보이는가"** 라는 질문에 대한 명확한 답을 제공하는 계약서입니다. 이 계약을 지키는 코드가 바로 스레드-안전한(thread-safe) 코드입니다.

---

**지난 글:** [라이브락과 기아 현상: 교착 상태의 사촌들](/posts/java-livelock-starvation/)

**다음 글:** [happens-before 규칙 완전 정복](/posts/java-happens-before/)

<br>
읽어주셔서 감사합니다. 😊
