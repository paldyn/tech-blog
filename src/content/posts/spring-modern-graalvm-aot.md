---
title: "GraalVM 네이티브 이미지: Spring AOT 컴파일 완전 가이드"
description: "GraalVM native-image와 Spring AOT의 동작 원리, JVM 대비 기동 시간·메모리 비교, 리플렉션·리소스·프록시 힌트 등록 방법, 그리고 서버리스·컨테이너 환경에서의 실전 적용법을 코드 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["GraalVM", "Native Image", "Spring AOT", "서버리스", "Spring Boot 3", "네이티브 컴파일"]
featured: false
draft: false
---

[지난 글](/posts/spring-modern-jakarta-migration/)에서 Spring Boot 3 마이그레이션을 완료했다면, 이제 Boot 3의 핵심 기능 중 하나인 **GraalVM 네이티브 이미지**를 활용할 차례입니다.

## GraalVM 네이티브 이미지란

GraalVM의 `native-image` 도구는 Java 바이트코드를 **미리 컴파일(AOT)**해 JVM 없이 실행 가능한 네이티브 바이너리로 만듭니다. 결과물은 OS에 직접 실행되는 단일 실행 파일입니다.

기존 JVM 방식은 JIT(Just-In-Time) 컴파일로 실행 중 최적화하기 때문에 최고 성능까지 워밍업이 필요합니다. 반면 네이티브 이미지는 빌드 타임에 모든 분석을 마치므로 즉시 최고 성능에 가까운 상태로 시작합니다.

![GraalVM 빌드 흐름과 JVM vs Native 비교](/assets/posts/spring-modern-graalvm-aot-flow.svg)

## Spring AOT의 역할

네이티브 이미지 빌드에서 가장 큰 도전은 **동적 기능의 처리**입니다. GraalVM은 빌드 타임에 닫힌 세계(Closed World) 가정을 적용하기 때문에, 런타임에 리플렉션이나 동적 프록시로 처음 접근하는 클래스를 미리 알 수 없습니다.

Spring AOT(Ahead-Of-Time) 엔진은 빌드 타임에 애플리케이션 컨텍스트를 분석해 세 가지 작업을 수행합니다.

1. **코드 생성**: `@Configuration` 클래스의 빈 등록 로직을 리플렉션 없는 Java 코드로 변환
2. **리플렉션 힌트 생성**: `@Entity`, Jackson 직렬화 대상 등 리플렉션이 필요한 클래스를 힌트로 자동 등록
3. **프록시 힌트 생성**: AOP, `@Transactional` 등에서 사용하는 동적 프록시를 컴파일 타임 프록시로 교체

## 빌드 설정

```xml
<!-- Maven: native profile -->
<profiles>
  <profile>
    <id>native</id>
    <build>
      <plugins>
        <plugin>
          <groupId>org.graalvm.buildtools</groupId>
          <artifactId>native-maven-plugin</artifactId>
          <executions>
            <execution>
              <id>build-native</id>
              <goals><goal>compile-no-fork</goal></goals>
              <phase>package</phase>
            </execution>
          </executions>
        </plugin>
      </plugins>
    </build>
  </profile>
</profiles>
```

```groovy
// Gradle build.gradle
plugins {
    id 'org.springframework.boot' version '3.2.5'
    id 'org.graalvm.buildtools.native' version '0.10.2'
}

graalvmNative {
    binaries {
        main {
            buildArgs.add('--no-fallback')
            // 메모리 제한 설정 (CI 환경)
            buildArgs.add('-J-Xmx6g')
        }
    }
}
```

```bash
# Maven 네이티브 빌드
./mvnw -Pnative native:compile

# Gradle 네이티브 빌드
./gradlew nativeCompile

# Docker 기반 빌드 (GraalVM 미설치 환경)
./gradlew bootBuildImage --imageName=my-app:native
```

## 리플렉션 힌트 등록

Spring이 자동으로 처리하지 못하는 동적 클래스 접근은 힌트를 직접 등록해야 합니다.

