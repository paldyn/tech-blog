---
title: "Java toString() — 의미 있는 문자열 표현 만들기"
description: "Object.toString()의 기본 출력 형식과 한계, 오버라이드해야 하는 이유, toString()이 자동 호출되는 상황, 올바른 구현 패턴과 formatted() 활용, 그리고 순환 참조·민감 정보 포함 같은 주의사항을 실전 코드로 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "toString", "Object", "디버깅", "로깅", "문자열 표현"]
featured: false
draft: false
---

[지난 글](/posts/java-equals-hashcode/)에서 `equals()`와 `hashCode()`의 계약과 올바른 구현 방법을 살펴봤다. 이번에는 `Object`의 또 다른 핵심 메서드인 **`toString()`**을 다룬다. `equals`/`hashCode`보다 단순해 보이지만, 제대로 구현하지 않으면 디버깅이 어려워지고 로그가 무의미해진다.

## 기본 동작

`Object.toString()`을 오버라이드하지 않으면 다음 형식을 반환한다.

```java
getClass().getName() + "@" + Integer.toHexString(hashCode())
```

```java
class Person {
    String name = "Alice";
    int age = 30;
}

Person p = new Person();
System.out.println(p); // Person@1b6d3586

// 로그에서
log.info("사용자: {}", p); // 사용자: Person@1b6d3586
```

`Person@1b6d3586`은 디버깅에 전혀 도움이 되지 않는다. 어떤 사람인지, 어떤 값을 가지는지 알 수 없다.

## toString()이 자동 호출되는 상황

`toString()`은 명시적으로 호출하지 않아도 여러 상황에서 자동으로 호출된다.

```java
Person p = new Person("Alice", 30);

// 1. 문자열 연결
String msg = "사용자: " + p;  // p.toString() 호출

// 2. System.out.println
System.out.println(p);         // p.toString() 호출

// 3. String.valueOf()
String s = String.valueOf(p);  // p.toString() 호출

// 4. 포맷 문자열 %s
String f = String.format("user=%s", p);  // p.toString() 호출
```

특히 SLF4J 같은 로거의 `{}` 플레이스홀더도 내부적으로 `toString()`을 호출한다.

## 기본 오버라이드 패턴

```java
class Person {
    private final String name;
    private final int age;

    Person(String name, int age) {
        this.name = name;
        this.age = age;
    }

    @Override
    public String toString() {
        return "Person{name=" + name + ", age=" + age + "}";
    }
}

System.out.println(new Person("Alice", 30));
// Person{name=Alice, age=30}
```

클래스 이름을 접두사로 포함하면 로그에서 어떤 타입인지 즉시 알 수 있다.

![toString() 기본값 vs 오버라이드 출력 비교](/assets/posts/java-tostring-patterns.svg)

## Java 15+ formatted() 활용

`String.formatted()`(Java 15+)를 사용하면 더 읽기 좋은 형식을 쉽게 만들 수 있다.

```java
@Override
public String toString() {
    return "Person{name='%s', age=%d}".formatted(name, age);
}
// Person{name='Alice', age=30}
```

`String.format()`보다 간결하고, 템플릿 문자열이 앞에 오므로 가독성이 좋다.

## record의 자동 toString()

record를 사용하면 `toString()`도 자동 생성된다.

```java
record Person(String name, int age) { }

System.out.println(new Person("Alice", 30));
// Person[name=Alice, age=30]
```

record의 `toString()` 형식은 `ClassName[field1=value1, field2=value2]`다. 중괄호 대신 대괄호를 사용한다. 필요하면 오버라이드할 수 있다.

```java
record Person(String name, int age) {
    @Override
    public String toString() {
        return "%s(%d세)".formatted(name, age);
    }
}
System.out.println(new Person("Alice", 30)); // Alice(30세)
```

## 컬렉션의 toString()

Java 컬렉션(`List`, `Set`, `Map`)은 `AbstractCollection`이 `toString()`을 구현해 원소들을 출력한다.

```java
List<Person> people = List.of(
    new Person("Alice", 30),
    new Person("Bob", 25)
);

System.out.println(people);
// [Person{name=Alice, age=30}, Person{name=Bob, age=25}]
```

원소 클래스가 `toString()`을 오버라이드하지 않았다면 `[Person@1b6d3586, Person@4e50df2e]`처럼 무의미한 출력이 나온다.

## 주의사항

**민감 정보 포함 금지**: 패스워드, 카드 번호, 토큰 등 민감 정보를 `toString()`에 포함하면 로그 파일에 평문으로 노출된다.

```java
class Credential {
    private final String username;
    private final String password; // ← 절대 toString에 포함하지 말 것

    @Override
    public String toString() {
        return "Credential{username=" + username + "}"; // password 생략
    }
}
```

**순환 참조 주의**: 두 객체가 서로를 참조할 때 양쪽 `toString()`이 상대방을 출력하려 하면 `StackOverflowError`가 발생한다.

```java
class A {
    B b;
    @Override
    public String toString() {
        return "A{b=" + b + "}"; // b.toString() 호출 → b.a.toString() → 무한 재귀
    }
}
class B {
    A a;
    @Override
    public String toString() {
        return "B{a=" + a + "}"; // 순환 참조!
    }
}
```

순환 참조가 있을 때는 참조 객체의 ID나 핵심 식별자만 출력한다.

**toString()을 API 계약으로 삼지 말 것**: `toString()` 출력 형식은 언제든 바뀔 수 있다. 파싱이나 비교에 사용하지 말고, 디버깅과 로깅 목적으로만 사용하라.

![toString() 구현 방법 3가지 비교와 주의사항](/assets/posts/java-tostring-tools.svg)

## @ToString Lombok 어노테이션

프로젝트에 Lombok이 있다면 `@ToString`으로 보일러플레이트를 제거할 수 있다.

```java
@ToString
class Person {
    private final String name;
    private final int age;
    @ToString.Exclude
    private final String password; // 제외
}
// 출력: Person(name=Alice, age=30)
```

Lombok을 사용하지 않는 프로젝트에서는 IDE의 "Generate toString()" 기능이나 record를 활용한다.

`toString()`은 작은 메서드지만 팀 전체의 디버깅 효율에 큰 영향을 미친다. 다음 글에서는 `Object`의 `clone()` 메서드를 다룬다. `Cloneable` 인터페이스와 얕은 복사·깊은 복사의 차이, 그리고 복사 생성자를 대안으로 활용하는 방법을 살펴볼 것이다.

---

**지난 글:** [Java equals()와 hashCode() — 계약과 올바른 구현](/posts/java-equals-hashcode/)

**다음 글:** [Java clone() — Cloneable과 깊은 복사·얕은 복사](/posts/java-clone/)

<br>
읽어주셔서 감사합니다. 😊
