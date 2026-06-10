---
title: "Java 12~16 브리지 — Switch 표현식·Text Block·Records·Pattern Matching"
description: "Java 12부터 16까지 Preview로 도입되어 표준화된 Switch 표현식(14), Text Block(15), Records(16), Pattern Matching for instanceof(16), Sealed Classes Preview 등 핵심 언어 기능을 총정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "Java12", "Java14", "Java15", "Java16", "Records", "Text Block", "Switch Expression"]
featured: false
draft: false
---

[지난 글](/posts/java-11-features/)에서 Java 11 LTS의 핵심 변화를 살펴봤습니다. Java 12부터 16까지는 LTS가 아닌 6개월 주기 버전들이지만, **오늘날 Java 17·21 코드에서 매일 사용하는 언어 기능 대부분이 이 시기에 Preview로 도입되고 표준화됩니다.** Switch 표현식, Text Block, Records, Pattern Matching for instanceof — 이 네 기능을 이해하면 모던 Java 코드를 읽고 쓸 수 있습니다.

## Preview 메커니즘이란

Java 12부터 **Preview Feature** 메커니즘이 도입됩니다. 언어 기능을 먼저 선보이고 피드백을 받아 수정하는 방식입니다.

```bash
# Preview 기능 활성화
javac --enable-preview --source 14 Main.java
java  --enable-preview Main
```

Preview 기간 동안 기능은 변경될 수 있으며, 프로덕션 코드에서는 사용이 권장되지 않습니다. 일반적으로 2~3개의 버전을 거쳐 표준화됩니다.

![Java 12-16 주요 기능 로드맵](/assets/posts/java-12-16-bridge-features.svg)

## Switch 표현식 (JEP 325/354/361 — Java 14 표준)

기존 `switch` 문은 세 가지 문제가 있었습니다: fall-through로 인한 버그, 각 case마다 `break` 필요, 값을 반환할 수 없음. Switch 표현식이 이를 모두 해결합니다.

```java
// 이전 switch 문 — fall-through 위험
int numLetters;
switch (day) {
    case MONDAY:
    case FRIDAY:
    case SUNDAY:
        numLetters = 6;
        break; // 빠뜨리면 버그
    case TUESDAY:
        numLetters = 7;
        break;
    default:
        numLetters = 8;
}

// Java 14 Switch 표현식 — 화살표 문법
int numLetters = switch (day) {
    case MONDAY, FRIDAY, SUNDAY -> 6;
    case TUESDAY               -> 7;
    case THURSDAY, SATURDAY    -> 8;
    case WEDNESDAY             -> 9;
};

// 블록이 필요한 경우 yield로 값 반환
String result = switch (code) {
    case 200 -> "OK";
    case 404 -> "Not Found";
    default -> {
        String msg = lookupMessage(code);
        yield msg.isEmpty() ? "Unknown" : msg;
    }
};
```

**yield** 키워드는 블록 형태의 switch arm에서 값을 반환할 때 사용합니다. `return`은 메서드를 종료하지만, `yield`는 switch 표현식의 값을 결정합니다.

## Text Block (JEP 355/378 — Java 15 표준)

JSON, HTML, SQL 같은 멀티라인 문자열을 작성할 때 기존 방식은 가독성이 매우 나빴습니다.

```java
// 이전 방식
String json = "{\n" +
    "  \"name\": \"Alice\",\n" +
    "  \"age\": 30\n" +
    "}";

// Text Block — Java 15
String json = """
    {
      "name": "Alice",
      "age": 30
    }
    """;

// SQL
String query = """
    SELECT u.name, u.email
      FROM users u
     WHERE u.active = true
       AND u.age > 18
     ORDER BY u.name
    """;

// 들여쓰기 정규화
// — 닫는 """ 위치가 기준선
// — 공통 앞 공백 자동 제거
```

Text Block의 닫는 `"""` 위치가 중요합니다. 닫는 따옴표를 별도 줄에 두면 마지막 줄에 개행이 포함되고, 마지막 내용 끝에 붙이면 개행이 없습니다. 또한 줄 끝 공백 제거를 방지하려면 `\s`(공백 이스케이프)를 사용합니다.

