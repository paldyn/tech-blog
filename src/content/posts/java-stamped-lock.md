---
title: "StampedLock — 낙관적 읽기와 락 변환"
description: "Java StampedLock의 3가지 모드(Write/Read/Optimistic Read), 스탬프 기반 락 관리, 낙관적 읽기 패턴, ReentrantReadWriteLock과 성능 비교, 재진입 불가 주의사항"
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "StampedLock", "낙관적읽기", "OptimisticRead", "ReadWriteLock", "락변환", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/java-locks/)에서 `ReentrantLock`과 `ReadWriteLock`을 다뤘다. 이번에는 Java 8에서 추가된 **`StampedLock`**을 살펴본다. `ReentrantReadWriteLock`보다 복잡하지만, 읽기가 압도적으로 많은 환경에서 **낙관적 읽기(Optimistic Read)** 모드를 통해 락 없이 읽기를 시도해 성능을 크게 향상시킬 수 있다.

## 스탬프(Stamp) 개념

`StampedLock`의 모든 락 획득/해제 메서드는 `long` 타입의 **스탬프**를 사용한다. 스탬프는 특정 락 획득의 상태를 표현하는 토큰이다.

- `0`이 반환되면 락 획득 실패를 의미한다.
- 락을 해제할 때는 획득 시 반환된 스탬프를 그대로 전달해야 한다.
- 스탬프를 잘못 사용하거나 해제 후 재사용하면 `IllegalMonitorStateException`이 발생한다.

![StampedLock 3가지 모드](/assets/posts/java-stamped-lock-modes.svg)

## 3가지 모드

### Write Mode

배타적 쓰기 락이다. `synchronized`나 `ReentrantLock`과 동일한 배타 보장을 제공하지만, 재진입할 수 없다.

```java
StampedLock sl = new StampedLock();

long stamp = sl.writeLock();
try {
    x = newX;
    y = newY;
} finally {
    sl.unlockWrite(stamp);
}
```

### Read Mode

여러 스레드가 동시에 읽기 가능한 공유 락이다. 쓰기 락과 배타적이다.

```java
long stamp = sl.readLock();
try {
    return Math.hypot(x, y);
} finally {
    sl.unlockRead(stamp);
}
```

### Optimistic Read Mode (핵심)

락을 획득하지 않고 스탬프만 채취한다. 이후 `validate(stamp)`로 읽는 동안 쓰기가 없었는지 확인한다. 쓰기 없으면 읽은 값을 사용하고, 쓰기가 있었으면 Read Mode로 폴백한다.

```java
double distanceFromOrigin() {
    // 1단계: 낙관적 읽기 — 락 없음
    long stamp = sl.tryOptimisticRead();
    double curX = x, curY = y;  // 로컬 변수에 복사 (필수)

    // 2단계: 읽는 사이 쓰기가 없었는지 검증
    if (!sl.validate(stamp)) {
        // 3단계: 검증 실패 → 읽기 락으로 폴백
        stamp = sl.readLock();
        try {
            curX = x;
            curY = y;
        } finally {
            sl.unlockRead(stamp);
        }
    }
    return Math.hypot(curX, curY);
}
```

이 패턴의 포인트: 쓰기가 드물면 `validate(stamp)`가 거의 항상 성공해 락 비용 없이 읽기가 가능하다. 쓰기 경합이 많으면 폴백이 자주 발생해 오히려 overhead가 생긴다.

## 락 변환

스탬프를 다른 모드로 변환하는 메서드를 제공한다.

```java
// 읽기 → 쓰기 업그레이드 시도
long stamp = sl.readLock();
try {
    while (x < 0) {
        long ws = sl.tryConvertToWriteLock(stamp);
        if (ws != 0L) {         // 변환 성공
            stamp = ws;
            x = 1;
            break;
        } else {                 // 변환 실패 — 읽기 해제 후 쓰기 획득
            sl.unlockRead(stamp);
            stamp = sl.writeLock();
        }
    }
    return x;
} finally {
    sl.unlock(stamp); // 어떤 모드든 해제
}
```

`tryConvertToWriteLock()`이 `0`을 반환하면 다른 읽기 스레드가 있어 변환 불가. 이 경우 읽기 락을 해제하고 쓰기 락을 직접 획득한다.

## ⚠ 재진입 불가

`StampedLock`은 `ReentrantLock`과 달리 재진입을 지원하지 않는다. 같은 스레드가 이미 보유한 락을 다시 획득하려 하면 교착 상태가 된다.

```java
// 위험 — 재진입 교착
long stamp1 = sl.writeLock();
try {
    long stamp2 = sl.writeLock(); // 교착! (자기 자신을 기다림)
    ...
} finally {
    sl.unlockWrite(stamp1);
}
```

## 낙관적 읽기 시 주의사항

낙관적 읽기는 락 없이 진행하므로, 다른 스레드의 쓰기가 동시에 발생할 수 있다. 따라서 읽은 값을 **반드시 로컬 변수에 복사**한 후, `validate()` 이후에만 사용해야 한다.

```java
// 잘못된 예 — validate 전에 값 사용
long stamp = sl.tryOptimisticRead();
return Math.hypot(x, y); // x, y가 쓰기와 레이스 가능
// validate 생략 → 불일관성

// 올바른 예
long stamp = sl.tryOptimisticRead();
double cx = x, cy = y;  // 복사
if (!sl.validate(stamp)) {
    stamp = sl.readLock();
    try { cx = x; cy = y; } finally { sl.unlockRead(stamp); }
}
return Math.hypot(cx, cy); // 검증된 로컬 복사본 사용
```

![StampedLock vs ReadWriteLock 성능 비교](/assets/posts/java-stamped-lock-perf.svg)

## 완전한 예시: 좌표 클래스

```java
class Point {
    private double x, y;
    private final StampedLock sl = new StampedLock();

    void move(double deltaX, double deltaY) {
        long stamp = sl.writeLock();
        try {
            x += deltaX;
            y += deltaY;
        } finally {
            sl.unlockWrite(stamp);
        }
    }

    double distanceFromOrigin() {
        long stamp = sl.tryOptimisticRead();
        double curX = x, curY = y;
        if (!sl.validate(stamp)) {
            stamp = sl.readLock();
            try { curX = x; curY = y; }
            finally { sl.unlockRead(stamp); }
        }
        return Math.hypot(curX, curY);
    }
}
```

이 예시는 JDK `StampedLock` Javadoc의 공식 예시를 기반으로 한 것이다.

## 언제 StampedLock을 사용하나

- **읽기가 압도적으로 많고 쓰기가 드문** 경우
- 재진입이 필요 없는 단순 패턴
- 극한 성능이 필요한 내부 데이터 구조

단순 구현이 필요하거나 재진입, Condition 변수가 필요하면 `ReentrantReadWriteLock`이 더 적합하다.

---

**지난 글:** [Lock 인터페이스 — ReentrantLock 완전 가이드](/posts/java-locks/)

**다음 글:** [Condition 변수로 구현하는 생산자-소비자 패턴](/posts/java-condition/)

<br>
읽어주셔서 감사합니다. 😊
