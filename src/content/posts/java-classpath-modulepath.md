---
title: "클래스패스와 모듈패스"
description: "Java의 클래스패스(-cp)와 Java 9에서 도입된 모듈패스(-p)의 차이점, module-info.java 작성 방법, 레거시 라이브러리와의 혼합 사용 전략을 실용적으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "Classpath", "ModulePath", "JPMS", "module-info", "Java9"]
featured: false
draft: false
---

[지난 글](/posts/java-jdk-tools/)에서 JDK에 포함된 다양한 도구들을 살펴봤습니다. 이번에는 `javac`와 `java` 명령에서 빠지지 않고 등장하는 `-cp`와 `-p` 옵션, 즉 **클래스패스**와 **모듈패스**를 깊이 있게 살펴봅니다. 두 개념의 차이를 정확히 이해해야 빌드 오류를 빠르게 해결하고, 모듈 시스템을 제대로 활용할 수 있습니다.

## 클래스패스(Classpath)란?

클래스패스는 JVM이 `.class` 파일을 찾을 때 탐색하는 경로 목록입니다. Java 1.0부터 존재해 온 전통적인 방식으로, JAR 파일·디렉터리·ZIP 파일을 콜론(Unix) 또는 세미콜론(Windows)으로 구분해 나열합니다.

```bash
# Unix/macOS
java -cp "lib/*:out" com.example.App

# Windows
java -cp "lib/*;out" com.example.App
```

`*` 와일드카드는 해당 디렉터리 안의 모든 JAR를 자동으로 포함합니다. 단, 하위 디렉터리는 재귀적으로 포함되지 않습니다.

### 클래스패스의 한계

클래스패스 방식은 편리하지만 규모가 커질수록 문제가 생깁니다.

- **JAR Hell**: 같은 패키지·클래스가 여러 JAR에 존재하면 먼저 발견된 것이 사용되고, 나머지는 조용히 무시됩니다.
- **캡슐화 부재**: `public` 클래스는 어느 JAR에서든 접근 가능해 내부 구현을 숨길 수 없습니다.
- **의존성 불투명**: 런타임에 어떤 JAR가 실제로 필요한지 선언 없이는 알 수 없습니다.

## 모듈패스(Module Path)와 JPMS

Java 9에서 도입된 **JPMS**(Java Platform Module System)는 이러한 한계를 해결하기 위해 **모듈**이라는 새로운 단위를 도입했습니다. 모듈은 패키지의 집합에 `module-info.java`라는 선언 파일을 추가한 것입니다.

![클래스패스 vs 모듈패스](/assets/posts/java-classpath-modulepath-comparison.svg)

모듈패스는 `-p` 또는 `--module-path` 옵션으로 지정하고, 실행할 메인 모듈은 `-m` 또는 `--module`로 지정합니다.

```bash
# 컴파일
javac -p mods -d out \
      src/module-info.java \
      src/com/example/app/Main.java

# 실행
java -p mods:out -m com.example.app/com.example.app.Main
```

## module-info.java 작성하기

`module-info.java`는 소스 루트(src/) 바로 아래, 어떤 패키지에도 속하지 않는 위치에 놓습니다.

![module-info.java 구조와 주요 지시자](/assets/posts/java-classpath-modulepath-module-info.svg)

### requires — 의존 모듈 선언

```java
module com.example.app {
    requires java.logging;           // 컴파일 + 런타임
    requires transitive java.sql;    // 전이 의존: 이 모듈 사용자도 java.sql 접근 가능
    requires static java.compiler;   // 컴파일 시에만 필요 (런타임 선택적)
}
```

`transitive`는 라이브러리가 자신의 공개 API에서 다른 모듈의 타입을 노출할 때 사용합니다. 사용자가 별도로 `requires java.sql`을 선언하지 않아도 됩니다.

### exports — 공개 패키지 선언

```java
module com.example.app {
    // 모든 모듈에 공개
    exports com.example.app.api;

    // 특정 모듈에만 공개 (한정 exports)
    exports com.example.app.internal
        to com.example.plugin, com.example.test;
}
```

