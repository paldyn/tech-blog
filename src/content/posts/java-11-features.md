---
title: "Java 11 핵심 기능 정리"
description: "Java 11 LTS의 핵심 변화인 HTTP Client API 표준화, String 신규 메서드, Lambda에서 var 사용, Files 유틸리티 추가, ZGC 도입, Java EE 모듈 제거를 코드 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "Java11", "LTS", "HTTP Client", "String", "ZGC", "마이그레이션"]
featured: false
draft: false
---

[지난 글](/posts/java-9-10-bridge/)에서 Java 9·10의 핵심 변화를 살펴봤습니다. Java 11은 Java 8 이후 첫 번째 LTS 버전으로, 2018년 9월 출시됩니다. 많은 기업이 Java 8에서 **Java 11로 직접 마이그레이션**한 버전이며, HTTP Client 표준화·String 메서드 확충·Java EE 모듈 제거 등 실용적인 변화가 가득합니다.

## 새로운 HTTP Client API (JEP 321)

Java 9에서 인큐베이터로 도입된 HTTP Client가 Java 11에서 **`java.net.http` 패키지로 표준화**됩니다. 기존 `HttpURLConnection`의 불편함(스트리밍 비지원, 비동기 없음, HTTP/2 불가)을 모두 해결했습니다.

![HTTP Client 동기 vs 비동기](/assets/posts/java-11-features-httpclient.svg)

```java
// HttpClient 공유 인스턴스 (재사용 권장)
HttpClient client = HttpClient.newBuilder()
    .version(HttpClient.Version.HTTP_2) // HTTP/2 선호
    .followRedirects(HttpClient.Redirect.NORMAL)
    .connectTimeout(Duration.ofSeconds(10))
    .build();

// 동기 GET
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.example.com/users"))
    .header("Accept", "application/json")
    .timeout(Duration.ofSeconds(30))
    .GET()
    .build();

HttpResponse<String> response =
    client.send(request, HttpResponse.BodyHandlers.ofString());

System.out.println(response.statusCode()); // 200
System.out.println(response.body());
```

비동기 방식은 `CompletableFuture`를 반환합니다.

```java
// 비동기 요청 체이닝
client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
    .thenApply(HttpResponse::body)
    .thenApply(this::parseUsers)
    .exceptionally(ex -> {
        log.error("HTTP error", ex);
        return Collections.emptyList();
    })
    .thenAccept(users -> updateCache(users));
```

## String 신규 메서드

![Java 11 핵심 기능](/assets/posts/java-11-features-overview.svg)

Java 11에서 `String` 클래스에 유용한 메서드가 추가됩니다.

```java
// strip() — Unicode 인식 공백 제거 (trim() 대체)
"  hello  ".strip()       // "hello"
"  hello  ".stripLeading() // "hello  "
"  hello  ".stripTrailing() // "  hello"

// isBlank() — 공백만 있으면 true
"".isBlank()       // true
"  ".isBlank()     // true
" a ".isBlank()    // false

// lines() — 줄 단위 Stream 반환
"line1\nline2\nline3"
    .lines()
    .map(String::strip)
    .collect(Collectors.toList()); // ["line1", "line2", "line3"]

// repeat() — 반복
"ha".repeat(3); // "hahaha"
"-".repeat(20); // "--------------------"
```

**`strip()` vs `trim()`**: `trim()`은 ASCII 공백(코드포인트 ≤ 32)만 제거합니다. `strip()`은 `Character.isWhitespace()`를 사용해 유니코드 공백(예: ` ` EM SPACE)도 제거합니다. 새 코드에서는 `strip()` 사용을 권장합니다.

## Lambda 파라미터에서 var 사용 (JEP 323)

Java 10에서 도입된 `var`를 Lambda 파라미터에도 사용할 수 있게 됩니다.

```java
// Java 10까지 — Lambda에서 var 불가
list.stream().map((String s) -> s.toUpperCase()); // 타입 명시

// Java 11 — var 사용 가능
list.stream().map((var s) -> s.toUpperCase());

// 가장 큰 장점: var + 어노테이션 조합
list.stream()
    .filter((@NotNull var s) -> !s.isBlank())
    .map((@NonNull var s) -> s.trim());
// 타입 추론을 유지하면서 어노테이션을 붙일 수 있음
// (타입 생략 시 어노테이션 붙일 위치가 없음)
```

