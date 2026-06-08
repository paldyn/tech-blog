---
title: "라이브락과 기아 현상: 교착 상태의 사촌들"
description: "Java 멀티스레드에서 발생하는 라이브락(Livelock)과 기아 현상(Starvation)의 원인, 증상, 랜덤 백오프·공정 락으로 해결하는 실전 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "Livelock", "Starvation", "동시성", "멀티스레드", "백오프", "공정락"]
featured: false
draft: false
---

[지난 글](/posts/java-deadlock/)에서 교착 상태(Deadlock)가 어떻게 발생하고 어떻게 예방하는지 살펴봤습니다. 이번에는 교착 상태의 사촌 격인 **라이브락(Livelock)** 과 **기아 현상(Starvation)** 을 다룹니다. 두 문제 모두 스레드가 "멈춘" 것처럼 보이지만 교착 상태와는 다른 메커니즘으로 작동하며, 그만큼 진단과 해결도 달리 접근해야 합니다.

## 라이브락이란?

교착 상태에서 스레드는 아무것도 하지 않고 그냥 블로킹됩니다. 반면 **라이브락에서 스레드는 활발히 실행되고 있지만 아무런 진전을 이루지 못합니다.** 좁은 복도에서 서로 비켜주려는 두 사람이 계속 같은 방향으로 이동하는 상황을 떠올리면 됩니다.

```java
// 라이브락 발생 예시
class BankAccount {
    private ReentrantLock lock = new ReentrantLock();
    private int balance;

    boolean transfer(BankAccount target, int amount) {
        // 두 스레드가 서로 양보하며 영원히 tryLock 실패를 반복할 수 있음
        if (this.lock.tryLock()) {
            try {
                if (target.lock.tryLock()) {
                    try {
                        this.balance -= amount;
                        target.balance += amount;
                        return true;
                    } finally {
                        target.lock.unlock();
                    }
                }
            } finally {
                this.lock.unlock();
            }
        }
        return false; // 실패 → 즉시 재시도 → 라이브락 위험
    }
}
```

스레드 A가 `accountA → accountB` 방향으로, 스레드 B가 `accountB → accountA` 방향으로 동시에 진입하면 두 스레드 모두 첫 번째 락은 잡지만 두 번째 락에서 실패하고, 첫 번째 락을 풀고 다시 시도하는 과정을 무한 반복할 수 있습니다.

![라이브락 vs 기아 현상 비교](/assets/posts/java-livelock-starvation-comparison.svg)

### 교착 상태 vs 라이브락 차이

| 특성 | 교착 상태 | 라이브락 |
|------|-----------|---------|
| 스레드 상태 | BLOCKED | RUNNABLE |
| CPU 점유 | 거의 없음 | 높음 |
| `jstack` | WAITING/BLOCKED 명확 | RUNNABLE로 표시 |
| 자동 회복 | 불가 | 상황에 따라 가능 |

## 기아 현상이란?

**기아 현상(Starvation)** 은 특정 스레드가 필요한 자원을 지속적으로 다른 스레드에게 빼앗겨 실행 기회를 얻지 못하는 상황입니다. 원인은 대부분 두 가지입니다.

1. **스레드 우선순위 남용**: 높은 우선순위 스레드가 CPU를 독점
2. **불공정 락(Unfair Lock)**: `synchronized`나 `new ReentrantLock()`(기본값 비공정)은 대기 순서를 보장하지 않음

```java
// 기아 현상을 유발하는 synchronized 블록
class SharedResource {
    synchronized void highPriorityWork() {
        // 이 메서드를 호출하는 높은 우선순위 스레드들이
        // 락을 연속으로 획득하면 낮은 우선순위 스레드는 굶는다
        Thread.sleep(100);
    }
}
```

## 라이브락 해결: 랜덤 백오프

핵심 아이디어는 **재시도 사이에 랜덤한 대기 시간을 추가해서 두 스레드가 항상 같은 타이밍에 충돌하는 패턴을 깨는 것**입니다.

```java
import java.util.Random;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

class SafeTransfer {
    private static final int MAX_RETRY = 5;
    private static final Random rand = new Random();
    private ReentrantLock lock = new ReentrantLock();
    private int balance;

    void transfer(SafeTransfer target, int amount) throws InterruptedException {
        int retries = 0;
        while (retries < MAX_RETRY) {
            if (this.lock.tryLock()) {
                try {
                    if (target.lock.tryLock()) {
                        try {
                            this.balance -= amount;
                            target.balance += amount;
                            return; // 성공
                        } finally {
                            target.lock.unlock();
                        }
                    }
                } finally {
                    this.lock.unlock();
                }
            }
            // 지수 백오프 + 랜덤 지터
            long delay = (1L << retries) * 10 + rand.nextLong(50);
            TimeUnit.MILLISECONDS.sleep(delay);
            retries++;
        }
        throw new IllegalStateException("transfer failed after " + MAX_RETRY + " retries");
    }
}
```

