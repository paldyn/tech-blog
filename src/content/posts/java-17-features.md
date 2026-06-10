---
title: "Java 17 핵심 기능 정리 (LTS)"
description: "Java 17 LTS의 Sealed Classes 표준화, Pattern Matching Switch Preview, Strong Encapsulation, RandomGenerator API, macOS AArch64 지원, 보안 강화와 제거된 항목을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "Java17", "LTS", "Sealed Classes", "Pattern Matching", "Strong Encapsulation"]
featured: false
draft: false
---

[지난 글](/posts/java-12-16-bridge/)에서 Java 12~16에서 Preview로 도입된 언어 기능들을 살펴봤습니다. Java 17은 2021년 9월 출시된 LTS 버전으로, Java 11 이후 두 번째 LTS입니다. **많은 기업이 현재 Java 17로 마이그레이션 완료했거나 진행 중이며**, Spring Boot 3.x가 Java 17을 최소 버전으로 요구하는 버전이기도 합니다.

## Sealed Classes (JEP 409) — 표준화

Java 15·16에서 Preview를 거쳐 Java 17에서 표준화됩니다. `sealed`는 어떤 클래스/인터페이스가 이 타입을 상속/구현할 수 있는지 명시적으로 선언합니다.

![Java 17 핵심 기능 개요](/assets/posts/java-17-features-overview.svg)

```java
// sealed interface 선언
public sealed interface Shape
    permits Circle, Rectangle, Triangle {}

// permits에 명시된 타입만 구현 가능
public record Circle(double radius) implements Shape {}
public record Rectangle(double width, double height) implements Shape {}

// non-sealed — 이 클래스는 다시 자유롭게 상속 가능
public non-sealed class Triangle implements Shape {
    private final double base, height;
    // ...
}

// sealed class (interface 아님)
public sealed class Expr
    permits Num, Add, Mul {}

public record Num(int value) extends Expr {}
public record Add(Expr left, Expr right) extends Expr {}
public record Mul(Expr left, Expr right) extends Expr {}
```

Sealed Classes의 핵심 가치는 **Pattern Matching과의 시너지**입니다. 컴파일러가 모든 허용된 하위 타입을 알고 있으므로, switch에서 모든 경우를 다뤘는지 컴파일 타임에 검증합니다.

## Pattern Matching for Switch Preview (JEP 406)

Java 16에서 표준화된 `instanceof` 패턴 매칭이 `switch`로 확장됩니다. Java 17에서는 Preview 상태이며, Java 21에서 표준화됩니다.

```java
// --enable-preview 필요 (Java 17)
// Java 21에서는 표준
static double area(Shape shape) {
    return switch (shape) {
        case Circle c    -> Math.PI * c.radius() * c.radius();
        case Rectangle r -> r.width() * r.height();
        case Triangle t  -> 0.5 * t.base() * t.height();
        // Sealed interface이므로 default 불필요
        // 모든 경우가 커버됨을 컴파일러가 검증
    };
}
```

![Sealed Classes와 Pattern Matching](/assets/posts/java-17-features-sealed.svg)

**Guarded Pattern** — `when` 절로 조건을 추가할 수 있습니다.

```java
String classify(Object obj) {
    return switch (obj) {
        case Integer i when i < 0  -> "음수 정수";
        case Integer i when i == 0 -> "영";
        case Integer i             -> "양수 정수";
        case String s when s.isBlank() -> "빈 문자열";
        case String s              -> "문자열: " + s;
        case null                  -> "null";
        default                    -> "기타: " + obj.getClass();
    };
}
```

`null` 처리도 switch에서 직접 가능합니다. 이전에는 switch에 null을 넣으면 `NullPointerException`이 발생했습니다.

## Strong Encapsulation (JEP 403)

Java 9부터 경고로 표시되던 `--illegal-access` 플래그가 Java 17에서 완전히 제거됩니다. JDK 내부 API에 대한 리플렉션 접근이 기본적으로 차단됩니다.

```bash
# Java 16까지 동작
java --illegal-access=permit -jar app.jar

# Java 17부터: 플래그 자체가 없음 → InaccessibleObjectException
# 합법적 접근이 필요하면 명시적으로:
java --add-opens java.base/java.util=ALL-UNNAMED -jar app.jar
```

