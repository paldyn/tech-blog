---
title: "happens-before 규칙 완전 정복"
description: "Java 메모리 모델의 핵심 happens-before 관계를 6가지 규칙으로 정리하고, 이행성 체인을 통해 멀티스레드 코드의 안전성을 추론하는 방법을 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "happens-before", "JMM", "동시성", "volatile", "synchronized", "메모리모델"]
featured: false
draft: false
---

[지난 글](/posts/java-memory-model-jmm/)에서 JMM이 다루는 세 가지 문제(가시성·원자성·순서 재배치)를 개략적으로 살펴봤습니다. 이번에는 JMM의 핵심 형식 개념인 **happens-before** 관계를 깊이 파헤칩니다. happens-before를 이해하면 `volatile`이나 `synchronized` 없이도 어떤 코드가 안전한지, 그리고 왜 특정 패턴이 위험한지를 논리적으로 설명할 수 있습니다.

## happens-before란?

**"A happens-before B"** 는 "A 연산의 결과가 B 연산에서 반드시 보인다"는 의미입니다. 정확하게는 두 가지를 동시에 보장합니다.

1. **가시성**: A에서 쓴 값은 B에서 읽을 때 반드시 반영되어 있음
2. **순서**: A는 B보다 먼저 실행된 것처럼 관찰됨

중요한 점은 happens-before가 **실제 실행 순서가 아니라 관찰 가능한 순서**를 정의한다는 것입니다. CPU나 JIT이 내부적으로 최적화를 하더라도, happens-before 관계가 성립하는 한 프로그램은 마치 그 순서대로 실행된 것처럼 동작해야 합니다.

![happens-before 주요 규칙](/assets/posts/java-happens-before-rules.svg)

## 규칙 1: 프로그램 순서 규칙

동일 스레드 내에서, 앞서 작성된 코드는 뒤에 작성된 코드보다 먼저 발생합니다.

```java
// 같은 스레드 내에서
int x = 1;          // A
int y = x + 1;      // B
// A happens-before B → y는 반드시 2
```

이것은 당연해 보이지만, happens-before 체인을 구성하는 출발점이 됩니다.

## 규칙 2: 모니터 잠금 규칙

`synchronized` 블록 또는 메서드에서 모니터를 해제(unlock)하면, 이후에 같은 모니터를 획득(lock)하는 연산보다 먼저 발생합니다.

```java
class SharedCounter {
    private int count = 0;

    synchronized void increment() {
        count++;
    } // unlock 시점에 count++의 결과가 메모리에 플러시됨

    synchronized int get() {
        return count; // lock 획득 시점에 최신 값 로드
    }
}
```

이 규칙 때문에 `synchronized`를 올바르게 사용하면 별도의 `volatile` 없이 가시성이 보장됩니다.

## 규칙 3: volatile 변수 규칙

`volatile` 변수에 대한 쓰기는 이후 같은 변수에 대한 읽기보다 먼저 발생합니다.

```java
volatile boolean flag = false;
volatile int data = 0;

// 쓰기 스레드
void writer() {
    data = 100;       // 일반 변수 쓰기
    flag = true;      // volatile 쓰기 → 메모리 펜스
}

// 읽기 스레드
void reader() {
    if (flag) {       // volatile 읽기
        // 프로그램 순서 규칙 + volatile 규칙의 결합:
        // flag=true를 보는 시점에 data=100도 보임
        assert data == 100;
    }
}
```

`flag` 쓰기 이전의 모든 쓰기(여기서는 `data = 100`)는 `flag` 읽기 이후의 모든 읽기에서 보입니다. 이것이 volatile이 단순한 변수 이상의 역할을 하는 이유입니다.

## 규칙 4 & 5: 스레드 시작·종료 규칙

```java
int sharedValue = 0;

// 규칙 4: Thread.start() 이전의 모든 연산은
// 새 스레드 내의 모든 연산보다 먼저 발생
sharedValue = 42;
Thread t = new Thread(() -> {
    // sharedValue == 42 보장 (start() 이전에 설정했으므로)
    System.out.println(sharedValue);
});
t.start();

// 규칙 5: 스레드 t의 모든 연산은
// t.join() 반환보다 먼저 발생
t.join();
// 이 시점에서 t가 수행한 모든 쓰기가 가시화됨
```