`exports` 선언이 없는 패키지는 모듈 외부에서 접근할 수 없습니다. 이것이 모듈의 핵심 캡슐화 기능입니다.

### opens — 리플렉션 접근 허용

```java
module com.example.app {
    // 런타임 리플렉션 전용 공개 (컴파일 타임 접근 불가)
    opens com.example.app.model;

    // 특정 모듈에만 허용
    opens com.example.app.model to com.fasterxml.jackson.databind;
}
```

JPA, Jackson, Spring 등 리플렉션을 사용하는 프레임워크를 모듈 환경에서 사용할 때 필요합니다.

### uses / provides — 서비스 로더 선언

```java
module com.example.app {
    uses com.example.app.spi.StorageProvider;  // 소비자

    provides com.example.app.spi.StorageProvider
        with com.example.app.S3StorageProvider; // 구현체 등록
}
```

`ServiceLoader`를 사용한 플러그인 패턴에서 서비스 인터페이스와 구현체를 모듈 시스템에 등록합니다.

## 자동 모듈과 무명 모듈

레거시 JAR처럼 `module-info.class`가 없는 JAR는 모듈패스에 올리면 **자동 모듈**(automatic module)이 됩니다. 모듈 이름은 JAR 파일 이름에서 버전 접미사를 제거한 값이 됩니다(예: `guava-33.0.0-jre.jar` → `guava`). 자동 모듈은 모든 패키지를 exports하고 모든 모듈을 requires합니다.

클래스패스에 올린 JAR는 **무명 모듈**(unnamed module)이 되어 모든 named 모듈 패키지에 접근할 수 없습니다.

```text
named module → named module: exports/requires 규칙 적용
named module → unnamed module: 접근 불가 (기본)
unnamed module → named module: exports된 패키지만 접근 가능
```

## 클래스패스와 모듈패스 혼합 사용

완전한 모듈화 전환 없이도 `-cp`와 `-p`를 함께 쓸 수 있습니다. 점진적 마이그레이션 전략에서 자주 쓰입니다.

```bash
# 신규 모듈은 -p, 레거시 라이브러리는 -cp
java -p mods \
     -cp "lib/legacy-1.0.jar:out/legacy" \
     -m com.example.app/com.example.app.Main
```

## 실전 체크리스트

모듈 시스템 도입 시 자주 맞닥뜨리는 문제들과 해결 방법입니다.

```bash
# 1. 모듈이 어디서 어디로 의존하는지 확인
java -p mods -m com.example.app --describe-module

# 2. 리플렉션 접근 오류가 날 때 임시 우회 (--add-opens)
java --add-opens java.base/java.lang=ALL-UNNAMED -jar app.jar

# 3. 내부 API 사용 오류 임시 우회 (--add-exports)
java --add-exports java.base/sun.misc=ALL-UNNAMED -jar app.jar

# 4. 모듈 의존성 그래프 출력
java -p mods -m com.example.app --list-modules
```

`--add-opens`와 `--add-exports`는 임시방편이며, 근본적으로는 `module-info.java`에 올바른 `opens`/`exports` 선언을 추가하거나 리플렉션에 의존하지 않도록 코드를 개선해야 합니다.

## 정리

| 구분 | 클래스패스 | 모듈패스 |
|------|-----------|---------|
| 도입 버전 | Java 1.0 | Java 9 (JPMS) |
| 캡슐화 | 없음 | 강한 캡슐화 |
| 의존성 선언 | 없음 | requires 강제 |
| 순환 의존 감지 | 런타임 이후 | 컴파일 타임 |
| 레거시 호환 | 완벽 | 자동 모듈 경유 |
| 학습 비용 | 낮음 | 높음 |

클래스패스는 여전히 대부분의 현장에서 쓰입니다. 모듈 시스템은 대형 플랫폼이나 강한 캡슐화가 필요한 라이브러리를 개발할 때 특히 가치가 있습니다.

---

**지난 글:** [JDK 내장 도구 완전 정복](/posts/java-jdk-tools/)

**다음 글:** [Javadoc으로 API 문서 작성하기](/posts/java-javadoc/)

<br>
읽어주셔서 감사합니다. 😊
