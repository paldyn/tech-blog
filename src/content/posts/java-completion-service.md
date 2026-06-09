---
title: "CompletionService: 완료 순서로 결과 수집하기"
description: "ExecutorCompletionService를 활용해 여러 비동기 작업의 결과를 제출 순서가 아닌 완료 순서로 수집하는 방법과, Future.get() 블로킹 문제를 해소하는 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "CompletionService", "ExecutorCompletionService", "동시성", "Future", "스레드풀"]
featured: false
draft: false
---

[지난 글](/posts/java-callable/)에서 `Callable`로 결과를 반환하고 예외를 전파하는 작업 단위를 만드는 방법을 살펴봤습니다. `Future.get()`을 사용해 결과를 받아 오는 방식은 직관적이지만, 여러 작업을 동시에 실행할 때 문제가 생깁니다. 첫 번째 `Future.get()`이 가장 오래 걸리는 작업에서 블로킹되는 동안 빨리 끝난 작업의 결과는 큐에서 기다리게 됩니다. `CompletionService`는 이 문제를 해결해 **완료된 순서대로** 결과를 꺼낼 수 있게 해 줍니다.

## CompletionService란

`java.util.concurrent.CompletionService<V>`는 `ExecutorService`에 작업을 제출하고, 완료된 `Future`를 내부 `BlockingQueue`에 쌓아 두는 인터페이스입니다. 호출자는 `take()` 또는 `poll()`로 완료된 순서대로 결과를 꺼내기만 하면 됩니다.

```java
public interface CompletionService<V> {
    Future<V> submit(Callable<V> task);
    Future<V> submit(Runnable task, V result);
    Future<V> take() throws InterruptedException;   // 블로킹
    Future<V> poll();                               // 논블로킹
    Future<V> poll(long timeout, TimeUnit unit) throws InterruptedException;
}
```

JDK 구현체는 `ExecutorCompletionService`입니다.

## 동작 원리

![CompletionService 동작 흐름](/assets/posts/java-completion-service-flow.svg)

`ExecutorCompletionService`는 내부적으로 래핑된 `FutureTask`를 사용합니다. 작업이 끝나면 `done()` 콜백이 호출되고, 그 시점에 `Future`를 내부 `LinkedBlockingQueue`에 추가합니다. 덕분에 호출자는 어떤 작업이 먼저 끝나는지 신경 쓸 필요 없이 큐에서 꺼내기만 하면 됩니다.

## 기본 사용법

![ExecutorCompletionService 코드 예](/assets/posts/java-completion-service-code.svg)

```java
ExecutorService es = Executors.newFixedThreadPool(4);
CompletionService<String> cs = new ExecutorCompletionService<>(es);

List<String> urls = List.of("https://a.com", "https://b.com", "https://c.com");

for (String url : urls) {
    cs.submit(() -> fetch(url));
}

for (int i = 0; i < urls.size(); i++) {
    Future<String> f = cs.take();  // 완료된 순서로 꺼냄
    System.out.println(f.get());
}
es.shutdown();
```

`urls.size()` 만큼 `take()`를 호출해 모든 결과를 수집합니다. 만약 작업 중 하나가 예외를 던졌다면 `f.get()`에서 `ExecutionException`으로 감싸져 나옵니다.

## Future만 사용했을 때의 문제

```java
// 제출 순서대로 get() — 첫 번째가 오래 걸리면 뒤는 이미 끝났어도 대기
List<Future<String>> futures = new ArrayList<>();
for (String url : urls) {
    futures.add(es.submit(() -> fetch(url)));
}
for (Future<String> f : futures) {
    System.out.println(f.get()); // 순서대로 블로킹
}
```

세 작업의 소요 시간이 각각 1.2s·0.3s·0.8s 라면, `Future` 방식은 1.2 + 0.3 + 0.8 = 2.3s처럼 보이지만 첫 번째 `get()`에서 1.2s를 기다리는 동안 나머지 두 결과는 이미 준비된 상태로 낭비됩니다. `CompletionService`를 쓰면 세 번의 `take()` 모두 합쳐서 최대 1.2s 내에 끝납니다.

## take() vs poll()

| 메서드 | 동작 | 용도 |
|---|---|---|
| `take()` | 완료 결과가 있을 때까지 블로킹 | 모든 결과를 반드시 수집할 때 |
| `poll()` | 즉시 반환 (없으면 null) | 타임아웃 없는 논블로킹 체크 |
| `poll(timeout, unit)` | 지정 시간까지 대기 | 응답 시간 제한이 있을 때 |

```java
// 100ms 이내에 완료된 작업만 처리
Future<String> f;
while ((f = cs.poll(100, TimeUnit.MILLISECONDS)) != null) {
    process(f.get());
}
```

## 첫 번째 성공 결과만 쓰는 패턴

여러 서버에 동일 요청을 보내고 가장 먼저 응답한 결과를 사용하는 경우에 유용합니다.

```java
CompletionService<String> cs = new ExecutorCompletionService<>(es);
int n = endpoints.size();

for (String ep : endpoints) {
    cs.submit(() -> callEndpoint(ep));
}

String first = null;
for (int i = 0; i < n; i++) {
    try {
        String result = cs.take().get();
        if (first == null) {
            first = result;
            // 나머지 작업 취소 (Future 레퍼런스 별도 보관 필요)
            break;
        }
    } catch (ExecutionException ignored) {
        // 이 작업 실패 — 다음 완료 결과 대기
    }
}
```

## CompletableFuture와의 차이

`CompletionService`는 스레드 풀과 결과 큐를 명시적으로 다루는 전통적인 방식입니다. `CompletableFuture`가 도입된 Java 8 이후에는 `anyOf()`, `allOf()`, 콜백 체이닝이 더 많이 쓰이지만, 제출·수집 루프를 명확히 분리하고 싶거나 기존 `ExecutorService` 코드와 통합해야 할 때는 `CompletionService`가 여전히 간결한 선택입니다.

```java
// CompletableFuture 방식 비교
CompletableFuture.anyOf(
    urls.stream()
        .map(url -> CompletableFuture.supplyAsync(() -> fetch(url), es))
        .toArray(CompletableFuture[]::new)
).thenAccept(System.out::println);
```

`CompletionService`는 여러 작업의 **완료를 순서대로 소비하는 파이프라인**에, `CompletableFuture`는 **콜백과 변환 체이닝**에 각각 더 어울립니다.

---

**지난 글:** [Callable: 결과와 예외를 반환하는 작업 단위](/posts/java-callable/)

**다음 글:** [Fork/Join 프레임워크 완전 정복](/posts/java-fork-join/)

<br>
읽어주셔서 감사합니다. 😊
