---
title: "Optional — null을 대체하는 안전한 값 컨테이너"
description: "Java Optional 완전 정리 — Optional이 해결하는 NullPointerException 문제, Optional.of·empty·ofNullable 생성, map·flatMap·filter 파이프라인, orElse·orElseGet·orElseThrow 값 추출, Optional 설계 의도와 올바른 사용 범위"
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "Optional", "NullPointerException", "null안전", "함수형프로그래밍", "Java8"]
featured: false
draft: false
---

[지난 글](/posts/java-immutability/)에서 불변 객체 설계 원칙을 살펴봤다. 이번에는 **Optional** 을 다룬다. Java 8에서 도입된 `Optional<T>`는 "값이 있을 수도, 없을 수도 있는" 상황을 타입으로 명시하는 컨테이너다. 수십 년간 Java 개발자를 괴롭혀온 `NullPointerException`을 방지하는 데 핵심적인 역할을 한다.

## null의 문제

Tony Hoare는 1965년 null 참조를 고안하면서 "10억 달러짜리 실수"라고 자평했다. Java에서 null이 문제가 되는 이유는 **값이 없다는 사실을 타입에서 표현하지 못하기** 때문이다.

```java
// null을 반환하는 메서드
User findUser(long id) {
    return userMap.get(id); // 없으면 null 반환
}

// 호출 측: null 체크를 잊으면 NPE
String name = findUser(42).getName(); // NullPointerException!

// 방어 코드: 매번 null 체크 — 잡음이 많고 실수하기 쉬움
User user = findUser(42);
String name2 = (user != null) ? user.getName() : "Unknown";
```

`Optional`을 사용하면 메서드 시그니처 자체가 "이 결과는 없을 수 있다"고 선언한다.

```java
Optional<User> findUser(long id) {
    return Optional.ofNullable(userMap.get(id));
}

// 호출 측: 값이 없을 수 있다는 것을 타입으로 인지
Optional<User> user = findUser(42);
String name = user.map(User::getName).orElse("Unknown");
```

![Optional — null을 명시적으로 다루는 컨테이너](/assets/posts/java-optional-overview.svg)

## Optional 생성

세 가지 팩토리 메서드로 생성한다.

```java
// 1. Optional.of(value) — null이 아님이 보장될 때
Optional<String> definite = Optional.of("Hello");
// Optional.of(null) → 즉시 NullPointerException 발생

// 2. Optional.empty() — 값이 없음을 표현
Optional<String> nothing = Optional.empty();

// 3. Optional.ofNullable(value) — null 가능성이 있을 때 (가장 많이 사용)
String maybeNull = getFromMap(key); // null일 수 있음
Optional<String> safe = Optional.ofNullable(maybeNull);
```

`Optional.of()`에 null을 넘기면 `NullPointerException`이 즉시 발생한다. 이것은 의도된 설계다. null이 아님이 확실한 경우에만 사용하고, 불확실하면 `ofNullable()`을 쓴다.

## 값 조회 메서드

Optional에서 값을 꺼내는 방법은 여러 가지다.

```java
Optional<String> opt = Optional.of("Java");

// isPresent() / isEmpty() — 값 존재 여부 확인
opt.isPresent(); // true
opt.isEmpty();   // false (Java 11+)

// get() — 있을 때만 안전. 없으면 NoSuchElementException
opt.get(); // "Java"

// orElse(default) — 없으면 기본값
opt.orElse("기본값");          // "Java"
Optional.empty().orElse("기본값"); // "기본값"

// orElseGet(supplier) — 기본값 생성이 비용이 클 때 지연 실행
opt.orElseGet(() -> computeDefault()); // 람다는 값이 없을 때만 실행

// orElseThrow() — 없으면 예외 (Java 10+)
opt.orElseThrow(); // 있으면 "Java", 없으면 NoSuchElementException
opt.orElseThrow(() -> new UserNotFoundException(id));

// ifPresent — 값이 있을 때만 동작 수행
opt.ifPresent(v -> System.out.println(v)); // "Java" 출력

// ifPresentOrElse — 있을 때 / 없을 때 (Java 9+)
opt.ifPresentOrElse(
    v -> System.out.println("Found: " + v),
    () -> System.out.println("Not found")
);
```

## map · flatMap · filter 파이프라인

Optional의 진가는 파이프라인 처리에서 드러난다.

```java
// map: 값이 있으면 변환, 없으면 empty 유지
Optional<String> upperName = findUser(id)
    .map(User::getName)
    .map(String::toUpperCase);

// filter: 조건을 만족하지 않으면 empty
Optional<User> adultUser = findUser(id)
    .filter(u -> u.getAge() >= 18);

// flatMap: map이 Optional을 반환할 때 중첩 방지
// Optional<Optional<Address>>가 되는 것을 방지
Optional<String> city = findUser(id)
    .flatMap(User::getAddress)  // User::getAddress가 Optional<Address> 반환
    .map(Address::getCity);
```

`flatMap`은 변환 함수 자체가 `Optional`을 반환할 때 사용한다. `map`을 쓰면 `Optional<Optional<Address>>`가 되어 다시 꺼내야 하는 번거로움이 생긴다.

![Optional 파이프라인 — map·flatMap·filter](/assets/posts/java-optional-pipeline.svg)

## or · stream (Java 9+)

```java
// or: empty일 때 대체 Optional 제공 (orElse와 달리 Optional 반환)
Optional<User> user = findUserById(id)
    .or(() -> findUserByEmail(email));

// stream: Optional을 Stream으로 변환 (0개 또는 1개 요소)
List<User> users = ids.stream()
    .map(this::findUser)           // Stream<Optional<User>>
    .flatMap(Optional::stream)     // Stream<User> — empty는 제거됨
    .collect(Collectors.toList());
```

## Optional 설계 의도와 제한

Optional은 **메서드 반환 타입**으로 사용하기 위해 설계됐다. 모든 곳에 쓰이도록 만든 게 아니다.

```java
// 좋은 사용: 메서드 반환 타입
Optional<User> findUser(long id) { ... }

// 나쁜 사용 1: 필드로 사용 — Serializable이 아니고 성능 낭비
class User {
    private Optional<String> nickname; // 안티패턴
}

// 나쁜 사용 2: 메서드 파라미터로 사용 — 호출자가 불편
void process(Optional<String> name) { ... } // 안티패턴
// 대신: process(String name)으로 받고 내부에서 null 처리

// 나쁜 사용 3: Collections 내부 타입
List<Optional<String>> list; // 안티패턴 — null 대신 빈 컬렉션 사용
```

Optional은 도구다. null 체크를 완전히 없애는 마법이 아니라, null이 발생할 수 있음을 타입으로 명시하고 파이프라인 처리를 가능하게 하는 도구다. 다음 글에서는 Optional 생성 방법을 더 자세히 다룬다.

---

**지난 글:** [불변 객체(Immutable Objects) — 안전한 설계의 기초](/posts/java-immutability/)

**다음 글:** [Optional 생성 — of·empty·ofNullable 완전 분석](/posts/java-optional-creation/)

<br>
읽어주셔서 감사합니다. 😊
