---
title: "Spring Boot 내장 서버: Tomcat을 JAR 안에 품는 방법"
description: "Spring Boot 내장 서버(Embedded Server)가 어떻게 동작하는지 이해합니다. 전통적 WAR 배포와 Fat JAR의 차이, Tomcat/Jetty/Undertow 교체 방법, application.properties로 서버 설정 커스터마이징, WebServerFactoryCustomizer 활용, 그리고 운영 환경에서 고려해야 할 스레드 풀과 SSL 설정까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "EmbeddedServer", "Tomcat", "Jetty", "Undertow", "FatJar", "내장서버"]
featured: false
draft: false
---

[지난 글](/posts/springboot-starter-structure/)에서 Spring Boot Starter가 의존성 묶음과 Auto-Configuration을 어떻게 패키징하는지 살펴봤습니다. 이번에는 Spring Boot의 또 다른 핵심 특징인 **내장 서버(Embedded Server)**를 파헤칩니다. `java -jar myapp.jar` 한 줄로 서버가 뜨는 것은 당연한 게 아닙니다. 그 배경에는 꽤 정교한 설계가 있습니다.

## 전통적 배포 vs. 내장 서버 배포

Spring Boot 이전의 자바 웹 애플리케이션 배포는 이런 흐름이었습니다.

1. Tomcat / JBoss / WebLogic 같은 WAS를 서버에 **별도로 설치**합니다.
2. 애플리케이션을 **WAR 파일**로 빌드합니다.
3. WAS의 `webapps/` 디렉터리에 WAR를 배포합니다.
4. WAS를 재시작하거나 Hot Deploy를 적용합니다.

WAS 버전, 설정 파일, 클래스로더 구조가 환경마다 달랐고, "내 PC에서는 되는데 서버에서 안 된다"는 문제가 빈번했습니다.

![내장 서버 vs 외장 서버](/assets/posts/springboot-embedded-server-concept.svg)

Spring Boot는 이 모델을 뒤집었습니다. **서버가 애플리케이션 안에 포함**됩니다. 빌드 결과물인 JAR 파일 안에 Tomcat(또는 Jetty, Undertow)이 함께 패키징되어 있습니다. JRE만 설치된 환경이라면 어디서든 동일하게 실행됩니다.

## Fat JAR의 구조

```
myapp.jar
├── BOOT-INF/
│   ├── classes/          ← 애플리케이션 클래스
│   └── lib/              ← 의존 라이브러리 (tomcat-embed-core.jar 포함)
├── META-INF/
│   └── MANIFEST.MF       ← Main-Class: JarLauncher
└── org/springframework/boot/loader/
    └── JarLauncher.class ← Spring Boot 커스텀 클래스로더
```

일반 JAR는 내부에 다른 JAR를 포함할 수 없습니다(Nested JAR 불가). Spring Boot는 `JarLauncher`라는 커스텀 클래스로더를 사용해 이 제약을 해결합니다. `JarLauncher`가 `BOOT-INF/lib/` 안의 JAR들을 클래스패스에 올리고, 실제 메인 클래스(`Start-Class`)를 실행합니다.

```bash
# Fat JAR 내용 확인
jar tf myapp.jar | grep tomcat | head -5
# BOOT-INF/lib/tomcat-embed-core-10.1.x.jar
# BOOT-INF/lib/tomcat-embed-el-10.1.x.jar
# BOOT-INF/lib/tomcat-embed-websocket-10.1.x.jar
```

## 내장 서버 교체하기

Spring Boot의 기본 서버는 **Tomcat**이지만, Gradle/Maven 의존성 교체만으로 다른 서버를 사용할 수 있습니다.

```kotlin
// build.gradle.kts — Tomcat 제외 후 Jetty로 교체
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web") {
        exclude(group = "org.springframework.boot", module = "spring-boot-starter-tomcat")
    }
    implementation("org.springframework.boot:spring-boot-starter-jetty")
}
```

```kotlin
// build.gradle.kts — Undertow로 교체
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web") {
        exclude(group = "org.springframework.boot", module = "spring-boot-starter-tomcat")
    }
    implementation("org.springframework.boot:spring-boot-starter-undertow")
}
```

서버별 특징을 간단히 정리하면 다음과 같습니다.

| 서버 | 특징 | 적합한 상황 |
|------|------|-------------|
| Tomcat | 안정성·범용성 최고, 가장 널리 쓰임 | 대부분의 프로덕션 환경 |
| Jetty | 경량·임베디드 적합, 낮은 메모리 | 마이크로서비스·IoT |
| Undertow | 논블로킹 I/O 기반, 고성능 | 높은 동시 요청 처리 |
| Netty | 완전한 비동기, WebFlux 전용 | Reactive 스택 |

