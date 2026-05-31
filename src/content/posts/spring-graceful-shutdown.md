---
title: "Spring Boot Graceful Shutdown — 안전한 서버 종료 전략"
description: "Spring Boot의 Graceful Shutdown 동작 원리와 server.shutdown=graceful 설정, SmartLifecycle을 이용한 커스텀 종료 훅 구현, Kubernetes 환경에서의 preStop 패턴까지 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "GracefulShutdown", "SmartLifecycle", "Kubernetes", "운영", "배포", "SIGTERM"]
featured: false
draft: false
---

[지난 글](/posts/spring-distributed-tracing/)에서 분산 추적으로 요청의 전체 흐름을 관측하는 방법을 살펴봤다. 이번에는 서버를 종료할 때 이미 처리 중인 요청을 안전하게 마무리하는 **Graceful Shutdown**을 다룬다. 컨테이너 환경에서 배포·스케일다운이 빈번한 지금, 서버가 SIGTERM 신호를 받는 순간 진행 중인 주문 처리나 결제 요청이 강제로 끊기지 않도록 하는 것은 필수 운영 요건이 되었다.

## Graceful Shutdown이 필요한 이유

일반적인 Java 프로세스는 SIGTERM(종료 신호)을 받으면 JVM이 Shutdown Hook을 실행하고 즉시 프로세스를 종료한다. 이때 HTTP 요청을 처리하던 스레드가 중간에 끊기면 다음과 같은 문제가 발생한다.

- 데이터베이스 트랜잭션이 완료되지 않아 **불완전한 레코드** 생성
- 외부 결제 API를 호출하고 응답을 받지 못한 **유령 거래** 발생
- 클라이언트 측에서 `Connection reset by peer` 오류 수신

Kubernetes에서 Rolling Update를 수행할 때 이 문제가 특히 두드러진다. 새 Pod가 Ready 상태가 되기 전에 기존 Pod가 종료되면서 요청 처리 중 연결이 끊기는 현상이 대표적이다.

## Spring Boot의 Graceful Shutdown 설정

Spring Boot 2.3부터 내장 서버(Tomcat, Jetty, Netty, Undertow) 수준의 Graceful Shutdown을 공식 지원한다.

```yaml
# application.yml
server:
  shutdown: graceful   # 기본값은 immediate

spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s   # 종료 단계당 최대 대기 시간
```

`server.shutdown=graceful`로 설정하면 SIGTERM을 수신한 시점부터 다음 순서로 동작한다.

1. 내장 서버가 새로운 HTTP 요청 수락을 중단한다 (포트 소켓 닫기)
2. 이미 처리 중인 요청들이 완료될 때까지 대기한다
3. `timeout-per-shutdown-phase` 내에 완료되지 못한 요청은 강제 종료한다
4. Spring 컨텍스트의 빈들을 역순으로 소멸시킨다

![Graceful Shutdown 처리 흐름](/assets/posts/spring-graceful-shutdown-flow.svg)

## SmartLifecycle로 커스텀 종료 훅 구현

HTTP 요청뿐 아니라 메시지 큐 컨슈머, 스케줄러, 백그라운드 스레드도 종료 시점에 정리해야 한다. Spring의 `SmartLifecycle` 인터페이스를 구현하면 컨텍스트 종료 과정에 참여할 수 있다.

```java
@Component
public class KafkaConsumerLifecycle implements SmartLifecycle {

    private final KafkaListenerEndpointRegistry registry;
    private volatile boolean running = false;

    public KafkaConsumerLifecycle(KafkaListenerEndpointRegistry registry) {
        this.registry = registry;
    }

    @Override
    public void start() {
        registry.start();
        running = true;
    }

    @Override
    public void stop(Runnable callback) {
        // 컨슈머를 중단하고 현재 메시지 처리가 끝나면 콜백 호출
        registry.stop(callback);
        running = false;
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    @Override
    public int getPhase() {
        // 숫자가 클수록 나중에 시작되고 먼저 종료됨
        // 기본 WebServer phase(Integer.MAX_VALUE - 1)보다 낮게 설정
        return Integer.MAX_VALUE - 100;
    }
}
```

