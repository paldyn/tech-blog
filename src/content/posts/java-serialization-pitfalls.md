---
title: "Java 직렬화의 함정 — 보안과 성능 문제"
description: "Java 직렬화의 4가지 함정 완전 분석 — 역직렬화 공격(CVE), 성능 문제, 하위 호환성 부담, JEP 290 필터, Jackson/Protobuf/Kryo 대안 비교"
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "직렬화", "보안취약점", "역직렬화공격", "JEP290", "Jackson", "Protobuf", "Kryo"]
featured: false
draft: false
---

[지난 글](/posts/java-serialization/)에서 Java 직렬화의 기본 동작 원리를 다뤘다. 이번에는 현장에서 Java 직렬화가 문제를 일으키는 4가지 함정을 분석하고, 실용적인 대안을 정리한다.

## 함정 1: 역직렬화 공격 (보안)

Java 직렬화의 가장 심각한 문제는 **보안 취약점**이다. `ObjectInputStream.readObject()`는 바이트 스트림이 가리키는 클래스를 찾아 인스턴스화하고 필드를 채운다. 공격자가 조작된 바이트 스트림을 보내면 클래스패스에 있는 임의 클래스가 인스턴스화될 수 있다.

**가젯 체인(Gadget Chain)**: Apache Commons Collections, Spring Framework, JDK 내장 클래스 중 일부는 특정 순서로 역직렬화될 때 OS 명령 실행으로 이어지는 메서드 체인을 형성한다. `CVE-2015-4852`(WebLogic), `CVE-2016-4978`(Apache Camel)이 대표적이다.

```java
// 취약한 코드 — 외부 입력을 그대로 역직렬화
Object obj = objectInputStream.readObject(); // 절대 금지!
```

**식별**: 직렬화 스트림은 `AC ED 00 05`로 시작한다. Base64로 인코딩하면 `rO0AB`로 시작한다. 이 패턴이 HTTP 요청이나 파일에서 발견되면 역직렬화 공격 시도 가능성이 있다.

![Java 직렬화의 4가지 함정](/assets/posts/java-serialization-pitfalls-overview.svg)

## 함정 2: 성능 문제

Java 직렬화는 리플렉션 기반으로 동작한다. 클래스 메타데이터, 전체 객체 그래프를 탐색하는 오버헤드가 크다.

```text
벤치마크 참고 (JMH 기준, 간단한 POJO 1만 건):
Java 직렬화:    ~450 MB/s 처리량
Jackson JSON:   ~800 MB/s 처리량
Protocol Buffers: ~1,500 MB/s 처리량
Kryo:           ~2,000 MB/s 처리량
```

출력 크기도 크다. JSON보다 20~30% 더 큰 경우가 일반적이다 — 클래스 이름, 필드 이름, 타입 정보가 포함되기 때문이다.

## 함정 3: 유지보수 부담

직렬화된 형식이 **공개 API처럼 굳어진다**. 클래스 내부 구현을 바꾸면 기존에 직렬화된 데이터가 깨질 수 있다.

```java
// v1
public class Order implements Serializable {
    private static final long serialVersionUID = 1L;
    private String productName;
    private int quantity;
}

// v2 — 필드 이름 변경 → 기존 직렬화 데이터 역직렬화 실패!
public class Order implements Serializable {
    private static final long serialVersionUID = 1L;
    private String itemName; // productName → itemName
    private int qty;         // quantity → qty
}
```

`serialVersionUID`를 유지해도 필드 이름이 다르면 역직렬화 시 해당 필드는 기본값이 된다. 구조적 변경(타입 변경)은 예외를 던진다.

## 함정 4: 이식성 부재

Java 직렬화 형식은 Java 전용이다. Go, Python, Node.js 서비스와 데이터를 주고받아야 하는 마이크로서비스 아키텍처에서 사용할 수 없다.

## JEP 290 — Serialization Filters (Java 9+)

불가피하게 역직렬화를 사용해야 한다면 **화이트리스트 필터**를 반드시 적용한다.

