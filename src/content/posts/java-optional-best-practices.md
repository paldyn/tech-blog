---
title: "Optional 모범 사례 — 실무에서 올바르게 쓰는 방법"
description: "Java Optional 모범 사례 완전 정리 — 메서드 반환 타입으로만 사용, isPresent+get 안티패턴 대신 orElse 계열 사용, 파라미터와 필드로 사용하지 않는 이유, Spring Service 레이어 패턴, Optional 체이닝 실전 코드, orElse vs orElseGet 성능 선택"
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "Optional", "모범사례", "BestPractices", "Spring", "클린코드"]
featured: false
draft: false
---

[지난 글](/posts/java-optional-methods/)에서 Optional의 모든 메서드를 살펴봤다. 이번에는 **Optional을 실무에서 어떻게 올바르게 사용해야 하는지** 모범 사례를 정리한다. Optional은 잘못 사용하면 오히려 코드 가독성을 해치고 의도를 흐린다.

## 핵심 원칙: 메서드 반환 타입으로만

Java API 설계자 Brian Goetz는 Optional이 "메서드의 반환값이 없을 수 있음을 표현하는 제한적인 메커니즘"으로 설계됐다고 명시했다. 이 원칙을 지키는 것이 모든 모범 사례의 출발점이다.

```java
// 올바른 사용: 메서드 반환 타입
Optional<User> findByEmail(String email);
Optional<Config> getConfig(String key);

// 잘못된 사용: 메서드 파라미터
void sendEmail(Optional<String> recipient) { ... } // X
// 대신: 오버로딩 또는 @Nullable
void sendEmail(String recipient) { ... }
void sendEmail() { ... } // 기본 recipient로

// 잘못된 사용: 필드
class User {
    private Optional<String> nickname; // X — Serializable 아님, 성능 낭비
    private String nickname; // O — null 허용 필드로 선언
}
```

![Optional 모범 사례 — 올바른 사용법](/assets/posts/java-optional-best-practices-do.svg)

## isPresent() + get() 대신 orElse* 사용

`isPresent()` 후 `get()`을 쓰는 패턴은 null 체크와 기능적으로 동일하다. Optional의 장점을 전혀 살리지 못한다.

```java
// 나쁜 패턴 1: isPresent + get
Optional<User> opt = findUser(id);
if (opt.isPresent()) {
    User user = opt.get();
    send(user.getEmail());
}

// 좋은 패턴: ifPresent
findUser(id).ifPresent(user -> send(user.getEmail()));

// 나쁜 패턴 2: get()으로 값 꺼내기
String name = opt.get(); // isPresent 없이 사용 — 언제든 NoSuchElementException

// 좋은 패턴: orElseThrow로 의도 명확히
String name2 = findUser(id)
    .map(User::getName)
    .orElseThrow(() -> new UserNotFoundException(id));
```

## orElse vs orElseGet — 성능 선택

```java
// orElse(T): 기본값이 항상 평가됨
// DB 조회, 객체 생성 등 비용이 큰 표현식은 사용 금지
User default = opt.orElse(userService.createDefaultUser()); // X
// opt에 값이 있어도 createDefaultUser()가 호출됨!

// orElseGet(Supplier<T>): 지연 평가 — 비용이 큰 경우
User default2 = opt.orElseGet(() -> userService.createDefaultUser()); // O
// opt가 empty일 때만 Supplier가 실행됨

// 상수나 리터럴은 orElse로 충분
String name = opt.orElse("Anonymous"); // O — "Anonymous"는 항상 존재하는 상수
```

## Spring 레이어 활용 패턴

![Optional 체이닝 패턴 — 레이어별 흐름](/assets/posts/java-optional-best-practices-chain.svg)

```java
// Repository — JPA findById는 자동으로 Optional 반환
@Repository
interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
}

// Service — Optional을 받아 비즈니스 로직 적용
@Service
public class UserService {
    public UserDto getActiveUser(long id) {
        return userRepository.findById(id)
            .filter(User::isActive)         // 활성 사용자만
            .map(UserDto::from)             // DTO 변환
            .orElseThrow(() -> new UserNotFoundException(id));
    }

    // 없으면 기본값 반환 — 예외를 던지지 않는 케이스
    public String getUserDisplayName(long id) {
        return userRepository.findById(id)
            .map(User::getDisplayName)
            .filter(name -> !name.isBlank())
            .orElse("익명 사용자");
    }
}
```

## 컬렉션 반환에는 Optional 사용 금지

컬렉션이 비어 있는 경우는 `Optional.empty()`가 아니라 빈 컬렉션으로 표현한다.

```java
// 잘못된 패턴
Optional<List<User>> findAll(String dept) { ... } // X
// Optional.empty()와 Optional.of(List.of())를 구분해야 할 이유가 없음

// 올바른 패턴
List<User> findAll(String dept) {
    return users.stream()
        .filter(u -> u.getDept().equals(dept))
        .collect(Collectors.toList()); // 없으면 빈 List 반환
}
```

## 중첩 Optional 회피

Optional 안에 Optional이 들어가는 구조는 설계 오류다.

```java
// 잘못된 패턴
Optional<Optional<String>> nested = opt.map(u -> Optional.of(u.getName())); // X

// 올바른 패턴: flatMap 사용
Optional<String> name = opt.flatMap(u -> Optional.of(u.getName())); // O

// 또는 단순히
Optional<String> name2 = opt.map(User::getName); // 더 간단
```

## 요약

Optional은 강력하지만 제한적인 도구다. 메서드 반환 타입으로 "이 값은 없을 수 있다"는 의도를 타입으로 표현하는 데 집중하고, 파라미터·필드·컬렉션 타입으로는 사용하지 않는다. `isPresent()+get()` 대신 `orElse*`/`ifPresent`/파이프라인 메서드를 사용하면 Optional의 진가를 발휘할 수 있다.

---

**지난 글:** [Optional 메서드 완전 정리 — map·flatMap·filter·orElse](/posts/java-optional-methods/)

**다음 글:** [Optional 안티패턴 — 잘못 사용하는 7가지 방법](/posts/java-optional-anti-patterns/)

<br>
읽어주셔서 감사합니다. 😊
