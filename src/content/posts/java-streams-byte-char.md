---
title: "바이트 스트림과 문자 스트림 — InputStream/OutputStream, Reader/Writer 심화"
description: "Java 바이트 스트림과 문자 스트림 심화 — InputStream read() int 반환의 이유, EOF -1 처리, read(buf) 부분 읽기 문제, OutputStream flush() 필수, Reader/Writer 문자 인코딩, BufferedReader.lines() Stream 활용"
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "InputStream", "OutputStream", "Reader", "Writer", "바이트스트림", "문자스트림", "IO"]
featured: false
draft: false
---

[지난 글](/posts/java-io-overview/)에서 Java IO 전체 구조를 살펴봤다. 이번에는 **바이트 스트림(`InputStream`/`OutputStream`)과 문자 스트림(`Reader`/`Writer`)**의 핵심 API와 함께 자주 틀리는 사용 패턴을 집중적으로 다룬다.

## InputStream — 바이트 입력의 근본

`InputStream`의 핵심 메서드는 `read()`다. 한 바이트를 읽어 **int(0~255)** 로 반환하고, 스트림 끝에 도달하면 **-1**을 반환한다.

```java
// ❌ 흔한 실수 — byte로 받으면 EOF 감지 불가
byte b;
while ((b = (byte) in.read()) != -1) { // byte -1 == 0xFF == 255
    process(b); // 0xFF 바이트가 EOF로 잘못 처리됨
}

// ✅ int로 받아야 -1을 정확히 감지
int b;
while ((b = in.read()) != -1) {
    process((byte) b); // 안전하게 byte로 캐스팅
}
```

`read()`가 `int`를 반환하는 이유가 바로 이것이다. `byte`의 범위는 -128~127인데, `-1`을 `byte`로 표현하면 `0xFF(255)`와 구분이 안 된다.

### 배열 단위 읽기와 부분 읽기 문제

```java
byte[] buf = new byte[1024];
int len;

// ❌ 부분 읽기 무시 — 데이터 소실 가능
while ((len = in.read(buf)) != -1) {
    // len이 실제로 읽힌 바이트 수. buf 전체가 아닐 수 있음
    process(buf); // 0~len-1만 유효한데 전체 처리 → 버그!
}

// ✅ len 반영
while ((len = in.read(buf)) != -1) {
    process(buf, 0, len); // 읽힌 만큼만 처리
}
```

`read(buf)`는 요청한 바이트보다 **적게** 읽힐 수 있다(네트워크 스트림이 특히 그렇다). 항상 반환값 `len`을 확인해야 한다.

### Java 9+ 편의 메서드

```java
// readAllBytes() — 전체 내용을 byte[]로 (소형 파일 한정)
byte[] data = in.readAllBytes();

// readNBytes(n) — 정확히 n 바이트 읽기 (부족하면 기다림)
byte[] header = in.readNBytes(16);

// transferTo() — 다른 OutputStream으로 직접 전달
long copied = in.transferTo(out);
```

![InputStream / OutputStream 핵심 API](/assets/posts/java-streams-byte-char-anatomy.svg)

## OutputStream — 바이트 출력의 근본

`write(int b)`는 하위 8비트만 기록한다.

```java
OutputStream out = new FileOutputStream("data.bin");
out.write(0x1234ABCD); // 0xCD만 기록됨 (하위 8비트)
```

### flush() 필수 — 버퍼링 래퍼 사용 시

```java
// ❌ flush() 누락 — 버퍼에 남은 데이터가 기록 안 됨
BufferedOutputStream buf = new BufferedOutputStream(new FileOutputStream("out.txt"));
buf.write("hello".getBytes());
// close() 없이 프로그램 종료 → "hello"가 파일에 없음!

// ✅ try-with-resources로 close() 보장 (close가 flush 호출)
try (BufferedOutputStream buf2 = new BufferedOutputStream(new FileOutputStream("out.txt"))) {
    buf2.write("hello".getBytes());
} // close() → flush() 자동 호출
```

## Reader — 문자 입력

