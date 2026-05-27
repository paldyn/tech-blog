---
title: "Java default 메서드 완전 정복 — 인터페이스의 진화"
description: "Java 8에서 도입된 default 메서드의 도입 배경, 동작 원리, 재정의 규칙, 충돌 해결, 템플릿 메서드·동작 합성 패턴, 실전 안티패턴까지 깊이 파헤친다"
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "default method", "인터페이스", "Java 8", "하위 호환성", "동작 합성", "템플릿 메서드", "OOP", "설계 패턴"]
featured: false
draft: false
---

[지난 글](/posts/java-interface/)에서 인터페이스의 전체 구조를 살펴봤다. 이번에는 그 중 `default` 메서드에 초점을 맞춰 깊이 파고든다. `default` 메서드는 단순히 "인터페이스에 구현을 추가하는 기능"이 아니다. Java 8 이전에는 상상도 못 했던 방식으로 API 진화와 동작 합성을 가능하게 했고, 현대 Java 설계의 핵심 도구가 됐다.

## 왜 default 메서드가 필요했나 — Java 8 이전의 한계

Java 8에서 람다와 스트림을 도입하려면 `Collection`, `Iterable`, `Comparator` 같은 핵심 인터페이스에 `forEach()`, `stream()`, `spliterator()`, `comparing()` 같은 메서드를 추가해야 했다. 문제는 이 인터페이스들을 구현하는 클래스가 JDK 내부에만 수백 개이고, 외부 라이브러리와 사용자 코드까지 합치면 수천, 수만 개에 달한다는 점이었다.

Java 8 이전 규칙은 간단했다: 인터페이스에 메서드를 추가하면 그 인터페이스를 구현하는 모든 클래스가 컴파일 오류를 낸다. `stream()`을 `Collection`에 추가하는 순간 Java 생태계 전체가 깨진다.

![default 메서드 — 인터페이스 진화와 하위 호환성](/assets/posts/java-default-methods-backward-compat.svg)

`default` 메서드는 이 문제의 해결책이다. 인터페이스에 **기본 구현이 있는 메서드**를 추가할 수 있고, 기존 구현 클래스는 아무것도 바꾸지 않아도 그 기본 구현을 자동으로 상속받는다. 새로운 기능이 필요한 클래스만 선택적으로 재정의(override)하면 된다.

## default 메서드 기본 구조

`default` 키워드를 메서드 선언 앞에 붙이고 메서드 바디를 작성한다.

```java
public interface Describable {
    String name();  // 추상 메서드 — 구현 클래스 필수

    // default 메서드 — 기본 구현 제공
    default String describe() {
        return "이름: " + name() + " (기본 설명)";
    }

    // 추상 메서드를 활용하는 default 메서드
    default boolean hasLongName() {
        return name().length() > 10;
    }
}

public class Product implements Describable {
    private final String productName;

    public Product(String productName) {
        this.productName = productName;
    }

    @Override
    public String name() {
        return productName;  // 추상 메서드만 구현
    }
    // describe()와 hasLongName()은 기본 구현 자동 상속
}

Product p = new Product("Java 완전 정복 시리즈");
System.out.println(p.describe());       // 이름: Java 완전 정복 시리즈 (기본 설명)
System.out.println(p.hasLongName());    // true (길이 13 > 10)
```

핵심은 `default` 메서드가 **인터페이스의 다른 추상 메서드를 자유롭게 호출**할 수 있다는 점이다. `describe()`와 `hasLongName()` 모두 `name()`을 호출하는데, `name()`의 실제 구현은 구현 클래스가 제공한다. 이 덕분에 `default` 메서드는 추상 메서드를 통해 다형성을 활용할 수 있다.

## 재정의 우선순위 — 클래스가 항상 이긴다

구현 클래스에서 `default` 메서드를 재정의하면 클래스의 구현이 항상 우선한다.

