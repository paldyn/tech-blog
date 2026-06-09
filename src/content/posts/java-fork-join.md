---
title: "Fork/Join 프레임워크 완전 정복"
description: "Java 7에서 도입된 Fork/Join 프레임워크의 분할 정복 패턴, Work-Stealing 알고리즘, ForkJoinPool 설정, 그리고 병렬 스트림과의 관계를 실전 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "ForkJoin", "ForkJoinPool", "Work-Stealing", "병렬처리", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/java-completion-service/)에서 완료 순서로 결과를 수집하는 `CompletionService`를 살펴봤습니다. 이번에는 완전히 다른 병렬 처리 전략인 **Fork/Join 프레임워크**를 다룹니다. 큰 문제를 재귀적으로 작은 부분으로 나눠 병렬 처리하고, 결과를 다시 합치는 **분할 정복(Divide and Conquer)** 패턴에 최적화된 Java 7의 선물입니다.

## Fork/Join이란

`java.util.concurrent.ForkJoinPool`은 **Work-Stealing** 알고리즘을 사용하는 특수한 스레드 풀입니다. 각 스레드는 자신만의 작업 덱(Deque)을 갖고, 할 일이 없을 때는 다른 스레드의 덱 끝에서 작업을 훔쳐(steal)와 처리합니다. 덕분에 불균등한 작업 크기에도 CPU를 최대한 활용할 수 있습니다.

핵심 구성 요소:

| 클래스 | 역할 |
|---|---|
| `ForkJoinPool` | Work-Stealing 스레드 풀 |
| `ForkJoinTask<V>` | 분할 가능한 작업의 추상 기반 |
| `RecursiveTask<V>` | 결과를 반환하는 재귀 작업 |
| `RecursiveAction` | 결과 없는 재귀 작업 |

## 분할 정복 트리

![Fork/Join 분할 정복 트리](/assets/posts/java-fork-join-tree.svg)

배열 합산 문제를 예로 들면, 임계값(threshold)보다 큰 범위는 반으로 분할하여 `fork()`를 호출하고, 임계값 이하가 되면 직접 계산합니다. 각 서브태스크가 완료되면 `join()`으로 결과를 병합합니다.

## Work-Stealing 알고리즘

![Work-Stealing 알고리즘](/assets/posts/java-fork-join-workstealing.svg)

각 스레드는 자신의 덱 앞쪽(LIFO)에서 작업을 꺼내 처리합니다. 유휴 스레드는 다른 스레드의 덱 뒤쪽(FIFO)에서 훔쳐옵니다. LIFO/FIFO를 동시에 사용함으로써 두 스레드 간의 경합을 최소화합니다.

## RecursiveTask 기본 예

```java
import java.util.concurrent.*;

class SumTask extends RecursiveTask<Long> {
    private static final int THRESHOLD = 1_000;
    private final long[] arr;
    private final int lo, hi;

    SumTask(long[] arr, int lo, int hi) {
        this.arr = arr; this.lo = lo; this.hi = hi;
    }

    @Override
    protected Long compute() {
        if (hi - lo <= THRESHOLD) {
            long sum = 0;
            for (int i = lo; i < hi; i++) sum += arr[i];
            return sum;
        }
        int mid = (lo + hi) >>> 1;
        SumTask left  = new SumTask(arr, lo, mid);
        SumTask right = new SumTask(arr, mid, hi);
        left.fork();                    // 비동기 제출
        long rightResult = right.compute(); // 현재 스레드에서 실행
        long leftResult  = left.join(); // 왼쪽 결과 대기
        return leftResult + rightResult;
    }
}
```

`fork()` + `join()` 패턴에서 **한 쪽은 `compute()`로 직접 실행**하는 것이 핵심입니다. 두 쪽 모두 `fork()`하면 현재 스레드가 놀게 되어 효율이 떨어집니다.

## ForkJoinPool 사용

```java
ForkJoinPool pool = new ForkJoinPool();            // CPU 수 = 병렬도
// 또는
ForkJoinPool pool = new ForkJoinPool(4);           // 명시적 병렬도

long[] data = LongStream.range(1, 1_000_001).toArray();
SumTask task = new SumTask(data, 0, data.length);
long result = pool.invoke(task); // 완료 시까지 블로킹
System.out.println(result); // 500000500000
pool.shutdown();
```

`invoke()` 외에 비동기 제출이 필요하면 `submit()`, 단방향 실행이면 `execute()`를 씁니다.

## 공용 풀 (Common Pool)

Java 8부터 JVM이 기본으로 제공하는 `ForkJoinPool.commonPool()`을 사용할 수 있습니다. 병렬 스트림(`parallelStream()`)도 이 공용 풀을 공유합니다.

```java
long result = ForkJoinPool.commonPool()
    .invoke(new SumTask(data, 0, data.length));
```

공용 풀의 병렬도는 `Runtime.getRuntime().availableProcessors() - 1`입니다. 시스템 속성 `-Djava.util.concurrent.ForkJoinPool.common.parallelism=N`으로 조정할 수 있습니다.

## 임계값 설정 지침

임계값이 너무 작으면 태스크 생성·스케줄링 오버헤드가 커지고, 너무 크면 병렬성이 줄어듭니다.

```java
// 실용적인 임계값 계산 예
int threshold = Math.max(arr.length / (ForkJoinPool.commonPool().getParallelism() * 4), 100);
```

JMH로 실제 측정 후 결정하는 것이 가장 안전합니다.

## 언제 Fork/Join을 쓸까

**적합한 경우**
- CPU 바운드 연산(정렬, 검색, 수치 계산)을 멀티코어로 가속할 때
- 작업 크기가 균일하지 않아 Work-Stealing이 효과적일 때

**적합하지 않은 경우**
- I/O 바운드 작업: 스레드가 블로킹되면 Work-Stealing 이득이 없음
- 공유 가변 상태가 많은 작업: 동기화 비용이 분할 이득을 상쇄함
- 재귀 깊이가 매우 깊은 경우: 스택 오버플로 위험

Java 8+ 에서는 `parallelStream()`이 내부적으로 Fork/Join을 사용하므로, 단순 컬렉션 병렬 처리에는 직접 `ForkJoinPool`을 쓰는 것보다 스트림 API가 더 간결합니다.

---

**지난 글:** [CompletionService: 완료 순서로 결과 수집하기](/posts/java-completion-service/)

**다음 글:** [RecursiveTask와 RecursiveAction 완전 정복](/posts/java-recursive-task/)

<br>
읽어주셔서 감사합니다. 😊
