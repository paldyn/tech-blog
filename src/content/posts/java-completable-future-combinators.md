---
title: "CompletableFuture 조합 연산자 완전 정복"
description: "thenCombine, allOf, anyOf, applyToEither 등 CompletableFuture 조합 연산자의 동작 원리와 사용 패턴, 그리고 allOf 결과 수집 관용구를 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "CompletableFuture", "thenCombine", "allOf", "anyOf", "비동기 조합"]
featured: false
draft: false
---

[지난 글](/posts/java-completable-future/)에서 `CompletableFuture`의 기본 생성·콜백 체이닝을 살펴봤습니다. 단일 파이프라인 이상으로, 실무에서는 여러 비동기 작업을 조합해야 하는 경우가 많습니다. 이번에는 두 개 이상의 `CompletableFuture`를 연결하는 **조합 연산자**들을 깊이 있게 다룹니다.

## 조합 연산자 전체 지도

![CompletableFuture 조합 연산자](/assets/posts/java-cf-combinators-overview.svg)

## thenCombine: 두 결과 병합

`thenCombine`은 두 개의 독립적인 `CompletableFuture`가 **모두** 완료되면 `BiFunction`으로 결과를 합칩니다.

```java
CompletableFuture<String> cfName =
    CompletableFuture.supplyAsync(() -> fetchName(id));
CompletableFuture<Integer> cfScore =
    CompletableFuture.supplyAsync(() -> fetchScore(id));

CompletableFuture<String> combined =
    cfName.thenCombine(cfScore,
        (name, score) -> name + ": " + score + "점");

System.out.println(combined.join()); // "Alice: 95점"
```

두 작업은 동시에 시작되며 총 소요 시간은 두 작업 중 더 오래 걸린 쪽에 결정됩니다.

## allOf: 모두 완료 대기

```java
List<CompletableFuture<String>> cfs = urls.stream()
    .map(url -> CompletableFuture.supplyAsync(() -> fetch(url)))
    .toList();

CompletableFuture<Void> all =
    CompletableFuture.allOf(cfs.toArray(new CompletableFuture[0]));
```

`allOf`는 `CF<Void>`를 반환하므로 결과를 직접 꺼낼 수 없습니다. 아래 관용구로 결과 목록을 수집합니다.

![allOf로 여러 API 병렬 호출 후 병합](/assets/posts/java-cf-combinators-code.svg)

```java
// 결과 목록 수집 관용구
List<String> results = all
    .thenApply(v -> cfs.stream()
        .map(CompletableFuture::join)
        .toList())
    .join();
```

`allOf` 완료 후 개별 `cf.join()`은 이미 완료된 상태이므로 블로킹 없이 즉시 반환합니다.

## anyOf: 가장 빠른 결과

```java
CompletableFuture<Object> first =
    CompletableFuture.anyOf(cf1, cf2, cf3);

String result = (String) first.join(); // 타입 캐스팅 필요
```

`anyOf`는 반환 타입이 `CF<Object>`입니다. 타입 정보가 소실되므로 캐스팅이 필요합니다. 같은 타입의 CF만 넣을 때는 `applyToEither`가 타입 안전한 대안입니다.

```java
// applyToEither: 타입 유지
CompletableFuture<String> faster =
    cf1.applyToEither(cf2, s -> s.toUpperCase());
```

`acceptEither(cf2, consumer)`는 먼저 완료된 결과를 소비만 합니다.

## 실전: 대시보드 페이지 병렬 조립

```java
var cfUser   = fetchUserAsync(userId);
var cfOrders = fetchOrdersAsync(userId);
var cfPromo  = fetchPromoAsync(userId);

Dashboard dash = CompletableFuture
    .allOf(cfUser, cfOrders, cfPromo)
    .thenApply(v -> new Dashboard(
        cfUser.join(),
        cfOrders.join(),
        cfPromo.join()))
    .join();
// 3개 API 중 가장 느린 것의 시간만 소요 (직렬이면 합산)
```

## 동일 타입 CF 리스트 병렬 실행 헬퍼

```java
static <T> CompletableFuture<List<T>> all(List<CompletableFuture<T>> cfs) {
    return CompletableFuture
        .allOf(cfs.toArray(new CompletableFuture[0]))
        .thenApply(v -> cfs.stream().map(CompletableFuture::join).toList());
}

// 사용
List<String> pages = all(
    List.of(fetchPageAsync("a"), fetchPageAsync("b"), fetchPageAsync("c"))
).join();
```

## runAfterBoth / runAfterEither

결과가 필요 없고 실행 순서만 제어할 때 사용합니다.

```java
cf1.runAfterBoth(cf2, () -> log.info("둘 다 완료"));
cf1.runAfterEither(cf2, () -> log.info("하나 완료"));
```

## 주의사항

**`anyOf`에서 나머지 CF 취소**: `anyOf`는 나머지 CF를 자동으로 취소하지 않습니다. 리소스 낭비를 막으려면 직접 취소해야 합니다.

```java
CompletableFuture<Object> first = CompletableFuture.anyOf(cf1, cf2, cf3);
first.thenRun(() -> Stream.of(cf1, cf2, cf3).forEach(cf -> cf.cancel(true)));
```

**`allOf` 한 개라도 예외 시**: 하나라도 예외가 발생하면 `allOf`가 반환한 CF도 예외로 완료됩니다. 나머지는 계속 실행 중이므로 결과 수집 시 `join()` 대신 예외 처리 포함 코드가 필요합니다.

---

**지난 글:** [CompletableFuture 기초와 비동기 파이프라인](/posts/java-completable-future/)

**다음 글:** [CompletableFuture 비동기 예외 처리 완전 정복](/posts/java-async-exception-handling/)

<br>
읽어주셔서 감사합니다. 😊
