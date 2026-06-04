---
title: "Optional 메서드 완전 정리 — map·flatMap·filter·orElse"
description: "Java Optional 메서드 완전 정리 — map·flatMap·filter 변환 파이프라인, get·orElse·orElseGet·orElseThrow 값 추출 차이, ifPresent·ifPresentOrElse 소비 메서드, or·stream Java9 추가 메서드, orElse vs orElseGet 성능 차이"
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "Optional", "map", "flatMap", "orElse", "orElseGet", "orElseThrow"]
featured: false
draft: false
---

[지난 글](/posts/java-optional-creation/)에서 Optional을 생성하는 세 가지 방법을 깊이 살펴봤다. 이번에는 **Optional의 모든 메서드**를 변환, 추출, 소비 그룹으로 나눠서 정리한다.

## 변환 메서드: map · flatMap · filter

![Optional 변환 메서드 — map·flatMap·filter](/assets/posts/java-optional-methods-map.svg)

### map(Function\<T, R\> fn)

값이 있으면 `fn`을 적용해 새 Optional로 반환한다. 값이 없으면 아무 것도 하지 않고 empty를 반환한다.

```java
Optional<String> name = Optional.of("java");
Optional<Integer> length = name.map(String::length); // Optional.of(4)
Optional<Integer> noLength = Optional.<String>empty().map(String::length); // empty

// fn이 null을 반환하면 empty가 된다
Optional<String> result = Optional.of("hello")
    .map(s -> null); // Optional.empty()
```

### flatMap(Function\<T, Optional\<R\>\> fn)

변환 함수 자체가 `Optional`을 반환할 때 사용한다. `map`을 쓰면 `Optional<Optional<R>>`이 되어 다시 꺼내야 하는 번거로움이 생긴다.

```java
class User {
    Optional<Address> getAddress() { ... }
}
class Address {
    Optional<String> getCity() { ... }
}

// flatMap 없이 map만 쓰면
Optional<Optional<Address>> wrapped = Optional.of(user)
    .map(User::getAddress); // 이중 Optional!

// flatMap으로 평탄화
Optional<String> city = Optional.of(user)
    .flatMap(User::getAddress)  // Optional<Address>
    .flatMap(Address::getCity); // Optional<String>
```

### filter(Predicate\<T\> predicate)

값이 있고 조건을 만족하면 그대로 통과, 아니면 empty를 반환한다.

```java
Optional<String> longWord = Optional.of("Spring")
    .filter(s -> s.length() > 4); // Optional.of("Spring")

Optional<String> shortWord = Optional.of("Hi")
    .filter(s -> s.length() > 4); // Optional.empty()

Optional<Integer> adult = Optional.of(20)
    .filter(age -> age >= 18)
    .filter(age -> age < 100); // 체이닝 가능
```

## 값 추출 메서드

![Optional 값 추출 메서드 비교](/assets/posts/java-optional-methods-extract.svg)

### get() — 위험한 메서드

값이 있으면 반환, 없으면 `NoSuchElementException`을 던진다. **`isPresent()`로 확인하고 쓰는 패턴은 null 체크와 다르지 않다.** 가능하면 `orElse*` 계열을 사용한다.

```java
Optional<String> opt = Optional.of("hello");
opt.get(); // "hello"

Optional.empty().get(); // NoSuchElementException!

// 나쁜 패턴: get()을 isPresent()와 함께 쓰기
if (opt.isPresent()) {
    System.out.println(opt.get()); // null 체크와 다를 바 없음
}
// 좋은 패턴: ifPresent 사용
opt.ifPresent(System.out::println);
```

### orElse vs orElseGet — 중요한 성능 차이

```java
// orElse: 기본값을 항상 평가
String result = opt.orElse(expensiveDefault()); // opt에 값이 있어도 호출됨!

// orElseGet: Supplier로 전달 — opt가 empty일 때만 실행
String result2 = opt.orElseGet(() -> expensiveDefault()); // empty일 때만 실행

// 기본값이 상수라면 orElse가 더 간결
String name = opt.orElse("Unknown"); // OK

// 기본값 생성에 비용이 들면 orElseGet
User defaultUser = opt.orElseGet(() -> userService.createDefaultUser());
```

### orElseThrow — 예외 명시

```java
// orElseThrow() — Java 10+, NoSuchElementException
User user = findUser(id).orElseThrow();

// orElseThrow(Supplier) — 커스텀 예외
User user2 = findUser(id)
    .orElseThrow(() -> new UserNotFoundException("User not found: " + id));

// Spring 서비스 레이어에서 자주 쓰는 패턴
public User getUser(long id) {
    return userRepo.findById(id)
        .orElseThrow(() -> new EntityNotFoundException("User", id));
}
```

## 소비 메서드: ifPresent · ifPresentOrElse

```java
// ifPresent: 값이 있을 때만 실행
Optional.of("hello").ifPresent(System.out::println); // "hello" 출력
Optional.empty().ifPresent(System.out::println);     // 아무것도 안 함

// ifPresentOrElse (Java 9+): 값 있을 때 / 없을 때 분기
Optional.of("hello").ifPresentOrElse(
    v -> System.out.println("Found: " + v),    // 값 있을 때
    () -> System.out.println("Not found")      // 값 없을 때
);
```

## Java 9+ 추가 메서드

```java
// or(Supplier<Optional<T>>) — empty일 때 대체 Optional 제공
// orElse와 달리 Optional을 반환하므로 파이프라인에서 계속 사용 가능
Optional<User> user = findById(id)
    .or(() -> findByEmail(email))    // 첫 번째 조회 실패 시
    .or(() -> Optional.of(guest));   // 두 번째도 실패 시

// stream() — Optional을 Stream으로 변환 (Java 9+)
// empty이면 빈 Stream, 값이 있으면 요소 1개짜리 Stream
List<User> users = ids.stream()
    .map(userRepo::findById)         // Stream<Optional<User>>
    .flatMap(Optional::stream)       // Stream<User> — empty 제거
    .collect(Collectors.toList());
```

## 요약: 메서드 선택 가이드

변환이 필요하면 `map`/`flatMap`/`filter`, 값을 꺼내야 하면 기본값이 있을 때 `orElse`/`orElseGet`, 없으면 안 될 때 `orElseThrow`, 부수효과만 실행할 때 `ifPresent`를 사용한다. `get()`은 `isPresent()` 확인 없이는 절대 쓰지 않는 것이 원칙이다.

---

**지난 글:** [Optional 생성 — of·empty·ofNullable 완전 분석](/posts/java-optional-creation/)

**다음 글:** [Optional 모범 사례 — 실무에서 올바르게 쓰는 방법](/posts/java-optional-best-practices/)

<br>
읽어주셔서 감사합니다. 😊
