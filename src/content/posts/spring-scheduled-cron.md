---
title: "Spring 스케줄링 — @Scheduled와 Cron 표현식 완전 정복"
description: "@EnableScheduling, @Scheduled의 fixedRate·fixedDelay·cron 옵션 차이, Spring Cron 6자리 표현식 문법, 멀티 스레드 스케줄러 설정, 그리고 분산 환경에서의 중복 실행 방지까지 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "@Scheduled", "Cron", "스케줄링", "ThreadPoolTaskScheduler", "Spring Boot"]
featured: false
draft: false
---

[지난 글](/posts/spring-async-threadpool/)에서 `@Async`와 스레드풀 설정을 살펴봤다. 이번 글에서는 정해진 시간이나 주기에 자동으로 작업을 실행하는 **Spring 스케줄링** 메커니즘을 다룬다.

## @EnableScheduling 활성화

스케줄링을 사용하려면 설정 클래스에 `@EnableScheduling`을 추가해야 한다.

```java
@Configuration
@EnableScheduling
public class AppConfig {
}
```

Spring Boot에서는 `@SpringBootApplication`이 붙은 메인 클래스에 함께 붙이거나 별도 설정 클래스로 분리하는 것이 일반적이다.

## @Scheduled 세 가지 실행 방식

`@Scheduled`는 메서드의 실행 시점을 결정하는 세 가지 방식을 제공한다.

![@Scheduled 실행 간격 옵션 비교](/assets/posts/spring-scheduled-cron-config.svg)

### fixedRate — 고정 빈도

```java
@Scheduled(fixedRate = 5000)  // 5초마다 (밀리초)
public void heartbeat() {
    healthCheckService.ping();
}
```

이전 실행 **시작 시점**부터 지정한 시간이 지나면 다시 실행한다. 작업 실행 시간이 `fixedRate`보다 길면 이전 작업이 끝나기 전에 다음 작업이 시작될 수 있다. 주로 상태 확인, 메트릭 수집처럼 가볍고 빠른 작업에 적합하다.

### fixedDelay — 완료 후 지연

```java
@Scheduled(fixedDelay = 10_000, initialDelay = 3_000)
public void cleanupTempFiles() {
    fileService.deleteExpired();
}
```

이전 실행 **완료 시점**부터 지정한 시간이 지나면 다시 실행한다. 중복 실행이 발생하지 않아 실행 순서와 완료가 중요한 작업에 적합하다. `initialDelay`는 애플리케이션 시작 후 첫 실행까지의 초기 지연이다.

### cron — 특정 시각 지정

```java
@Scheduled(cron = "0 0 2 * * *", zone = "Asia/Seoul")
public void dailyReport() {
    reportService.generateAndSend();
}
```

특정 시각이나 요일에 실행할 때 사용한다. `zone` 속성으로 타임존을 명시할 수 있으며, 지정하지 않으면 서버의 기본 타임존을 사용한다. **한국 서비스는 반드시 `zone = "Asia/Seoul"`을 명시**하는 것이 안전하다.

## Spring Cron 표현식 문법

![Spring Cron 표현식 구조](/assets/posts/spring-scheduled-cron-syntax.svg)

Unix 계열 cron은 분-시-일-월-요일의 5자리이지만, **Spring Cron은 초-분-시-일-월-요일의 6자리**다. 이 차이를 모르면 의도한 시각과 다르게 실행된다.

```
┌───── 초 (0-59)
│ ┌───── 분 (0-59)
│ │ ┌───── 시 (0-23)
│ │ │ ┌───── 일 (1-31)
│ │ │ │ ┌───── 월 (1-12 또는 JAN-DEC)
│ │ │ │ │ ┌───── 요일 (0-6 또는 SUN-SAT)
│ │ │ │ │ │
0 0 2 * * *
```

### 자주 쓰는 Cron 표현식 예시

```java
// 매일 새벽 2시
@Scheduled(cron = "0 0 2 * * *", zone = "Asia/Seoul")

// 평일 오전 9시 30분
@Scheduled(cron = "0 30 9 * * MON-FRI", zone = "Asia/Seoul")

// 매 5분마다
@Scheduled(cron = "0 */5 * * * *")

// 매월 1일 자정
@Scheduled(cron = "0 0 0 1 * *", zone = "Asia/Seoul")

// 매주 월요일 오전 8시
@Scheduled(cron = "0 0 8 * * MON", zone = "Asia/Seoul")

// 1시, 13시 (하루 두 번)
@Scheduled(cron = "0 0 1,13 * * *", zone = "Asia/Seoul")
```

### ? (물음표) 사용 규칙

`?`는 일(day-of-month)과 요일(day-of-week) 필드에서만 사용할 수 있으며, "지정하지 않음"을 의미한다. 두 필드 중 하나만 지정하고 나머지를 `?`로 두어야 한다.

```java
// 매월 15일 (요일 무관)
"0 0 9 15 * ?"

// 매주 월요일 (일 무관)
"0 0 9 ? * MON"
```

## 스케줄러 스레드 설정

