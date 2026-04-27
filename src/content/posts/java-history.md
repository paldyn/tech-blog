---
title: "Java 역사 (1991 ~ 2023+)"
description: "Oak 언어 탄생부터 Java 21 LTS까지, Java 30년 역사의 주요 이정표와 각 버전이 남긴 유산을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["java", "history", "lts", "jdk", "openJDK"]
featured: false
draft: false
---

[지난 글](/posts/java-what-is-java/)에서 이어집니다.

## 역사를 알면 현재가 보인다

지난 글에서 Java가 언어이자 플랫폼임을 살펴봤습니다. 그런데 지금의 Java는 처음부터 이런 모습이 아니었습니다. Java는 **가전제품 소프트웨어 플랫폼**으로 시작해, 웹 애플릿 시대를 거쳐, 엔터프라이즈 서버의 왕좌에 올랐고, 이제는 클라우드·컨테이너 시대에 맞게 다시 진화 중입니다. 각 시대의 문제 의식이 버전별 기능에 그대로 녹아 있기 때문에, 역사를 알면 "왜 이 기능이 이 모양인가?"가 자연스럽게 이해됩니다.

---

## 1991 — Project Green: 가전제품을 위한 언어

1991년 Sun Microsystems의 James Gosling, Mike Sheridan, Patrick Naughton은 **Project Green**을 시작했습니다. 목표는 인터랙티브 TV, 냉장고 컨트롤러 같은 가전제품용 소프트웨어 플랫폼이었습니다. 당시 가전 시장은 수십 개의 서로 다른 CPU와 OS를 사용했고, 개발자가 각 기기마다 별도로 코드를 작성해야 했습니다.

Gosling은 기존 C++을 사용해 보다가 한계를 느끼고 새로운 언어를 설계했습니다. 처음 이름은 **Oak**(참나무)였는데, 창문 밖에 보이는 나무에서 따온 이름이었습니다. 그러나 상표 등록 과정에서 이미 Oak라는 이름을 쓰는 회사가 있어 다른 이름이 필요했습니다. 팀원들이 커피숍에서 토론하다가 **Java**(인도네시아 자바 섬산 커피)로 결정했다는 유명한 일화가 있습니다.

가전제품 시장 진출은 실패했습니다. 하지만 이 과정에서 탄생한 핵심 아이디어—플랫폼 독립적 바이트코드와 가상 머신—는 다음 기회를 기다렸습니다.

---

## 1995 — 인터넷의 폭발과 Java 1.0

1993~1994년 Mosaic 브라우저의 등장으로 인터넷이 대중화되자, Sun 팀은 즉시 방향을 전환했습니다. "다양한 기기에서 실행되는 코드"는 "다양한 OS의 브라우저에서 실행되는 코드"로 그대로 적용됐습니다.

1995년 5월, **Java 1.0**이 공개됐습니다. Netscape Navigator 2.0에 탑재된 **Java Applet**은 웹 페이지 안에서 인터랙티브 프로그램을 실행할 수 있게 했습니다. "Write Once, Run Anywhere" 슬로건과 함께 Java는 순식간에 개발자들의 관심을 받았습니다.

![Java 역사 타임라인](/assets/posts/java-history-timeline.svg)

---

## 1998~2004 — Java 2와 엔터프라이즈 시대

### Java 1.2 (1998) — Java 2의 시작

Java 1.2는 브랜딩에서도 중요한 전환점이었습니다. Sun은 이 버전부터 "Java 2"라는 이름을 사용했고, 세 가지 에디션을 도입했습니다.

- **J2SE**: 일반 애플리케이션
- **J2EE**: 엔터프라이즈 서버 (서블릿, JSP, EJB)
- **J2ME**: 임베디드/모바일

기술적으로는 **Collections Framework**, **Swing GUI**, **JIT 컴파일러**가 추가됐습니다.

### Java 5 (2004) — 역사적인 언어 혁신

Java 5는 언어 문법 측면에서 **1.0 이후 가장 큰 변화**였습니다.

