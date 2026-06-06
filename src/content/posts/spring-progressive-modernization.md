---
title: "Spring 점진적 현대화: 레거시에서 최신 Spring까지"
description: "Spring 완전 정복 시리즈의 마지막 글. 레거시 Spring 프로젝트를 최신 Spring Boot 3와 클라우드 네이티브 아키텍처로 단계적으로 전환하는 전체 전략과 실무 경험을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "레거시현대화", "점진적마이그레이션", "SpringBoot3", "클라우드네이티브", "기술부채", "OpenRewrite"]
featured: false
draft: false
---

[지난 글](/posts/springboot-2-to-3-migration/)에서 Spring Boot 2에서 3으로 업그레이드하는 구체적인 절차를 살펴봤다. 시리즈의 마지막 글인 이번에는 더 넓은 시각에서 레거시 Spring 프로젝트를 현대화하는 전략, 실무 경험, 그리고 우리가 Spring을 배워온 여정을 돌아본다.

## 현대화가 필요한 순간

레거시 Spring 프로젝트를 현대화해야 하는 시점을 어떻게 판단할 수 있을까. 아래 신호 중 두 가지 이상이 해당된다면 현대화를 진지하게 고려할 때다.

- Java 8 이하 또는 Spring 4 이하를 사용 중
- 배포에 WAR 파일과 외부 WAS(Tomcat, JBoss)가 필요
- 신규 개발자의 온보딩 시간이 2주 이상
- 단위 테스트보다 통합 테스트 비율이 높고, 테스트 실행이 느림
- `applicationContext.xml`이 500줄을 넘음
- Spring Boot EOL 경고를 무시한 지 6개월 이상

현대화는 리스크가 따르지만, 현대화를 하지 않는 것도 리스크다. 보안 패치 지연, 인재 채용 어려움, 개발 생산성 저하가 시간이 지날수록 커진다.

## 전체 현대화 로드맵

![Spring 점진적 현대화 로드맵](/assets/posts/spring-progressive-modernization-roadmap.svg)

현대화를 한 번에 시도하면 실패한다. 가장 성공 확률이 높은 방식은 4단계 점진적 접근이다.

### Phase 1: 현황 분석과 기준선 수립

코드를 단 한 줄도 바꾸지 말고 먼저 측정한다.

```bash
# 프로젝트 구조 파악
find . -name "*.java" | wc -l
find . -name "*.xml" | grep -v target | wc -l

# 의존성 취약점 스캔 (OWASP)
./mvnw org.owasp:dependency-check-maven:check

# 테스트 커버리지 측정
./mvnw verify jacoco:report
open target/site/jacoco/index.html
```

기준선이 없으면 개선을 증명할 수 없다. 현재 빌드 시간, 시작 시간, 주요 API 응답 시간을 기록해 두자.

### Phase 2: Java 버전 업그레이드

Java 버전은 독립적으로 올릴 수 있다. Spring 버전을 건드리지 않고 Java 8 → 11 → 17 → 21 순서로 올린다.

```xml
<!-- Maven: Java 버전 설정 -->
<properties>
    <java.version>17</java.version>
    <maven.compiler.source>17</maven.compiler.source>
    <maven.compiler.target>17</maven.compiler.target>
</properties>
```

Java 11에서 주의할 점: `javax.xml.bind` (JAXB), `javax.activation` (JAF)이 JDK에서 제거됐다. 별도 의존성을 추가해야 한다.

```xml
<!-- Java 11 이상에서 JAXB 필요 시 -->
<dependency>
    <groupId>jakarta.xml.bind</groupId>
    <artifactId>jakarta.xml.bind-api</artifactId>
    <version>4.0.2</version>
</dependency>
```

Java 17의 새 기능(Records, Sealed Classes, Text Blocks)을 활용하면 코드 품질이 눈에 띄게 향상된다.

```java
// Java 16+ Record 활용 (DTO 간결화)
public record UserDto(Long id, String name, String email) {}

// Java 15+ Text Block 활용 (SQL, JSON 가독성 향상)
String sql = """
    SELECT u.id, u.name, u.email
    FROM users u
    WHERE u.active = true
    ORDER BY u.created_at DESC
    """;
```

### Phase 3: Spring Boot 현대화

Java 버전이 안정화됐으면 Spring Boot를 올린다. 지난 글에서 다룬 Boot 2→3 마이그레이션 절차를 모듈별로 적용한다.

