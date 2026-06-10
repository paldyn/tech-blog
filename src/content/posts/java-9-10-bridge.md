---
title: "Java 9·10 주요 변경 사항 브리지"
description: "Java 9의 모듈 시스템(JPMS), JShell, Collection Factory Methods, Stream/Optional 개선과 Java 10의 var 키워드, G1GC 기본 변경, 6개월 릴리스 사이클 시작을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "Java9", "Java10", "JPMS", "var", "모듈", "릴리스 사이클"]
featured: false
draft: false
---

[지난 글](/posts/java-8-features-recap/)에서 Java 8의 핵심 기능을 총정리했습니다. Java 8 이후 두 버전(9, 10)은 LTS가 아니지만, 이 시기에 도입된 **JPMS 모듈 시스템**과 **var 키워드**, 그리고 **6개월 릴리스 사이클**이라는 새로운 릴리스 정책은 이후 모든 Java 버전의 방향성을 결정한 중요한 변화입니다.

## Java 9 (2017년 9월) — 가장 큰 아키텍처 변화

### Java Platform Module System (JPMS, Project Jigsaw)

Java 9의 가장 큰 변화는 **모듈 시스템**입니다. 기존 Java는 클래스패스에 JAR를 쌓는 방식이어서 패키지 수준 접근 제어가 공개/비공개뿐이었습니다. JPMS는 모듈 단위로 의존성과 공개 API를 명시적으로 선언하도록 강제합니다.

![JPMS 모듈 시스템과 var 키워드](/assets/posts/java-9-10-bridge-module.svg)

```java
// module-info.java — 모듈 루트에 위치
module com.example.service {
    requires java.sql;                   // java.sql 모듈 의존
    requires transitive com.example.model; // 전이 의존성
    exports com.example.service.api;    // 이 패키지만 외부 공개
    // 나머지 패키지는 강한 캡슐화로 접근 불가
}
```

모듈 시스템의 핵심 혜택은 **강한 캡슐화**입니다. `exports`에 명시되지 않은 패키지는 다른 모듈에서 접근할 수 없으며, 리플렉션도 `opens` 선언 없이는 동작하지 않습니다.

**모듈리스 JAR(Unnamed Module)**: 기존 `classpath`에 올라가는 JAR는 자동으로 "unnamed module"이 됩니다. 모든 패키지를 공개하며 모든 named module에 의존할 수 있습니다. 기존 코드와의 하위 호환성을 위한 설계입니다.

### JShell — 대화형 Java REPL

```bash
$ jshell
|  Welcome to JShell -- Version 11
|  For an introduction type: /help intro

jshell> int sum(int a, int b) { return a + b; }
|  created method sum(int,int)

jshell> sum(3, 4)
$2 ==> 7
```

JShell은 Java 코드를 즉시 실행하고 결과를 확인하는 REPL(Read-Eval-Print-Loop) 도구입니다. 빠른 API 탐색과 프로토타이핑에 유용합니다.

### Collection Factory Methods

```java
// Java 8까지 — 불변 컬렉션 생성이 번거로움
List<String> old = Collections.unmodifiableList(
    Arrays.asList("a", "b", "c")
);

// Java 9부터 — 간결한 불변 컬렉션
List<String> list = List.of("a", "b", "c");
Set<String>  set  = Set.of("x", "y", "z");
Map<String, Integer> map = Map.of(
    "one", 1,
    "two", 2,
    "three", 3
);
Map<String, Integer> mapEntry = Map.ofEntries(
    Map.entry("one", 1),
    Map.entry("two", 2)
);
```

`List.of()`, `Set.of()`, `Map.of()`로 생성된 컬렉션은 **진정한 불변**입니다. `null`을 허용하지 않으며, 수정 시 `UnsupportedOperationException`이 발생합니다.

### Stream / Optional 개선

```java
// takeWhile — 조건이 거짓이 되는 순간 중단
List<Integer> result = Stream.of(1, 2, 3, 4, 5, 1)
    .takeWhile(n -> n < 4) // [1, 2, 3]
    .collect(Collectors.toList());

// dropWhile — 조건이 거짓이 되는 순간부터 포함
List<Integer> result2 = Stream.of(1, 2, 3, 4, 5)
    .dropWhile(n -> n < 3) // [3, 4, 5]
    .collect(Collectors.toList());

// Stream.iterate — 종료 조건 추가
Stream.iterate(0, n -> n < 10, n -> n + 2)
    .forEach(System.out::println); // 0, 2, 4, 6, 8

// Optional.ifPresentOrElse
optional.ifPresentOrElse(
    v -> log.info("Found: {}", v),
    () -> log.warn("Not found")
);

// Optional.stream() — Stream과 쉽게 통합
List<String> names = users.stream()
    .map(User::findName) // Optional<String> 반환
    .flatMap(Optional::stream)
    .collect(Collectors.toList());
```