`stop(Runnable callback)`의 `callback`은 종료가 실제로 완료됐음을 Spring에 알리는 신호다. 비동기로 컨슈머를 멈추고 완료되면 `callback.run()`을 호출해야 한다. 콜백을 호출하지 않으면 `timeout-per-shutdown-phase` 만큼 기다린 뒤 강제로 넘어간다.

![Graceful Shutdown 설정 코드와 SmartLifecycle 패턴](/assets/posts/spring-graceful-shutdown-config.svg)

## @PreDestroy와의 차이

`@PreDestroy`는 빈 소멸 단계에서 호출되는 반면, `SmartLifecycle.stop()`은 **컨텍스트 종료 과정의 lifecycle 단계**에서 호출된다. 타이밍 차이가 있으므로, HTTP 서버가 종료된 이후에 실행되어야 하는 정리 작업은 `SmartLifecycle`이 더 적합하다. 단순한 자원 해제(커넥션 닫기 등)라면 `@PreDestroy`로 충분하다.

```java
@Component
public class CacheManager {

    @PreDestroy
    public void cleanup() {
        // 빈 소멸 시 캐시 비우기 — 간단한 경우 @PreDestroy 충분
        localCache.invalidateAll();
    }
}
```

## Kubernetes 환경에서의 주의사항

Kubernetes에서 Pod를 종료할 때 다음 두 이벤트가 **동시에** 발생한다.

1. `kubelet`이 컨테이너에 SIGTERM 전송
2. Endpoints Controller가 Service에서 해당 Pod IP를 제거 (kube-proxy에 전파)

문제는 kube-proxy가 Load Balancer 규칙을 업데이트하는 데 수 초가 걸린다는 점이다. 이 시간 동안에도 트래픽이 종료 중인 Pod로 유입될 수 있다. 이를 해결하기 위해 `preStop` 훅에서 짧게 대기한다.

```yaml
# Kubernetes Deployment
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: app
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 10"]
```

`preStop`에서 10초 대기 → SIGTERM 전송 → Graceful Shutdown 30초 대기 순서로 진행된다. `terminationGracePeriodSeconds`(여기서는 60초)는 `preStop + 애플리케이션 종료`의 전체 시간을 포함해야 한다.

## 헬스 체크 연계: Readiness Probe

Graceful Shutdown이 시작되면 `/actuator/health/readiness` 엔드포인트가 `OUT_OF_SERVICE`를 반환한다. Kubernetes의 Readiness Probe가 이를 감지해 해당 Pod를 Service 엔드포인트에서 제거하므로, 신규 트래픽은 자동으로 차단된다.

```yaml
# application.yml
management:
  endpoint:
    health:
      probes:
        enabled: true   # liveness / readiness 분리 활성화
  health:
    livenessstate:
      enabled: true
    readinessstate:
      enabled: true
```

`/actuator/health/liveness` — 프로세스가 살아있는가  
`/actuator/health/readiness` — 요청을 받을 준비가 됐는가

## 종료 시퀀스 전체 정리

```
SIGTERM 수신
  → Readiness = OUT_OF_SERVICE (K8s가 트래픽 차단)
  → preStop sleep (LB 연결 해제 대기)
  → server.shutdown=graceful 진행 중 요청 완료 대기 (최대 30s)
  → SmartLifecycle.stop() 역순 호출
  → @PreDestroy 빈 소멸
  → JVM 종료 (exit code 0)
```

이 시퀀스를 모두 올바르게 구성하면, 배포 중에도 클라이언트가 502/503 오류를 받지 않고 요청이 완료된다.

---

**지난 글:** [Spring Boot 분산 추적 — Micrometer Tracing + Zipkin 실전 적용](/posts/spring-distributed-tracing/)

**다음 글:** [Spring Boot JAR vs WAR — 패키징 방식과 배포 전략 선택 가이드](/posts/spring-jar-vs-war/)

<br>
읽어주셔서 감사합니다. 😊
