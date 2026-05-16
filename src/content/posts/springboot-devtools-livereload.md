---
title: "Spring Boot DevTools & LiveReload로 개발 생산성 높이기"
description: "Spring Boot DevTools가 어떻게 동작하는지 내부 구조부터 이해합니다. ClassLoader 분리 기반의 자동 재시작 원리, LiveReload를 통한 브라우저 자동 새로고침, 개발 환경 캐시 비활성화, 트리거 파일 활용, 그리고 Remote DevTools 설정까지 실무에서 바로 적용할 수 있는 팁을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "DevTools", "LiveReload", "HotReload", "개발생산성", "자동재시작"]
featured: false
draft: false
---

[지난 글](/posts/springboot-logback-slf4j/)에서 SLF4J와 Logback으로 로깅을 설정하는 방법을 살펴봤습니다. 이번에는 **Spring Boot DevTools**입니다. 코드를 수정할 때마다 수동으로 서버를 재시작하는 시간을 크게 줄여주는 도구입니다. 단순히 편의 기능처럼 보이지만, 내부 동작 원리를 이해하면 왜 이것이 JVM 재구동보다 빠른지, 왜 프로덕션에서 자동으로 비활성화되는지 명확하게 파악할 수 있습니다.

## DevTools 추가하기

```kotlin
// build.gradle.kts
dependencies {
    developmentOnly("org.springframework.boot:spring-boot-devtools")
}
```

`developmentOnly`는 Gradle에서 프로덕션 빌드에 포함하지 않는다는 선언입니다. Maven에서는 `optional=true`를 사용합니다. 의존성을 추가하고 프로젝트를 재빌드하면 DevTools가 자동으로 활성화됩니다.

## 자동 재시작 원리

![DevTools 동작 원리](/assets/posts/springboot-devtools-livereload-concept.svg)

DevTools가 빠른 이유는 **ClassLoader를 두 계층으로 분리**하기 때문입니다.

- **Base ClassLoader**: 서드파티 라이브러리(Tomcat, Spring Framework, Jackson 등)를 로딩합니다. 이 계층은 코드를 수정해도 변하지 않으므로 재시작 시 건드리지 않습니다.
- **Restart ClassLoader**: 애플리케이션 코드(`BOOT-INF/classes/`)만 로딩합니다. 클래스패스 변경이 감지되면 이 계층만 새 인스턴스로 교체합니다.

결과적으로 재시작에 걸리는 시간이 JVM 전체를 새로 구동하는 것의 1/3~1/5 수준으로 줄어듭니다.

```
일반 재시작: JVM 기동 → 모든 클래스 로딩 → ApplicationContext → 10~30초
DevTools  : Restart ClassLoader만 교체 → ApplicationContext → 1~3초
```

## IDE 설정: 자동 빌드 활성화

DevTools는 **클래스패스 파일 변경**을 감지합니다. 소스 코드 파일(`.java`)을 감지하지 않습니다. 따라서 소스를 저장했을 때 IDE가 자동으로 컴파일해야 재시작이 트리거됩니다.

**IntelliJ IDEA:**
- `Settings → Build, Execution, Deployment → Compiler → Build project automatically` 체크
- `Advanced Settings → Allow auto-make to start even if developed application is currently running` 체크

**VS Code (Spring Boot Extension Pack):**
- 파일 저장 시 자동 컴파일이 기본으로 동작합니다.

## 재시작 세밀하게 제어하기

```properties
# application.properties

# 특정 경로는 감시에서 제외 (정적 자원은 재시작 불필요)
spring.devtools.restart.exclude=static/**,public/**,templates/**

# 추가 감시 경로 (기본 클래스패스 외 경로)
spring.devtools.restart.additional-paths=src/main/resources

# 자동 재시작 비활성화 (LiveReload만 사용할 때)
spring.devtools.restart.enabled=false
```

### 트리거 파일 사용

파일이 수정될 때마다 재시작되는 게 부담스럽다면 **트리거 파일**을 지정할 수 있습니다. 지정한 파일이 변경될 때만 재시작합니다.

```properties
spring.devtools.restart.trigger-file=.reloadtrigger
```

이제 의도적으로 `.reloadtrigger` 파일을 수정(또는 `touch`)할 때만 재시작합니다. 여러 파일을 한 번에 수정하고 그 후 한 번만 재시작하고 싶을 때 유용합니다.