![happens-before 체인 예시](/assets/posts/java-happens-before-chain.svg)

## 규칙 6: final 필드 초기화 규칙

생성자 내에서 `final` 필드에 쓴 값은 생성자가 완료된 후 객체 참조를 받은 모든 스레드에서 올바르게 보입니다. 이 규칙이 불변 객체(Immutable Object)의 thread-safety를 보장하는 근거입니다.

```java
class ImmutableConfig {
    final String host;
    final int port;

    ImmutableConfig(String host, int port) {
        this.host = host;  // final 필드 초기화
        this.port = port;  // 생성자 완료 후 참조 공개
    }
}

// 이렇게 안전하게 공개하면
static ImmutableConfig config = new ImmutableConfig("localhost", 8080);
// 어떤 스레드에서 config.host, config.port를 읽어도 올바른 값을 봄
```

단, 이 보장은 **생성자 내에서 this 참조가 새어나가지 않을 때**만 유효합니다.

## 이행성: 체인으로 연결하기

happens-before의 가장 강력한 특성은 **이행성**입니다.

```
A happens-before B  AND  B happens-before C
→  A happens-before C
```

```java
// 예: volatile 변수로 연결된 happens-before 체인
class Publisher {
    int value = 0;
    volatile boolean published = false;

    void publish(int v) {
        value = v;           // 1: 일반 쓰기
        published = true;    // 2: volatile 쓰기 → 1 HB 2
    }

    int read() {
        if (published) {     // 3: volatile 읽기 → 2 HB 3
            return value;    // 4: 일반 읽기 → 3 HB 4
            // 이행성: 1 HB 2 HB 3 HB 4 → 1 HB 4
            // 따라서 value는 반드시 v를 반환
        }
        return -1;
    }
}
```

## 자주 틀리는 패턴

```java
// 잘못된 예: happens-before 없음
class BrokenPublish {
    int x = 0;
    int ready = 0;

    void writer() {
        x = 42;
        ready = 1; // 일반 변수, HB 관계 없음
    }

    void reader() {
        if (ready == 1) {
            // x는 0일 수도 있음! ready=1이 먼저 보일 수 있음
            System.out.println(x);
        }
    }
}

// 올바른 예: volatile로 HB 확립
class CorrectPublish {
    int x = 0;
    volatile int ready = 0; // volatile 추가

    void writer() {
        x = 42;      // x 쓰기 HB volatile 쓰기
        ready = 1;   // volatile 쓰기
    }

    void reader() {
        if (ready == 1) { // volatile 읽기
            // x == 42 보장
            System.out.println(x);
        }
    }
}
```

## JDK 클래스의 happens-before 보장

표준 라이브러리의 많은 클래스가 문서화된 happens-before 보장을 제공합니다.

```java
// CountDownLatch
CountDownLatch latch = new CountDownLatch(1);
// latch.countDown() 이전의 연산
// HB latch.await() 반환 이후의 연산

// Future
Future<Integer> future = executor.submit(() -> {
    return compute(); // 이 연산들
});
future.get(); // HB get() 반환 이후

// BlockingQueue
BlockingQueue<Integer> queue = new LinkedBlockingQueue<>();
queue.put(42);  // put HB take
int val = queue.take(); // val == 42 보장
```

이 보장들은 `java.util.concurrent` 패키지 Javadoc에 명시되어 있으므로, 구현 세부사항에 의존하지 않고 계약에만 의존해서 코드를 작성할 수 있습니다.

## 정리

happens-before는 "이 연산의 결과가 저 연산에서 보인다"는 계약입니다. 6가지 기본 규칙과 이행성을 이해하면, `synchronized`, `volatile`, `Thread.start/join`, `CountDownLatch` 등이 왜 thread-safe한지를 직접 증명할 수 있습니다. 멀티스레드 버그를 디버깅할 때 "A와 B 사이에 happens-before가 있는가?"를 먼저 물어보는 습관을 들이면 문제의 원인을 빠르게 좁힐 수 있습니다.

---

**지난 글:** [Java 메모리 모델(JMM) 완전 이해](/posts/java-memory-model-jmm/)

**다음 글:** [ThreadLocal로 스레드별 상태 관리하기](/posts/java-thread-local/)

<br>
읽어주셔서 감사합니다. 😊