## Files 유틸리티 메서드

```java
// Files.readString / writeString (Java 11)
Path path = Path.of("/tmp/data.txt");

// 파일 전체 읽기 — 인코딩 지정 가능
String content = Files.readString(path);
String utf8Content = Files.readString(path, StandardCharsets.UTF_8);

// 파일 쓰기
Files.writeString(path, "Hello, Java 11!");
Files.writeString(path, content, StandardOpenOption.APPEND);

// 이전 방식 (Java 7~10)
String old = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
Files.write(path, "text".getBytes(StandardCharsets.UTF_8));
```

## 중첩 클래스 접근 개선 (JEP 181, Nest-based Access)

```java
public class Outer {
    private int value = 42;

    class Inner {
        void print() {
            // Java 11 이전: 컴파일러가 합성 접근자 메서드 생성
            // Java 11: 직접 접근 (바이트코드 수준 개선)
            System.out.println(value); // Outer.this.value
        }
    }
}
```

이 변경은 코드를 직접 바꾸지 않아도 적용되는 JVM 수준 개선입니다. 리플렉션으로 중첩 클래스의 private 멤버에 접근할 때 발생하던 `IllegalAccessException`을 방지합니다.

## ZGC 실험적 도입 (JEP 333)

Garbage Collector ZGC(Z Garbage Collector)가 Linux에서 실험적으로 도입됩니다.

```bash
# ZGC 활성화
java -XX:+UseZGC -Xmx16g app.jar

# ZGC 목표
# - STW(Stop-The-World) 시간 < 10ms
# - 힙 크기에 관계없이 일정한 STW 시간
# - 최대 수 TB 힙 지원
```

Java 11의 ZGC는 실험적(experimental) 수준이며, Java 15에서 production-ready가 됩니다.

## Java EE 모듈 제거

Java 11에서 Java EE 관련 모듈이 JDK에서 완전 제거됩니다. 이것이 **Java 8→11 마이그레이션에서 가장 자주 발생하는 컴파일 오류**입니다.

```xml
<!-- 제거된 모듈들 — Jakarta EE 의존성으로 대체 필요 -->
<!-- javax.xml.ws (JAXWS) -->
<dependency>
    <groupId>jakarta.xml.ws</groupId>
    <artifactId>jakarta.xml.ws-api</artifactId>
    <version>3.0.1</version>
</dependency>

<!-- javax.annotation.* -->
<dependency>
    <groupId>jakarta.annotation</groupId>
    <artifactId>jakarta.annotation-api</artifactId>
    <version>2.1.1</version>
</dependency>

<!-- javax.activation (JAF) -->
<dependency>
    <groupId>jakarta.activation</groupId>
    <artifactId>jakarta.activation-api</artifactId>
    <version>2.1.2</version>
</dependency>
```

**패키지 이름 변경**: `javax.*` → `jakarta.*` (Spring Boot 3.x가 Jakarta EE 9+를 요구하는 이유도 여기 있습니다.)

## 단일 파일 소스 실행 (JEP 330)

```bash
# Java 11부터 javac 없이 직접 실행 가능
java HelloWorld.java

# 스크립트처럼 사용 가능 (shebang 지원)
#!/usr/bin/java --source 11
public class Script {
    public static void main(String[] args) {
        System.out.println("Scripting with Java!");
    }
}
```

## Java 8 → 11 마이그레이션 체크리스트

1. `javax.*` → `jakarta.*` 패키지 의존성 추가
2. Nashorn 사용 코드 → GraalVM JS 또는 다른 솔루션으로 교체
3. `--illegal-access` 경고 확인 (JPMS 강한 캡슐화)
4. Applet, `appletviewer` 코드 제거
5. `new URL()` 생성자 사용 확인 (URL 처리 방식 변경 예고)
6. G1GC 기본 GC로 성능 테스트

---

**지난 글:** [Java 9·10 주요 변경 사항 브리지](/posts/java-9-10-bridge/)

**다음 글:** [Java 12~16 브리지 — Switch 표현식·Records·Sealed Classes](/posts/java-12-16-bridge/)

<br>
읽어주셔서 감사합니다. 😊