```java
// Java 5 이전 — 제네릭 없음, 캐스팅 필요
List list = new ArrayList();
list.add("hello");
String s = (String) list.get(0); // 런타임 ClassCastException 위험

// Java 5 이후 — 제네릭으로 컴파일 타임 타입 안전성
List<String> typed = new ArrayList<>();
typed.add("hello");
String safe = typed.get(0); // 캐스팅 불필요, 안전
```

Java 5에서 추가된 핵심 기능:
- **Generics(제네릭)**: 타입 파라미터, `List<T>`
- **Annotations(어노테이션)**: `@Override`, `@Deprecated`, 커스텀 어노테이션
- **Autoboxing/Unboxing**: `int` ↔ `Integer` 자동 변환
- **Enhanced for-each**: `for (String s : list) {...}`
- **Enumerations(enum)**: 타입 안전한 열거형
- **Varargs**: `void print(String... msgs)`

---

## 2006~2010 — 오픈소스화와 오라클 인수

### 2006 — OpenJDK: Java의 오픈소스화

Sun은 2006년 Java SE를 **GPL v2 라이선스**로 오픈소스 공개했습니다. **OpenJDK(Open Java Development Kit)** 프로젝트가 시작되며 커뮤니티 주도 개발이 가능해졌습니다. 현재 Java 생태계의 다양한 배포판(Temurin, Corretto, Zulu 등)이 모두 OpenJDK를 기반으로 합니다.

### 2010 — Oracle의 Sun 인수

Oracle이 Sun Microsystems를 **74억 달러**에 인수하면서 Java의 소유권도 Oracle로 넘어갔습니다. 이는 이후 Java 라이선스 정책 변화와 OpenJDK 생태계 다양화의 출발점이 됐습니다.

### Java 7 (2011) — Project Coin

작은 언어 개선 모음인 **Project Coin**으로 개발 편의성이 높아졌습니다.

```java
// try-with-resources: AutoCloseable 구현체 자동 close()
try (BufferedReader br = new BufferedReader(new FileReader("file.txt"))) {
    String line = br.readLine();
    System.out.println(line);
}

// Diamond operator: 우변에서 타입 추론
List<Map<String, Integer>> map = new ArrayList<>();

// multi-catch
try {
    // ...
} catch (IOException | SQLException e) {
    e.printStackTrace();
}
```

`java.nio.file` (NIO.2), Fork/Join 프레임워크도 Java 7에서 등장했습니다.

---

## 2014 — Java 8 LTS: 함수형 혁명

Java 8은 출시 이후 **10년 가까이 가장 널리 사용된 버전**입니다. Lambda와 Stream API로 함수형 프로그래밍 패러다임이 Java로 들어왔습니다.

```java
// Java 8 이전 — 익명 내부 클래스
List<String> names = Arrays.asList("Charlie", "Alice", "Bob");
Collections.sort(names, new Comparator<String>() {
    @Override
    public int compare(String a, String b) {
        return a.compareTo(b);
    }
});

// Java 8 이후 — Lambda + Stream
List<String> filtered = names.stream()
    .sorted()
    .filter(n -> n.startsWith("A"))
    .collect(Collectors.toList());
```

Java 8의 핵심 추가 기능:
- **Lambda 표현식**: `(a, b) -> a + b`
- **Stream API**: 선언적 데이터 처리
- **Optional**: null 안전 래퍼
- **java.time**: Joda-Time 기반의 새 날짜/시간 API
- **default/static 인터페이스 메서드**
- **CompletableFuture**: 비동기 프로그래밍

---

## 2017 이후 — 6개월 릴리스 사이클과 모듈 시스템

### Java 9 (2017) — Jigsaw와 새 릴리스 사이클

Java 9는 두 가지 측면에서 역사적입니다. 첫째, **Java Platform Module System(JPMS)**—코드명 Project Jigsaw—으로 JDK 자체가 모듈로 분리됐습니다. 둘째, 이 버전부터 **6개월마다 새 버전을 출시**하는 "기차 모델"이 도입됐습니다.

```java
// module-info.java (Java 9+)
module com.example.app {
    requires java.net.http;
    exports com.example.app.api;
}
```

### Java 11 LTS (2018) — 현대적 표준 HTTP

Java 11은 Java 8 이후 첫 LTS로, Oracle이 이 버전부터 **상업적 사용에 유료 라이선스**를 적용했습니다. 이로 인해 Adoptium Temurin, Amazon Corretto, Azul Zulu 등 무료 OpenJDK 배포판이 급성장했습니다.

