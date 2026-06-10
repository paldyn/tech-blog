---
title: "Java LTS 마이그레이션 로드맵"
description: "Java 8·11·17·21 LTS 버전의 출시 히스토리, 각 버전 간 주요 브레이킹 체인지, 실무 마이그레이션 체크리스트, 버전 선택 가이드를 종합 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "LTS", "마이그레이션", "Java21", "Java17", "Java11", "로드맵"]
featured: false
draft: false
---

[지난 글](/posts/java-21-features/)에서 Java 21 LTS의 핵심 기능을 살펴봤습니다. 이제 Java 완전 정복 시리즈의 버전 여정을 마무리하면서, **현실 프로젝트에서 어떤 LTS 버전을 선택하고 마이그레이션해야 하는지**에 대한 종합 가이드를 정리합니다.

## Java LTS 릴리스 히스토리

Java 9 이후 6개월마다 새 버전이 출시됩니다. LTS는 3년마다 제공되며, 장기 지원을 받습니다.

| 버전 | 출시일 | EOL (Oracle) | 주요 특징 |
|---|---|---|---|
| Java 8 | 2014.03 | 2030년 이후 | Lambda, Stream, Optional |
| Java 11 | 2018.09 | 2026년+ | HTTP Client, var, 모듈 안정화 |
| Java 17 | 2021.09 | 2029년+ | Sealed, Records, Strong Encap. |
| Java 21 | 2023.09 | 2031년+ | Virtual Threads, PM Switch |
| Java 25 | 2025.09 (예정) | 2033년+ | Structured Concurrency 표준 예상 |

![Java LTS 릴리스 타임라인](/assets/posts/java-lts-migration-roadmap-versions.svg)

**비LTS 버전의 지원 기간**: 다음 버전 출시 후 약 6개월. 즉, Java 19는 Java 20 출시(2023년 3월) 후 지원 종료됩니다. 비LTS를 프로덕션에 사용하는 것은 권장하지 않습니다.

## 버전별 마이그레이션 체크리스트

### Java 8 → 11

```bash
# 1. javax.* → jakarta.* 전환 필요 항목 확인
grep -r "import javax.xml.ws\|import javax.annotation\|import javax.activation" src/

# 2. Nashorn 사용 코드 확인
grep -r "ScriptEngine\|NashornScriptEngine\|jdk.nashorn" src/

# 3. --illegal-access 경고 확인 (추후 차단됨)
java --illegal-access=warn -jar app.jar 2>&1 | grep "WARNING: Illegal"

# 4. sun.misc.* 또는 com.sun.* 사용 확인
grep -r "import sun\.\|import com\.sun\." src/
```

핵심 변경 사항:
- Java EE 모듈(`javax.xml.ws`, `javax.annotation` 등) 완전 제거 → Maven/Gradle 의존성 추가
- `sun.misc.BASE64Encoder` 등 내부 API → `java.util.Base64`로 교체
- Applet, CORBA 제거

### Java 11 → 17

```bash
# --illegal-access 플래그 자체가 제거됨
# 아직 경고로 나오던 코드가 이제 InaccessibleObjectException 발생

# Strong Encapsulation 사전 테스트
java --illegal-access=deny -jar app.jar  # Java 11~16에서

# 필요한 경우 --add-opens 사용
java --add-opens java.base/java.lang=ALL-UNNAMED \
     --add-opens java.base/java.util=ALL-UNNAMED \
     -jar app.jar
```

핵심 변경 사항:
- `--illegal-access` 플래그 제거 (완전 차단)
- RMI Activation 제거 (사용 중이면 대안 필요)
- Security Manager Deprecated for Removal
- macOS AArch64 지원 (Apple Silicon 네이티브)

### Java 17 → 21

```bash
# 브레이킹 체인지가 가장 적은 업그레이드
# 대부분 코드는 재컴파일 없이 동작

# Security Manager 사용 코드 확인
grep -r "System.setSecurityManager\|SecurityManager" src/

# Finalization 의존 코드 확인
grep -r "finalize()" src/
```

핵심 변경 사항:
- Security Manager 접근 불가 (완전 제거)
- `Object.finalize()` Deprecated for Removal
- 이 외에는 사실상 하위 호환

## 마이그레이션 전략

![Java 8 to 21 마이그레이션 단계](/assets/posts/java-lts-migration-roadmap-steps.svg)

### Java 8 → 21 직접 마이그레이션 (권장)