## LiveReload: 브라우저 자동 새로고침

![DevTools 설정 방법](/assets/posts/springboot-devtools-livereload-config.svg)

DevTools는 포트 `35729`에 **LiveReload 서버**를 내장합니다. 브라우저에 [LiveReload 확장 프로그램](http://livereload.com/extensions/)을 설치하거나, 아래처럼 HTML에 스크립트를 삽입하면 서버가 재시작될 때 브라우저가 자동으로 새로고침됩니다.

```html
<!-- Thymeleaf 템플릿 개발 시 자동 삽입됨 -->
<script src="http://localhost:35729/livereload.js"></script>
```

Spring Boot의 `spring-boot-starter-thymeleaf`를 사용하면 DevTools가 활성화된 상태에서 자동으로 LiveReload 스크립트를 삽입합니다.

## 개발 환경 캐시 자동 비활성화

DevTools는 개발 중에 방해가 되는 캐시들을 자동으로 비활성화합니다.

| 설정 | 개발 환경 기본값 | 프로덕션 기본값 |
|------|-----------------|----------------|
| `spring.thymeleaf.cache` | `false` | `true` |
| `spring.freemarker.cache` | `false` | `true` |
| `spring.web.resources.cache.period` | `0` | 1년 |
| `spring.mvc.log-resolved-exception` | `true` | `false` |

이 설정들은 DevTools가 클래스패스에 있으면 `DevToolsPropertyDefaultsPostProcessor`가 자동으로 적용합니다. 별도로 설정하지 않아도 됩니다.

## 글로벌 DevTools 설정

여러 프로젝트에서 공통으로 적용할 설정은 홈 디렉터리의 설정 파일에 지정합니다.

```properties
# ~/.config/spring-boot/spring-boot-devtools.properties
# (또는 ~/.spring-boot-devtools.properties)

spring.devtools.restart.trigger-file=.reloadtrigger
spring.devtools.livereload.enabled=true
```

## Remote DevTools (원격 개발)

컨테이너나 원격 서버에서 실행 중인 앱에도 DevTools를 적용할 수 있습니다. 보안상 기본으로 비활성화되어 있으므로 명시적으로 활성화해야 합니다.

```properties
# 원격 서버의 application.properties
spring.devtools.remote.secret=mydevtoken
```

```bash
# 로컬에서 원격 클라이언트 실행
java -cp target/myapp.jar \
  org.springframework.boot.devtools.RemoteSpringApplication \
  https://dev.example.com
```

원격 클라이언트가 로컬 클래스패스 변경을 감지해 원격 서버로 업로드하고 재시작을 트리거합니다. 단, 프로덕션 환경에는 절대 사용하지 않습니다.

## 프로덕션에서 자동으로 비활성화되는 이유

DevTools는 다음 조건 중 하나라도 해당하면 **자동으로 비활성화**됩니다.

```java
// DevToolsEnablementDeducer — 비활성화 판단 로직 (요약)
if (isRunningInFatJar())      return false; // java -jar로 실행
if (isRunningInTest())        return false; // 테스트 환경
if (isSystemPropertySet())    return false; // -Dspring.devtools.restart.enabled=false
```

`java -jar`로 패키징된 JAR를 실행하면 클래스 구조가 달라져 DevTools가 비활성화됩니다. 따라서 프로덕션 배포 시 별도로 비활성화 설정을 할 필요가 없습니다.

## 정리

DevTools는 ClassLoader 분리라는 영리한 방법으로 전체 JVM 재구동 없이 빠른 재시작을 구현합니다. LiveReload와 캐시 자동 비활성화까지 더해지면 개발 피드백 루프가 크게 짧아집니다. 프로덕션에서는 자동으로 비활성화되므로 안심하고 `developmentOnly`로 추가할 수 있습니다. 다음 글에서는 Spring Boot의 강력한 설정 체계인 **`@ConfigurationProperties`**를 살펴봅니다.

---

**지난 글:** [Spring Boot 로깅 완전 정복: SLF4J와 Logback](/posts/springboot-logback-slf4j/)

**다음 글:** [Spring Boot @ConfigurationProperties 완전 정복](/posts/springboot-configuration-properties/)

<br>
읽어주셔서 감사합니다. 😊
