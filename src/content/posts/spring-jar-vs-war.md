---
title: "Spring Boot JAR vs WAR — 패키징 방식과 배포 전략 선택 가이드"
description: "Spring Boot의 Fat JAR과 WAR 패키징 방식의 내부 구조 차이를 이해하고, Gradle/Maven 빌드 설정부터 외부 WAS 배포를 위한 SpringBootServletInitializer 패턴까지 실전 기준으로 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "JAR", "WAR", "패키징", "배포", "Tomcat", "SpringBootServletInitializer", "Fat JAR"]
featured: false
draft: false
---

[지난 글](/posts/spring-graceful-shutdown/)에서 서버 종료 시 요청을 안전하게 처리하는 Graceful Shutdown을 살펴봤다. 이번에는 Spring Boot 애플리케이션을 어떤 형태로 패키징하고 배포할 것인지, **JAR과 WAR** 중 무엇을 선택해야 하는지를 구조적으로 비교한다. 선택 기준을 명확히 알고 있어야 배포 파이프라인 설계부터 실제 운영 환경 전환까지 흔들리지 않는다.

## Fat JAR이란?

전통적인 JAR 파일은 해당 프로젝트의 컴파일된 클래스만 담는다. 의존성 라이브러리는 별도로 classpath에 포함시켜야 했기 때문에, 운영 서버에 직접 배포하려면 의존성 관리가 번거로웠다.

**Spring Boot의 Fat JAR(Executable JAR)**은 다르다. `spring-boot-maven-plugin`이나 `spring-boot-gradle-plugin`이 빌드 시 모든 의존성 JAR을 하나의 JAR 안에 중첩 포함(nested JARs)하는 방식으로, 단일 파일 하나만으로 독립 실행이 가능하다.

```
java -jar myapp-1.0.jar
```

이 명령 하나로 내장 Tomcat이 구동되고 애플리케이션이 서비스를 시작한다.

![JAR vs WAR 내부 구조 비교](/assets/posts/spring-jar-vs-war-structure.svg)

## JAR 내부 구조

`jar tf myapp.jar`로 Fat JAR의 내용을 확인하면 다음 구조가 보인다.

```
BOOT-INF/classes/          ← 애플리케이션 클래스
BOOT-INF/lib/              ← 의존성 JAR 파일들 (중첩 포함)
META-INF/MANIFEST.MF       ← JarLauncher 지정
org/springframework/boot/  ← Spring Boot Loader (중첩 JAR 클래스로더)
```

핵심은 `META-INF/MANIFEST.MF`의 `Main-Class`가 `JarLauncher`를 가리킨다는 점이다. `JarLauncher`가 중첩된 JAR을 클래스로더에 등록하고, 실제 애플리케이션의 `main()` 메서드(`Start-Class` 속성)를 호출한다.

## WAR 내부 구조

WAR은 서블릿 컨테이너(Tomcat, Jetty 등)에 배포하기 위한 표준 포맷이다.

```
WEB-INF/classes/           ← 애플리케이션 클래스
WEB-INF/lib/               ← 앱 의존성 (서블릿 컨테이너 제외)
WEB-INF/lib-provided/      ← 내장 Tomcat (java -jar 실행 시 사용)
META-INF/MANIFEST.MF       ← WarLauncher 지정
static/                    ← 정적 리소스 (외부 WAS가 직접 서비스)
```

`WEB-INF/lib-provided/`에 내장 Tomcat이 들어가 `java -jar` 실행도 지원하고, 외부 Tomcat에 배포 시에는 이 디렉터리를 무시하고 WAS가 제공하는 서블릿 컨테이너를 사용한다.

## 빌드 설정

### Gradle

```groovy
// JAR (기본) — 별도 설정 불필요
plugins {
    id 'org.springframework.boot' version '3.3.0'
    id 'io.spring.dependency-management' version '1.1.5'
    id 'java'
}
// bootJar 태스크가 자동으로 Fat JAR 생성
```

WAR로 전환할 때는 `war` 플러그인을 추가하고, 내장 Tomcat을 `providedRuntime`으로 지정한다.

```groovy
plugins {
    id 'org.springframework.boot' version '3.3.0'
    id 'io.spring.dependency-management' version '1.1.5'
    id 'java'
    id 'war'    // WAR 패키징 활성화
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    // 내장 Tomcat을 provided로 — 외부 WAS 배포 시 충돌 방지
    providedRuntime 'org.springframework.boot:spring-boot-starter-tomcat'
}
```