```java
public interface Greeter {
    default String greet(String name) {
        return "안녕하세요, " + name + "님!";
    }
}

// default 구현을 그대로 사용
public class DefaultGreeter implements Greeter {
    // greet()를 재정의하지 않음 — "안녕하세요, X님!" 그대로
}

// default 구현을 재정의
public class FormalGreeter implements Greeter {
    @Override
    public String greet(String name) {
        return name + " 선생님께 삼가 문안드립니다.";
    }
}

Greeter dg = new DefaultGreeter();
Greeter fg = new FormalGreeter();

System.out.println(dg.greet("홍길동"));  // 안녕하세요, 홍길동님!
System.out.println(fg.greet("홍길동"));  // 홍길동 선생님께 삼가 문안드립니다.
```

우선순위 규칙은 세 단계로 정리된다:

1. **클래스의 구체 메서드** — 최우선. 클래스에서 직접 `@Override`한 메서드가 항상 이긴다
2. **더 구체적인(자식) 인터페이스의 default** — 부모 인터페이스보다 자식 인터페이스의 `default`가 우선
3. **인터페이스 간 충돌** — 같은 레벨의 두 인터페이스가 충돌하면 컴파일 오류 발생, 반드시 명시적 해결 필요

## 부모 default 메서드 호출 — Interface.super

재정의할 때 부모 인터페이스의 `default` 구현을 완전히 버리지 않고 활용하고 싶다면 `인터페이스명.super.메서드명()` 구문을 사용한다.

```java
public interface Logger {
    default void log(String message) {
        System.out.println("[INFO] " + message);
    }
}

public class TimestampLogger implements Logger {
    @Override
    public void log(String message) {
        String ts = java.time.LocalTime.now().toString();
        Logger.super.log("[" + ts + "] " + message);  // 부모 default 활용
    }
}

TimestampLogger tl = new TimestampLogger();
tl.log("서버 시작");  // [INFO] [10:30:45.123] 서버 시작
```

`super` 키워드만으로는 안 된다. 반드시 `Logger.super.log(...)`처럼 **인터페이스 이름을 명시**해야 한다. 이것은 클래스 상속에서의 `super.method()`와 완전히 다른 문법이다.

## 템플릿 메서드 패턴 — default 메서드로 구현

전통적으로 추상 클래스가 담당하던 **템플릿 메서드 패턴**(전체 흐름 정의, 세부 단계는 하위 클래스에 위임)을 `default` 메서드로도 구현할 수 있다.

```java
public interface DataProcessor<T, R> {
    // 구현 클래스가 반드시 구현할 단계들
    T fetch();
    T validate(T data);
    R transform(T data);
    void save(R result);

    // 전체 흐름을 정의하는 템플릿 메서드 (default)
    default R process() {
        T raw       = fetch();
        T validated = validate(raw);
        R result    = transform(validated);
        save(result);
        return result;
    }
}

public class CsvProcessor implements DataProcessor<String, List<String>> {
    @Override
    public String fetch() { return Files.readString(Path.of("data.csv")); }

    @Override
    public String validate(String data) {
        if (data.isEmpty()) throw new IllegalStateException("빈 파일");
        return data.strip();
    }

    @Override
    public List<String> transform(String data) {
        return Arrays.asList(data.split("\n"));
    }

    @Override
    public void save(List<String> result) { /* DB 저장 */ }
    // process()는 자동 상속 — fetch→validate→transform→save 순서 보장
}

CsvProcessor processor = new CsvProcessor();
List<String> rows = processor.process();  // 전체 파이프라인 실행
```

추상 클래스 기반 템플릿 메서드와 차이점: `interface` 기반이므로 `CsvProcessor`는 다른 클래스를 자유롭게 상속할 수 있다. 다중 구현도 가능하다.

## 동작 합성 — Validator 패턴

`default` 메서드의 가장 강력한 활용 중 하나는 **동작 합성(behavioral composition)** 이다. 자기 자신을 반환 타입으로 사용하면 여러 동작을 체인처럼 조합할 수 있다.

