---
title: "Java 18~20 브리지 — Virtual Threads Preview와 UTF-8 기본화"
description: "Java 18의 UTF-8 기본 인코딩·Simple Web Server, Java 19·20의 Virtual Threads Preview, Structured Concurrency, Record Patterns, Scoped Values 등 Java 21 LTS의 준비 단계를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "Java18", "Java19", "Java20", "Virtual Threads", "UTF-8", "Record Patterns"]
featured: false
draft: false
---

[지난 글](/posts/java-17-features/)에서 Java 17 LTS의 핵심 기능을 살펴봤습니다. Java 18부터 20까지는 LTS가 아니지만, **Java 21의 대표 기능들(Virtual Threads, Record Patterns, Pattern Matching Switch, Scoped Values)이 모두 이 시기에 Preview를 거칩니다.** 아울러 Java 18에서 UTF-8이 기본 인코딩으로 통일되는, 오랫동안 기다려온 변화도 포함됩니다.

## Java 18 (2022년 3월)

### UTF-8 기본 Charset (JEP 400)

Java 18 이전에는 `Charset.defaultCharset()`이 플랫폼마다 달랐습니다. Linux는 UTF-8이지만 Windows는 종종 Cp1252, 한국어 Windows는 EUC-KR이어서 `new FileReader("file.txt")`가 플랫폼마다 다르게 동작했습니다.

```java
// Java 18부터 — 플랫폼 무관하게 UTF-8
System.out.println(Charset.defaultCharset()); // UTF-8

// 이전 방식 — 명시적 인코딩 필요
BufferedReader reader = new BufferedReader(
    new InputStreamReader(stream, StandardCharsets.UTF_8)
);

// Java 18 이후 — 그냥 사용해도 UTF-8
BufferedReader reader = new BufferedReader(
    new InputStreamReader(stream) // UTF-8 보장
);

// 기존 동작 유지가 필요하면
// java -Dfile.encoding=COMPAT app.jar
// java -Dfile.encoding=EUC-KR app.jar
```

**주의**: UTF-8 기본화로 기존 코드가 다르게 동작할 수 있습니다. `FileReader`, `FileWriter`, `PrintStream` 등을 명시적 인코딩 없이 사용한 코드를 검토해야 합니다.

### Simple Web Server (JEP 408)

```bash
# 현재 디렉토리를 0.0.0.0:8000에서 서빙
$ jwebserver

# 포트와 디렉토리 지정
$ jwebserver -p 3000 -d ./build -o verbose

# 출력 예시
Serving /home/user/build and subdirectories on 0.0.0.0 port 3000
URL http://0.0.0.0:3000/
```

테스트·프로토타이핑용으로만 설계된 최소 HTTP 서버입니다. HTTPS, CGI, 서블릿 등은 지원하지 않습니다.

```java
// 프로그래매틱 사용
import com.sun.net.httpserver.*;

var addr = new InetSocketAddress(8080);
var root = Path.of("/var/www");
var server = SimpleFileServer.createFileServer(
    addr, root, OutputLevel.VERBOSE
);
server.start();
```

### Finalization Deprecated for Removal (JEP 421)

`Object.finalize()`가 Deprecated for Removal로 지정됩니다. `finalize()`는 GC 시점 예측 불가, 스레드 안전 미보장, 성능 저하 등의 문제로 오랫동안 사용 자제가 권고됐습니다.

```java
// ❌ finalize 사용 금지
@Override
protected void finalize() throws Throwable {
    cleanup(); // 호출 보장 없음
}

// ✅ try-with-resources + AutoCloseable
try (var resource = new Resource()) {
    resource.use();
} // 블록 종료 시 확실한 close() 호출
```

### @snippet Javadoc 태그 (JEP 413)

```java
/**
 * 예시:
 * {@snippet :
 * List<String> names = List.of("Alice", "Bob");
 * names.forEach(System.out::println); // @highlight substring="forEach"
 * }
 */
public interface MyList {}
```

