---
title: "Java IO 개요 — 입출력 스트림 구조 이해하기"
description: "Java IO 완전 개요 — InputStream/OutputStream vs Reader/Writer, 바이트 스트림과 문자 스트림 차이, 데코레이터 패턴, InputStreamReader 브리지, java.io vs java.nio vs java.nio.file 비교"
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "IO", "InputStream", "OutputStream", "Reader", "Writer", "NIO", "스트림"]
featured: false
draft: false
---

[지난 글](/posts/java-exception-best-practices/)에서 예외 처리의 올바른 원칙을 정리했다. 이번부터 새로운 챕터인 **Java IO**를 시작한다. Java의 입출력 시스템은 `java.io`, `java.nio`, `java.nio.file` 세 패키지로 나뉘며, 각각 다른 설계 철학을 갖는다.

## Java IO의 두 가지 축

Java IO는 크게 두 가지 기준으로 나뉜다.

**1. 데이터 단위: 바이트 vs 문자**
- **바이트 스트림** (`InputStream`, `OutputStream`): 8비트 raw 바이트를 처리. 이미지, 오디오, 바이너리 파일에 적합
- **문자 스트림** (`Reader`, `Writer`): 16비트 Unicode 문자를 처리. 텍스트 파일, 인코딩 처리에 적합

**2. IO 모델: 블로킹 vs 논블로킹**
- `java.io`: 항상 블로킹. 데이터를 읽을 때까지 스레드가 대기
- `java.nio`: 논블로킹 IO 가능. Selector와 Channel로 단일 스레드가 여러 연결 처리

```java
// 바이트 스트림 — 이미지 복사
try (InputStream in  = new FileInputStream("photo.jpg");
     OutputStream out = new FileOutputStream("copy.jpg")) {
    in.transferTo(out); // Java 9+: 직접 복사
}

// 문자 스트림 — 텍스트 파일 읽기
try (BufferedReader reader = new BufferedReader(new FileReader("text.txt"))) {
    String line;
    while ((line = reader.readLine()) != null) {
        System.out.println(line);
    }
}
```

## InputStream / OutputStream 계층

`InputStream`은 **바이트 입력**의 추상 기반 클래스다.

| 클래스 | 설명 |
|--------|------|
| `FileInputStream` | 파일에서 바이트 읽기 |
| `BufferedInputStream` | 내부 버퍼로 성능 향상 |
| `ByteArrayInputStream` | 바이트 배열을 InputStream으로 |
| `DataInputStream` | 기본 타입(int, long 등) 읽기 |
| `ObjectInputStream` | 역직렬화 |

`OutputStream`은 **바이트 출력**의 추상 기반 클래스다.

| 클래스 | 설명 |
|--------|------|
| `FileOutputStream` | 파일에 바이트 쓰기 |
| `BufferedOutputStream` | 내부 버퍼로 성능 향상 |
| `PrintStream` | `System.out`의 타입, println() 제공 |
| `DataOutputStream` | 기본 타입 쓰기 |
| `ObjectOutputStream` | 직렬화 |

![Java IO 클래스 계층 구조](/assets/posts/java-io-overview-hierarchy.svg)

## Reader / Writer 계층

`Reader`는 **문자 입력**의 추상 기반 클래스. `read()` 메서드가 `char`를 반환한다.

| 클래스 | 설명 |
|--------|------|
| `FileReader` | 파일에서 문자 읽기 (기본 인코딩 사용 — 주의) |
| `BufferedReader` | 버퍼링 + `readLine()` 제공 |
| `InputStreamReader` | 바이트 → 문자 변환 (인코딩 지정 가능) |
| `StringReader` | String을 Reader로 |

`Writer`는 **문자 출력**의 추상 기반 클래스.

| 클래스 | 설명 |
|--------|------|
| `FileWriter` | 파일에 문자 쓰기 (기본 인코딩 사용 — 주의) |
| `BufferedWriter` | 버퍼링 + `newLine()` 제공 |
| `OutputStreamWriter` | 문자 → 바이트 변환 (인코딩 지정 가능) |
| `PrintWriter` | `println()`, `printf()` 등 편의 메서드 |