```java
@FunctionalInterface
public interface Validator<T> {
    boolean validate(T value);

    // AND 합성 — 두 조건 모두 만족해야 통과
    default Validator<T> and(Validator<T> other) {
        return value -> this.validate(value) && other.validate(value);
    }

    // OR 합성 — 하나라도 만족하면 통과
    default Validator<T> or(Validator<T> other) {
        return value -> this.validate(value) || other.validate(value);
    }

    // 부정 — 조건 반전
    default Validator<T> negate() {
        return value -> !this.validate(value);
    }

    // 실패 시 예외 발생
    default void validateOrThrow(T value, String errorMsg) {
        if (!validate(value)) {
            throw new IllegalArgumentException(errorMsg + ": " + value);
        }
    }
}

// 람다로 기본 규칙 정의
Validator<String> notEmpty  = s -> s != null && !s.isBlank();
Validator<String> maxLen50  = s -> s.length() <= 50;
Validator<String> noSpecial = s -> s.matches("[a-zA-Z0-9가-힣 ]+");

// 합성 — and() 체이닝
Validator<String> nameRule = notEmpty.and(maxLen50).and(noSpecial);

nameRule.validateOrThrow("홍길동", "이름 유효성 오류");        // OK
nameRule.validateOrThrow("", "이름 유효성 오류");              // 예외
nameRule.validateOrThrow("Robert'); DROP TABLE--", "SQL 인젝션"); // 예외
```

이 패턴은 표준 라이브러리의 `Predicate<T>`(`and()`, `or()`, `negate()`)와 `Comparator<T>`(`thenComparing()`, `reversed()`)가 정확히 같은 방식으로 구현되어 있다.

## default 메서드 충돌 해결

두 인터페이스에 같은 시그니처의 `default` 메서드가 있고 한 클래스가 둘 다 구현하면 **컴파일 오류**가 발생한다.

![default 메서드 충돌 — 다이아몬드 문제와 해결](/assets/posts/java-default-methods-conflict.svg)

```java
public interface A {
    default String hello() { return "Hello from A"; }
}

public interface B {
    default String hello() { return "Hello from B"; }
}

// 컴파일 오류: class C inherits unrelated defaults for hello()
public class C implements A, B {
    // 반드시 @Override로 명시적 해결
    @Override
    public String hello() {
        // 특정 인터페이스의 default 구현을 명시적으로 선택
        return A.super.hello() + " | " + B.super.hello();
    }
}

C c = new C();
System.out.println(c.hello());  // Hello from A | Hello from B
```

**충돌이 아닌 경우**: 자식 인터페이스가 부모의 `default`를 재정의하면 자식이 우선한다. 이때는 충돌이 아니므로 클래스에서 별도 해결 불필요.

```java
public interface Parent {
    default String greeting() { return "Hi"; }
}

public interface Child extends Parent {
    @Override
    default String greeting() { return "Hello"; }
}

// Child.greeting()이 Parent.greeting()을 가림 — 충돌 아님
public class MyClass implements Parent, Child {
    // greeting()을 재정의 안 해도 됨 — Child.greeting() 자동 선택
}

System.out.println(new MyClass().greeting());  // Hello
```

## 표준 라이브러리 주요 default 메서드

| 인터페이스 | default 메서드 | 역할 |
|-----------|---------------|------|
| `Collection<E>` | `stream()`, `parallelStream()` | Stream API 연결 |
| `Iterable<T>` | `forEach(Consumer)` | 람다 기반 순회 |
| `Map<K,V>` | `getOrDefault()`, `forEach()`, `merge()` | 안전한 맵 조작 |
| `Comparator<T>` | `thenComparing()`, `reversed()` | 비교자 합성 |
| `Predicate<T>` | `and()`, `or()`, `negate()` | 조건 합성 |
| `Function<T,R>` | `andThen()`, `compose()` | 함수 합성 |

이 중 `Comparator` 체이닝은 실무에서 가장 자주 마주치는 사례다.

```java
List<Employee> employees = /* 직원 목록 */;

// 부서명 오름차순 → 같으면 연봉 내림차순 → 같으면 이름 오름차순
Comparator<Employee> comp = Comparator
    .comparing(Employee::getDepartment)           // 1차: 부서명 오름차순
    .thenComparing(Employee::getSalary, Comparator.reverseOrder())  // 2차: 연봉 내림차순
    .thenComparing(Employee::getName);            // 3차: 이름 오름차순

employees.sort(comp);
```

`comparing()`, `thenComparing()`, `reversed()` 모두 `default` 메서드와 `static` 메서드의 조합으로 구현된 체이닝 API다.

## default 메서드 안티패턴

### 안티패턴 1 — 인터페이스에 가변 상태 넣기

`default` 메서드가 인터페이스에 구현을 허용한다고 해서 상태(필드)를 흉내 내면 안 된다.