`Reader`의 `read()`는 **단일 문자를 int(0~65535)** 로 반환하고, EOF에서 -1이다.

```java
// StringReader — String을 Reader로 감싸기
Reader reader = new StringReader("hello world");
int c;
StringBuilder sb = new StringBuilder();
while ((c = reader.read()) != -1) {
    sb.append((char) c);
}

// BufferedReader — 줄 단위 읽기 (가장 자주 쓰는 패턴)
try (BufferedReader br = new BufferedReader(
        new InputStreamReader(new FileInputStream("data.txt"), StandardCharsets.UTF_8))) {
    String line;
    while ((line = br.readLine()) != null) { // EOF → null (not -1)
        System.out.println(line);
    }
}
```

`readLine()`은 줄 구분자를 제거한 문자열을 반환하고, EOF에서 **null**을 반환한다(-1이 아닌 점을 주의).

### BufferedReader.lines() — Stream API 활용

Java 8부터 `lines()` 메서드로 스트림 API와 결합할 수 있다.

```java
try (BufferedReader br = Files.newBufferedReader(Path.of("data.csv"), StandardCharsets.UTF_8)) {
    long count = br.lines()
        .filter(line -> line.startsWith("ERROR"))
        .count();
    System.out.println("에러 줄 수: " + count);
}
```

![Reader / Writer 핵심 API와 사용 패턴](/assets/posts/java-streams-byte-char-reader-writer.svg)

## Writer — 문자 출력

```java
// PrintWriter — println/printf 지원
try (PrintWriter pw = new PrintWriter(
        Files.newBufferedWriter(Path.of("output.txt"), StandardCharsets.UTF_8))) {
    pw.println("첫 번째 줄");
    pw.printf("포맷: %d%n", 42);
} // autoFlush=false가 기본 → close()에서 flush

// autoFlush=true (각 println마다 자동 flush)
PrintWriter pw = new PrintWriter(
    new BufferedWriter(new OutputStreamWriter(System.out)), true);
pw.println("즉시 출력됨");
```

## 바이트 스트림 vs 문자 스트림 선택 기준

| 데이터 종류 | 권장 |
|------------|------|
| 이미지, 오디오, 바이너리 | `InputStream`/`OutputStream` |
| 텍스트 (인코딩 필요) | `Reader`/`Writer` |
| 소켓 텍스트 프로토콜 | `InputStreamReader(socket.getInputStream(), UTF_8)` |
| 전체 파일 읽기 (Java 11+) | `Files.readString(path)` |
| 줄 단위 처리 | `BufferedReader.readLine()` or `.lines()` |

## FileInputStream/FileOutputStream의 성능 문제

파일 스트림은 기본적으로 버퍼링이 없다. 바이트 하나씩 읽으면 시스템 콜이 반복 발생해 극도로 느려진다.

```java
// ❌ 버퍼 없는 파일 읽기 — 매우 느림
try (FileInputStream in = new FileInputStream("large.bin")) {
    int b;
    while ((b = in.read()) != -1) { } // 1 바이트마다 시스템 콜!
}

// ✅ BufferedInputStream으로 감싸기
try (InputStream in = new BufferedInputStream(new FileInputStream("large.bin"))) {
    int b;
    while ((b = in.read()) != -1) { } // 8KB 단위로 읽어 캐시
}

// ✅ 더 간단하게 (Java 7+)
Path path = Path.of("large.bin");
byte[] data = Files.readAllBytes(path); // 내부적으로 최적화
```

실무에서는 `FileInputStream`/`FileOutputStream`을 직접 쓰는 일이 드물다. `Files` 유틸리티나 `BufferedInputStream`/`BufferedReader`를 통해 접근하는 것이 권장된다.

---

**지난 글:** [Java IO 개요 — 입출력 스트림 구조 이해하기](/posts/java-io-overview/)

**다음 글:** [BufferedReader/Writer — 버퍼링 IO와 줄 단위 처리](/posts/java-bufferedreader-writer/)

<br>
읽어주셔서 감사합니다. 😊
