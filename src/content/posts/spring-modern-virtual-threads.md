---
title: "Virtual Threads로 Spring MVC 성능 극대화하기"
description: "Java 21 Virtual Threads(가상 스레드)의 동작 원리와 Platform Threads와의 차이, Spring Boot 3.2의 한 줄 활성화 방법, Pinning·ThreadLocal 함정 회피, 그리고 I/O 집중 서비스에서의 실전 성능 개선 사례를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Virtual Threads", "Java 21", "Spring Boot 3", "동시성", "Loom", "성능"]
featured: false
draft: false
---

[지난 글](/posts/spring-modern-graalvm-aot/)에서 GraalVM 네이티브 이미지로 기동 시간을 수십 ms로 줄이는 방법을 살펴봤습니다. 이번 글에서는 Java 21의 또 다른 혁신인 **Virtual Threads(가상 스레드)**를 Spring Boot에 적용하는 방법을 다룹니다.

## 왜 Virtual Threads가 필요한가

기존 Java 스레드(Platform Thread)는 OS 커널 스레드와 1:1로 매핑됩니다. OS 스레드는 생성 비용이 높고 (스택 약 1MB) 개수에 한계가 있어, 전통적인 Tomcat은 요청당 스레드 방식에서 최대 수백 개의 스레드 풀로 동시성을 제한합니다.

대기 시간이 긴 I/O(DB 쿼리, 외부 HTTP 호출)가 많은 서비스에서는 스레드가 블로킹 상태로 묶여 있어, 실제 CPU 사용률은 낮아도 스레드 부족으로 응답 지연이 발생하는 역설적 상황이 생깁니다.

**Virtual Threads(Project Loom)**는 JVM이 경량 스레드를 직접 관리하는 방식으로 이 문제를 해결합니다. 수십만 개의 VT를 생성해도 메모리 부담이 적고, I/O 대기 중 캐리어 스레드를 반납해 다른 작업을 처리합니다.

![Virtual Threads vs Platform Threads 구조 비교](/assets/posts/spring-modern-virtual-threads-model.svg)

## Spring Boot 3.2에서 활성화

한 줄로 끝납니다.

```properties
# application.properties
spring.threads.virtual.enabled=true
```

이 설정 하나로 Tomcat, Jetty, Undertow가 모두 요청당 Virtual Thread를 사용하도록 전환됩니다. `@Async` 태스크와 스케줄러도 VT 기반으로 전환됩니다.

Java Config로 직접 설정하는 방법도 있습니다.

```java
@Configuration
public class VirtualThreadConfig {

    // Tomcat 요청 처리 스레드를 VT로 교체
    @Bean
    public TomcatProtocolHandlerCustomizer<?> virtualThreadTomcat() {
        return protocolHandler ->
            protocolHandler.setExecutor(
                Executors.newVirtualThreadPerTaskExecutor()
            );
    }

    // @Async 작업도 VT 사용
    @Bean
    public AsyncTaskExecutor applicationTaskExecutor() {
        return new TaskExecutorAdapter(
            Executors.newVirtualThreadPerTaskExecutor()
        );
    }
}
```

## 성능 개선 예시

I/O 집중 서비스에서 VT를 적용하면 어떤 변화가 생기는지 간단한 벤치마크로 확인할 수 있습니다.

```java
// 시뮬레이션: DB 쿼리 50ms + 외부 API 100ms
@RestController
@RequestMapping("/orders")
public class OrderController {

    @GetMapping("/{id}")
    public OrderDto getOrder(@PathVariable Long id) {
        // DB 조회 (50ms)
        Order order = orderRepo.findById(id).orElseThrow();
        // 외부 재고 API (100ms)
        StockInfo stock = stockClient.getStock(order.getProductId());
        return OrderDto.from(order, stock);
    }
}
```

| 설정 | 동시 요청 1000 | P99 응답 | 처리량 |
|------|----------------|----------|--------|
| Tomcat (200 스레드) | 큐잉 발생 | ~3000ms | ~650 req/s |
| Virtual Threads | 즉시 처리 | ~160ms | ~5800 req/s |

