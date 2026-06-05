---
title: "BufferedReader/Writer — 버퍼링 IO와 줄 단위 처리"
description: "Java BufferedReader Writer 완전 분석 — 버퍼링 동작 원리와 성능 차이, readLine() EOF null 처리, lines() Stream API, BufferedWriter newLine(), PrintWriter autoFlush, 인코딩 지정 방법"
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "BufferedReader", "BufferedWriter", "PrintWriter", "readLine", "IO", "버퍼링"]
featured: false
draft: false
---

[지난 글](/posts/java-streams-byte-char/)에서 바이트 스트림과 문자 스트림의 핵심 API를 살펴봤다. 이번에는 실무에서 가장 자주 쓰이는 **`BufferedReader`와 `BufferedWriter`**를 깊이 파고든다. 버퍼링이 성능에 어떤 차이를 만드는지, `readLine()`의 올바른 사용법, `PrintWriter`의 `autoFlush`까지 다룬다.

## 왜 BufferedReader가 필요한가

`FileReader`의 `read()`는 한 번 호출할 때마다 **시스템 콜(커널 모드 전환)**을 발생시킨다. 10만 문자를 읽으면 10만 번의 시스템 콜이 일어난다. 이는 성능에 치명적이다.

`BufferedReader`는 내부에 **기본 8192 chars(약 16KB)** 의 버퍼를 두고, 한 번의 시스템 콜로 대량의 데이터를 읽어온 후 버퍼에서 순차적으로 제공한다.

```java
// 성능 비교
// 1,000줄 파일 읽기 — FileReader 직접 (느림): ~수백 ms
// 1,000줄 파일 읽기 — BufferedReader 사용 (빠름): ~수 ms
```

![BufferedReader 버퍼링 동작 원리](/assets/posts/java-bufferedreader-mechanism.svg)

## BufferedReader 생성 방법

```java
// 방법 1: 전통적 방식 (인코딩 명시)
BufferedReader br = new BufferedReader(
    new InputStreamReader(new FileInputStream("data.txt"), StandardCharsets.UTF_8));

// 방법 2: Files.newBufferedReader (Java 7+, 권장)
BufferedReader br = Files.newBufferedReader(Path.of("data.txt"), StandardCharsets.UTF_8);

// 방법 3: 버퍼 크기 커스텀
BufferedReader br = new BufferedReader(
    new InputStreamReader(is, StandardCharsets.UTF_8), 32768); // 32KB 버퍼

// 항상 try-with-resources 사용
try (BufferedReader br = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
    // 사용
}
```

## readLine() — 줄 단위 읽기

`readLine()`은 줄 구분자(`\n`, `\r`, `\r\n`)를 제거한 문자열을 반환한다.

```java
try (BufferedReader br = Files.newBufferedReader(Path.of("data.txt"), StandardCharsets.UTF_8)) {
    String line;
    while ((line = br.readLine()) != null) { // EOF → null (빈 줄 ""과 다름!)
        if (!line.isBlank()) {
            System.out.println(line.trim());
        }
    }
}
```

자주 혼동하는 점:
- **빈 줄**: `readLine()` → `""` (빈 문자열)
- **EOF**: `readLine()` → `null`
- `null` 체크 없이 `"".equals(line)` 같은 비교만 하면 EOF에서 NPE 발생

## lines() — Stream API 결합

Java 8부터 `lines()` 메서드가 `Stream<String>`을 반환한다. 스트림이 닫히면 `BufferedReader`도 닫힌다.

```java
// CSV 파일에서 헤더 제외 후 특정 조건으로 필터링
try (BufferedReader br = Files.newBufferedReader(Path.of("orders.csv"), StandardCharsets.UTF_8)) {
    List<String> errorOrders = br.lines()
        .skip(1)                              // 헤더 행 건너뜀
        .filter(line -> line.contains(",ERROR,"))
        .collect(Collectors.toList());
    // ...
}

// 더 간단하게 — Files.lines() (Java 8+)
try (Stream<String> lines = Files.lines(Path.of("data.txt"), StandardCharsets.UTF_8)) {
    long count = lines.filter(l -> !l.isBlank()).count();
}
```