### Maven

```xml
<packaging>war</packaging>

<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-tomcat</artifactId>
        <scope>provided</scope>
    </dependency>
</dependencies>
```

![JAR vs WAR 빌드 설정 및 배포 방식](/assets/posts/spring-jar-vs-war-deploy.svg)

## SpringBootServletInitializer — WAR의 필수 설정

외부 WAS에서 WAR를 로드하려면 서블릿 컨테이너가 Spring 컨텍스트를 초기화할 수 있도록 `SpringBootServletInitializer`를 상속해야 한다.

```java
@SpringBootApplication
public class MyApplication extends SpringBootServletInitializer {

    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder application) {
        return application.sources(MyApplication.class);
    }

    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}
```

이 설정이 있으면 `java -jar myapp.war`로 내장 Tomcat을 사용한 로컬 실행도 가능하고, 외부 Tomcat의 `webapps/` 디렉터리에 복사해 배포하는 것도 가능하다. 두 경로를 모두 지원하는 **이중 실행 패턴**이다.

## 외부 Tomcat 배포 절차

```bash
# 1. WAR 빌드
./gradlew bootWar

# 2. build/libs/ 의 WAR 파일을 Tomcat webapps/에 복사
cp build/libs/myapp.war $TOMCAT_HOME/webapps/ROOT.war

# 3. Tomcat 시작 (또는 이미 실행 중이면 자동 deploy)
$TOMCAT_HOME/bin/startup.sh

# 4. context path 확인 (ROOT.war → /)
curl http://localhost:8080/
```

`ROOT.war`로 배포하면 컨텍스트 경로가 `/`가 된다. `myapp.war`로 배포하면 `/myapp`로 접근해야 한다. Spring Boot 앱 내부에서 context path를 가정하지 않도록 주의가 필요하다.

## 배포 방식 결정 기준

| 항목 | JAR | WAR |
|---|---|---|
| 실행 방법 | `java -jar` | 외부 WAS에 배포 |
| 서버 의존성 | 없음 (내장) | 외부 WAS 필요 |
| 컨테이너 적합성 | 매우 적합 (Docker) | 컨테이너화 가능하나 불필요한 레이어 증가 |
| 레거시 WAS 정책 | 부적합 | 적합 |
| 신규 프로젝트 | 기본 선택 | 예외적 상황에만 |

클라우드 네이티브, 컨테이너, Kubernetes 환경이라면 **JAR이 압도적으로 유리**하다. Docker 이미지를 만들 때 `COPY myapp.jar .` + `ENTRYPOINT ["java","-jar","myapp.jar"]` 만으로 완성된다.

WAR은 레거시 온프레미스 환경에서 Tomcat·WebLogic·WebSphere 같은 WAS 인프라가 조직 정책상 고정되어 있거나, 여러 웹 애플리케이션을 하나의 WAS에서 관리해야 할 때 선택한다.

## Layered JAR — 컨테이너 최적화

Spring Boot 2.3부터 제공하는 **Layered JAR** 기능은 Docker 이미지 빌드 시 레이어 캐시를 최적화한다.

```bash
# 레이어 정보 추출
java -Djarmode=layertools -jar myapp.jar extract

# 레이어 목록 확인
java -Djarmode=layertools -jar myapp.jar list
# dependencies
# spring-boot-loader
# snapshot-dependencies
# application
```

```dockerfile
FROM eclipse-temurin:21-jre AS builder
WORKDIR /app
COPY myapp.jar .
RUN java -Djarmode=layertools -jar myapp.jar extract

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /app/dependencies/ ./
COPY --from=builder /app/spring-boot-loader/ ./
COPY --from=builder /app/snapshot-dependencies/ ./
COPY --from=builder /app/application/ ./
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

의존성 레이어(`dependencies/`)는 코드가 바뀌어도 변하지 않으므로 Docker 캐시에 남는다. 코드만 변경됐을 때 `application/` 레이어만 새로 빌드되어 이미지 빌드 속도가 대폭 빨라진다.

---

**지난 글:** [Spring Boot Graceful Shutdown — 안전한 서버 종료 전략](/posts/spring-graceful-shutdown/)

**다음 글:** [Spring Boot 멀티 모듈 프로젝트 — 구조 설계와 빌드 전략](/posts/spring-multi-module/)

<br>
읽어주셔서 감사합니다. 😊