같은 코드, 같은 인프라에서 설정 한 줄로 처리량이 약 9배 향상됩니다 (I/O 대기 비율이 높을수록 효과 큼).

## Pinning 문제와 해결

VT의 가장 중요한 주의사항입니다.

![Virtual Threads 주의사항: Pinning과 ThreadLocal](/assets/posts/spring-modern-virtual-threads-pitfalls.svg)

`synchronized` 블록 안에서 I/O가 발생하면 VT가 캐리어 스레드에 **pin**됩니다. 이 상태에서는 캐리어 스레드를 반납하지 못해 VT의 이점이 사라집니다.

```java
// 문제: synchronized 내 I/O 블로킹
public synchronized UserDto findUser(Long id) {
    return userRepo.findById(id).orElseThrow(); // DB I/O → pin 발생
}

// 해결: ReentrantLock 사용
private final ReentrantLock lock = new ReentrantLock();

public UserDto findUser(Long id) {
    lock.lock();
    try {
        return userRepo.findById(id).orElseThrow(); // pin 없음
    } finally {
        lock.unlock();
    }
}
```

JDBC 드라이버, HikariCP 등 라이브러리 내부의 `synchronized` 블록은 라이브러리 버전 업데이트로 해결합니다. HikariCP는 5.1.0부터 VT 친화적으로 개선됐습니다.

## Pinning 탐지

JVM 플래그로 핀닝 발생 시 스택 트레이스를 출력할 수 있습니다.

```bash
# 핀닝 감지 로그 활성화
java -Djdk.tracePinnedThreads=full -jar myapp.jar

# 출력 예시
Thread[#31,ForkJoinPool-1-worker-1,5,CarrierThreads]
  com.example.MyService.findUser(MyService.java:42) <== monitors:1
```

`monitors:N`이 0이 아니면 핀닝 발생 지점입니다.

## ThreadLocal 대안: ScopedValue

VT는 수십만 개가 생성되므로 `ThreadLocal`에 무거운 객체를 저장하면 메모리 문제가 생깁니다. Java 21의 **ScopedValue**는 불변 컨텍스트 전파를 위한 더 나은 대안입니다.

```java
// ScopedValue (Java 21 Preview → 22 정식)
static final ScopedValue<String> REQUEST_ID = ScopedValue.newInstance();

public void handleRequest(String requestId) {
    ScopedValue.where(REQUEST_ID, requestId).run(() -> {
        processOrder(); // processOrder 내에서 REQUEST_ID.get() 접근 가능
    });
    // ScopedValue는 run 블록 종료 시 자동 해제 — 메모리 안전
}
```

## 적용 시 체크리스트

```bash
# 1. 핀닝 경고 없는지 확인
java -Djdk.tracePinnedThreads=short -jar myapp.jar &
# 요청 생성 후 로그 검색
grep "PinnedThreads" app.log

# 2. HikariCP 버전 확인 (5.1.0+)
./gradlew dependencies | grep hikari

# 3. 스레드 덤프로 VT 확인
jcmd <pid> Thread.dump_to_file -format=json /tmp/threads.json
```

## CPU 집중 작업은 다르다

Virtual Threads는 I/O 대기 워크로드에만 효과적입니다. CPU 집중 작업(암호화, 이미지 처리, 수치 계산)은 캐리어 스레드를 계속 점유하므로 VT로 전환해도 처리량 향상이 없습니다. 오히려 컨텍스트 스위칭 오버헤드만 증가할 수 있습니다.

CPU 집중 작업은 기존 `ForkJoinPool`이나 `ExecutorService`를 유지하고, I/O 집중 경로에만 VT를 적용하는 전략이 바람직합니다.

---

**지난 글:** [GraalVM 네이티브 이미지: Spring AOT 컴파일 완전 가이드](/posts/spring-modern-graalvm-aot/)

**다음 글:** [Spring AI 입문: ChatClient, RAG, 도구 호출까지](/posts/spring-ai-intro/)

<br>
읽어주셔서 감사합니다. 😊
