---
title: "레코드와 직렬화 — Record Serialization"
description: "Java Record 직렬화 완전 가이드 — 생성자 기반 역직렬화 보장, writeObject 제한, Jackson/Gson과 Record 통합, @JsonProperty 활용, 불변식 보호"
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "Record", "직렬화", "Jackson", "Gson", "역직렬화", "불변식", "Java16"]
featured: false
draft: false
---

[지난 글](/posts/java-serialization-pitfalls/)에서 Java 직렬화의 함정을 짚었다. 이번에는 Java 16에서 정식 도입된 **레코드(Record)**가 직렬화와 어떻게 상호작용하는지 다룬다. 레코드는 기존 클래스와 다른 직렬화 규칙을 적용받아 보안상 더 안전하다.

## Record의 직렬화 특수 규칙

`record` 선언이 `Serializable`을 구현하면 JVM은 **레코드 전용 직렬화 메커니즘**을 사용한다. 핵심 차이는 역직렬화 방식이다.

일반 클래스는 역직렬화 시 **생성자를 우회**해 리플렉션으로 필드를 직접 주입한다. 레코드는 반드시 **정식 생성자(canonical constructor)**를 호출해 역직렬화한다. 이 말은 compact 생성자에 작성한 불변식 검증이 역직렬화 시에도 실행된다는 뜻이다.

![Record 직렬화 아키텍처](/assets/posts/java-record-serialization-arch.svg)

## 기본 사용

```java
public record Point(int x, int y) implements Serializable {
    private static final long serialVersionUID = 1L;
}

// 직렬화
Point p = new Point(3, 4);
try (ObjectOutputStream oos = new ObjectOutputStream(
        new FileOutputStream("point.ser"))) {
    oos.writeObject(p);
}

// 역직렬화
try (ObjectInputStream ois = new ObjectInputStream(
        new FileInputStream("point.ser"))) {
    Point restored = (Point) ois.readObject();
    System.out.println(restored.x() + ", " + restored.y()); // 3, 4
}
```

## 불변식 보호 — compact 생성자

역직렬화 시에도 compact 생성자가 실행되므로 불변식 위반 데이터를 자동으로 거부한다.

```java
public record PositiveInt(int value) implements Serializable {
    PositiveInt {
        if (value <= 0)
            throw new IllegalArgumentException("value must be positive: " + value);
    }
}

// 조작된 바이트 스트림에서 value=-1로 역직렬화를 시도해도
// compact 생성자가 실행되므로 IllegalArgumentException 발생
// 기존 클래스 역직렬화는 생성자 우회 → 이런 보호가 없음
```

이것이 레코드 직렬화의 핵심 보안 이점이다.

## writeObject / readObject 제한

레코드에는 `writeObject`, `readObject`, `readObjectNoData`를 선언할 수 없다. 선언하면 컴파일 에러가 발생한다. `readResolve`와 `writeReplace`는 허용된다.

```java
// 컴파일 에러!
public record Bad(String name) implements Serializable {
    private void writeObject(ObjectOutputStream oos) { } // 불가!
}

// readResolve는 허용
public record Singleton(String id) implements Serializable {
    private static final Singleton INSTANCE = new Singleton("main");
    private Object readResolve() { return INSTANCE; }
}
```

## serialVersionUID 처리

레코드에서도 `serialVersionUID`를 명시할 수 있다. 명시하지 않으면 컴포넌트(이름, 타입)를 기반으로 자동 계산된다. 컴포넌트가 변경되면 자동 계산값이 달라지므로 명시 권장이다.

```java
public record Config(String host, int port) implements Serializable {
    private static final long serialVersionUID = 42L;
}
```

## Jackson과 Record 통합

Jackson 2.12+에서 레코드를 기본 지원한다. 컴포넌트 이름이 JSON 키 이름으로 자동 매핑된다.

```java
public record UserDto(String name, int age, String email) {}

ObjectMapper mapper = new ObjectMapper();
UserDto dto = new UserDto("Alice", 30, "alice@example.com");

// 직렬화
String json = mapper.writeValueAsString(dto);
// {"name":"Alice","age":30,"email":"alice@example.com"}

// 역직렬화 (생성자 호출)
UserDto back = mapper.readValue(json, UserDto.class);
```