## 인코딩 주의사항 — FileReader/FileWriter를 피하라

`FileReader`와 `FileWriter`는 **JVM 기본 인코딩**을 사용한다. 플랫폼마다 다를 수 있어 이식성이 없다.

```java
// ❌ 플랫폼 기본 인코딩 — 위험
BufferedReader reader = new BufferedReader(new FileReader("data.txt"));

// ✅ 인코딩 명시
BufferedReader reader = new BufferedReader(
    new InputStreamReader(new FileInputStream("data.txt"), StandardCharsets.UTF_8));

// ✅ 더 간단하게 (Java 11+)
BufferedReader reader = Files.newBufferedReader(Path.of("data.txt"), StandardCharsets.UTF_8);
```

## 브리지 클래스 — 바이트와 문자 스트림 연결

`InputStreamReader`와 `OutputStreamWriter`는 바이트 스트림을 문자 스트림으로 변환하는 **브리지** 역할을 한다.

```java
// System.in (InputStream) → Scanner가 아닌 BufferedReader로 읽기
BufferedReader stdin = new BufferedReader(
    new InputStreamReader(System.in, StandardCharsets.UTF_8));

// 소켓 InputStream → 텍스트 프로토콜 처리
Socket socket = new Socket("localhost", 8080);
BufferedReader socketReader = new BufferedReader(
    new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
PrintWriter socketWriter = new PrintWriter(
    new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8), true);
```

## 데코레이터 패턴 — IO 클래스의 설계 철학

Java IO는 **데코레이터 패턴**으로 설계됐다. 기본 스트림에 기능을 겹겹이 추가한다.

```java
// 계층 구조: File → FileOutputStream → BufferedOutputStream → DataOutputStream
DataOutputStream dos = new DataOutputStream(
    new BufferedOutputStream(
        new FileOutputStream("data.bin")));

dos.writeInt(42);
dos.writeDouble(3.14);
dos.writeUTF("hello");
```

각 클래스는 한 가지 책임만 갖는다: 파일 접근, 버퍼링, 타입 변환. 필요한 기능만 조합해 사용할 수 있다.

## java.io vs java.nio vs java.nio.file

![Java IO vs NIO vs NIO.2 비교](/assets/posts/java-io-vs-nio.svg)

```java
// java.io — 전통적 방식
File file = new File("test.txt"); // 구식
file.exists(); file.delete();

// java.nio.file — 현대적 방식 (Java 7+, 권장)
Path path = Path.of("test.txt");
Files.exists(path);
Files.delete(path);
Files.readString(path, StandardCharsets.UTF_8); // Java 11+
Files.writeString(path, content, StandardCharsets.UTF_8);

// java.nio Channel — 고성능 IO
try (FileChannel fc = FileChannel.open(path, StandardOpenOption.READ)) {
    ByteBuffer buf = ByteBuffer.allocate(1024);
    fc.read(buf);
}
```

현대 Java 개발에서는 **`java.nio.file`의 `Files`와 `Path`**를 기본으로 사용하고, 대용량·비동기 처리가 필요할 때만 NIO Channel을 고려한다.

## 핵심 요약

| 상황 | 권장 클래스 |
|------|-------------|
| 텍스트 파일 읽기 | `Files.newBufferedReader(path, UTF_8)` |
| 텍스트 파일 쓰기 | `Files.newBufferedWriter(path, UTF_8)` |
| 짧은 파일 전체 읽기 | `Files.readString(path)` (Java 11+) |
| 바이너리 파일 복사 | `Files.copy(src, dst)` |
| 소켓 텍스트 통신 | `InputStreamReader(is, UTF_8)` |
| 고성능 대용량 IO | NIO `FileChannel` + `ByteBuffer` |

---

**지난 글:** [예외 처리 베스트 프랙티스 — 올바른 예외 설계 원칙](/posts/java-exception-best-practices/)

**다음 글:** [바이트 스트림과 문자 스트림 — InputStream/OutputStream, Reader/Writer 심화](/posts/java-streams-byte-char/)

<br>
읽어주셔서 감사합니다. 😊