```java
// ✗ 위험 — default 메서드에서 가변 외부 상태 참조
public interface Countable {
    List<Object> getItems();  // 구현 클래스가 상태 제공

    default int count() {
        return getItems().size();  // OK — 추상 메서드 위임
    }

    // ✗ default 메서드 안에서 getItems()를 직접 변경 — 부작용 발생
    default void addItem(Object item) {
        getItems().add(item);  // 구현 클래스 내부 상태를 default가 변경
    }
}
```

`addItem()`처럼 구현 클래스의 내부 상태를 변경하는 `default` 메서드는 테스트를 어렵게 만들고 예측 불가능한 부작용을 낳는다. 인터페이스의 `default` 메서드는 **조회·합성·변환** 역할에만 사용하고 상태 변경은 구현 클래스에 맡겨야 한다.

### 안티패턴 2 — 추상 클래스를 인터페이스로 대체하려는 시도

`default` 메서드가 있다고 해서 인터페이스가 추상 클래스를 완전히 대체하는 건 아니다.

```java
// ✗ 잘못된 접근 — 인터페이스를 추상 클래스처럼 쓰려는 시도
public interface Service {
    default void init() { /* 초기화 — 그런데 상태가 필요하면? */ }
    default void process() { /* 처리 — 공통 로직이 너무 많아진다 */ }
    default void cleanup() { /* 정리 */ }
}
```

`init()`, `process()`, `cleanup()` 같은 생명주기 메서드를 모두 `default`로 구현하면 인터페이스가 추상 클래스보다 복잡해진다. 이 경우 인스턴스 필드가 필요한 공통 상태가 있다면 추상 클래스를 쓰는 것이 맞다. **`default` 메서드는 선택적 확장점과 동작 합성에 집중**해야 한다.

### 안티패턴 3 — 너무 많은 default 메서드

인터페이스의 `default` 메서드가 늘어날수록 구현 클래스의 암묵적 계약이 복잡해진다. 구현 클래스 개발자는 어떤 `default` 메서드가 어떤 추상 메서드에 의존하는지, 재정의하지 않으면 어떤 동작이 발생하는지를 모두 파악해야 한다.

**`default` 메서드 추가 체크리스트**:
- 이 메서드가 없으면 구현 클래스마다 중복 코드가 생기는가? (중복 제거 목적)
- 기존 구현 클래스의 하위 호환성을 유지해야 하는가? (API 진화 목적)
- 순수한 조회·합성 역할인가? (부작용 없는 함수)

위 세 가지 중 하나라도 해당되지 않는다면 `default` 메서드보다 추상 메서드나 별도 유틸리티 클래스가 더 적합하다.

## 정리

`default` 메서드는 인터페이스를 "인터페이스"로 유지하면서 API 진화를 가능하게 하는 도구다.

| 개념 | 설명 |
|------|------|
| 도입 목적 | Java 8 API 확장 시 하위 호환성 유지 |
| 우선순위 | 클래스 구현 > 자식 인터페이스 > 부모 인터페이스 |
| `Interface.super.method()` | 특정 인터페이스의 default 구현을 명시적으로 호출 |
| 템플릿 메서드 패턴 | 흐름 정의(default) + 단계 구현(abstract) 분리 |
| 동작 합성 | `and()`, `or()`, `negate()`, `thenComparing()` 등 |
| 충돌 | 두 인터페이스 동일 시그니처 충돌 시 컴파일 오류 → `@Override` 강제 |
| 안티패턴 | 가변 상태 참조, 추상 클래스 흉내, 과도한 default 확대 |

다음 글에서는 `default` 메서드와 함께 Java 8에 도입된 `static` 메서드를 깊이 살펴본다. `static` 메서드는 상속이 되지 않는다는 점에서 `default`와 근본적으로 다르며, 팩토리 패턴과 유틸리티 설계에 특화되어 있다.

---

**지난 글:** [Java 인터페이스 완전 정복 — 계약과 다중 구현](/posts/java-interface/)

**다음 글:** [Java 인터페이스 static 메서드 — 팩토리와 유틸리티 설계](/posts/java-static-methods-interface/)

<br>
읽어주셔서 감사합니다. 😊