```java
// Java 11 LTS — HttpClient (java.net.http)
HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://example.com"))
    .GET()
    .build();
HttpResponse<String> response = client.send(
    request,
    HttpResponse.BodyHandlers.ofString()
);
System.out.println(response.statusCode());

// Java 11 LTS — String 신규 메서드
"  hello  ".strip();         // trim()의 유니코드 인식 버전
"".isBlank();                // true
"a\nb\nc".lines().count();   // 3
```

---

## 2021~2023 — Java 17 / 21 LTS: 현대 Java의 완성

![LTS 버전별 핵심 기능 비교](/assets/posts/java-history-lts.svg)

### Java 17 LTS (2021) — sealed · Records · 패턴 매칭

Java 12~16에서 preview로 제안됐던 기능들이 Java 17에서 정식(GA)으로 확정됐습니다.

```java
// Java 17 LTS — sealed 클래스와 Records
public sealed interface Shape
    permits Circle, Rectangle {}

public record Circle(double radius) implements Shape {}
public record Rectangle(double w, double h) implements Shape {}

// instanceof 패턴 매칭 (Java 16 정식)
Object obj = new Circle(5.0);
if (obj instanceof Circle c) {
    System.out.println("반지름: " + c.radius());
}
```

Oracle은 Java 17부터 **NFTC(No-Fee Terms and Conditions)** 라이선스로 전환해 개발·프로덕션 모두 무료로 사용할 수 있게 했습니다. Spring Boot 3.x, Jakarta EE 10도 Java 17을 기준선으로 삼았습니다.

### Java 21 LTS (2023) — Virtual Threads와 패턴 매칭 완성

Java 21은 **Project Loom의 Virtual Threads**가 정식 진입한 버전입니다.

```java
// Java 21 LTS — Virtual Threads
// 기존 플랫폼 스레드: OS 스레드 1:1 매핑, 수천 개 한계
Thread platformThread = new Thread(() -> {
    System.out.println("플랫폼 스레드");
});

// Java 21 LTS: Virtual Thread (JVM 관리, 수십만 개 생성 가능)
Thread vThread = Thread.ofVirtual().start(() ->
    System.out.println("가상 스레드")
);

// ExecutorService로 대량 사용
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 10_000; i++) {
        final int task = i;
        executor.submit(() -> processTask(task));
    }
}
```

switch 패턴 매칭, Record Patterns, Sequenced Collections도 Java 21에서 정식화됐습니다.

---

## 6개월 릴리스 사이클 이해하기

Java 9 이후 릴리스 모델이 완전히 바뀌었습니다.

```text
Java 8 LTS (2014)
  → Java 9 (2017) → 10 (2018)
  → Java 11 LTS (2018)
  → 12 → 13 → 14 → 15 → 16
  → Java 17 LTS (2021)
  → 18 → 19 → 20
  → Java 21 LTS (2023)
  → 22 → 23 → 24
  → Java 25 LTS (2025 예정)
```

- **LTS**: 약 3년 주기 출시, 최소 8년 유지보수 (Oracle 기준)
- **비LTS**: 6개월마다 출시, 다음 버전이 나오면 EOL

실무에서는 LTS 버전만 사용하는 것이 일반적입니다. 현재 활성 LTS는 Java 8, 11, 17, 21입니다.

---

## 역사가 남긴 교훈

Java 30년 역사를 돌아보면 몇 가지 패턴이 보입니다.

1. **필요가 언어를 만든다**: Lambda는 함수형 패턴 수요, Virtual Threads는 고동시성 서비스 수요에서 탄생했습니다.
2. **하위 호환성은 철칙**: Java는 1.0 코드가 21에서도 대부분 동작합니다. 이것이 Java의 가장 큰 강점이자 언어 진화를 느리게 하는 이유입니다.
3. **오픈소스가 생태계를 지켰다**: Oracle JDK 유료화 이후에도 OpenJDK 배포판들이 생태계를 유지했습니다.

---

**지난 글:** [Java란 무엇인가](/posts/java-what-is-java/)

<br>
읽어주셔서 감사합니다. 😊
