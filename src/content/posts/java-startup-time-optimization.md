---
title: "자바 기동 시간 최적화 — 빠르게 시작하는 JVM"
description: "JVM이 왜 느리게 시작하는지 클래스 로딩·인터프리터·JIT 워밍업 원리부터 짚고, CDS/AppCDS·Tiered Compilation·Lazy Init·클래스패스 최소화까지 실전 최적화 기법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "기동 시간", "CDS", "AppCDS", "성능", "Spring Boot", "GraalVM"]
featured: false
draft: false
---

[지난 글](/posts/java-profiler-async/)에서 async-profiler로 런타임 핫스팟을 찾는 법을 살펴봤습니다. 런타임 성능 못지않게 현장에서 자주 문제가 되는 것이 **기동 시간(startup time)** 입니다. 쿠버네티스 파드가 롤링 업데이트될 때 60초씩 기다려야 한다면 배포 빈도와 서비스 가용성 모두 떨어집니다. 서버리스 함수는 콜드 스타트가 수초를 넘기면 SLA 자체가 흔들립니다. JVM이 왜 느리게 시작하는지 원리부터 이해하고, 실제로 어떤 기법들을 조합해 단축할 수 있는지 알아보겠습니다.

## JVM 기동이 느린 이유

JVM 프로세스가 `main()`에 도달하기까지 세 단계를 거칩니다.

![JVM 기동 단계별 소요 시간](/assets/posts/java-startup-time-optimization-phases.svg)

첫째, **클래스 로딩(class loading)** 입니다. JVM은 클래스가 처음 참조될 때 `.class` 파일을 디스크에서 읽고, 바이트코드를 검증하고, 메서드 영역에 메타데이터를 올립니다. Spring Boot 같은 대형 프레임워크는 기동 시점에 수천 개의 클래스를 로드합니다. 파일 I/O와 검증 과정이 쌓이면 이것만으로도 수백 밀리초가 소모됩니다.

둘째, **인터프리터 실행** 단계입니다. JVM은 처음에 바이트코드를 한 줄씩 해석해 실행합니다. 이 방식은 컴파일된 네이티브 코드보다 훨씬 느리지만, 메서드가 충분히 "핫"해지기 전까지는 컴파일하지 않습니다.

셋째, **JIT 워밍업** 입니다. Tiered Compilation 체계에서 JVM은 메서드를 C1 컴파일러로 먼저 빠르게 컴파일하고, 일정 호출 횟수를 넘으면 C2로 더 공격적으로 최적화합니다. 이 과정이 완료되기 전까지 애플리케이션은 피크 성능이 나오지 않고, 컴파일 스레드가 CPU를 점유합니다.

Spring Boot 애플리케이션은 빈(Bean) 컨테이너 초기화·컴포넌트 스캔·자동 설정 평가까지 더해져 기동 시간이 5~15초에 달하는 경우도 흔합니다.

## 먼저 측정하기

최적화 전에 어디서 시간이 소모되는지 먼저 파악해야 합니다.

```bash
# 클래스 로딩 상세 로그 (어떤 클래스가 얼마나 로드되는지)
java -Xlog:class+load*=info -jar app.jar 2>&1 | grep "source:" | wc -l

# Spring Boot Actuator 기동 단계별 타이밍
# application.properties
management.endpoint.startup.enabled=true
management.endpoints.web.exposure.include=startup
```

```bash
# 간단한 기동 시간 측정
time java -jar app.jar --spring.profiles.active=prod &
# 로그에서 "Started Application in X seconds" 확인
```

`-Xlog:class+load*=info`는 로드된 클래스 수와 소스(JAR 경로)를 출력합니다. 클래스 수가 예상보다 많다면 불필요한 의존성이 풀린 것이므로 클래스패스 정리 우선순위를 높여야 합니다.

## CDS와 AppCDS — 클래스 로딩 단축

**Class Data Sharing(CDS)** 은 클래스 메타데이터를 공유 아카이브 파일로 만들어 두고, 이후 기동 시 디스크 I/O 없이 메모리 매핑으로 즉시 로드하는 기술입니다. JDK 5부터 있었지만, JDK 10에 **AppCDS**로 확장돼 애플리케이션 JAR의 클래스까지 포함할 수 있게 됐습니다.

![AppCDS 워크플로 & 주요 JVM 플래그](/assets/posts/java-startup-time-optimization-cds.svg)

```bash
# 1단계: 어떤 클래스가 로드되는지 목록 수집
java -XX:DumpLoadedClassList=classes.lst -jar app.jar

# 2단계: 공유 아카이브 생성 (1회 실행)
java -Xshare:dump \
     -XX:SharedClassListFile=classes.lst \
     -XX:SharedArchiveFile=app.jsa \
     -cp app.jar

# 3단계: 아카이브를 사용해 기동
java -Xshare:on \
     -XX:SharedArchiveFile=app.jsa \
     -jar app.jar
```

JDK 17부터는 JDK 자체 클래스에 대한 기본 CDS 아카이브가 내장돼 있어, `-Xshare:on`만으로도 JDK 클래스 로딩이 가속됩니다. AppCDS를 추가로 적용하면 클래스 로딩 단계가 30~50% 단축되는 경우가 많습니다.