**마이그레이션 영향**: Spring Framework 5.x 이하, Hibernate ORM 5.x 이하, 일부 레거시 라이브러리가 내부 API에 의존했습니다. Spring Boot 3.x(Spring Framework 6.x)는 Java 17 Strong Encapsulation을 완전히 지원합니다.

## RandomGenerator API (JEP 356)

기존 `Random`, `ThreadLocalRandom`, `SplittableRandom`의 공통 인터페이스가 없어 교체가 어려웠습니다. Java 17에서 `RandomGenerator` 인터페이스 계층구조가 도입됩니다.

```java
import java.util.random.RandomGenerator;
import java.util.random.RandomGeneratorFactory;

// 기본 사용
RandomGenerator rng = RandomGenerator.getDefault();
int n = rng.nextInt(100); // 0~99

// 알고리즘 선택
RandomGenerator fast = RandomGeneratorFactory
    .of("Xoroshiro128PlusPlus")
    .create();

// 사용 가능한 알고리즘 목록
RandomGeneratorFactory.all()
    .map(RandomGeneratorFactory::name)
    .sorted()
    .forEach(System.out::println);

// SplittableGenerator — Fork/Join에 적합
var splittable = RandomGeneratorFactory
    .of("L64X128MixRandom")
    .create();
```

## Context-Specific Deserialization Filters (JEP 415)

Java 역직렬화 취약점에 대응하기 위해 JVM 전체 수준의 직렬화 필터를 설정할 수 있습니다.

```java
// JVM 전역 필터 설정
ObjectInputFilter globalFilter = ObjectInputFilter.Config
    .createFilter("maxbytes=1000;maxdepth=20;!*");

ObjectInputFilter.Config.setSerialFilter(globalFilter);

// 컨텍스트별 필터 (스트림마다 다른 필터 적용)
ObjectInputFilter contextFilter = info -> {
    if (info.serialClass() != null) {
        String name = info.serialClass().getName();
        if (name.startsWith("com.trusted.")) {
            return ObjectInputFilter.Status.ALLOWED;
        }
        return ObjectInputFilter.Status.REJECTED;
    }
    return ObjectInputFilter.Status.UNDECIDED;
};
```

## macOS 관련 개선 (JEP 382, 391)

- **JEP 382**: macOS Rendering Pipeline — Metal API 기반 렌더링 (OpenGL 대체)
- **JEP 391**: macOS/AArch64 포팅 — Apple Silicon(M1, M2) 네이티브 지원

```bash
# Apple Silicon에서 네이티브 JDK 확인
java -XshowSettings:all 2>&1 | grep os.arch
# os.arch = aarch64
```

## 제거 및 Deprecated 항목

**RMI Activation 제거 (JEP 407)**

```java
// 이전 코드 — Java 17에서 컴파일 오류
import java.rmi.activation.Activatable; // NoClassDefFoundError
```

**Applet API Deprecated for Removal (JEP 398)**

```java
// 이미 브라우저 지원이 끊겼으므로 코드에서 제거 권장
@Deprecated(forRemoval = true)
public class Applet extends Panel {}
```

**Security Manager Deprecated for Removal (JEP 411)**

```java
// System.setSecurityManager() — Deprecated for Removal
// 사용 중이면 대안 검토 필요 (Java 21에서 제거 예정)
```

## Java 11 → 17 마이그레이션 요점

```bash
# 1. --illegal-access 경고 → 에러로 전환 확인
java --illegal-access=deny -jar app.jar  # Java 11~16에서 미리 테스트

# 2. 종속성 업그레이드
# Spring Boot: 2.x → 3.x (필요 시)
# Hibernate: 5.x → 6.x
# Jackson: 2.12+

# 3. javac 경고 사이프
javac --source 17 --target 17 ... 2>&1 | grep -v "^Note:"
```

Java 17은 Java 21이 등장하기 전까지 **실질적인 현대 Java의 기준**이었습니다. Sealed Classes + Records + Pattern Matching for instanceof의 삼각 편대가 완성됨으로써, 함수형 스타일과 타입 안전 패턴 처리가 Java에서 자연스럽게 표현됩니다.

---

**지난 글:** [Java 12~16 브리지 — Switch 표현식·Text Block·Records·Pattern Matching](/posts/java-12-16-bridge/)

**다음 글:** [Java 18~20 브리지](/posts/java-18-20-bridge/)

<br>
읽어주셔서 감사합니다. 😊
