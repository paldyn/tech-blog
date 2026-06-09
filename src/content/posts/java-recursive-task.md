---
title: "RecursiveTask와 RecursiveAction 완전 정복"
description: "Fork/Join 프레임워크의 두 핵심 클래스 RecursiveTask와 RecursiveAction의 차이, compute() 구현 패턴, invokeAll() 활용, 그리고 흔한 실수를 실전 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "RecursiveTask", "RecursiveAction", "ForkJoin", "병렬처리", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/java-fork-join/)에서 Fork/Join 프레임워크의 전체 구조와 Work-Stealing 알고리즘을 살펴봤습니다. 이번에는 실제로 작업을 구현할 때 사용하는 두 클래스, **`RecursiveTask`와 `RecursiveAction`**의 세부 사용법과 주의점을 깊이 있게 다룹니다.

## 두 클래스의 차이

![RecursiveTask vs RecursiveAction](/assets/posts/java-recursive-task-types.svg)

`RecursiveTask<V>`는 `compute()` 메서드가 값을 반환하고, `join()`으로 그 값을 회수합니다. `RecursiveAction`은 `compute()`가 `void`를 반환하며 배열 내용 수정이나 파일 처리처럼 결과 대신 사이드 이펙트로 동작합니다.

## compute() 구현 패턴

두 클래스 모두 `compute()`에서 다음 패턴을 따릅니다.

```java
@Override
protected V compute() {
    if (크기 <= THRESHOLD) {
        return 직접_계산(); // 베이스 케이스
    }
    // 분할
    SubTask left  = new SubTask(lo, mid);
    SubTask right = new SubTask(mid, hi);
    // fork + compute 패턴 (핵심)
    left.fork();
    V rightResult = right.compute(); // 현재 스레드에서 실행
    V leftResult  = left.join();
    return merge(leftResult, rightResult);
}
```

`left.fork()` 후 `right.compute()` → `left.join()` 순서가 중요합니다. `right`도 `fork()`하면 현재 스레드는 아무것도 안 하고 기다리기만 해서 스레드 낭비가 생깁니다.

## invokeAll() 편의 메서드

여러 서브태스크를 한 번에 제출하고 모두 끝날 때까지 기다릴 때 `invokeAll()`이 편리합니다.

```java
// 두 태스크를 동시에 실행, 모두 완료 후 반환
invokeAll(left, right);
// 세 개 이상: Collection<ForkJoinTask<?>> 전달 가능
invokeAll(List.of(t1, t2, t3));
```

`invokeAll()`은 첫 번째 태스크를 현재 스레드에서 실행하고 나머지를 `fork()`합니다. 모든 태스크가 완료되면 반환합니다. 예외가 발생한 태스크에서 `join()` 시 `RuntimeException`으로 재포장됩니다.

## RecursiveAction 실전: 병렬 정렬

![RecursiveAction 병렬 정렬 코드](/assets/posts/java-recursive-task-code.svg)

```java
ForkJoinPool pool = ForkJoinPool.commonPool();
int[] data = /* 10만 개 정수 */;
pool.invoke(new ParallelSort(data, 0, data.length));
// invoke() 후 data는 정렬됨
```

`RecursiveAction`에서 결과를 "반환"하는 방법은 외부 컨테이너(배열, `AtomicReference`, 결과 객체 필드)를 사용하는 것입니다.

## RecursiveTask 실전: 최솟값 찾기

```java
class MinTask extends RecursiveTask<Integer> {
    private static final int THRESHOLD = 500;
    private final int[] arr;
    private final int lo, hi;

    MinTask(int[] arr, int lo, int hi) {
        this.arr = arr; this.lo = lo; this.hi = hi;
    }

    @Override
    protected Integer compute() {
        if (hi - lo <= THRESHOLD) {
            int min = arr[lo];
            for (int i = lo + 1; i < hi; i++)
                if (arr[i] < min) min = arr[i];
            return min;
        }
        int mid = (lo + hi) >>> 1;
        MinTask left  = new MinTask(arr, lo, mid);
        MinTask right = new MinTask(arr, mid, hi);
        left.fork();
        int rightMin = right.compute();
        int leftMin  = left.join();
        return Math.min(leftMin, rightMin);
    }
}
```

## 흔한 실수 모음

**실수 1: 양쪽 모두 fork()**

```java
// 잘못된 예 — 현재 스레드가 놀게 됨
left.fork();
right.fork();
return left.join() + right.join();

// 올바른 예
left.fork();
long r = right.compute();
return left.join() + r;
```

**실수 2: fork() 없이 순차 실행**

```java
// 이렇게 하면 병렬화가 전혀 없음
return left.compute() + right.compute();
```

**실수 3: compute() 밖에서 fork/join**

`fork()`와 `join()`은 `ForkJoinWorkerThread` 위에서 실행될 때만 효과적입니다. 외부 일반 스레드에서 호출하면 내부적으로 단순 실행으로 폴백되거나 성능이 저하됩니다. 외부에서는 `pool.invoke()` 또는 `pool.submit()`을 사용하세요.

**실수 4: 너무 작은 임계값**

태스크 생성과 스케줄링 비용은 공짜가 아닙니다. 임계값을 100 미만으로 설정하면 오버헤드가 병렬화 이익을 초과합니다.

## ForkJoinTask 상태 체크

```java
ForkJoinTask<Long> task = pool.submit(new SumTask(data, 0, n));
task.isDone();          // 완료 여부
task.isCancelled();     // 취소 여부
task.isCompletedNormally();  // 예외 없이 완료
task.cancel(true);      // 취소 시도
```

`join()`은 예외를 `RuntimeException`으로 감싸 재투척합니다. 예외를 직접 다루려면 `get()` (`InterruptedException`, `ExecutionException` 체크 예외)을 사용하세요.

---

**지난 글:** [Fork/Join 프레임워크 완전 정복](/posts/java-fork-join/)

**다음 글:** [CompletableFuture 기초와 비동기 파이프라인](/posts/java-completable-future/)

<br>
읽어주셔서 감사합니다. 😊