`Files.lines()`는 내부적으로 `BufferedReader`를 사용하며 lazy evaluation으로 대용량 파일을 메모리 효율적으로 처리한다.

## BufferedWriter — 버퍼링 쓰기

```java
try (BufferedWriter bw = Files.newBufferedWriter(
        Path.of("output.txt"), StandardCharsets.UTF_8)) {
    bw.write("첫 번째 줄");
    bw.newLine();      // OS에 맞는 줄 구분자 (\r\n on Windows, \n on Unix)
    bw.write("두 번째 줄");
    bw.newLine();
    bw.flush();        // 필요하다면 명시적 flush (close에서도 호출됨)
}

// 추가 모드로 열기 (기존 파일에 이어쓰기)
try (BufferedWriter bw = Files.newBufferedWriter(
        path, StandardCharsets.UTF_8,
        StandardOpenOption.APPEND, StandardOpenOption.CREATE)) {
    bw.write("추가 내용");
    bw.newLine();
}
```

**주의**: `write(String s)` 다음에 명시적으로 `newLine()`을 호출하지 않으면 줄 구분자가 추가되지 않는다.

![BufferedWriter / PrintWriter 사용 패턴](/assets/posts/java-bufferedwriter-pattern.svg)

## PrintWriter — 포맷 출력과 autoFlush

`PrintWriter`는 `println()`, `printf()`, `format()` 등 편의 메서드를 제공한다.

```java
// 파일 쓰기 — autoFlush=false (기본, 성능 좋음)
try (PrintWriter pw = new PrintWriter(
        Files.newBufferedWriter(Path.of("report.txt"), StandardCharsets.UTF_8))) {
    pw.println("=== 리포트 ===");
    pw.printf("처리 건수: %,d%n", 1234567);
    pw.printf("성공률: %.2f%%%n", 99.87);
} // close() → flush() 자동

// 소켓 통신 — autoFlush=true 필요
Socket socket = new Socket("localhost", 8080);
PrintWriter pw = new PrintWriter(
    new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8), true); // autoFlush
pw.println("HELLO"); // 즉시 전송
```

`PrintWriter`는 내부적으로 예외를 삼키고 `checkError()`로 오류 여부를 반환한다. 예외를 명시적으로 처리해야 한다면 `BufferedWriter`를 직접 사용하는 것이 낫다.

## Scanner vs BufferedReader

`Scanner`도 줄 단위로 읽을 수 있지만 목적이 다르다.

| 기준 | Scanner | BufferedReader |
|------|---------|----------------|
| 주 목적 | 토큰 파싱 (int, double 등) | 줄 단위 텍스트 읽기 |
| 성능 | 느림 (정규식 파싱) | 빠름 (버퍼링) |
| 인코딩 제어 | Scanner(is, charset) | InputStreamReader |
| 동기화 | 없음 (단일 스레드) | 없음 |
| 권장 상황 | stdin 파싱, 단순 입력 | 대용량 파일 처리 |

## 실전 패턴 — 대용량 로그 파일 분석

```java
Path logPath = Path.of("/var/log/app.log");
Map<String, Long> errorCounts;

try (Stream<String> lines = Files.lines(logPath, StandardCharsets.UTF_8)) {
    errorCounts = lines
        .filter(line -> line.contains("ERROR"))
        .map(line -> {
            // "2026-06-06 ERROR [UserService] ..." 에서 모듈명 추출
            int start = line.indexOf('[');
            int end = line.indexOf(']');
            return (start != -1 && end != -1)
                ? line.substring(start + 1, end)
                : "Unknown";
        })
        .collect(Collectors.groupingBy(
            module -> module,
            Collectors.counting()
        ));
}

errorCounts.entrySet().stream()
    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
    .forEach(e -> System.out.printf("%-20s %,d%n", e.getKey(), e.getValue()));
```

`Files.lines()`의 lazy evaluation 덕분에 수 GB 로그 파일도 힙 부족 없이 처리할 수 있다.

---

**지난 글:** [바이트 스트림과 문자 스트림 — InputStream/OutputStream, Reader/Writer 심화](/posts/java-streams-byte-char/)

**다음 글:** [Files 클래스 — 파일 시스템 조작 완전 가이드](/posts/java-files-class/)

<br>
읽어주셔서 감사합니다. 😊
