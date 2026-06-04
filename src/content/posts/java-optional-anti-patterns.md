---
title: "Optional 안티패턴 — 잘못 사용하는 7가지 방법"
description: "Java Optional 안티패턴 7가지 완전 분석 — isPresent+get 패턴, 파라미터·필드에 Optional, Optional 컬렉션, 중첩 Optional, orElse에 비용 큰 식, Optional.get() 직접 사용, Before/After 교정 코드, IntelliJ 경고 활용"
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "Optional", "안티패턴", "AntiPattern", "코드품질", "리팩터링"]
featured: false
draft: false
---

[지난 글](/posts/java-optional-best-practices/)에서 Optional을 올바르게 사용하는 모범 사례를 정리했다. 이번에는 반대로 **실무에서 자주 발견되는 Optional 안티패턴 7가지**와 교정 방법을 살펴본다.

## 7가지 안티패턴 한눈에 보기

![Optional 안티패턴 7가지](/assets/posts/java-optional-anti-patterns-list.svg)

## 안티패턴 ① isPresent() + get()

```java
// 안티패턴: null 체크를 Optional로 포장한 것뿐
Optional<User> opt = findUser(id);
if (opt.isPresent()) {
    User user = opt.get();
    sendEmail(user.getEmail());
}

// 교정: ifPresent 사용
findUser(id)
    .map(User::getEmail)
    .ifPresent(this::sendEmail);

// 교정: 값을 반환해야 할 때
String email = findUser(id)
    .map(User::getEmail)
    .orElseThrow(() -> new UserNotFoundException(id));
```

## 안티패턴 ② 메서드 파라미터에 Optional

```java
// 안티패턴: 호출자가 Optional.of() / Optional.empty() 선택 강요
void process(Optional<String> name, Optional<Integer> age) {
    String n = name.orElse("Anonymous");
    int a = age.orElse(0);
}

// 호출: 불편하고 장황함
process(Optional.of("Alice"), Optional.empty());

// 교정: 오버로딩
void process(String name, int age) { ... }
void process(String name) { process(name, 0); }
void process() { process("Anonymous", 0); }
```

파라미터에 Optional을 쓰면 호출자가 오히려 더 불편해진다. `@Nullable` 어노테이션이나 오버로딩이 더 명확하다.

## 안티패턴 ③ 필드에 Optional

```java
// 안티패턴: Serializable 아님, 불필요한 래핑
public class User {
    private Optional<String> nickname; // X
}

// 교정: null 허용 필드로 선언
public class User {
    private String nickname; // null 가능 — getter에서 Optional 반환 가능

    public Optional<String> getNickname() {
        return Optional.ofNullable(nickname);
    }
}
```

필드를 `Optional`로 선언하면 직렬화가 불가능하고 메모리 낭비가 생긴다. 필드는 nullable로, getter에서 Optional을 반환하는 패턴이 올바르다.

## 안티패턴 ④ 컬렉션을 Optional로 감싸기

```java
// 안티패턴: 빈 컬렉션과 Optional.empty의 차이가 없음
Optional<List<User>> findByDept(String dept) {
    List<User> result = query(dept);
    return result.isEmpty() ? Optional.empty() : Optional.of(result);
}

// 교정: 빈 컬렉션 반환
List<User> findByDept(String dept) {
    return query(dept); // 없으면 Collections.emptyList()
}
```

컬렉션의 "없음"은 빈 컬렉션으로 표현한다. `null` 컬렉션도, `Optional.empty()`도 불필요하다.

## 안티패턴 ⑤ 중첩 Optional

```java
// 안티패턴: map이 Optional을 반환할 때 생기는 중첩
Optional<Optional<Address>> wrapped = Optional.of(user)
    .map(u -> u.getAddress()); // getAddress()가 Optional<Address> 반환

// 교정: flatMap으로 평탄화
Optional<Address> address = Optional.of(user)
    .flatMap(User::getAddress);

// 연쇄 flatMap
Optional<String> city = Optional.of(user)
    .flatMap(User::getAddress)
    .flatMap(Address::getCity);
```

## 안티패턴 ⑥ orElse에 비용 큰 표현식

```java
// 안티패턴: 값이 있어도 DB 조회가 실행됨
User user = findUser(id).orElse(dao.createDefaultUser()); // X

// 교정: orElseGet으로 지연 실행
User user2 = findUser(id).orElseGet(() -> dao.createDefaultUser()); // O
```

## 안티패턴 ⑦ Optional.get() 무방비 사용

```java
// 안티패턴: NoSuchElementException 위험
Optional<String> opt = getConfig("key");
String value = opt.get(); // 없으면 런타임 예외

// 교정: orElseThrow로 의도 명확히
String value2 = opt.orElseThrow(
    () -> new ConfigNotFoundException("key"));

// 또는 기본값
String value3 = opt.orElse("default");
```

## Before/After 교정 코드

![Optional 안티패턴 Before/After 교정](/assets/posts/java-optional-anti-patterns-fix.svg)

## IntelliJ IDEA 도움 활용

IntelliJ IDEA는 Optional 안티패턴을 자동으로 감지하고 리팩터링 제안을 한다.

- "Call to Optional.get() without isPresent check" → `orElseThrow` 변환 제안
- "Optional.isPresent() can be replaced with functional-style expression" → `ifPresent`/`map` 변환 제안
- "Optional used as field or parameter" → 설계 경고

Analyze → Inspect Code 메뉴에서 프로젝트 전체 Optional 안티패턴을 한 번에 스캔할 수 있다. Optional 챕터를 마치며 — Optional은 "없을 수 있는 반환값"을 타입으로 표현하는 도구다. 이 용도를 벗어나면 코드만 복잡해진다.

---

**지난 글:** [Optional 모범 사례 — 실무에서 올바르게 쓰는 방법](/posts/java-optional-best-practices/)

**다음 글:** [예외 처리 개요 — Java 예외 계층 구조와 설계 원칙](/posts/java-exception-overview/)

<br>
읽어주셔서 감사합니다. 😊
