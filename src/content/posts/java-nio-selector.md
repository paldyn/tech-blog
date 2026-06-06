---
title: "NIO Selector — 단일 스레드 다중 채널 I/O"
description: "Java NIO Selector 완전 가이드 — 논블로킹 채널 등록, SelectionKey 이벤트(OP_ACCEPT/READ/WRITE), 에코 서버 구현, Selector vs 스레드 풀 비교"
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "NIO", "Selector", "SelectionKey", "논블로킹IO", "ServerSocketChannel", "SocketChannel"]
featured: false
draft: false
---

[지난 글](/posts/java-nio-channels-buffers/)에서 채널과 버퍼로 파일을 읽고 쓰는 법을 익혔다. 그런데 네트워크 서버에서 클라이언트 수천 개를 처리하려면 스레드 수천 개를 만들 수는 없다. 이 문제를 해결하는 것이 **Selector**다 — 단일 스레드로 여러 채널의 I/O 이벤트를 동시에 감시한다.

## Selector의 개념

전통적인 I/O 서버 모델은 클라이언트 1개당 스레드 1개를 할당한다. 스레드는 대부분의 시간을 `read()` 블로킹 대기에 낭비하고, 스레드가 수만 개로 늘면 컨텍스트 스위치 오버헤드가 폭증한다.

`Selector`는 다르다. 채널을 **논블로킹 모드**로 설정하고 Selector에 등록한다. Selector는 OS의 `epoll`(Linux) / `kqueue`(macOS) / `select`(Windows) 시스템 콜을 사용해 I/O가 준비된 채널만 알려준다. 스레드는 준비된 채널만 처리하면 된다.

![Selector 아키텍처](/assets/posts/java-nio-selector-arch.svg)

## 핵심 개념 세 가지

### Selector

관심 채널들을 등록받고 `select()` 호출 시 I/O 준비가 된 채널 집합을 반환한다.

```java
Selector selector = Selector.open();
```

### SelectionKey

채널을 Selector에 등록할 때 반환되는 토큰이다. 등록된 관심 이벤트와 채널 참조를 담는다.

```java
// 채널을 Selector에 등록
SelectionKey key = channel.register(selector, SelectionKey.OP_READ);

// 이벤트 종류 확인
key.isAcceptable();  // 새 연결 수락 가능
key.isConnectable(); // 연결 완료
key.isReadable();    // 읽기 가능
key.isWritable();    // 쓰기 가능

// 관심 이벤트 변경 (쓰기 대기 추가)
key.interestOps(SelectionKey.OP_READ | SelectionKey.OP_WRITE);

// 채널 접근
SocketChannel sc = (SocketChannel) key.channel();

// 첨부 객체 (세션 상태 저장에 활용)
key.attach(new ClientSession());
ClientSession session = (ClientSession) key.attachment();
```

### 관심 이벤트 (ops)

| 상수 | 값 | 설명 |
|------|---|------|
| `OP_ACCEPT` | 16 | `ServerSocketChannel`에 새 연결 도착 |
| `OP_CONNECT` | 8 | `SocketChannel` 연결 완료 |
| `OP_READ` | 1 | 채널에 읽을 데이터 존재 |
| `OP_WRITE` | 4 | 채널에 데이터 쓸 수 있음 |

여러 이벤트는 OR로 조합한다: `OP_READ | OP_WRITE`.

## 서버 구현 — 단계별

![Selector 에코 서버 코드](/assets/posts/java-nio-selector-code.svg)

### 1단계: Selector와 ServerSocketChannel 초기화

```java
Selector selector = Selector.open();
ServerSocketChannel ssc = ServerSocketChannel.open();
ssc.bind(new InetSocketAddress(8080));
ssc.configureBlocking(false); // 반드시 논블로킹으로
ssc.register(selector, SelectionKey.OP_ACCEPT);
```

`configureBlocking(false)` 없이 register하면 `IllegalBlockingModeException`이 발생한다.

### 2단계: 이벤트 루프

