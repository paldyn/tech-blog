---
title: "Java 8 → 11 마이그레이션"
description: "가장 널리 쓰이던 Java 8에서 첫 모듈형 LTS인 Java 11로 이동하는 실전 가이드입니다. JDK에서 제거된 Java EE 모듈(JAXB·JAX-WS 등) 복구, 내부 API 접근 제한, jdeps 진단, 점진적 마이그레이션 순서를 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-07-05"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "마이그레이션", "Java11", "Java8", "LTS", "모듈"]
featured: false
draft: false
---

[지난 글](/posts/java-deserialization-vuln/)에서 역직렬화 취약점을 끝으로 보안 파트를 마무리했다. 이번 글부터는 오래된 Java를 현대 LTS로 옮기는 **마이그레이션** 을 세 편에 걸쳐 다룬다. 첫 편은 가장 많은 조직이 마주하는 관문, **Java 8에서 11로의 이동** 이다. Java 8은 역사상 가장 오래 쓰인 버전이지만 공식 지원이 끝난 지 오래이고, 11은 모듈 시스템이 도입된 이후 첫 LTS라는 점에서 이 구간에 고유한 함정이 몰려 있다.

## 왜 8→11이 특히 까다로운가

11 이후의 LTS 간 이동(11→17, 17→21)은 대체로 매끄럽다. 하지만 8→11 구간은 그 사이에 **Java 9의 모듈 시스템(JPMS)** 이라는 거대한 변화가 끼어 있어 유독 험난하다. 가장 큰 충격은 오랫동안 JDK에 기본 포함돼 있던 **Java EE 모듈들이 제거된 것** 이다.

![Java 8 → 11: 사라진 것들](/assets/posts/java-migration-8-to-11-removed.svg)

Java 8에서는 `import javax.xml.bind.*` 를 아무 의존성 없이 쓸 수 있었다. 이 코드는 Java 11에서 컴파일조차 되지 않거나 런타임에 `ClassNotFoundException` 을 던진다. JAXB, JAX-WS, JAF, CORBA, JTA 등이 JDK에서 빠졌기 때문이다. 이것이 8→11 마이그레이션에서 가장 흔히 마주치는 오류다.

## 제거된 모듈 복구하기

해법은 간단하다. JDK에서 빠진 모듈을 **별도 라이브러리 의존성으로 다시 추가** 하면 된다. 예를 들어 JAXB는 이렇게 복구한다.

```xml
<!-- Maven: JAXB를 명시적 의존성으로 추가 -->
<dependency>
    <groupId>jakarta.xml.bind</groupId>
    <artifactId>jakarta.xml.bind-api</artifactId>
    <version>4.0.2</version>
</dependency>
<dependency>
    <groupId>org.glassfish.jaxb</groupId>
    <artifactId>jaxb-runtime</artifactId>
    <version>4.0.5</version>
</dependency>
```

```gradle
// Gradle: 동일한 복구
dependencies {
    implementation 'jakarta.xml.bind:jakarta.xml.bind-api:4.0.2'
    runtimeOnly 'org.glassfish.jaxb:jaxb-runtime:4.0.5'
}
```

주의할 점은 패키지 이름이 `javax.xml.bind` 에서 `jakarta.xml.bind` 로 바뀌었다는 것이다(Java EE가 Jakarta EE로 이관되면서 발생한 네임스페이스 변경). 오래된 `javax.*` 아티팩트를 임시로 쓸 수도 있지만, 신규 코드는 `jakarta.*` 로 맞추는 것이 미래 지향적이다.

## 내부 API 접근 제한

모듈 시스템의 또 다른 영향은 `sun.misc.Unsafe` 같은 **JDK 내부 API 접근이 제한** 된 것이다. Java 11에서는 이런 접근이 경고를 발생시키며, 이후 버전에서는 아예 막힌다.

```text
WARNING: An illegal reflective access operation has occurred
WARNING: Illegal reflective access by com.example.SomeLib
WARNING: Please consider reporting this to the maintainers
```

이 경고는 대개 오래된 라이브러리(구버전 Mockito, Hibernate 등)가 리플렉션으로 내부에 접근하며 발생한다. 근본 해법은 **해당 라이브러리를 최신 버전으로 올리는 것** 이다. 불가피하게 시간을 벌어야 한다면 `--add-opens` 로 임시 우회할 수 있지만, 이는 언젠가 막힐 미봉책임을 기억해야 한다.

```bash
# 임시 우회 (영구 해법 아님 — 라이브러리 업데이트가 우선)
java --add-opens java.base/java.lang=ALL-UNNAMED -jar app.jar
```

## jdeps로 미리 진단하기

무작정 JDK를 바꾸기 전에, JDK에 포함된 **jdeps** 로 애플리케이션이 제거된 모듈이나 내부 API에 의존하는지 먼저 진단할 수 있다.

```bash
# JDK 내부 API 사용 여부 스캔
jdeps --jdk-internals app.jar

# 제거될 예정인 모듈 의존성 확인
jdeps -s --multi-release 11 app.jar
```

이 진단을 먼저 돌리면 실제 실행 전에 어디를 고쳐야 할지 목록을 얻을 수 있어, 마이그레이션 리스크를 크게 줄인다.

## 점진적 마이그레이션 순서

한꺼번에 JDK를 바꾸고 모든 문제를 동시에 처리하려 하면 원인 파악이 어려워진다. 변경을 단계로 나눠 각 단계마다 검증하는 것이 안전하다.

![점진적 마이그레이션 순서](/assets/posts/java-migration-8-to-11-steps.svg)

1. **의존성 먼저**: JDK는 8에 둔 채 라이브러리를 Java 11 호환 버전으로 올린다. 이 단계에서 대부분의 라이브러리 호환성 문제가 드러난다.
2. **JDK 11로 컴파일**: `jdeps` 진단을 반영해 컴파일 오류와 경고를 해소한다.
3. **제거 모듈 복구**: JAXB 등을 `jakarta` 의존성으로 추가한다.
4. **전체 검증**: 테스트와 런타임 동작을 확인하고 배포한다.

## 부수적으로 얻는 것들

마이그레이션은 부담이지만, 11로 올라오면 실질적인 이득이 따라온다. `var` 지역 변수 타입 추론, 표준 `HttpClient`(java.net.http), 문자열 편의 메서드(`isBlank`, `strip`, `lines`), 그리고 컨테이너 환경 인식이 개선된 G1 GC를 바로 쓸 수 있다. 무엇보다 **보안 패치가 계속 제공되는 지원 버전** 이 된다는 점이 가장 크다.

## 정리

- 8→11의 최대 난관은 모듈 시스템 도입과 함께 **Java EE 모듈(JAXB·JAX-WS 등)이 JDK에서 제거된 것** 이다.
- 제거된 모듈은 `jakarta.*` **의존성으로 복구** 하고, 내부 API 경고는 라이브러리 최신화로 해결한다.
- 실행 전에 **jdeps** 로 위험 지점을 진단하고, 의존성 → 컴파일 → 모듈 복구 → 검증의 **단계별 순서** 를 따른다.

다음 글에서는 상대적으로 매끄러운 구간인 **11 → 17 마이그레이션** 을 다룬다.

---

**지난 글:** [역직렬화 취약점 — 안전하지 않은 역직렬화 방어](/posts/java-deserialization-vuln/)

**다음 글:** [Java 11 → 17 마이그레이션](/posts/java-migration-11-to-17/)

<br>
읽어주셔서 감사합니다. 😊