![네이티브 힌트 등록 방법](/assets/posts/spring-modern-graalvm-aot-hints.svg)

```java
// @RegisterReflectionForBinding: DTO 직렬화/역직렬화
@SpringBootApplication
@RegisterReflectionForBinding(OrderDto.class)
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}
```

```java
// RuntimeHintsRegistrar: 세밀한 제어가 필요할 때
@Component
@ImportRuntimeHints(MyRuntimeHints.class)
public class MyService { }

class MyRuntimeHints implements RuntimeHintsRegistrar {
    @Override
    public void registerHints(RuntimeHints hints, ClassLoader cl) {
        // 리플렉션 힌트
        hints.reflection().registerType(
            OrderDto.class,
            MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS,
            MemberCategory.DECLARED_FIELDS
        );
        // 리소스 힌트 (classpath 파일)
        hints.resources().registerPattern("templates/*.html");
        // 직렬화 힌트
        hints.serialization().registerType(OrderDto.class);
    }
}
```

## reflect-config.json (수동 방식)

자동화 도구가 커버하지 못하는 경우 JSON 파일로 직접 지정할 수 있습니다.

```json
// src/main/resources/META-INF/native-image/reflect-config.json
[
  {
    "name": "com.example.OrderDto",
    "allDeclaredConstructors": true,
    "allPublicFields": true,
    "allDeclaredMethods": true
  }
]
```

## 네이티브 이미지 테스트

AOT 모드에서 동작을 미리 검증할 수 있습니다.

```java
// 네이티브 테스트: 실제 native-image 빌드 없이 AOT 처리만 검증
@SpringBootTest
@TestPropertySource(properties = "spring.aot.enabled=true")
class MyServiceNativeTest {

    @Autowired
    MyService myService;

    @Test
    void contextLoads() {
        // AOT 모드에서 빈이 정상 생성되는지 확인
        assertThat(myService).isNotNull();
    }
}
```

```bash
# 네이티브 테스트 실행 (실제 native-image 컴파일 포함 — 시간 소요)
./gradlew nativeTest
```

## 실행 파일 크기와 실행

```bash
# 빌드 결과: build/native/nativeCompile/my-app
ls -lh build/native/nativeCompile/my-app
# -rwxr-xr-x 1 user user 68M my-app

# 실행 — JVM 불필요
./build/native/nativeCompile/my-app
# Started MyApplication in 0.057 seconds (process running for 0.08)
```

## 언제 Native Image를 쓸까

네이티브 이미지가 적합한 경우와 그렇지 않은 경우를 명확히 구분해야 합니다.

| 적합 | 부적합 |
|------|--------|
| AWS Lambda, Cloud Run 등 서버리스 | 장기 실행 + 높은 처리량이 필요한 서비스 |
| 컨테이너 스케일아웃이 잦은 MSA | 동적 클래스 로딩 많이 사용하는 레거시 |
| 메모리 비용 절감이 중요한 환경 | 빌드 파이프라인 시간이 제약인 프로젝트 |
| CLI 도구 배포 | JVM 최신 기능(ZGC, Virtual Threads) 의존 |

## 자주 만나는 빌드 오류

**`ReflectiveOperationException` at runtime**  
→ 리플렉션 힌트 누락입니다. `--trace-class-initialization` 옵션으로 원인 클래스를 추적하세요.

**`ClassNotFoundException` for dynamic class**  
→ `Class.forName()` 호출 대상 클래스에 reflect 힌트가 없습니다.

**빌드 중 `OutOfMemoryError`**  
→ native-image는 6GB 이상 메모리를 사용합니다. CI 빌드 머신 사양을 확인하고 `-J-Xmx6g`를 명시하세요.

---

**지난 글:** [Java EE에서 Jakarta EE로: Spring Boot 3 마이그레이션 완전 가이드](/posts/spring-modern-jakarta-migration/)

**다음 글:** [Virtual Threads로 Spring MVC 성능 극대화하기](/posts/spring-modern-virtual-threads/)

<br>
읽어주셔서 감사합니다. 😊