```java
while (true) {
    int ready = selector.select(); // 준비된 채널 없으면 블로킹
    if (ready == 0) continue;

    Iterator<SelectionKey> iter = selector.selectedKeys().iterator();
    while (iter.hasNext()) {
        SelectionKey key = iter.next();
        iter.remove(); // 처리 후 반드시 제거 — 누락시 중복 처리

        if (key.isAcceptable()) {
            acceptConnection(key, selector);
        } else if (key.isReadable()) {
            readData(key);
        } else if (key.isWritable()) {
            writeData(key);
        }
    }
}
```

`iter.remove()`를 빠뜨리면 같은 키가 계속 재처리돼 무한 루프에 빠진다 — NIO 버그 1위다.

### 3단계: 연결 수락

```java
private void acceptConnection(SelectionKey key, Selector sel)
        throws IOException {
    ServerSocketChannel ssc = (ServerSocketChannel) key.channel();
    SocketChannel sc = ssc.accept();
    if (sc == null) return; // 논블로킹이라 null일 수 있음
    sc.configureBlocking(false);
    sc.register(sel, SelectionKey.OP_READ, ByteBuffer.allocate(256));
}
```

accept 후 받은 `SocketChannel`도 논블로킹으로 설정하고 `OP_READ`로 등록한다. `attach()` 대신 `register` 3번째 인자로 첨부 객체를 넘길 수 있다.

### 4단계: 데이터 읽기

```java
private void readData(SelectionKey key) throws IOException {
    SocketChannel sc = (SocketChannel) key.channel();
    ByteBuffer buf = (ByteBuffer) key.attachment();
    int read = sc.read(buf);
    if (read == -1) {
        key.cancel();
        sc.close();
        return;
    }
    buf.flip();
    // 에코: 그대로 되돌려 보내기
    sc.write(buf);
    buf.compact();
}
```

`read == -1`은 클라이언트 연결이 닫혔다는 신호다. `key.cancel()`로 Selector에서 등록을 해제하고 채널을 닫는다.

## select()의 세 가지 변형

```java
selector.select();          // 무한 블로킹 (기본)
selector.select(1000);      // 최대 1초 대기
selector.selectNow();       // 즉시 반환 (준비 없으면 0)
```

`selectNow()`는 폴링 루프에서 CPU를 100% 소모할 수 있으니 주의한다. 타임아웃 버전이 더 안전하다.

## Selector.wakeup()

다른 스레드에서 블로킹 중인 `select()`를 즉시 깨울 수 있다. 채널 추가나 종료 신호 전달에 사용한다.

```java
// 다른 스레드에서 호출
selector.wakeup();
```

## Selector vs 스레드 풀 비교

| 기준 | Selector (NIO) | 스레드 풀 (BIO) |
|------|---------------|----------------|
| 연결당 스레드 | 1개 스레드 N개 채널 | 1 스레드 1 연결 |
| 메모리 | 낮음 | 스레드당 ~1MB 스택 |
| 구현 복잡도 | 높음 | 낮음 |
| 적합 상황 | 수천~수만 연결, 짧은 요청 | CPU 집중 작업 |
| 대안 | Virtual Thread (Java 21+) | — |

Java 21의 가상 스레드가 도입된 이후 Selector 기반 직접 구현의 필요성이 줄었다. 가상 스레드는 블로킹 I/O를 쓰면서도 Selector 수준의 스케일링을 제공한다. 그러나 Netty·Vert.x 같은 비동기 프레임워크는 여전히 Selector를 직접 사용하므로, 내부 동작 이해에는 필수 지식이다.

## 핵심 정리

- `configureBlocking(false)` → `register(selector, ops)` 순서 필수
- 이벤트 루프에서 `iter.remove()` 빠뜨리면 무한 중복 처리 발생
- `attach()`로 채널별 상태 객체를 SelectionKey에 첨부
- `select(-1)`은 무한 대기, `selectNow()`는 즉시 반환
- Java 21 가상 스레드 시대에도 비동기 프레임워크 이해를 위해 Selector 개념은 필수

---

**지난 글:** [NIO 채널과 버퍼 — 고성능 I/O의 핵심](/posts/java-nio-channels-buffers/)

**다음 글:** [WatchService — 디렉터리 변경 감시](/posts/java-watch-service/)

<br>
읽어주셔서 감사합니다. 😊
