---
title: "Spring Boot 애플리케이션 도커라이징: 레이어드 JAR와 멀티스테이지 빌드"
description: "Spring Boot 애플리케이션을 Docker 이미지로 패키징하는 방법을 단계별로 설명합니다. 레이어드 JAR, 멀티스테이지 빌드, JVM 컨테이너 옵션, docker-compose 구성까지 실전 예제로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring Boot", "Docker", "컨테이너", "레이어드JAR", "멀티스테이지빌드", "DevOps"]
featured: false
draft: false
---

[지난 글](/posts/spring-jar-vs-war/)에서 JAR와 WAR 패키징의 차이를 살펴봤다. 이번 글에서는 Spring Boot 애플리케이션을 Docker 이미지로 효율적으로 패키징하는 방법을 다룬다. 단순히 JAR를 이미지에 넣는 것을 넘어서, 레이어드 JAR와 멀티스테이지 빌드를 결합해 빠른 재빌드와 작은 이미지 크기를 동시에 달성하는 실전 전략을 살펴본다.

## 왜 일반 FAT JAR 이미지가 비효율적인가

Spring Boot `bootJar`로 생성한 실행 가능한 JAR는 의존성 전체를 포함한 단일 파일이다. 이 파일을 그대로 Docker 이미지 레이어에 담으면, 코드 한 줄만 바꿔도 70~100MB에 달하는 전체 JAR를 레지스트리에 다시 올려야 한다.

실제로 업무 로직 클래스 파일은 전체의 0.1% 남짓이다. 나머지 99% 이상은 Spring Boot Starter, Hibernate, Jackson 같은 외부 의존성인데, 이것들은 의존성 버전을 올리지 않는 한 거의 바뀌지 않는다.

![Spring Boot Docker 이미지 레이어 구조](/assets/posts/spring-dockerizing-layers.svg)

## 레이어드 JAR: 변경 빈도에 따라 분리

Spring Boot 2.3부터 `layertools` 모드를 내장했다. 이 모드로 JAR를 분해하면 네 개의 레이어로 나뉜다.

| 레이어 | 내용 | 변경 빈도 |
|---|---|---|
| `dependencies` | 릴리즈 의존성 | 거의 변경 없음 |
| `snapshot-dependencies` | SNAPSHOT 의존성 | 가끔 |
| `resources` | 정적 리소스, 설정 파일 | 가끔 |
| `application` | 내 코드 (클래스) | 매 배포마다 |

Docker는 레이어를 아래에서 위로 쌓고, 변경된 레이어부터 위쪽만 다시 빌드하므로 `application` 레이어만 바뀐 경우 나머지 세 레이어는 캐시에서 재사용된다.

### Gradle 설정

```groovy
// build.gradle
tasks.named('bootJar') {
    layered {
        enabled = true
    }
}
```

Maven에서는 기본 활성화되어 있으므로 별도 설정이 불필요하다.

## 멀티스테이지 Dockerfile 작성

레이어드 JAR를 실제로 활용하는 Dockerfile은 두 단계로 구성된다. 첫 번째 스테이지에서 JAR를 분해하고, 두 번째 스테이지에서 JRE만 포함한 최소 이미지에 레이어를 순서대로 COPY한다.

```dockerfile
# 1단계: 레이어 분해
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY build/libs/*.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract

# 2단계: 실행 이미지 (JRE만 포함)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# 변경 빈도 낮은 레이어 먼저 복사 → 캐시 최대 활용
COPY --from=builder /app/dependencies/ ./
COPY --from=builder /app/snapshot-dependencies/ ./
COPY --from=builder /app/resources/ ./
COPY --from=builder /app/application/ ./

EXPOSE 8080
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]
```

JDK 대신 JRE 이미지를 사용하면 최종 이미지 크기가 약 200MB 줄어든다.

![Spring Boot 도커 빌드 흐름](/assets/posts/spring-dockerizing-build-flow.svg)

## .dockerignore 설정

빌드 컨텍스트가 크면 `docker build` 자체가 느려진다. `.dockerignore`로 불필요한 파일을 제외한다.

```
.gradle
.git
.idea
src/test
*.md
gradlew.bat
```

Dockerfile에서 `COPY build/libs/*.jar`만 사용하므로, 소스 코드는 컨텍스트에 포함될 필요가 없다.

## JVM 컨테이너 옵션

Docker 컨테이너는 cgroup으로 CPU와 메모리를 제한하는데, JVM은 기본적으로 이 제한을 인식하지 못하고 호스트 전체 메모리를 기준으로 힙을 설정한다. `UseContainerSupport`(JDK 10+, 기본 활성)와 `MaxRAMPercentage`를 함께 설정하면 컨테이너 메모리 한도의 75%를 힙으로 자동 배정한다.

```bash
# 메모리 512MB 컨테이너에서 확인
docker run --memory=512m myapp:latest java \
  -XX:+PrintFlagsFinal -version 2>&1 | grep MaxHeapSize
# MaxHeapSize = 402653184  (≈ 384MB = 512MB × 75%)
```

## docker-compose로 로컬 개발 환경 구성

로컬에서 DB와 함께 띄울 때는 docker-compose가 편리하다.

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/mydb
      SPRING_DATASOURCE_USERNAME: user
      SPRING_DATASOURCE_PASSWORD: pass
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d mydb"]
      interval: 5s
      timeout: 5s
      retries: 5
```

`depends_on`의 `condition: service_healthy`를 사용하면 DB가 완전히 준비된 뒤에 앱이 시작된다.

## Buildpacks 대안

Dockerfile 없이 이미지를 만들고 싶다면 Spring Boot의 Cloud Native Buildpacks 통합을 사용할 수 있다.

```bash
# Gradle
./gradlew bootBuildImage --imageName=myapp:latest

# Maven
./mvnw spring-boot:build-image -Dspring-boot.build-image.imageName=myapp:latest
```

Buildpacks는 JVM 옵션, 레이어 분리, 보안 패치를 자동으로 처리해 주지만, 빌드 시간이 Dockerfile 방식보다 길고 커스터마이징 자유도가 낮다. 기업 CI/CD 파이프라인에서는 Dockerfile 방식이 여전히 주류다.

## 이미지 크기 비교

| 방식 | 이미지 크기 | 코드 변경 시 재전송 |
|---|---|---|
| JDK + FAT JAR | ~350MB | ~80MB |
| JRE + FAT JAR | ~150MB | ~80MB |
| JRE + 레이어드 (멀티스테이지) | ~130MB | ~100KB |
| Buildpacks | ~200MB | 레이어 자동 최적화 |

레이어드 JAR + 멀티스테이지 조합이 재전송 용량을 가장 극적으로 줄여준다. 배포가 잦은 서비스일수록 이 차이가 누적 비용과 배포 속도에 직결된다.

---

**지난 글:** [Spring Boot JAR vs WAR 패키징](/posts/spring-jar-vs-war/)

**다음 글:** [Spring Boot CI/CD 파이프라인 구성](/posts/spring-cicd-pipeline/)

<br>
읽어주셔서 감사합니다. 😊
