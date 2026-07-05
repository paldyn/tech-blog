---
title: "역직렬화 취약점 — 안전하지 않은 역직렬화 방어"
description: "Java native 역직렬화가 왜 위험한지, 가젯 체인이 어떻게 원격 코드 실행으로 이어지는지 이해하고, ObjectInputFilter(JEP 290) 기반 허용 목록 필터링과 데이터 전용 포맷 전환 같은 방어 전략을 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-07-05"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "보안", "역직렬화", "Deserialization", "RCE", "취약점"]
featured: false
draft: false
---

[지난 글](/posts/java-input-validation/)에서 입력 검증으로 인젝션 공격을 막는 법을 다뤘다. 이번에는 Java 보안에서 가장 악명 높은 취약점인 **안전하지 않은 역직렬화(Insecure Deserialization)** 를 깊이 있게 살펴본다. OWASP Top 10에 오랫동안 이름을 올려온 이 취약점은, 신뢰할 수 없는 데이터를 `ObjectInputStream` 으로 복원하는 순간 원격 코드 실행(RCE)으로 이어질 수 있는 치명적인 문제다.

## 왜 역직렬화가 위험한가

앞선 직렬화 관련 글에서 봤듯이, Java의 native 직렬화는 객체 그래프를 바이트 스트림으로 저장하고 `readObject()` 로 그대로 복원한다. 문제는 이 복원 과정이 **단순한 데이터 채우기가 아니라는 것** 이다. 복원 도중 각 객체의 `readObject`, `readResolve`, `validateObject` 같은 특수 메서드가 자동으로 호출된다. 공격자는 이 자동 실행 지점을 악용한다.

![역직렬화 공격의 원리](/assets/posts/java-deserialization-vuln-attack.svg)

핵심은 **가젯 체인(gadget chain)** 이다. 공격자는 클래스패스에 존재하는 평범한 클래스들의 `readObject` 동작을 도미노처럼 연결해, 최종적으로 `Runtime.exec()` 같은 위험한 호출에 도달하는 객체 그래프를 만든다. Apache Commons-Collections의 특정 버전이 대표적인 가젯 공급원이었고, `ysoserial` 같은 공개 도구는 이런 페이로드를 자동 생성해준다. 무서운 점은, 애플리케이션 코드에 취약점이 없어도 **취약한 라이브러리가 클래스패스에 있기만 하면** 공격이 성립한다는 것이다.

## 취약한 코드의 모습

전형적인 취약 패턴은 이렇게 생겼다. 신뢰할 수 없는 출처(HTTP 바디, 쿠키, 메시지 큐 등)의 바이트를 그대로 역직렬화한다.

```java
// ❌ 매우 위험 — 신뢰 못 할 데이터를 native 역직렬화
public Object receive(InputStream untrustedInput) throws Exception {
    ObjectInputStream ois = new ObjectInputStream(untrustedInput);
    return ois.readObject(); // 이 한 줄에서 RCE가 발생할 수 있다
}
```

`readObject()` 가 어떤 클래스를 복원할지 호출 시점에는 알 수 없다. 스트림 안에 담긴 타입 정보에 따라 임의의 클래스가 인스턴스화되고 그 특수 메서드가 실행된다. 즉, **입력이 코드가 되는 것** 이다.

## 방어 전략: 위에서부터

방어에는 우선순위가 있다. 가장 확실한 것부터 적용한다.

![역직렬화 방어 전략](/assets/posts/java-deserialization-vuln-defense.svg)

### 최선: native 직렬화를 쓰지 않는다

근본 해법은 신뢰할 수 없는 데이터 교환에 Java native 직렬화를 아예 쓰지 않는 것이다. JSON(Jackson), Protocol Buffers 같은 **데이터 전용 포맷** 은 바이트를 값으로만 해석하고 임의 코드를 실행하는 경로가 없다.