많은 기업이 Java 8에서 11을 건너뛰고 17이나 21로 직접 마이그레이션합니다. 단계별 마이그레이션과 비용 차이가 크지 않기 때문입니다.

```bash
# Step 1: 의존성 목록 분석
mvn dependency:tree | grep -E "javax\.|com.sun\."

# Step 2: Jakarta EE 9 전환 (javax → jakarta)
# 자동화 도구 사용 가능
# mvn org.eclipse.transformer:eclipse-transformer-maven-plugin:run

# Step 3: 라이브러리 업그레이드
# Spring Boot: 2.x → 3.x
# Hibernate: 5.x → 6.x
# Mockito: 4.x → 5.x
# Jackson: 2.12+ 권장

# Step 4: 컴파일 + 테스트
mvn clean test -Djava.version=21

# Step 5: Pinning 탐지 (Virtual Thread 적용 시)
java -Djdk.tracePinnedThreads=full -jar app.jar
```

### Spring Boot 버전과 Java 버전 매핑

| Spring Boot | 최소 Java | 권장 Java |
|---|---|---|
| 2.x | 8 | 11, 17 |
| 3.0~3.1 | 17 | 17, 21 |
| 3.2+ | 17 | 21 |

Spring Boot 3.2부터 `spring.threads.virtual.enabled=true` 한 줄로 Virtual Threads를 전체 적용합니다.

## 어떤 버전을 선택해야 하는가?

**신규 프로젝트**: Java 21 (현재 권장 LTS)

**Java 8 유지보수 프로젝트**:
- Spring Boot 2.x 유지 중이면 Java 11 또는 17로 먼저 이동
- Spring Boot 3.x 전환 예정이면 Java 21로 직접 이동

**Java 11/17 프로젝트**:
- Java 21 마이그레이션 비용이 매우 낮으므로 적극 권장
- Virtual Threads 혜택을 즉시 받을 수 있음

**컨테이너 환경 (Docker/Kubernetes)**:
```dockerfile
# 권장
FROM eclipse-temurin:21-jdk-alpine

# G1GC (기본값) 또는 ZGC 선택
CMD ["java", "-XX:+UseZGC", \
     "-XX:MaxRAMPercentage=75.0", \
     "-jar", "app.jar"]
```

## JDK 배포판 선택 가이드

| 배포판 | 특징 | 권장 용도 |
|---|---|---|
| Eclipse Temurin (AdoptOpenJDK) | 무료, TCK 인증 | 범용 프로덕션 |
| Amazon Corretto | AWS 최적화, 무료 | AWS 환경 |
| Azul Zulu | Compact Java 지원 | 임베디드/클라우드 |
| GraalVM Community | Native Image, 폴리글랏 | AOT 컴파일 필요 시 |
| Oracle JDK | 상용 지원 | Oracle 계약 있는 경우 |

```bash
# SDKMAN으로 여러 JDK 버전 관리
sdk install java 21.0.3-tem   # Temurin 21
sdk install java 17.0.11-tem  # Temurin 17
sdk use java 21.0.3-tem       # 현재 세션 전환
sdk default java 21.0.3-tem   # 기본값 설정
```

## Java 완전 정복 시리즈를 마치며

이 시리즈를 통해 JVM 아키텍처부터 Java 21 LTS까지, Java의 전체 생태계를 깊이 있게 살펴봤습니다. 다음은 학습 경로 요약입니다.

- **JVM 기초**: JVM 아키텍처 → 클래스 로더 → 힙 구조 → JIT 컴파일
- **언어 기초**: 변수 → 타입 → 연산자 → 제어 흐름 → 배열 → 문자열
- **OOP**: 클래스 → 상속 → 다형성 → 인터페이스 → 제네릭
- **함수형**: Lambda → Stream → Optional → Functional Interface
- **동시성**: Thread → Executor → CompletableFuture → Virtual Threads
- **버전 여정**: Java 8 → 11 → 17 → 21

Java는 계속 진화합니다. 6개월 릴리스 사이클로 새 기능이 꾸준히 도입되고, LTS를 통해 안정성이 보장됩니다. **Java 21 LTS가 현재의 출발점**이며, 앞으로 Java 25(2025), Java 29(2027)로 이어지는 여정이 기다립니다.

---

**지난 글:** [Java 21 핵심 기능 정리 (LTS)](/posts/java-21-features/)

<br>
읽어주셔서 감사합니다. 😊