```java
// 허용할 클래스만 지정 — "!*"로 나머지 차단
ObjectInputFilter filter = ObjectInputFilter.Config.createFilter(
    "com.example.User;java.util.ArrayList;java.lang.*;!*");

try (ObjectInputStream ois = new ObjectInputStream(in)) {
    ois.setObjectInputFilter(filter);
    User user = (User) ois.readObject();
}
```

패턴 문법:
- `com.example.User` — 특정 클래스 허용
- `com.example.*` — 패키지 전체 허용
- `!*` — 나머지 모두 거부

JVM 전역 필터는 시스템 프로퍼티로 설정한다:
```text
-Djdk.serialFilter=com.example.*;java.lang.*;!*
```

Java 17+에서는 `ObjectInputFilter.Config.setSerialFilter()`로 프로그래밍 방식으로 설정 가능하다.

## 대안 1: Jackson JSON

가장 널리 쓰이는 대안이다. 사람이 읽을 수 있고, 언어 독립적이며, 스키마 없이도 유연하게 진화한다.

```java
ObjectMapper mapper = new ObjectMapper();

// 직렬화
String json = mapper.writeValueAsString(user);
// {"name":"Alice","age":30}

// 역직렬화
User restored = mapper.readValue(json, User.class);
```

Java 레코드(Java 16+)도 기본 지원한다.

## 대안 2: Protocol Buffers

Google의 이진 직렬화 형식이다. `.proto` 스키마를 정의하고 코드를 생성한다. 성능과 공간 효율이 뛰어나고 언어 독립적이다.

```protobuf
// user.proto
message User {
    string name = 1;
    int32 age = 2;
}
```

```java
// 생성된 코드 사용
User user = User.newBuilder()
    .setName("Alice")
    .setAge(30)
    .build();
byte[] bytes = user.toByteArray();

User restored = User.parseFrom(bytes);
```

필드 번호(1, 2)로 식별하므로 필드 이름이 바뀌어도 하위 호환성이 유지된다.

## 대안 3: Kryo (JVM 전용 고성능)

JVM 전용이지만 Java 직렬화의 10배 속도를 낼 수 있다. Apache Spark, Storm 등 빅데이터 프레임워크에서 사용한다.

```java
Kryo kryo = new Kryo();
kryo.register(User.class);

try (Output out = new Output(new FileOutputStream("user.kryo"))) {
    kryo.writeObject(out, user);
}

try (Input in = new Input(new FileInputStream("user.kryo"))) {
    User restored = kryo.readObject(in, User.class);
}
```

스키마 진화 시 필드 추가/삭제 처리를 명시적으로 다뤄야 하는 점이 단점이다.

## 대안 비교

![직렬화 대안 비교](/assets/posts/java-serialization-pitfalls-alternatives.svg)

## 어떤 대안을 선택할까

| 상황 | 권장 |
|------|------|
| REST API, 범용 통신 | Jackson JSON |
| gRPC, 고성능 이진 | Protocol Buffers |
| Kafka 스키마 관리 | Apache Avro |
| JVM 내부 고속 캐시 | Kryo |
| Java → Java, 단순 | Jackson JSON (JSON도 충분히 빠름) |

## 핵심 정리

- 신뢰할 수 없는 소스의 역직렬화는 **절대 금지** — RCE 위험
- 불가피하다면 JEP 290 필터로 허용 클래스를 화이트리스트 지정
- 성능 · 이식성 · 유지보수 모두 대안이 우월
- 신규 프로젝트는 Jackson JSON 또는 Protobuf를 기본으로 선택
- Java 직렬화는 RMI, Java EE 레거시 시스템 유지보수 목적으로만

---

**지난 글:** [Java 직렬화 — 객체를 바이트로](/posts/java-serialization/)

**다음 글:** [레코드와 직렬화 — Record Serialization](/posts/java-record-serialization/)

<br>
읽어주셔서 감사합니다. 😊