## application.properties로 서버 설정하기

![내장 서버 설정 방법](/assets/posts/springboot-embedded-server-config.svg)

자주 쓰이는 서버 설정들입니다.

```properties
# application.properties

# 기본 포트 (기본값: 8080)
server.port=8080

# 컨텍스트 경로 (기본값: /)
server.servlet.context-path=/api

# 커넥션 타임아웃
server.tomcat.connection-timeout=20s

# 스레드 풀 크기
server.tomcat.threads.max=200
server.tomcat.threads.min-spare=10

# 요청 큐 크기
server.tomcat.accept-count=100

# 최대 요청 헤더 크기
server.tomcat.max-http-form-post-size=2MB
```

## 코드로 서버 설정하기: WebServerFactoryCustomizer

`application.properties`로 설정할 수 없는 세밀한 옵션은 `WebServerFactoryCustomizer`를 사용합니다.

```java
@Component
public class TomcatServerCustomizer
        implements WebServerFactoryCustomizer<TomcatServletWebServerFactory> {

    @Override
    public void customize(TomcatServletWebServerFactory factory) {
        // 커넥터 추가 — HTTP/2 설정
        factory.addConnectorCustomizers(connector -> {
            connector.setProperty("relaxedQueryChars", "|{}[]");
        });

        // 에러 페이지 커스터마이징
        factory.addErrorPages(new ErrorPage(HttpStatus.NOT_FOUND, "/404.html"));
    }
}
```

`TomcatServletWebServerFactory` 대신 `JettyServletWebServerFactory`, `UndertowServletWebServerFactory`를 사용하면 서버별 설정도 가능합니다.

## SSL(HTTPS) 설정

내장 Tomcat에 SSL을 적용하는 가장 간단한 방법입니다.

```bash
# 개발용 자체 서명 인증서 생성
keytool -genkeypair \
  -alias myapp \
  -keyalg RSA \
  -keysize 2048 \
  -storetype PKCS12 \
  -keystore keystore.p12 \
  -validity 3650
```

```properties
# application.properties
server.ssl.key-store=classpath:keystore.p12
server.ssl.key-store-password=changeit
server.ssl.key-store-type=PKCS12
server.ssl.key-alias=myapp
server.port=8443
```

프로덕션에서는 인증서 관리를 애플리케이션 앞단의 **리버스 프록시(Nginx/Apache)나 로드밸런서**에서 처리하고 내장 서버는 HTTP로만 받는 것이 일반적입니다.

## 랜덤 포트 활용 (테스트 용도)

```properties
# 테스트용: 사용 가능한 포트를 자동 할당
server.port=0
```

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ApiIntegrationTest {

    @LocalServerPort
    private int port;

    // 여러 테스트가 병렬로 실행될 때 포트 충돌을 방지
}
```

## 내장 서버의 생명주기

Spring Boot 애플리케이션이 시작될 때 내장 서버는 이 순서로 초기화됩니다.

```
SpringApplication.run()
  → ApplicationContext 생성
  → 빈 등록 완료
  → EmbeddedWebApplicationContext
    → WebServerFactory 빈 탐색
    → TomcatServletWebServerFactory.getWebServer()
      → Tomcat 인스턴스 생성
      → 커넥터 설정
      → Tomcat.start()
  → ApplicationStartedEvent 발행
  → 서버 Ready
```

`ServletContextInitializer`, `FilterRegistrationBean`, `ServletRegistrationBean` 등을 빈으로 등록하면 Tomcat 초기화 과정에서 자동으로 설정됩니다.

## 정리

Spring Boot의 내장 서버는 단순히 편의 기능이 아닙니다. 배포 모델 자체를 바꾼 설계 결정입니다. 서버 설정이 코드와 함께 버전 관리되고, Docker 이미지가 단순해지며, 환경 불일치 문제가 사라집니다. 다음 글에서는 애플리케이션 운영에 필수인 **Logback과 SLF4J 로깅 설정**을 다룹니다.

---

**지난 글:** [Spring Boot Starter 구조 완전 정복](/posts/springboot-starter-structure/)

**다음 글:** [Spring Boot Logback & SLF4J 로깅 완전 정복](/posts/springboot-logback-slf4j/)

<br>
읽어주셔서 감사합니다. 😊