Javadoc에 코드 예제를 삽입하고 구문 강조, 참조 검증을 지원합니다.

![Java 18-20 주요 기능](/assets/posts/java-18-20-bridge-features.svg)

## Java 19 (2022년 9월)

### Virtual Threads Preview (JEP 425)

```java
// --enable-preview 필요 (Java 19)
// Java 21에서 표준화

// Thread.ofVirtual()
Thread vt = Thread.ofVirtual().start(() -> {
    System.out.println("Virtual Thread");
});

// ExecutorService
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 10_000; i++) {
        executor.submit(() -> handleRequest());
    }
}
```

### Structured Concurrency Incubator (JEP 428)

```java
// jdk.incubator.concurrent 모듈 필요
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Future<String> user   = scope.fork(() -> fetchUser(id));
    Future<Order>  order  = scope.fork(() -> fetchOrder(id));
    scope.join();
    scope.throwIfFailed();
    return new Result(user.get(), order.get());
}
```

### Record Patterns Preview (JEP 405)

```java
// Record 분해 패턴
record Point(int x, int y) {}
record ColoredPoint(Point p, String color) {}

// instanceof + 분해
if (obj instanceof Point(int x, int y)) {
    System.out.printf("x=%d, y=%d%n", x, y);
}

// switch + 중첩 Record 분해
switch (shape) {
    case ColoredPoint(Point(var x, var y), var c) ->
        System.out.printf("(%d,%d) in %s%n", x, y, c);
}
```

![Record Patterns와 jwebserver](/assets/posts/java-18-20-bridge-code.svg)

## Java 20 (2023년 3월)

### Virtual Threads Second Preview (JEP 436)

Java 19의 Preview 이후 API 안정화 작업이 이루어집니다. 실질적인 변경은 거의 없으며, 표준화를 위한 마지막 Preview입니다.

### Scoped Values Incubator (JEP 429)

`ThreadLocal`의 한계(가변, 무거운 복사, VT에서 수백만 복사본 문제)를 해결하는 `ScopedValue`가 도입됩니다.

```java
// jdk.incubator.concurrent
static final ScopedValue<String> PRINCIPAL = ScopedValue.newInstance();

void handle(String user) {
    ScopedValue.where(PRINCIPAL, user).run(() -> {
        processRequest();
        // 내부 어디서든 PRINCIPAL.get()으로 접근
    });
}

void processRequest() {
    String user = PRINCIPAL.get(); // 현재 범위의 값
}
```

### Structured Concurrency Second Preview (JEP 437)

API 세부 조정 후 두 번째 Preview.

### Pattern Matching Switch Third Preview (JEP 433)

`when` 절 문법 확정, null 처리 안정화.

## 정리 — Java 18~20이 Java 21에 남긴 것

| 기능 | 상태 | Java 21 |
|---|---|---|
| Virtual Threads | 19·20 Preview | 표준화 (JEP 444) |
| Structured Concurrency | 19·20 Preview | Preview 유지 (JEP 453) |
| Record Patterns | 19·20 Preview | 표준화 (JEP 440) |
| Pattern Match Switch | 17~20 Preview | 표준화 (JEP 441) |
| Scoped Values | 20 Incubator | Preview (JEP 446) |
| UTF-8 Default | 18 표준 | 유지 |

Java 18~20은 새로운 패러다임의 기능들이 안정화되는 과정입니다. 프로덕션 코드에는 Java 17 또는 Java 21을 사용하고, 이 시기의 변화는 Java 21에서 완성된 형태로 학습하는 것이 효율적입니다.

---

**지난 글:** [Java 17 핵심 기능 정리 (LTS)](/posts/java-17-features/)

**다음 글:** [Java 21 핵심 기능 정리 (LTS)](/posts/java-21-features/)

<br>
읽어주셔서 감사합니다. 😊
