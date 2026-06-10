---
title: "Java 21 핵심 기능 정리 (LTS)"
description: "Java 21 LTS의 Virtual Threads 표준화, Pattern Matching Switch, Record Patterns, Sequenced Collections, Scoped Values Preview, String Templates Preview를 상세히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "Java21", "LTS", "Virtual Threads", "Pattern Matching", "Sequenced Collections", "Records"]
featured: false
draft: false
---

[지난 글](/posts/java-18-20-bridge/)에서 Java 18~20의 변화를 살펴봤습니다. Java 21은 2023년 9월 출시된 LTS 버전으로, **Java 11 이후 가장 많은 언어 및 플랫폼 기능이 표준화된 버전**입니다. Virtual Threads의 표준화로 동시성 프로그래밍이 단순해지고, Pattern Matching 완성으로 타입 안전 코드가 간결해졌습니다.

## Virtual Threads 표준화 (JEP 444)

Java 19·20에서 Preview를 거쳐 Java 21에서 표준화됩니다. `--enable-preview` 없이 사용 가능합니다.

```java
// 방법 1: Thread.ofVirtual()
Thread vt = Thread.ofVirtual()
    .name("request-handler-", 0)
    .start(() -> handleRequest(request));

// 방법 2: ExecutorService
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 10_000)
        .forEach(i -> executor.submit(() -> processTask(i)));
} // try-with-resources로 자동 종료

// 방법 3: Spring Boot 3.2+
// application.properties
// spring.threads.virtual.enabled=true
// → Tomcat, @Async, @Scheduled 자동 전환
```

Virtual Thread는 `Thread.isVirtual()`로 구분할 수 있습니다.

```java
Thread t = Thread.currentThread();
System.out.println(t.isVirtual()); // true (VT 내에서)
```

![Java 21 LTS 핵심 기능](/assets/posts/java-21-features-overview.svg)

## Pattern Matching for switch 표준화 (JEP 441)

Java 17~20에서 Preview를 거쳐 표준화됩니다.

```java
sealed interface Shape permits Circle, Rectangle, Triangle {}
record Circle(double radius) implements Shape {}
record Rectangle(double w, double h) implements Shape {}
record Triangle(double base, double height) implements Shape {}

// Sealed + switch → 완전성 컴파일 검증
double area(Shape shape) {
    return switch (shape) {
        case Circle c    -> Math.PI * c.radius() * c.radius();
        case Rectangle r -> r.w() * r.h();
        case Triangle t  -> 0.5 * t.base() * t.height();
        // default 불필요 — 모든 case 커버됨
    };
}

// when 절 (Guarded Pattern)
String classify(Object obj) {
    return switch (obj) {
        case null              -> "null";
        case Integer i when i < 0 -> "음수";
        case Integer i         -> "정수";
        case String s when s.isBlank() -> "빈 문자열";
        case String s          -> "문자열";
        default                -> "기타";
    };
}
```

**중요한 순서 규칙**: `when`이 있는 패턴(guarded)이 동일 타입의 일반 패턴(unguarded)보다 앞에 위치해야 합니다. 그렇지 않으면 컴파일 오류가 발생합니다.

## Record Patterns 표준화 (JEP 440)

```java
record Point(int x, int y) {}
record ColoredPoint(Point p, Color color) {}

// instanceof + Record Pattern
void printCoordinate(Object obj) {
    if (obj instanceof Point(int x, int y)) {
        System.out.printf("x=%d, y=%d%n", x, y);
    }
}

// switch + 중첩 Record Pattern
String describe(Object obj) {
    return switch (obj) {
        case ColoredPoint(Point(int x, int y), Color c) ->
            "(%d,%d) in %s".formatted(x, y, c);
        case Point(int x, int y) ->
            "(%d,%d)".formatted(x, y);
        default -> obj.toString();
    };
}

// var 패턴 — 타입 추론
if (obj instanceof Point(var x, var y)) {
    System.out.println(x + ", " + y);
}
```

## Sequenced Collections (JEP 431)

기존 컬렉션에서 첫/마지막 원소를 가져오는 방법이 컬렉션마다 달랐습니다. `SequencedCollection` 인터페이스가 이를 통일합니다.