JDK 24에는 **JEP 483 — AOT Class Loading & Linking** 이 추가돼, 컴파일된 코드 일부도 아카이브에 포함할 수 있게 됐습니다. 이는 CDS와 JIT 사이 어딘가에 위치한 기법으로, JIT 워밍업 초기를 단축합니다.

## Tiered Compilation 이해

기본적으로 JVM은 네 단계의 컴파일 수준을 사용합니다.

| 레벨 | 설명 |
|---|---|
| 0 | 인터프리터 |
| 1~3 | C1 (프로파일링 포함 경량 JIT) |
| 4 | C2 (최적화 JIT) |

일반적으로 기동 시에는 **레벨 1~3 C1**으로 빠르게 컴파일해 인터프리터보다 빠른 실행을 확보하고, 호출 횟수가 쌓이면 C2로 승격합니다. `-XX:TieredStopAtLevel=1`처럼 C1에서 멈추면 기동 시간은 단축되지만 피크 성능이 낮아집니다. 빠른 기동이 중요한 배치성 작업이나 단명 프로세스에 유효합니다.

## Lazy Initialization

Spring Boot는 기본적으로 모든 빈을 기동 시 초기화합니다. 이를 요청이 들어올 때 필요한 빈만 초기화하도록 바꾸면 기동 시간이 크게 줄어듭니다.

```properties
# application.properties
spring.main.lazy-initialization=true
```

```java
// 특정 빈만 lazy 제외 (기동 시 반드시 초기화해야 한다면)
@Lazy(false)
@Bean
public DataSource dataSource() { ... }
```

다만 Lazy 초기화는 첫 요청이 들어올 때 지연 시간을 발생시킵니다. 프로덕션에서는 `spring.main.lazy-initialization=true`와 함께 준비 상태 엔드포인트(`/actuator/health/readiness`)를 정확히 설정해 트래픽이 오기 전에 필요한 빈이 초기화되도록 관리해야 합니다.

## 클래스패스 최소화

로드되는 클래스 수 자체를 줄이는 것도 효과적입니다.

```bash
# 실제로 사용하는 모듈만 포함한 커스텀 JRE 생성 (jlink)
jlink \
  --module-path $JAVA_HOME/jmods \
  --add-modules java.base,java.logging,java.sql \
  --output custom-jre \
  --strip-debug \
  --compress=2
```

Maven/Gradle에서 의존성 트리를 정기적으로 점검하고 transitive dependency로 딸려 오는 불필요한 라이브러리를 exclusion으로 제거하면 JAR 크기와 클래스 수가 줄어 CDS 효율도 높아집니다.

## Spring Boot 특유의 기동 최적화

컴포넌트 스캔 범위를 좁히는 것이 가장 직관적입니다.

```java
// 범위를 명시해 전체 클래스패스 스캔 방지
@SpringBootApplication(scanBasePackages = "com.example.myapp")
public class MyApp { ... }

// 또는 스캔 없이 직접 등록
@Configuration
@Import({ ServiceConfig.class, RepositoryConfig.class })
public class AppConfig { ... }
```

Spring Framework 6.x / Spring Boot 3.x에서는 **AOT processing** 이 기본으로 제공됩니다. `spring-boot:process-aot` 단계에서 빈 정의를 사전 처리해 런타임 리플렉션을 줄이고, GraalVM Native Image와 연동하면 밀리초 단위 기동이 가능합니다.

## GraalVM Native Image의 역할

가장 극적인 기동 단축 방법은 **GraalVM Native Image** 입니다. 빌드 타임에 AOT 컴파일로 JVM 없이 실행되는 네이티브 바이너리를 생성합니다. 클래스 로딩·JIT 워밍업 단계가 없으므로 기동이 수십 밀리초 수준입니다. 트레이드오프로 빌드 시간이 길고, 리플렉션·동적 프록시 등 런타임 동적 기능에 제약이 따릅니다. GraalVM에 대해서는 [다음 글](/posts/graalvm-overview/)에서 상세히 다루겠습니다.

## 정리

JVM 기동 시간은 클래스 로딩·인터프리터 실행·JIT 워밍업 세 단계의 합입니다. 이를 줄이는 기법도 각 단계에 대응합니다. CDS/AppCDS는 클래스 로딩을, Tiered Compilation 조정은 JIT 워밍업을 단축하고, Lazy Init·클래스패스 최소화·컴포넌트 스캔 범위 한정은 애플리케이션 레이어에서 초기화 작업을 줄입니다. 어떤 단계가 병목인지는 `-Xlog:class+load*`와 Actuator로 먼저 측정하고, 그 결과에 맞는 기법을 조합해 적용하는 것이 가장 효과적입니다.

---

**지난 글:** [async-profiler — 낮은 오버헤드의 프로파일링](/posts/java-profiler-async/)

**다음 글:** [GraalVM 개요 — 고성능 폴리글랏 런타임](/posts/graalvm-overview/)

<br>
읽어주셔서 감사합니다. 😊