![Java 9·10 핵심 변경 사항](/assets/posts/java-9-10-bridge-features.svg)

### Private Interface Methods

```java
interface Validator<T> {
    boolean validate(T value);

    default boolean validateAndLog(T value) {
        boolean result = validate(value);
        logResult(value, result); // private 메서드 호출
        return result;
    }

    // Java 9: interface 내 private 메서드 가능
    private void logResult(T value, boolean result) {
        System.out.printf("Validated %s: %s%n", value, result);
    }
}
```

## Java 10 (2018년 3월) — 6개월 사이클의 시작

Java 9 출시 6개월 후 Java 10이 출시되면서 새로운 릴리스 사이클이 공식화됩니다.

### var — 로컬 변수 타입 추론 (JEP 286)

```java
// 이전: 타입을 두 번 작성
HashMap<String, List<Employee>> map =
    new HashMap<String, List<Employee>>();

// Java 10: var로 간결하게
var map = new HashMap<String, List<Employee>>();

// 긴 제네릭 타입에서 특히 효과적
var stream = Arrays.stream(largeArray)
    .filter(Objects::nonNull)
    .sorted();
```

`var`는 키워드처럼 보이지만 실제로는 **예약 타입 이름**입니다. 변수, 메서드, 패키지 이름으로는 여전히 사용할 수 있습니다. 컴파일 시점에 타입이 결정되므로 런타임 오버헤드가 없으며, 바이트코드에는 실제 타입으로 저장됩니다.

**var 사용 불가 위치:**
- 필드 선언 (`private var name = "hi"` 불가)
- 메서드 파라미터 (`void method(var x)` 불가)
- 메서드 반환 타입 (`var method()` 불가)
- 초기화 없는 선언 (`var x;` 불가)
- `null`만으로 초기화 (`var x = null;` 불가)
- Lambda 파라미터 (Java 11에서 추가)

### Collectors 추가

```java
// toUnmodifiableList / Set / Map
List<String> immutable = stream
    .collect(Collectors.toUnmodifiableList());

// copyOf — 기존 컬렉션으로부터 불변 복사본
List<String> copy = List.copyOf(existingList);
Map<K, V> mapCopy = Map.copyOf(existingMap);
```

### G1GC 기본 GC 변경

Java 8까지 기본 GC는 Parallel GC였습니다. Java 9에서 G1GC가 기본값으로 바뀌었습니다(Java 10에서 공식화). G1GC는 힙을 Region 단위로 관리해 STW(Stop-The-World) 시간을 예측 가능하게 제어합니다.

```bash
# 명시적으로 GC 지정
java -XX:+UseG1GC app.jar      # G1GC (기본값)
java -XX:+UseParallelGC app.jar # Parallel GC
java -XX:+UseZGC app.jar        # ZGC (Java 15+)
```

## 릴리스 사이클 변화와 마이그레이션 전략

Java 9부터 6개월마다 새 버전이 출시됩니다. 3년마다 LTS 버전(8, 11, 17, 21)이 출시되며, 비LTS 버전은 다음 버전 출시 전까지만 지원합니다.

Java 8에서 11로 바로 마이그레이션하는 프로젝트가 많기 때문에, Java 9·10의 변경 사항 중 반드시 인지해야 할 것은 **JPMS로 인한 리플렉션 제한**입니다. 특히 Spring, Hibernate 같은 프레임워크가 내부적으로 리플렉션을 많이 사용하므로, `--add-opens` JVM 플래그가 필요할 수 있습니다.

```bash
# JPMS 모듈 캡슐화로 막힌 리플렉션 임시 열기
java --add-opens java.base/java.lang=ALL-UNNAMED \
     --add-opens java.base/java.util=ALL-UNNAMED \
     -jar app.jar
```

---

**지난 글:** [Java 8 핵심 기능 총정리](/posts/java-8-features-recap/)

**다음 글:** [Java 11 핵심 기능 정리](/posts/java-11-features/)

<br>
읽어주셔서 감사합니다. 😊
