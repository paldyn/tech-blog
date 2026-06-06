---
title: "Spring Boot 2 → 3 마이그레이션 실전 가이드"
description: "Spring Boot 2에서 3으로 업그레이드할 때 반드시 처리해야 하는 Jakarta EE 전환, Security 설정 변경, Properties 키 수정을 단계별 코드와 함께 완전히 안내합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["SpringBoot3", "마이그레이션", "Jakarta EE", "Spring Security 6", "OpenRewrite", "Boot업그레이드"]
featured: false
draft: false
---

[지난 글](/posts/spring-version-4-5-6-changes/)에서 Spring 4부터 6까지 버전별 핵심 변경사항을 살펴봤다. 이번 글에서는 실제 프로젝트에서 Spring Boot 2를 Spring Boot 3으로 업그레이드하는 전 과정을 실전 코드와 함께 단계별로 안내한다.

## 마이그레이션 전 필수 확인사항

Spring Boot 3 마이그레이션은 단순한 버전 숫자 변경이 아니다. Java 17 이상, Jakarta EE 9+, Spring Framework 6이 동시에 요구된다. 시작 전에 다음을 확인한다.

- **현재 JDK 버전**: Java 17 미만이면 JDK 업그레이드를 먼저 진행
- **현재 Spring Boot 버전**: 2.5 이하라면 2.7로 먼저 올린 뒤 3.0으로 이동
- **3rd-party 라이브러리**: Jakarta EE 9 호환 버전 제공 여부 확인
- **테스트 커버리지**: 마이그레이션 후 회귀 검증을 위해 70% 이상 권장

## Spring Boot 버전 범프

`pom.xml`의 부모 버전을 변경한다.

```xml
<!-- 변경 전 -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.18</version>
</parent>

<!-- 변경 후 -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.0</version>
</parent>
```

Gradle을 사용한다면:

```kotlin
// build.gradle.kts
plugins {
    id("org.springframework.boot") version "3.3.0"
    id("io.spring.dependency-management") version "1.1.5"
}
```

## Breaking Change 1: Jakarta EE 패키지 전환

가장 광범위한 변경이다. `javax.*`로 시작하는 모든 import가 `jakarta.*`로 바뀐다.

```java
// 변경 전 (javax.*)
import javax.servlet.http.HttpServletRequest;
import javax.servlet.Filter;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.transaction.Transactional;

// 변경 후 (jakarta.*)
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.Filter;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.transaction.Transactional;
```

파일 수가 많다면 OpenRewrite로 자동화한다.

```xml
<!-- pom.xml에 추가 -->
<plugin>
    <groupId>org.openrewrite.maven</groupId>
    <artifactId>rewrite-maven-plugin</artifactId>
    <version>5.40.0</version>
    <configuration>
        <activeRecipes>
            <recipe>org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_3</recipe>
        </activeRecipes>
    </configuration>
    <dependencies>
        <dependency>
            <groupId>org.openrewrite.recipe</groupId>
            <artifactId>rewrite-spring</artifactId>
            <version>5.20.0</version>
        </dependency>
    </dependencies>
</plugin>
```

```bash
# 자동 변환 실행
./mvnw rewrite:run
```

## Breaking Change 2: Spring Security 6 설정 변경

![Security 설정 마이그레이션 Before / After](/assets/posts/springboot-2-to-3-migration-security.svg)

`WebSecurityConfigurerAdapter`가 Spring Security 6에서 완전히 제거됐다. `SecurityFilterChain` Bean 방식으로 변경해야 한다.

```java
// 변경 전 (Boot 2 / Security 5)
@Configuration
public class SecurityConfig extends WebSecurityConfigurerAdapter {

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http
            .authorizeRequests()
                .antMatchers("/public/**").permitAll()
                .antMatchers("/api/**").authenticated()
                .anyRequest().denyAll()
            .and()
            .formLogin()
                .loginPage("/login")
                .defaultSuccessUrl("/dashboard")
            .and()
            .logout()
                .logoutSuccessUrl("/login");
    }
}

// 변경 후 (Boot 3 / Security 6)
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/public/**").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().denyAll()
            )
            .formLogin(form -> form
                .loginPage("/login")
                .defaultSuccessUrl("/dashboard")
            )
            .logout(logout -> logout
                .logoutSuccessUrl("/login")
            );
        return http.build();
    }
}
```

핵심 변경 API:
- `authorizeRequests()` → `authorizeHttpRequests()`
- `antMatchers()` → `requestMatchers()`
- `.and()` 체이닝 → 람다 설정 블록
- 메서드 재정의 → `SecurityFilterChain` Bean 반환

## Breaking Change 3: application.properties 키 변경

많은 설정 키가 리네임됐다.

```yaml
# 변경 전 (Boot 2)
spring:
  redis:
    host: localhost
    port: 6379
  mvc:
    pathmatch:
      use-suffix-pattern: false
  datasource:
    initialization-mode: always

# 변경 후 (Boot 3)
spring:
  data:
    redis:
      host: localhost
      port: 6379
  mvc:
    pathmatch:
      use-suffix-pattern: false  # 제거됨, 설정 불필요
  sql:
    init:
      mode: always
```

주요 변경된 키 목록:
- `spring.redis.*` → `spring.data.redis.*`
- `spring.mongodb.*` → `spring.data.mongodb.*`
- `spring.elasticsearch.*` → `spring.elasticsearch.uris` 등
- `spring.datasource.initialization-mode` → `spring.sql.init.mode`

## Breaking Change 4: Actuator 기본 노출 변경

Boot 3에서 Actuator 엔드포인트의 기본 노출 범위가 강화됐다.

```yaml
# 필요한 엔드포인트를 명시적으로 노출
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: when-authorized
```

## 신기능 활성화

마이그레이션 완료 후 Boot 3의 새 기능을 설정으로 활성화한다.

```yaml
# application.yml
spring:
  threads:
    virtual:
      enabled: true  # Virtual Threads (JDK 21 필요)
  mvc:
    problemdetails:
      enabled: true  # RFC 7807 Problem Details
  docker:
    compose:
      enabled: true  # Docker Compose 자동 연동
```

## 마이그레이션 체크리스트

![Spring Boot 2 → 3 마이그레이션 체크리스트](/assets/posts/springboot-2-to-3-migration-checklist.svg)

마이그레이션 완료 후 검증 절차:

```bash
# 1. 전체 빌드 확인
./mvnw clean package

# 2. 테스트 실행
./mvnw test

# 3. 애플리케이션 기동 확인
./mvnw spring-boot:run

# 4. Actuator health 확인
curl http://localhost:8080/actuator/health

# 5. 주요 API 엔드포인트 스모크 테스트
curl http://localhost:8080/api/users
```

서드파티 라이브러리가 Jakarta EE 9을 지원하는 버전으로 업그레이드됐는지 확인한다. 특히 Hibernate 6+, Flyway 9+, MyBatis 3.5.11+ 등은 Jakarta EE 호환 버전이 별도로 제공된다.

Spring Boot 2 → 3 마이그레이션은 한 번의 작업으로 Java 17, Jakarta EE, Spring 6의 모든 현대화 혜택을 동시에 얻을 수 있는 의미 있는 투자다.

---

**지난 글:** [Spring 4 · 5 · 6 핵심 변경사항 총정리](/posts/spring-version-4-5-6-changes/)

**다음 글:** [Spring 점진적 현대화: 레거시에서 최신 Spring까지](/posts/spring-progressive-modernization/)

<br>
읽어주셔서 감사합니다. 😊