```java
// ✅ 데이터 전용 포맷 — 코드 실행 경로 자체가 없음
import com.fasterxml.jackson.databind.ObjectMapper;

ObjectMapper mapper = new ObjectMapper();
// 명시한 타입으로만 바인딩, 임의 클래스 인스턴스화 없음
OrderDto dto = mapper.readValue(untrustedJson, OrderDto.class);
```

단, Jackson도 다형 역직렬화(`@JsonTypeInfo` + `enableDefaultTyping`)를 잘못 켜면 유사한 위험이 생긴다. 신뢰 못 할 입력에는 **명시적 타입 바인딩** 만 쓰고, 기본 타이핑을 활성화하지 않는다.

### 차선: ObjectInputFilter로 허용 목록

기존 시스템이 native 직렬화를 벗어날 수 없다면, Java 9부터 내장된 **ObjectInputFilter(JEP 290)** 로 복원 가능한 클래스를 허용 목록으로 제한한다.

```java
import java.io.*;

public Object receiveSafely(InputStream in) throws Exception {
    ObjectInputStream ois = new ObjectInputStream(in);

    // 허용 목록 + 리소스 한도 지정 (그 외 클래스는 REJECTED)
    ObjectInputFilter filter = ObjectInputFilter.Config.createFilter(
        "com.paldyn.dto.*;java.util.*;java.lang.*;" +
        "!*;" +                 // 나머지 클래스 전부 거부
        "maxdepth=20;maxrefs=1000;maxbytes=100000"
    );
    ois.setObjectInputFilter(filter);

    return ois.readObject(); // 허용 목록 밖 클래스는 InvalidClassException
}
```

`!*` 는 "위에서 명시적으로 허용한 것 외에는 전부 거부"를 뜻하며, 이것이 허용 목록 방식의 핵심이다. 또한 `maxdepth`·`maxrefs`·`maxbytes` 로 자원 소비를 제한해 역직렬화 폭탄(DoS)도 함께 막는다. JVM 전역에는 `jdk.serialFilter` 시스템 프로퍼티로 필터를 걸 수도 있다.

### 보조: 의존성 최신화

가젯 체인은 결국 라이브러리에서 나온다. 취약한 것으로 알려진 버전을 최신으로 유지하고, 사용하지 않는 라이브러리는 제거한다. OWASP Dependency-Check 같은 도구로 알려진 취약 의존성을 자동 스캔하는 것이 좋다.

## 실무 체크리스트

| 상황 | 권장 조치 |
|------|----------|
| 새 시스템 설계 | native 직렬화 대신 JSON/Protobuf |
| 외부 입력 역직렬화 | 절대 native `readObject` 금지 |
| 레거시로 native 불가피 | ObjectInputFilter 허용 목록 |
| Jackson 다형 처리 | 기본 타이핑 비활성, 명시 타입만 |
| 자원 고갈 방지 | maxdepth·maxrefs·maxbytes 한도 |
| 의존성 관리 | 취약 라이브러리 최신화·제거 |

## 정리

- Java native 역직렬화는 복원 과정에서 특수 메서드를 자동 실행하며, **가젯 체인** 을 통해 RCE로 이어질 수 있다.
- 애플리케이션 코드가 멀쩡해도 **취약한 라이브러리가 클래스패스에 있으면** 공격이 성립한다.
- 근본 해법은 native 직렬화를 버리고 **데이터 전용 포맷** 을 쓰는 것이다.
- 불가피하다면 **ObjectInputFilter 허용 목록** 과 자원 한도로 방어선을 세운다.

여기까지가 이 시리즈의 보안 파트다. 다음 글부터는 주제를 옮겨, 오래된 Java 버전을 현대 LTS로 옮기는 **마이그레이션** 을 다룬다. 첫 편은 Java 8에서 11로의 이동이다.

---

**지난 글:** [입력 검증 — 신뢰할 수 없는 데이터 다루기](/posts/java-input-validation/)

**다음 글:** [Java 8 → 11 마이그레이션](/posts/java-migration-8-to-11/)

<br>
읽어주셔서 감사합니다. 😊