Jackson이 역직렬화할 때 레코드의 정식 생성자를 호출하므로 불변식도 자동 적용된다.

## @JsonProperty로 이름 오버라이드

컴포넌트에 `@JsonProperty`를 붙여 JSON 키 이름을 바꿀 수 있다.

```java
public record UserDto(
    @JsonProperty("user_name") String name,
    @JsonProperty("user_age") int age
) {}

// {"user_name":"Alice","user_age":30}
```

![Record 직렬화 코드 패턴](/assets/posts/java-record-serialization-code.svg)

## Gson과 Record

Gson은 레코드를 완전히 자동 지원하지 않는다. Gson의 기본 역직렬화는 `Unsafe.allocateInstance()`로 생성자를 우회하므로 불변식 검증이 실행되지 않는다.

```java
// Gson — 레코드에 주의 필요
Gson gson = new Gson();
PositiveInt bad = gson.fromJson("{\"value\":-1}", PositiveInt.class);
// 불변식 우회! bad.value() == -1
```

레코드 + Gson 조합에서 불변식을 보장하려면 `GsonBuilder`에 커스텀 `TypeAdapter`를 등록해야 한다.

```java
Gson gson = new GsonBuilder()
    .registerTypeAdapter(PositiveInt.class,
        (JsonDeserializer<PositiveInt>) (json, type, ctx) ->
            new PositiveInt(json.getAsJsonObject().get("value").getAsInt()))
    .create();
```

## 레코드 → 역직렬화 안전성 비교

| 방식 | 생성자 실행 | 불변식 보호 |
|------|------------|------------|
| Java Serialization (클래스) | 아니오 | 없음 |
| Java Serialization (레코드) | 예 | 예 |
| Jackson readValue (클래스) | 예 (설정에 따라) | 일부 |
| Jackson readValue (레코드) | 예 | 예 |
| Gson (레코드) | 아니오 | 없음 |

## 레코드가 Java 직렬화보다 나은 이유

1. **불변식 자동 검증**: compact 생성자가 역직렬화 시에도 실행된다.
2. **더 작은 직렬화 형식**: 컴포넌트만 직렬화되고 메서드 정보는 제외된다.
3. **설계 단순성**: `writeObject/readObject` 커스터마이징이 금지돼 있어 복잡한 직렬화 로직을 원천 봉쇄한다.

## 권장 패턴

```java
// 권장: Record + Jackson (Java 직렬화 없이)
public record OrderDto(String orderId, List<String> items, BigDecimal amount) {
    OrderDto {
        Objects.requireNonNull(orderId, "orderId");
        Objects.requireNonNull(items, "items");
        if (amount.compareTo(BigDecimal.ZERO) < 0)
            throw new IllegalArgumentException("amount must not be negative");
        items = List.copyOf(items); // 방어 복사
    }
}

// Jackson이 역직렬화 시 정식 생성자 호출 → 검증 자동 실행
```

Jackson + Record 조합은 Java 직렬화 없이도 안전한 데이터 직렬화를 제공한다. Spring Boot 3.x + `record` + Jackson이 가장 실용적인 현대 Java 스택이다.

## 핵심 정리

- 레코드 역직렬화는 항상 정식 생성자 경유 → 불변식 자동 보호
- `writeObject/readObject` 선언 불가 (컴파일 에러)
- `readResolve/writeReplace`는 허용
- Jackson 2.12+에서 레코드 기본 지원, `@JsonProperty`로 키 이름 제어
- Gson은 생성자 우회 — 커스텀 TypeAdapter 필요
- `serialVersionUID` 명시 권장

---

**지난 글:** [Java 직렬화의 함정 — 보안과 성능 문제](/posts/java-serialization-pitfalls/)

**다음 글:** [스레드 기초 — 동시성 프로그래밍의 시작](/posts/java-threads-basics/)

<br>
읽어주셔서 감사합니다. 😊