`@EnableScheduling`의 기본 스케줄러는 **단일 스레드**다. 여러 `@Scheduled` 메서드가 있을 때 하나가 오래 걸리면 다른 스케줄이 지연된다.

### ThreadPoolTaskScheduler 등록

```java
@Configuration
@EnableScheduling
public class SchedulerConfig implements SchedulingConfigurer {

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(5);  // 동시 실행 가능한 스케줄 수
        scheduler.setThreadNamePrefix("sched-");
        scheduler.initialize();
        registrar.setTaskScheduler(scheduler);
    }
}
```

`PoolSize`는 동시에 실행될 수 있는 스케줄 작업의 최대 수다. 스케줄링 주기가 겹치는 작업이 여러 개라면 `PoolSize >= 동시 실행 가능 작업 수`로 설정한다.

### @Async와 함께 사용

스케줄러 스레드를 즉시 해방하고 싶으면 `@Scheduled`와 `@Async`를 함께 사용한다.

```java
@Scheduled(fixedRate = 5000)
@Async("taskExecutor")
public void asyncJob() {
    // taskExecutor 스레드풀에서 실행
    // 스케줄러 스레드는 즉시 해방
    heavyTask();
}
```

## 프로퍼티로 Cron 표현식 관리

하드코딩 대신 프로퍼티로 분리하면 환경마다 다른 스케줄을 적용할 수 있다.

```java
@Scheduled(cron = "${scheduler.daily-report.cron:0 0 2 * * *}",
           zone   = "${scheduler.timezone:Asia/Seoul}")
public void dailyReport() {
    reportService.generate();
}
```

```yaml
# application-prod.yml
scheduler:
  daily-report:
    cron: "0 0 1 * * *"   # 운영: 새벽 1시
  timezone: Asia/Seoul

# application-dev.yml
scheduler:
  daily-report:
    cron: "0 */1 * * * *"  # 개발: 매분 (빠른 테스트)
```

## 분산 환경에서 중복 실행 방지

수평 확장 환경(서버 여러 대)에서는 모든 인스턴스가 동시에 같은 스케줄을 실행하는 문제가 생긴다. Spring 자체에는 분산 락 기능이 없으므로 외부 도구를 활용한다.

### ShedLock으로 단일 실행 보장

```xml
<dependency>
  <groupId>net.javacrumbs.shedlock</groupId>
  <artifactId>shedlock-spring</artifactId>
  <version>5.10.0</version>
</dependency>
<dependency>
  <groupId>net.javacrumbs.shedlock</groupId>
  <artifactId>shedlock-provider-jdbc-template</artifactId>
  <version>5.10.0</version>
</dependency>
```

```java
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "10m")
public class ShedLockConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(dataSource);
    }
}
```

```java
@Scheduled(cron = "0 0 2 * * *", zone = "Asia/Seoul")
@SchedulerLock(name = "dailyReport",
               lockAtLeastFor = "1m",
               lockAtMostFor  = "30m")
public void dailyReport() {
    reportService.generate();
}
```

`lockAtLeastFor`은 최소 잠금 유지 시간(작업이 빨리 끝나도 이 시간 동안은 다른 노드가 실행 못 함), `lockAtMostFor`은 최대 잠금 시간(노드 다운 시 자동 해제 대기 시간)이다.

## 스케줄 실행 로깅

```java
@Scheduled(cron = "0 0 2 * * *", zone = "Asia/Seoul")
public void dailyReport() {
    log.info("[SCHEDULED] dailyReport started");
    long start = System.currentTimeMillis();
    try {
        reportService.generate();
        log.info("[SCHEDULED] dailyReport completed in {}ms",
                 System.currentTimeMillis() - start);
    } catch (Exception e) {
        log.error("[SCHEDULED] dailyReport failed", e);
        throw e;
    }
}
```

스케줄 작업은 요청-응답 흐름 밖에서 실행되므로 시작과 완료를 항상 로그로 남겨야 운영 중 이슈를 추적할 수 있다.

## 정리

| 옵션 | 기준 시점 | 중복 실행 | 적합한 사용 사례 |
|---|---|---|---|
| `fixedRate` | 시작 시점 | 가능 | 가벼운 상태 확인, 메트릭 수집 |
| `fixedDelay` | 완료 시점 | 불가 | 파일 처리, 순차 실행 필요 작업 |
| `cron` | 특정 시각 | 설정에 따라 | 배치, 정산, 리포트 생성 |

분산 환경에서는 ShedLock 같은 분산 락 라이브러리로 단일 실행을 보장하고, 기본 단일 스레드 스케줄러는 `ThreadPoolTaskScheduler`로 교체해 스케줄 블로킹을 방지해야 한다.

---

**지난 글:** [Spring 비동기 스레드풀 — @Async와 ThreadPoolTaskExecutor 완전 정복](/posts/spring-async-threadpool/)

**다음 글:** [Spring 비동기 예외 처리 — AsyncUncaughtExceptionHandler 완전 정복](/posts/spring-async-exception-handling/)

<br>
읽어주셔서 감사합니다. 😊