```java
// 이전 — 컬렉션마다 다른 방법
List<Integer> list = new ArrayList<>(List.of(1, 2, 3));
list.get(0);              // 첫 원소 (List)
list.get(list.size()-1);  // 마지막 원소 (List)

LinkedList<Integer> deque = new LinkedList<>(List.of(1,2,3));
deque.getFirst();  // LinkedList/Deque
deque.getLast();   // LinkedList/Deque

// Java 21 — 통일된 인터페이스
list.getFirst();  // 1 (NoSuchElementException if empty)
list.getLast();   // 3
list.reversed();  // [3, 2, 1] (뷰 — 원본 공유)

// addFirst / addLast / removeFirst / removeLast
list.addFirst(0);   // [0, 1, 2, 3]
list.removeLast();  // [0, 1, 2]
```

![Sequenced Collections와 Pattern Matching](/assets/posts/java-21-features-sequenced.svg)

`SequencedMap`도 추가됩니다.

```java
var map = new LinkedHashMap<>(Map.of("a", 1, "b", 2, "c", 3));
map.firstEntry();  // Map.Entry<K, V>
map.lastEntry();
map.reversed();    // 역순 SequencedMap 뷰
```

## Scoped Values Preview (JEP 446)

`ThreadLocal`의 문제점(가변, Virtual Thread에서 수백만 복사본, 부모→자식 상속)을 해결하는 `ScopedValue`가 Preview로 도입됩니다.

```java
static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

void handle(HttpRequest req) {
    User user = authenticate(req);

    ScopedValue.where(CURRENT_USER, user).run(() -> {
        processOrder();
        sendNotification();
    });
}

void processOrder() {
    User user = CURRENT_USER.get(); // 현재 범위의 값
    // ...
}
```

`ScopedValue`의 특징:
- **불변**: 한번 설정하면 `where` 범위 내에서 변경 불가
- **범위 한정**: `run()` 또는 `call()` 블록 종료 시 자동 해제
- **Virtual Thread 최적화**: 수백만 VT가 동일 `ScopedValue`를 공유해도 복사본 없음

## String Templates Preview (JEP 430)

문자열 보간을 안전하게 처리하는 Template Processor가 Preview로 도입됩니다.

```java
// --enable-preview 필요
String name = "Alice";
int age = 30;

// STR 프로세서 — 단순 보간
String msg = STR."Hello, \{name}! You are \{age} years old.";

// FMT 프로세서 — 포맷 지정
String formatted = FMT."Balance: \{"%.2f".formatted(balance)}";

// 커스텀 프로세서 — SQL 이스케이핑 등
String safeSql = SQL."SELECT * FROM users WHERE name = \{userInput}";
// SQL 프로세서가 userInput을 자동으로 파라미터 바인딩
```

**주의**: String Templates는 이후 버전에서 재설계 결정이 내려져 Java 23에서 Preview 취소됩니다. 프로덕션 코드에 사용하지 않는 것을 권장합니다.

## Unnamed Patterns and Variables Preview (JEP 443)

`_`를 미사용 변수 자리에 사용할 수 있습니다.

```java
// 미사용 변수 _ 표기
try {
    processRequest();
} catch (Exception _) { // 예외 변수 불필요
    log.error("Request failed");
}

// Unnamed Pattern in switch
switch (shape) {
    case Circle c -> draw(c);
    case _        -> skip(); // 나머지 모든 타입
}

// Pattern에서 필요 없는 컴포넌트 무시
if (obj instanceof Point(int x, _)) {
    System.out.println("x=" + x); // y는 불필요
}
```

## Unnamed Classes and Instance Main Methods Preview (JEP 445)

학습·스크립팅 목적으로 `public static void main(String[] args)` 없이 실행 가능합니다.

```java
// Java 21 Preview — 클래스 선언 불필요
void main() {
    System.out.println("Hello, Java 21!");
}
```

## Java 17 → 21 마이그레이션 요점

대부분의 Java 17 코드는 수정 없이 21에서 동작합니다. 주요 확인 사항:

```bash
# 1. Virtual Threads 적용 (선택)
# Spring Boot 3.2+
spring.threads.virtual.enabled=true

# 2. Sequenced Collections API 사용 (선택적 리팩토링)
# list.get(0) → list.getFirst()

# 3. Deprecated API 정리
# Security Manager 관련 코드 제거
# Finalization 의존 코드 → try-with-resources

# 4. Pattern Matching switch로 instanceof 체인 단순화
```

Java 21은 **2031년까지 지원**되는 LTS입니다. Java 8/11에서 21로 마이그레이션하는 것이 현 시점의 가장 권장되는 업그레이드 경로입니다.

---

**지난 글:** [Java 18~20 브리지 — Virtual Threads Preview와 UTF-8 기본화](/posts/java-18-20-bridge/)

**다음 글:** [Java LTS 마이그레이션 로드맵](/posts/java-lts-migration-roadmap/)

<br>
읽어주셔서 감사합니다. 😊
