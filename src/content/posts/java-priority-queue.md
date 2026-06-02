---
title: "PriorityQueue — 우선순위 큐의 힙 구조와 활용"
description: "PriorityQueue의 이진 최소 힙 내부 구조, offer/poll/peek API 차이, Comparator로 역순·커스텀 정렬, Top-K 문제와 다익스트라 등 실전 패턴, 그리고 스레드 안전 대안 PriorityBlockingQueue까지"
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "PriorityQueue", "힙", "Comparator", "Top-K", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/java-queue-deque/)에서 Queue와 Deque 인터페이스의 메서드 체계를 살펴봤다. 이번에는 **`PriorityQueue`** 를 다룬다. FIFO가 아닌 **우선순위 기준으로 원소를 꺼내는** 자료구조로, 내부는 이진 최소 힙(Binary Min-Heap)으로 구현돼 있다.

## 이진 힙 내부 구조

`PriorityQueue`는 내부적으로 배열 하나로 완전 이진 트리를 표현한다. 인덱스 관계는 다음과 같다.

- 부모: `(i - 1) / 2`
- 왼쪽 자식: `2 * i + 1`
- 오른쪽 자식: `2 * i + 2`

**불변식**: 부모 노드의 값 ≤ 자식 노드의 값(Min-Heap). `poll()`은 루트(최솟값)를 꺼낸 뒤 마지막 원소를 루트로 올리고 **sift-down**으로 불변식을 복구한다. `offer()`는 배열 끝에 추가하고 **sift-up**으로 올린다.

![PriorityQueue Min-Heap 구조](/assets/posts/java-priority-queue-heap.svg)

```java
PriorityQueue<Integer> pq = new PriorityQueue<>();
pq.offer(5);
pq.offer(1);
pq.offer(3);

System.out.println(pq.peek());  // 1 (최솟값, 제거 안 함)
System.out.println(pq.poll());  // 1 (제거)
System.out.println(pq.poll());  // 3
System.out.println(pq.poll());  // 5
```

초기 용량 기본값은 11이고, 용량 초과 시 내부 배열이 약 50% 증가한다. 처음부터 크기를 예측할 수 있으면 생성자에 초기 용량을 전달해 재할당을 줄인다.

## 시간 복잡도

| 연산 | 복잡도 |
|------|--------|
| `offer(e)` / `add(e)` | O(log n) |
| `poll()` / `remove()` | O(log n) |
| `peek()` / `element()` | O(1) |
| `remove(Object)` | O(n) — 선형 탐색 후 sift |
| `contains(Object)` | O(n) |

`remove(Object)`가 O(n)인 이유는 힙이 **정렬된 배열이 아니기 때문**이다. 원소 위치를 알 수 없어 전체를 순회해야 한다.

## Comparator로 정렬 기준 변경

`PriorityQueue`의 기본 정렬은 **자연 순서(Comparable)**다. 역순이나 커스텀 기준을 쓰려면 생성자에 `Comparator`를 전달한다.

```java
// Max-Heap: 가장 큰 값이 먼저 나옴
PriorityQueue<Integer> maxPq = new PriorityQueue<>(Comparator.reverseOrder());
maxPq.offer(5);
maxPq.offer(1);
maxPq.offer(3);
System.out.println(maxPq.poll()); // 5

// 커스텀 객체: 작업 우선순위 기준
record Task(String name, int priority) {}

PriorityQueue<Task> taskQueue = new PriorityQueue<>(
    Comparator.comparingInt(Task::priority)
);
taskQueue.offer(new Task("배포", 3));
taskQueue.offer(new Task("버그 수정", 1));
taskQueue.offer(new Task("코드 리뷰", 2));

while (!taskQueue.isEmpty()) {
    System.out.println(taskQueue.poll().name());
}
// 버그 수정 → 코드 리뷰 → 배포
```

![PriorityQueue 주요 API와 패턴](/assets/posts/java-priority-queue-patterns.svg)

## API: 예외 방식 vs null 반환 방식

`PriorityQueue`는 `Queue` 인터페이스를 구현하므로 두 쌍의 메서드가 있다.

```java
PriorityQueue<Integer> pq = new PriorityQueue<>();

// 예외 방식 (큐가 비면 NoSuchElementException)
pq.add(1);
pq.remove();
pq.element();

// 안전 방식 (실패 시 null / false 반환)
pq.offer(1);
pq.poll();   // 비면 null
pq.peek();   // 비면 null
```

프로덕션 코드에서는 `null` 체크가 자연스러운 `offer/poll/peek` 조합을 선호한다.

## Top-K 패턴

K번째로 큰 값을 찾는 고전 문제다. 크기 K의 Min-Heap을 유지하면 O(n log K)로 해결된다.

```java
// 배열에서 K번째로 큰 값
int kthLargest(int[] nums, int k) {
    PriorityQueue<Integer> minHeap = new PriorityQueue<>(k);
    for (int n : nums) {
        minHeap.offer(n);
        if (minHeap.size() > k) {
            minHeap.poll(); // 가장 작은 값 제거
        }
    }
    return minHeap.peek(); // K번째로 큰 값
}
```

K개의 힙만 유지하므로 전체 정렬(O(n log n))보다 효율적이다.

## 주의사항

**스레드 안전 아님**: `PriorityQueue`는 동기화되지 않는다. 멀티스레드 환경에서는 `PriorityBlockingQueue`를 사용한다.

```java
import java.util.concurrent.PriorityBlockingQueue;

PriorityBlockingQueue<Task> concurrentQueue =
    new PriorityBlockingQueue<>(11, Comparator.comparingInt(Task::priority));
```

**null 삽입 금지**: `offer(null)`은 `NullPointerException`을 던진다. 힙 정렬이 `compareTo`/`compare`를 호출하는데 null은 비교 불가능하기 때문이다.

**반복 순서 보장 없음**: `for (int e : pq)`는 힙 배열 순서(정렬 보장 없음)로 순회한다. 정렬 순서가 필요하면 `poll()`을 반복 호출한다.

## 다익스트라 알고리즘 스케치

그래프 최단 경로에서 PriorityQueue가 핵심 역할을 한다.

```java
record Node(int id, int dist) {}

void dijkstra(int[][] graph, int src) {
    int n = graph.length;
    int[] dist = new int[n];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[src] = 0;

    PriorityQueue<Node> pq = new PriorityQueue<>(
        Comparator.comparingInt(Node::dist)
    );
    pq.offer(new Node(src, 0));

    while (!pq.isEmpty()) {
        Node cur = pq.poll();
        if (cur.dist() > dist[cur.id()]) continue;
        for (int[] edge : neighbors(graph, cur.id())) {
            int next = edge[0], weight = edge[1];
            int newDist = dist[cur.id()] + weight;
            if (newDist < dist[next]) {
                dist[next] = newDist;
                pq.offer(new Node(next, newDist));
            }
        }
    }
}
```

PriorityQueue 덕분에 항상 현재까지 가장 짧은 거리의 노드를 O(log n)에 꺼낼 수 있다.

---

**지난 글:** [Queue와 Deque — 큐와 양방향 큐 인터페이스](/posts/java-queue-deque/)

**다음 글:** [Collections 유틸리티 — 정렬·검색·동기화 래퍼](/posts/java-collections-utility/)

<br>
읽어주셔서 감사합니다. 😊
