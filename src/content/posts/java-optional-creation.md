---
title: "Optional 생성 — of·empty·ofNullable 완전 분석"
description: "Java Optional 생성 완전 분석 — Optional.of와 ofNullable 차이, Optional.empty 싱글턴, null 전달 시 즉시 NPE 발생하는 이유, OptionalInt·OptionalLong·OptionalDouble 기본 타입 전용 Optional, JPA·Stream·Map과의 연동 패턴"
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "Optional", "ofNullable", "OptionalInt", "null안전", "Java8"]
featured: false
draft: false
---

[지난 글](/posts/java-optional/)에서 Optional의 개념과 기본 활용을 살펴봤다. 이번에는 **Optional 생성 방법을 더 깊이** 파고든다. 세 가지 팩토리 메서드(`of`, `empty`, `ofNullable`)의 차이, 각각 언제 써야 하는지, 기본 타입 전용 Optional까지 다룬다.

## 세 가지 팩토리 메서드

```java
// Optional.of(T value)
Optional<String> present = Optional.of("Java");
// 내부: Objects.requireNonNull(value)를 호출 — null이면 즉시 NPE

// Optional.empty()
Optional<String> empty = Optional.empty();
// 내부: 싱글턴 인스턴스를 캐싱해서 반환 — 새 객체 생성 없음

// Optional.ofNullable(T value)
Optional<String> nullable = Optional.ofNullable(str);
// 내부: value == null ? empty() : of(value)
```

`Optional.of(null)`이 `NullPointerException`을 발생시키는 건 **버그를 조기에 발견**하기 위해 의도된 동작이다. null이 아님을 보장한다고 했는데 null이 들어왔다면 그것 자체가 프로그래밍 오류이므로 즉시 실패해야 한다.

![Optional 생성 — of·empty·ofNullable](/assets/posts/java-optional-creation-methods.svg)

## of vs ofNullable — 선택 기준

```java
// of: 반환값이 null일 수 없음이 보장될 때
// 예: 상수, 이미 null 체크한 값, not-null 어노테이션이 있는 API
Optional<String> config = Optional.of(System.getProperty("app.name"));
// getProperty가 null을 반환할 수 있으므로 사실 이건 ofNullable이 더 안전하다

// ofNullable: 레거시 API, Map.get(), 외부 데이터 등 null 가능성 있는 경우
Optional<String> fromMap = Optional.ofNullable(properties.getProperty("key"));
Optional<User> fromDb = Optional.ofNullable(legacyDao.findUser(id));

// 실제로는 ofNullable을 더 많이 쓴다 — 방어적이고 안전하기 때문
```

## Optional.empty()의 싱글턴 최적화

```java
// Optional.empty()는 매번 새 객체를 만들지 않는다
Optional<String> e1 = Optional.empty();
Optional<String> e2 = Optional.empty();

e1 == e2;         // true (동일 싱글턴 인스턴스)
e1.equals(e2);    // true

// of/ofNullable은 값마다 새 Optional 생성
Optional<String> o1 = Optional.of("a");
Optional<String> o2 = Optional.of("a");
o1 == o2;         // false (다른 인스턴스)
o1.equals(o2);    // true (값 기반 동등성)
```

## JPA·Stream·Map 연동 패턴

![Optional 생성 실전 패턴](/assets/posts/java-optional-creation-patterns.svg)

실무에서 Optional을 가장 많이 생성하는 세 가지 상황이다.

```java
// 1. JPA Repository — findById는 자동으로 Optional 반환
interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    // findById(Long id)는 JpaRepository에서 이미 Optional<User> 반환
}

// 2. Stream 터미널 연산 — findFirst, findAny, reduce, min, max
Optional<String> longest = words.stream()
    .filter(w -> w.length() > 5)
    .max(Comparator.comparingInt(String::length));

// 3. Map.get() 래핑 — 레거시 Map API의 null 반환 처리
Map<String, String> config = loadConfig();
Optional<String> dbUrl = Optional.ofNullable(config.get("db.url"));
String url = dbUrl.orElse("jdbc:h2:mem:test");
```

## 기본 타입 전용 Optional

`Optional<Integer>`는 `int`를 박싱해야 한다. 성능이 중요한 경우 기본 타입 전용 Optional 클래스를 사용한다.

```java
// OptionalInt — int 전용
OptionalInt count = IntStream.range(0, 100)
    .filter(n -> n % 7 == 0)
    .findFirst();

count.isPresent();  // true
count.getAsInt();   // 0 — get()이 아닌 getAsInt()

OptionalInt empty = OptionalInt.empty();
empty.orElse(-1);   // -1

// OptionalLong, OptionalDouble도 동일한 API
OptionalLong size  = LongStream.range(0, 1000).filter(n -> n == 500).findFirst();
OptionalDouble avg = IntStream.range(1, 10).average(); // average()는 OptionalDouble 반환
```

주의: `OptionalInt` 등에는 `map`, `flatMap`, `filter` 같은 파이프라인 메서드가 없다. 단순 존재 여부 확인과 값 추출만 가능하다. 파이프라인이 필요하면 `Optional<Integer>`를 사용한다.

## Optional 동등성과 해시코드

```java
// Optional은 equals()를 오버라이드해 값 기반 비교
Optional.of("hello").equals(Optional.of("hello")); // true
Optional.of("hello").equals(Optional.of("world")); // false
Optional.empty().equals(Optional.empty());          // true
Optional.of("x").equals(Optional.empty());          // false

// hashCode도 감싸진 값의 hashCode 기반
Optional.of("hello").hashCode();      // "hello".hashCode()와 동일
Optional.empty().hashCode();          // 0
```

이런 특성 덕분에 Optional을 Map의 키나 Set의 요소로 쓰는 것이 기술적으로는 가능하지만, 그렇게 쓰는 것은 안티패턴이다. `Optional`을 필드나 컬렉션 원소로 쓰지 않는 원칙을 지키면 자연스럽게 이런 상황을 피할 수 있다.

---

**지난 글:** [Optional — null을 대체하는 안전한 값 컨테이너](/posts/java-optional/)

**다음 글:** [Optional 메서드 완전 정리 — map·flatMap·filter·orElse](/posts/java-optional-methods/)

<br>
읽어주셔서 감사합니다. 😊
