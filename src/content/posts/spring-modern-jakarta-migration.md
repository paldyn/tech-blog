---
title: "Java EE에서 Jakarta EE로: Spring Boot 3 마이그레이션 완전 가이드"
description: "javax.* 패키지가 jakarta.*로 바뀐 이유와 배경부터, Spring Boot 2 → 3 업그레이드 체크리스트, OpenRewrite를 활용한 자동 마이그레이션, 그리고 Security 6·Actuator 설정 변경점까지 실무 중심으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring Boot 3", "Jakarta EE", "마이그레이션", "javax", "OpenRewrite", "Java 17"]
featured: false
draft: false
---

[지난 글](/posts/spring-webflux-functional-routing/)에서 WebFlux의 함수형 엔드포인트를 살펴봤습니다. 이번 글부터는 **현대 Spring 생태계**를 다루는 파트로 넘어갑니다. 그 시작은 많은 팀이 한 번쯤 겪는 고통, 바로 Spring Boot 3 마이그레이션입니다.

## 왜 jakarta.* 로 바꿨나

2019년 Oracle이 Java EE 상표권과 `javax.*` 네임스페이스를 Eclipse Foundation에 이전하지 않기로 결정하면서, Eclipse는 새 브랜드 **Jakarta EE** 아래 패키지 이름을 바꿀 수밖에 없었습니다. 결과적으로 Jakarta EE 9부터 `javax.*` 대신 `jakarta.*` 를 사용합니다.

Spring Boot 3은 Jakarta EE 10을 기반으로 하며, 이로 인해 모든 `javax.*` 임포트를 `jakarta.*`로 변경해야 합니다. 단순한 문자열 치환처럼 보이지만, 대규모 프로젝트에서는 수백 개 파일에 걸친 작업이 됩니다.

![javax에서 jakarta로 패키지 이름 변경 비교](/assets/posts/spring-modern-jakarta-migration-packages.svg)

## 마이그레이션 전제 조건

Spring Boot 3.x가 요구하는 최소 버전이 있습니다.

| 항목 | 최소 버전 |
|------|-----------|
| Java | **17** |
| Spring Framework | **6.x** |
| Hibernate ORM | **6.x** |
| Tomcat | **10.x** |

Java 17 이전 버전을 사용하고 있다면 먼저 JDK 업그레이드가 필요합니다. 레코드, 텍스트 블록, 패턴 매칭 등 Java 17 기능을 적극 활용할 수 있으니 단순 비용이 아닌 투자로 볼 수 있습니다.

## 단계별 마이그레이션 체크리스트

![마이그레이션 단계별 체크리스트](/assets/posts/spring-modern-jakarta-migration-checklist.svg)

### 1단계: 의존성 버전 업그레이드

```xml
<!-- Maven pom.xml -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.5</version>
</parent>
```

```groovy
// Gradle build.gradle
plugins {
    id 'org.springframework.boot' version '3.2.5'
    id 'io.spring.dependency-management' version '1.1.4'
    id 'java'
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}
```

### 2단계: javax.* 일괄 치환

수동으로 하면 실수가 납니다. **OpenRewrite** 플러그인이 가장 신뢰도 높은 자동화 도구입니다.

```groovy
// build.gradle에 추가
plugins {
    id("org.openrewrite.rewrite") version "6.15.1"
}

dependencies {
    rewrite("org.openrewrite.recipe:rewrite-spring:5.x.x")
}

rewrite {
    activeRecipe(
        "org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_2"
    )
}
```

```bash
# 마이그레이션 실행
./gradlew rewriteRun

# 변경사항 미리보기 (실제 적용 없이 확인)
./gradlew rewriteDryRun
```

IntelliJ IDEA를 사용한다면 **Refactor → Migrate to Jakarta EE 10** 메뉴로도 자동 변환이 가능합니다.

### 3단계: 자주 바뀌는 패키지 확인

```java
// Before (Spring Boot 2)
import javax.servlet.http.HttpServletRequest;
import javax.persistence.Entity;
import javax.validation.constraints.NotNull;
import javax.annotation.PostConstruct;

// After (Spring Boot 3)
import jakarta.servlet.http.HttpServletRequest;
import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotNull;
import jakarta.annotation.PostConstruct;
```

`javax.sql.*`, `javax.naming.*`, `javax.crypto.*` 같이 Java SE 표준 라이브러리에 속하는 패키지는 바뀌지 않습니다. `javax.` 전체를 기계적으로 치환하면 안 됩니다.

## Spring Security 6 주요 변경점

Security도 대규모 API 변경이 있었습니다.

```java
// Spring Boot 2 방식 (더 이상 동작 안 함)
@Configuration
public class SecurityConfig extends WebSecurityConfigurerAdapter {
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.authorizeRequests()
            .antMatchers("/public/**").permitAll()
            .anyRequest().authenticated();
    }
}
```

```java
// Spring Boot 3 방식 (컴포넌트 기반)
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http)
            throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/public/**").permitAll()
                .anyRequest().authenticated()
            )
            .formLogin(Customizer.withDefaults());
        return http.build();
    }
}
```

`WebSecurityConfigurerAdapter`가 완전히 제거됐습니다. 상속 대신 `SecurityFilterChain` 빈을 직접 선언하는 방식으로 전환해야 합니다. `antMatchers` 대신 `requestMatchers`를 사용합니다.

## Actuator 기본값 변경

Spring Boot 3에서 Actuator 엔드포인트 기본 노출 정책이 바뀌었습니다.

```yaml
# Spring Boot 3 기본값: info와 health만 HTTP 노출
# 필요한 엔드포인트를 명시적으로 추가
management:
  endpoints:
    web:
      exposure:
        include: "health,info,metrics,prometheus"
  endpoint:
    health:
      show-details: when-authorized
```

## 마이그레이션 후 검증

빌드만 통과했다고 끝이 아닙니다. 다음 항목을 반드시 확인하세요.

```bash
# 1. 단위 테스트 전체 실행
./gradlew test

# 2. javax 잔여 임포트 검색
grep -r "import javax\." src/main/java/ \
  --include="*.java" | grep -v "javax.sql\|javax.naming\|javax.crypto"

# 3. 빈 생성 실패 여부 확인 (통합 테스트)
./gradlew bootRun
```

## 트러블슈팅 자주 보는 오류

**`ClassNotFoundException: javax.servlet.http.HttpServletRequest`**  
→ Tomcat 의존성이 이전 버전으로 고정된 경우입니다. 명시적 버전 지정을 제거하거나 BOM 버전을 확인하세요.

**`HibernateJpaDialect.convertHibernateAccessException`**  
→ Hibernate 6.x에서 내부 예외 클래스 구조가 바뀌었습니다. 커스텀 예외 변환기가 있다면 재검토가 필요합니다.

**`IllegalStateException: No SecurityFilterChain found`**  
→ `WebSecurityConfigurerAdapter` 방식을 제거했지만 새 방식의 `SecurityFilterChain` 빈을 등록하지 않은 경우입니다.

---

**지난 글:** [함수형 엔드포인트: RouterFunction과 HandlerFunction](/posts/spring-webflux-functional-routing/)

**다음 글:** [GraalVM 네이티브 이미지: Spring AOT 컴파일 완전 가이드](/posts/spring-modern-graalvm-aot/)

<br>
읽어주셔서 감사합니다. 😊
