---
title: "NIO 채널과 버퍼 — 고성능 I/O의 핵심"
description: "Java NIO의 Channel과 ByteBuffer 완전 가이드 — FileChannel, ByteBuffer 상태(flip/clear/compact), Heap vs Direct 버퍼, transferTo 제로 카피"
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "NIO", "FileChannel", "ByteBuffer", "채널", "버퍼", "제로카피", "java.nio"]
featured: false
draft: false
---

[지난 글](/posts/java-paths-and-path/)에서 `Path` 인터페이스로 파일 경로를 다루는 법을 익혔다. 이번에는 Java NIO의 핵심 기둥인 **채널(Channel)과 버퍼(Buffer)**를 다룬다. 전통적인 스트림 I/O와 근본적으로 다른 데이터 이동 모델을 이해하면 고성능 파일 처리와 네트워크 프로그래밍의 토대가 마련된다.

## 스트림 I/O vs NIO

전통적인 `java.io` 스트림 I/O는 **단방향, 블로킹**이다. 스레드는 데이터가 올 때까지 블로킹되고, 별도의 입력·출력 스트림이 필요하다. Java 1.4에서 도입된 NIO는 다르다.

- **양방향**: 하나의 채널로 읽기·쓰기 모두 가능
- **버퍼 중심**: 데이터는 항상 Buffer를 경유한다
- **논블로킹 가능**: Selector와 결합하면 단일 스레드로 수천 채널 처리

![NIO 채널 &amp; 버퍼 아키텍처](/assets/posts/java-nio-channels-buffers-arch.svg)

## Channel — 데이터 이동 통로

채널은 I/O를 수행하는 **연결 통로**다. 파일 채널은 `FileChannel`, 네트워크 채널은 `SocketChannel`·`ServerSocketChannel`·`DatagramChannel`이 있다.

```java
// FileChannel 열기 — StandardOpenOption 지정
FileChannel readCh  = FileChannel.open(path, StandardOpenOption.READ);
FileChannel writeCh = FileChannel.open(path, StandardOpenOption.WRITE,
                                             StandardOpenOption.CREATE);
// try-with-resources 권장 (AutoCloseable 구현)
try (FileChannel ch = FileChannel.open(path)) {
    // ...
}
```

채널은 `AutoCloseable`이므로 try-with-resources로 안전하게 닫는다.

## ByteBuffer — 데이터 컨테이너

`ByteBuffer`는 3개의 포인터로 상태를 관리한다.

| 포인터 | 의미 |
|--------|------|
| `position` | 다음 읽기/쓰기 위치 |
| `limit` | 읽기/쓰기 가능한 마지막 위치 (exclusive) |
| `capacity` | 버퍼의 최대 크기 (불변) |

불변식: `0 ≤ position ≤ limit ≤ capacity`

### 버퍼 생성

```java
// Heap 버퍼 — JVM 힙, GC 대상
ByteBuffer heap = ByteBuffer.allocate(4096);

// Direct 버퍼 — 네이티브 메모리, OS와 직접 공유
ByteBuffer direct = ByteBuffer.allocateDirect(4096);

// 기존 배열을 감싸기 (복사 없음)
byte[] data = "Hello".getBytes();
ByteBuffer wrapped = ByteBuffer.wrap(data);
```

**Direct 버퍼**는 OS가 직접 접근할 수 있어 파일·네트워크 I/O 성능이 좋다. 다만 GC가 수집하지 않아 메모리 해제 시점을 직접 관리해야 하며(Java 21+ `Buffer.close()` 또는 Cleaner 사용), 할당 비용이 크다. 반복 재사용하는 I/O 루프에서 유리하다.

## 버퍼 상태 전환 — flip / clear / compact

NIO 코드에서 가장 흔히 나오는 버그는 `flip()`을 빠뜨리는 것이다.

```java
ByteBuffer buf = ByteBuffer.allocate(8);

// 채널에서 읽기 (buf에 데이터 채워짐: position 증가)
ch.read(buf);      // position=5, limit=8

// 읽기 모드로 전환 (flip 필수!)
buf.flip();        // limit=5, position=0

// 버퍼에서 데이터 소비
while (buf.hasRemaining()) {
    byte b = buf.get(); // position 증가
}

// 다시 쓰기 모드로 — 두 가지 방법
buf.clear();       // position=0, limit=8 (빠름, 데이터 덮어씀)
// 또는
buf.compact();     // 미처리 데이터를 앞으로 이동 후 position 조정
```