```java
// Java 15 새 이스케이프 시퀀스
String noNewline = """
    Hello, World!\
    """; // \로 줄 연결 — 실제로는 한 줄

String preserveSpace = """
    key = value   \s
    """; // \s로 줄 끝 공백 유지
```

## Records (JEP 359/395 — Java 16 표준)

`record`는 불변 데이터 클래스의 간결한 표현입니다. `equals()`, `hashCode()`, `toString()`, 컴포넌트 접근자 메서드가 자동 생성됩니다.

```java
// 기존 — Lombok 없이 DTO 작성
public final class Person {
    private final String name;
    private final int age;

    public Person(String name, int age) {
        this.name = name;
        this.age = age;
    }

    public String name() { return name; }
    public int age() { return age; }

    @Override public boolean equals(Object o) { /* 45줄... */ }
    @Override public int hashCode() { /* ... */ }
    @Override public String toString() { /* ... */ }
}

// Records — 단 한 줄
record Person(String name, int age) {}

// 사용
var alice = new Person("Alice", 30);
System.out.println(alice.name()); // "Alice"
System.out.println(alice);         // Person[name=Alice, age=30]
```

Records는 커스텀 컴팩트 생성자로 유효성 검증을 추가할 수 있습니다.

```java
record Range(int min, int max) {
    // Compact constructor — 필드 할당은 자동
    Range {
        if (min > max)
            throw new IllegalArgumentException(
                "min %d > max %d".formatted(min, max)
            );
    }
}

// Records는 interface 구현 가능
record Point(int x, int y) implements Printable {
    @Override
    public void print() {
        System.out.printf("(%d, %d)%n", x, y);
    }
}
```

![Switch·Records·Pattern Matching 코드](/assets/posts/java-12-16-bridge-code.svg)

## Pattern Matching for instanceof (JEP 305/394 — Java 16 표준)

`instanceof` 검사 후 캐스팅하는 반복 코드를 한 번에 처리합니다.

```java
// 이전 — 캐스팅 반복
if (obj instanceof String) {
    String s = (String) obj; // 반복 캐스팅
    System.out.println(s.length());
}

// Java 16 — 타입 검사 + 바인딩 한번에
if (obj instanceof String s) {
    System.out.println(s.length()); // s는 String으로 바인딩
}

// 조건과 함께 사용
if (obj instanceof String s && s.length() > 5) {
    System.out.println("Long string: " + s);
}

// 부정 조건
if (!(obj instanceof String s)) {
    throw new IllegalArgumentException("Expected String");
}
// s는 이후 코드에서도 사용 가능

// equals 구현 간소화
@Override
public boolean equals(Object o) {
    return o instanceof Point p
        && p.x() == this.x()
        && p.y() == this.y();
}
```

## Sealed Classes Preview (JEP 360/397 — Java 15·16)

Java 17에서 표준화되지만 Java 15·16에서 Preview로 도입됩니다.

```java
// Java 15+ Preview
public sealed interface Shape
    permits Circle, Rectangle, Triangle {}

public record Circle(double radius) implements Shape {}
public record Rectangle(double w, double h) implements Shape {}
public record Triangle(double base, double height) implements Shape {}
```

`sealed`는 허용된 하위 클래스만 상속할 수 있게 제한합니다. Pattern Matching Switch와 결합하면 컴파일러가 모든 경우를 처리했는지 검증합니다.

## 기타 주목할 변화

**Helpful NullPointerException (Java 14)**

```text
// Java 13까지
NullPointerException

// Java 14부터 — 어느 변수가 null인지 명시
Cannot invoke "String.length()" because
"user.getAddress().getCity()" is null
```

**ZGC Production Ready (Java 15)**

Java 11에서 실험적으로 도입된 ZGC가 Java 15에서 프로덕션 준비 완료 상태가 됩니다.

```bash
java -XX:+UseZGC -Xmx4g app.jar
```

이 시기(12~16)에 Preview로 등장한 기능들은 모두 Java 17 LTS에서 완성된 형태로 제공됩니다. Java 17 마이그레이션을 계획 중이라면 이 기능들을 미리 익혀두는 것이 도움이 됩니다.

---

**지난 글:** [Java 11 핵심 기능 정리](/posts/java-11-features/)

**다음 글:** [Java 17 핵심 기능 정리 (LTS)](/posts/java-17-features/)

<br>
읽어주셔서 감사합니다. 😊