```java
// Spring Boot 3의 @SpringBootApplication — 변경 없음
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

이 단계에서 OpenRewrite를 최대한 활용한다.

```bash
# Boot 3.3으로 일괄 업그레이드 (javax→jakarta, 설정 키, Security API)
./mvnw rewrite:run -Drewrite.activeRecipes=\
org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_3

# 변경 사항 확인
git diff --stat
```

### Phase 4: 클라우드 네이티브 완성

이 단계는 필수가 아니라 선택이다. 팀의 역량과 비즈니스 요구에 맞게 적용한다.

```yaml
# Virtual Threads 활성화 (JDK 21, Boot 3.2+)
spring:
  threads:
    virtual:
      enabled: true

# Micrometer Observability 설정
management:
  tracing:
    sampling:
      probability: 1.0
  zipkin:
    tracing:
      endpoint: http://zipkin:9411/api/v2/spans
```

## 자동화 도구 활용

![OpenRewrite 자동 마이그레이션 전략](/assets/posts/spring-progressive-modernization-strategy.svg)

현대화 작업의 반복적이고 기계적인 부분은 도구에 맡긴다.

**OpenRewrite**: Java 코드 변환 자동화

```bash
# 사용 가능한 Spring Boot 관련 레시피 목록 확인
./mvnw rewrite:discover -Drecipe=org.openrewrite.java.spring
```

**Dependabot**: 의존성 최신화 자동화

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "maven"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      spring:
        patterns:
          - "org.springframework*"
```

**Spring Boot Migration Guide**: 공식 마이그레이션 가이드를 버전별로 제공한다. [spring.io/guides](https://spring.io/guides)에서 항상 최신 정보를 확인한다.

## 현대화 성공을 위한 조직적 접근

기술 현대화는 기술 문제만이 아니다. 다음 사항이 갖춰지지 않으면 기술이 아무리 좋아도 실패한다.

**비즈니스 케이스 수립**: 현대화의 ROI를 수치로 제시하라. "Java 17로 올리면 Virtual Threads로 서버 비용 30% 절감 가능" 같은 구체적 수치가 경영진 설득에 효과적이다.

**점진적 적용, 빠른 피드백**: 전체 마이그레이션을 한 번에 하지 말고, 마이크로서비스라면 트래픽이 적은 서비스부터, 모놀리스라면 도메인 모듈 단위로 나눠 적용하라.

**Feature Flag**: 현대화된 새 코드와 레거시 코드를 동시에 운영하면서 점진적으로 트래픽을 이동시키는 방식이 안전하다.

```java
@Service
public class UserService {

    private final LegacyUserRepository legacyRepo;
    private final ModernUserRepository modernRepo;
    private final FeatureFlags flags;

    public User findById(Long id) {
        if (flags.isEnabled("use-modern-repo")) {
            return modernRepo.findById(id).orElseThrow();
        }
        return legacyRepo.findById(id);
    }
}
```

## Spring 완전 정복 시리즈를 마무리하며

이 시리즈는 Spring의 철학과 기본 원리(IoC/DI, AOP)에서 시작해 Spring MVC, Spring Data JPA, Spring Boot, Spring Security, 캐시·비동기·이벤트, 테스트 전략, 운영 관측, Cloud Native, Spring WebFlux, 그리고 현대화 전략까지 152개의 글로 Spring 생태계 전체를 다뤘다.

```bash
# Spring 완전 정복 시리즈 통계
# - 총 포스트: 152편
# - 다룬 주제: IoC/DI, AOP, MVC, Security, JPA, Boot, Cloud, Reactive, AI...
# - 목표: 현업에서 Spring을 자신 있게 사용할 수 있는 실력
```

Spring은 계속 진화한다. Spring 6.x 업데이트, Spring Boot 4.x 예고, Spring AI의 급격한 발전 등 변화의 속도가 빠르다. 하지만 시리즈 첫 글에서 다룬 IoC/DI의 철학, 테스트 가능한 코드, 횡단 관심사의 분리라는 원칙은 버전이 바뀌어도 흔들리지 않는다.

공식 문서([docs.spring.io](https://docs.spring.io)), Spring 공식 블로그, 그리고 실제 프로젝트에서의 실습이 학습의 완성이다. 이 시리즈가 Spring 마스터로 가는 여정에 탄탄한 디딤돌이 되기를 바란다.

---

**지난 글:** [Spring Boot 2 → 3 마이그레이션 실전 가이드](/posts/springboot-2-to-3-migration/)

<br>
읽어주셔서 감사합니다. 😊