`compact()`는 부분 소비 후 추가로 채널에서 읽어야 할 때 사용한다. 루프 안에서 `clear()` 대신 `compact()`를 써야 하는 경우가 있다.

![ByteBuffer 읽기/쓰기 코드](/assets/posts/java-nio-channels-buffers-code.svg)

## 완전한 파일 읽기 예제

```java
Path path = Path.of("input.dat");
try (FileChannel ch = FileChannel.open(path, StandardOpenOption.READ)) {
    ByteBuffer buf = ByteBuffer.allocate(4096);
    while (ch.read(buf) != -1) {
        buf.flip();
        while (buf.hasRemaining()) {
            process(buf.get()); // 바이트 처리
        }
        buf.clear();
    }
}
```

`ch.read(buf)`는 -1을 반환하면 EOF다. 루프를 돌며 버퍼를 채우고(`read`), 소비하고(`flip` + `get`), 초기화(`clear`)하는 패턴을 반복한다.

## transferTo — 제로 카피 파일 복사

`transferTo`는 OS 커널 안에서 파일 채널 간 데이터를 직접 전송해 사용자 공간 복사를 없앤다. 대용량 파일 복사에서 큰 성능 이점이 있다.

```java
try (FileChannel src = FileChannel.open(source, StandardOpenOption.READ);
     FileChannel dst = FileChannel.open(dest, StandardOpenOption.WRITE,
                                              StandardOpenOption.CREATE)) {
    long transferred = 0;
    long size = src.size();
    while (transferred < size) {
        transferred += src.transferTo(transferred, size - transferred, dst);
    }
}
```

while 루프가 필요한 이유: `transferTo`는 한 번에 전체를 전송하지 못할 수 있다. 반환값이 실제 전송 바이트 수이므로 남은 양을 반복해서 전송한다.

## FileChannel의 추가 기능

```java
// 랜덤 접근 — position 지정 읽기/쓰기
ch.read(buf, 1024);    // 오프셋 1024에서 읽기
ch.write(buf, 2048);   // 오프셋 2048에 쓰기

// 크기 및 위치
long size = ch.size();
long pos  = ch.position();
ch.position(512);       // 위치 이동

// 강제 플러시
ch.force(true);         // 메타데이터 포함 OS 버퍼 → 디스크

// 파일 잠금 (OS 레벨 lock)
FileLock lock = ch.lock();          // 전체 배타 잠금
FileLock shared = ch.lock(0, 100, true); // 공유 잠금
```

## 스트림 → 채널 변환

기존 스트림 코드에서 채널로 전환할 때 `Channels` 유틸리티를 사용한다.

```java
// InputStream → ReadableByteChannel
InputStream in = new FileInputStream("file.txt");
ReadableByteChannel rbc = Channels.newChannel(in);

// OutputStream → WritableByteChannel
OutputStream out = new FileOutputStream("out.txt");
WritableByteChannel wbc = Channels.newChannel(out);

// Channel → InputStream (래거시 API 전달용)
InputStream fromCh = Channels.newInputStream(rbc);
```

## Heap vs Direct 버퍼 선택 기준

| 기준 | Heap 버퍼 | Direct 버퍼 |
|------|-----------|------------|
| 할당 | 빠름 (일반 객체) | 느림 (네이티브 메모리) |
| I/O 성능 | JVM→OS 복사 발생 | 복사 없음 (OS 직접) |
| GC | 수집됨 | 수집 안 됨 |
| 메모리 해제 | 자동 | 명시 해제 필요 |
| 권장 상황 | 단순 처리, 소용량 | 반복 I/O, 대용량 파일/네트워크 |

## 핵심 정리

- 채널은 **양방향** 통로, 버퍼는 **데이터 컨테이너** — 채널은 버퍼를 통해서만 데이터를 주고받는다
- `ByteBuffer.flip()` = 쓰기→읽기 전환, `clear()` = 읽기→쓰기 전환, `compact()` = 부분 소비 후 쓰기 전환
- `allocateDirect()` = 네이티브 메모리, 반복 I/O에서 Heap 버퍼 대비 우수
- `transferTo()` = 커널 내 제로 카피, 대용량 파일 복사에 최적

---

**지난 글:** [Path API — 경로 표현의 표준](/posts/java-paths-and-path/)

**다음 글:** [NIO Selector — 단일 스레드 다중 채널 I/O](/posts/java-nio-selector/)

<br>
읽어주셔서 감사합니다. 😊