![랜덤 백오프로 라이브락 탈출](/assets/posts/java-livelock-starvation-backoff.svg)

지수 백오프(`1 << retries`)에 랜덤 지터(`rand.nextLong(50)`)를 더하면 두 스레드의 재시도 타이밍이 점점 어긋나게 되어 충돌 확률이 급격히 줄어듭니다. 이 패턴은 이더넷 프로토콜의 CSMA/CD에서 가져온 아이디어입니다.

## 기아 현상 해결: 공정 락

`ReentrantLock`은 생성자에 `true`를 전달하면 **공정(fair) 모드**가 활성화됩니다. 공정 모드에서는 가장 오래 대기한 스레드가 먼저 락을 획득합니다.

```java
import java.util.concurrent.locks.ReentrantLock;

class FairResource {
    // fair=true: 대기 순서(FIFO) 보장
    private final ReentrantLock fairLock = new ReentrantLock(true);

    void accessResource() {
        fairLock.lock();
        try {
            // 작업 수행
            doWork();
        } finally {
            fairLock.unlock();
        }
    }
}
```

공정 락은 기아를 방지하지만 처리량(throughput)이 비공정 락보다 낮을 수 있습니다. 내부적으로 큐 관리 오버헤드가 추가되기 때문입니다. 성능이 중요한 핫 패스에는 비공정 락 + 에이징 전략을 혼용하는 편이 낫습니다.

## 에이징(Aging): 우선순위 기반 기아 해결

JVM 스레드 우선순위는 OS 스케줄러 힌트일 뿐 보장이 없지만, 직접 작업 큐를 관리한다면 에이징 기법을 구현할 수 있습니다.

```java
import java.util.concurrent.PriorityBlockingQueue;

class AgingTask implements Comparable<AgingTask> {
    int priority;
    long waitingSince;
    Runnable task;

    AgingTask(int priority, Runnable task) {
        this.priority = priority;
        this.waitingSince = System.currentTimeMillis();
        this.task = task;
    }

    // 대기 시간 1초마다 우선순위 1씩 상향
    int effectivePriority() {
        long waited = (System.currentTimeMillis() - waitingSince) / 1000;
        return priority + (int) waited;
    }

    @Override
    public int compareTo(AgingTask other) {
        // 높은 effectivePriority가 먼저 처리됨
        return Integer.compare(other.effectivePriority(), this.effectivePriority());
    }
}
```

`PriorityBlockingQueue<AgingTask>`에 넣고 주기적으로 `effectivePriority`를 재계산하면, 오래 기다린 저우선순위 작업도 결국 처리됩니다.

## 진단: 두 문제를 어떻게 구별하나?

```bash
# 스레드 덤프 분석
jstack <PID> > thread-dump.txt
grep -E "BLOCKED|WAITING|RUNNABLE" thread-dump.txt | sort | uniq -c

# 라이브락: RUNNABLE 스레드가 CPU를 높게 점유하지만 진전 없음
# 기아:     특정 스레드 ID가 항상 BLOCKED/WAITING 상태
```

`jstack`으로 RUNNABLE인데 진전이 없는 스레드가 반복 등장하면 라이브락을 의심합니다. 반면 특정 스레드가 항상 WAITING인데 CPU 전체 사용률은 정상이면 기아를 먼저 확인합니다.

## 정리

| | 라이브락 | 기아 현상 |
|-|---------|---------|
| 원인 | 상호 양보 무한 반복 | 자원 독점·불공정 스케줄링 |
| CPU | 높음 | 정상 또는 낮음 |
| 해결 | 랜덤 백오프, 재시도 제한 | 공정 락, 에이징 |
| 탐지 | RUNNABLE + CPU 높음 | 특정 스레드 지속 대기 |

두 문제 모두 단위 테스트로 잡기 어렵고, 높은 동시성 환경에서 간헐적으로 나타납니다. 코드 리뷰 단계에서 "무한 루프 내 tryLock"과 "우선순위 설정 + synchronized 조합"을 발견하면 미리 해결해 두는 것이 최선입니다.

---

**지난 글:** [교착 상태(Deadlock) 완전 분석과 예방 전략](/posts/java-deadlock/)

**다음 글:** [Java 메모리 모델(JMM) 완전 이해](/posts/java-memory-model-jmm/)

<br>
읽어주셔서 감사합니다. 😊
