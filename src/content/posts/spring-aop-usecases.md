---
title: "Spring AOP 실전 활용 사례: 로깅·트랜잭션·캐싱·보안을 AOP로 분리하기"
description: "Spring AOP를 실무에서 활용하는 6가지 핵심 패턴—요청 로깅, 트랜잭션 관리, 캐싱, 메서드 보안, Micrometer 메트릭, Circuit Breaker—을 완성된 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "AOP", "Logging", "Transaction", "Cache", "Security", "Micrometer", "CircuitBreaker"]
featured: false
draft: false
---

[지난 글](/posts/spring-aop-pointcut-expression/)에서 Pointcut 표현식의 지시자 6가지와 와일드카드 규칙을 완전히 정리했습니다. 이번 글에서는 실제 프로젝트에서 AOP가 어떻게 쓰이는지 완성된 사례 코드를 중심으로 살펴봅니다. 각 사례는 독립적이므로 필요한 부분만 골라 참고해도 됩니다.

## AOP 적용 사례 전체 지도

![AOP 실전 활용 사례 맵](/assets/posts/spring-aop-usecases-map.svg)

Spring 생태계에서 AOP가 자동 적용되는 기능은 `@Transactional`, `@Cacheable`, `@Async`, `@Scheduled`, Spring Security의 `@PreAuthorize` 등 매우 많습니다. 이미 그 혜택을 누리고 있으면서도 직접 Aspect를 작성하지 않는 경우가 많은데, 원리를 알면 자신만의 횡단 관심사를 같은 방식으로 분리할 수 있습니다.

## 사례 1: 구조적 로깅 + 분산 추적

MDC를 활용해 요청 단위 추적 ID를 모든 로그에 자동 삽입합니다.

```java
@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class StructuredLoggingAspect {

    private static final Logger log =
            LoggerFactory.getLogger(StructuredLoggingAspect.class);

    @Around("within(@org.springframework.stereotype.Service *) "
          + "&& execution(public * *(..))")
    public Object structuredLog(ProceedingJoinPoint jp) throws Throwable {
        String traceId = Optional
                .ofNullable(MDC.get("traceId"))
                .orElseGet(() -> UUID.randomUUID().toString().substring(0, 8));

        MDC.put("traceId",  traceId);
        MDC.put("method",   jp.getSignature().toShortString());
        MDC.put("class",    jp.getTarget().getClass().getSimpleName());

        long start = System.nanoTime();
        try {
            Object result = jp.proceed();
            long ms = (System.nanoTime() - start) / 1_000_000;
            log.info("OK duration={}ms", ms);
            return result;
        } catch (Throwable t) {
            log.error("FAIL error={}", t.getMessage());
            throw t;
        } finally {
            MDC.remove("method");
            MDC.remove("class");
        }
    }
}
```

`logback.xml`에서 `%X{traceId}`로 MDC 값을 출력하면 Kibana나 CloudWatch에서 traceId 기준으로 요청 흐름 전체를 추적할 수 있습니다.

## 사례 2: 커스텀 캐싱 (Redis + TTL 제어)

Spring의 `@Cacheable`은 캐시 키 생성·TTL 제어 면에서 한계가 있습니다. 직접 작성하면 완전히 제어할 수 있습니다.

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Cached {
    String key();              // SpEL 표현식
    long ttlSeconds() default 300;
    Class<?> valueType();      // 역직렬화 타입
}

@Aspect
@Component
public class CustomCacheAspect {

    private final RedisTemplate<String, String> redis;
    private final ObjectMapper objectMapper;
    private final ExpressionParser parser = new SpelExpressionParser();

    @Around("@annotation(cached)")
    public Object cache(ProceedingJoinPoint jp,
                        Cached cached) throws Throwable {
        String cacheKey = resolveKey(jp, cached.key());

        // 캐시 히트
        String json = redis.opsForValue().get(cacheKey);
        if (json != null) {
            return objectMapper.readValue(json, cached.valueType());
        }

        // 캐시 미스 → 실행 후 저장
        Object result = jp.proceed();
        if (result != null) {
            redis.opsForValue().set(
                    cacheKey,
                    objectMapper.writeValueAsString(result),
                    Duration.ofSeconds(cached.ttlSeconds())
            );
        }
        return result;
    }

    private String resolveKey(ProceedingJoinPoint jp, String keyExpr) {
        MethodSignature sig    = (MethodSignature) jp.getSignature();
        EvaluationContext ctx  = new StandardEvaluationContext();
        String[] paramNames    = sig.getParameterNames();
        Object[] args          = jp.getArgs();
        for (int i = 0; i < paramNames.length; i++) {
            ctx.setVariable(paramNames[i], args[i]);
        }
        return parser.parseExpression(keyExpr).getValue(ctx, String.class);
    }
}

// 사용
@Service
public class ProductService {

    @Cached(key = "'product:' + #id", ttlSeconds = 600, valueType = Product.class)
    public Product findById(Long id) {
        return productRepository.findById(id).orElseThrow();
    }
}
```

## 사례 3: Micrometer 메트릭 수집

![Micrometer 메트릭 수집 Aspect](/assets/posts/spring-aop-usecases-metrics.svg)

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Timed {
    String value();                    // 메트릭 이름
    String[] tags() default {};        // key=value 쌍
}

@Aspect
@Component
public class MetricsAspect {

    private final MeterRegistry registry;

    @Around("@annotation(timed)")
    public Object record(ProceedingJoinPoint jp,
                         Timed timed) throws Throwable {
        Timer.Sample sample = Timer.start(registry);
        String status = "success";
        try {
            return jp.proceed();
        } catch (Throwable t) {
            status = "error";
            throw t;
        } finally {
            String[] rawTags = timed.tags();
            String[] allTags = Arrays.copyOf(rawTags, rawTags.length + 2);
            allTags[rawTags.length]     = "status";
            allTags[rawTags.length + 1] = status;

            sample.stop(Timer.builder(timed.value())
                    .tags(allTags)
                    .register(registry));
        }
    }
}

// 사용 — 비즈니스 코드에 계측 코드 전혀 없음
@Service
public class OrderService {

    @Timed(value = "order.place", tags = {"layer", "service"})
    public Order place(OrderRequest req) {
        // 순수 비즈니스 로직만
        validateStock(req);
        Order order = new Order(req);
        orderRepository.save(order);
        return order;
    }
}
```

Prometheus + Grafana 스택과 연결하면 `order_place_seconds_sum`, `order_place_seconds_count`, `order_place_seconds_bucket` 등의 히스토그램이 자동으로 수집됩니다.

## 사례 4: Circuit Breaker (단순 구현)

Resilience4j를 사용하지 않고 AOP로 간단한 Circuit Breaker를 구현해 원리를 이해할 수 있습니다.

```java
@Aspect
@Component
public class CircuitBreakerAspect {

    private final Map<String, CircuitState> states = new ConcurrentHashMap<>();

    @Around("@annotation(com.example.annotation.CircuitBreaker)")
    public Object breaker(ProceedingJoinPoint jp) throws Throwable {
        String key = jp.getSignature().toShortString();
        CircuitState state = states.computeIfAbsent(key, k -> new CircuitState());

        if (state.isOpen()) {
            if (state.shouldAttemptReset()) {
                state.halfOpen();
            } else {
                throw new CircuitOpenException("Circuit open: " + key);
            }
        }

        try {
            Object result = jp.proceed();
            state.recordSuccess();
            return result;
        } catch (Throwable t) {
            state.recordFailure();
            throw t;
        }
    }

    static class CircuitState {
        private static final int FAILURE_THRESHOLD = 5;
        private static final long RESET_TIMEOUT_MS = 30_000;

        private final AtomicInteger failures = new AtomicInteger(0);
        private volatile boolean open = false;
        private volatile long openedAt = 0;

        boolean isOpen() { return open; }

        boolean shouldAttemptReset() {
            return System.currentTimeMillis() - openedAt > RESET_TIMEOUT_MS;
        }

        void halfOpen() { open = false; }

        void recordSuccess() { failures.set(0); open = false; }

        void recordFailure() {
            if (failures.incrementAndGet() >= FAILURE_THRESHOLD) {
                open = true;
                openedAt = System.currentTimeMillis();
            }
        }
    }
}
```

실무에서는 Resilience4j의 `@CircuitBreaker`를 사용하는 것이 훨씬 낫습니다. 이 구현은 원리 학습용입니다.

## 사례 5: 멱등성(Idempotency) 보장

HTTP PUT/POST에서 클라이언트가 동일 요청을 재시도할 때 중복 처리를 막는 패턴입니다.

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Idempotent {
    String keyHeader() default "Idempotency-Key";
    long ttlMinutes() default 60;
}

@Aspect
@Component
public class IdempotencyAspect {

    private final RedisTemplate<String, String> redis;

    @Around("@annotation(idempotent)")
    public Object enforce(ProceedingJoinPoint jp,
                          Idempotent idempotent) throws Throwable {
        HttpServletRequest request = getCurrentRequest();
        String idempotencyKey = request.getHeader(idempotent.keyHeader());

        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return jp.proceed();    // 키 없으면 그냥 통과
        }

        String redisKey = "idempotent:" + idempotencyKey;
        Boolean isNew = redis.opsForValue()
                .setIfAbsent(redisKey, "processing",
                             Duration.ofMinutes(idempotent.ttlMinutes()));

        if (Boolean.FALSE.equals(isNew)) {
            // 이미 처리 중이거나 완료된 요청
            String cachedResult = redis.opsForValue().get(redisKey + ":result");
            if (cachedResult != null) {
                return objectMapper.readValue(cachedResult, Object.class);
            }
            throw new DuplicateRequestException("이미 처리 중인 요청: " + idempotencyKey);
        }

        try {
            Object result = jp.proceed();
            String resultJson = objectMapper.writeValueAsString(result);
            redis.opsForValue().set(redisKey + ":result", resultJson,
                                    Duration.ofMinutes(idempotent.ttlMinutes()));
            return result;
        } catch (Throwable t) {
            redis.delete(redisKey);   // 실패 시 키 삭제 (재시도 허용)
            throw t;
        }
    }

    private HttpServletRequest getCurrentRequest() {
        return ((ServletRequestAttributes)
                RequestContextHolder.currentRequestAttributes()).getRequest();
    }
}
```

## 사례 6: 분산 환경 분산 락

여러 인스턴스에서 동시에 실행되면 안 되는 작업(예: 배치 잡, 재고 감소)에 Redis 분산 락을 AOP로 적용합니다.

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface DistributedLock {
    String key();               // SpEL
    long timeoutSeconds() default 5;
    long leaseSeconds() default 30;
}

@Aspect
@Component
public class DistributedLockAspect {

    private final RedissonClient redisson;
    private final ExpressionParser parser = new SpelExpressionParser();

    @Around("@annotation(lock)")
    public Object withLock(ProceedingJoinPoint jp,
                           DistributedLock lock) throws Throwable {
        String lockKey = "lock:" + resolveKey(jp, lock.key());
        RLock rLock   = redisson.getLock(lockKey);

        boolean acquired = rLock.tryLock(
                lock.timeoutSeconds(), lock.leaseSeconds(), TimeUnit.SECONDS);
        if (!acquired) {
            throw new LockAcquisitionException("락 획득 실패: " + lockKey);
        }
        try {
            return jp.proceed();
        } finally {
            if (rLock.isHeldByCurrentThread()) {
                rLock.unlock();
            }
        }
    }

    private String resolveKey(ProceedingJoinPoint jp, String expr) {
        MethodSignature sig   = (MethodSignature) jp.getSignature();
        EvaluationContext ctx = new StandardEvaluationContext();
        String[] names        = sig.getParameterNames();
        Object[] args         = jp.getArgs();
        for (int i = 0; i < names.length; i++) ctx.setVariable(names[i], args[i]);
        return parser.parseExpression(expr).getValue(ctx, String.class);
    }
}

// 사용
@Service
public class InventoryService {

    @DistributedLock(key = "'product:stock:' + #productId")
    @Transactional
    public void decrease(Long productId, int quantity) {
        Product product = productRepository.findById(productId).orElseThrow();
        product.decreaseStock(quantity);
    }
}
```

## 사례별 Advice 타입 선택 가이드

| 사례 | 권장 Advice | 이유 |
|------|------------|------|
| 로깅 / 실행시간 | `@Around` | 전·후 모두 처리 + 예외 캡처 |
| 입력 검증 | `@Before` | 실패 시 예외로 실행 차단 |
| 결과 감사 | `@AfterReturning` | 정상 반환값 필요, 예외 시 불필요 |
| 예외 알림 | `@AfterThrowing` | 예외 타입 필터링 가능 |
| 리소스 정리 | `@After` | 정상·예외 무관하게 항상 실행 |
| 캐싱 / 락 | `@Around` | 실행 여부 자체를 제어해야 함 |

## AOP 적용 시 체크리스트

```
□ 대상 빈이 Spring 컨테이너가 관리하는 빈인가?
□ 대상 메서드가 public인가? (private은 프록시 불가)
□ self-invocation이 아닌가? (같은 클래스 내 호출)
□ final 클래스·메서드가 아닌가? (CGLIB 불가)
□ @Order로 여러 Aspect의 실행 순서를 명확히 했는가?
□ @Around에서 proceed()를 빠뜨리지 않았는가?
□ Pointcut 표현식이 의도한 메서드만 정확히 매칭하는가?
   (AspectJExpressionPointcut 단위 테스트로 검증)
```

## 핵심 정리

- Spring AOP는 단순 로깅부터 분산 락·Circuit Breaker까지 다양한 횡단 관심사를 비즈니스 로직과 완전히 분리 가능
- `@Around`는 실행 여부까지 제어하므로 캐싱·락·Circuit Breaker에 필수
- 커스텀 어노테이션 + `@annotation`의 파라미터 바인딩 조합이 가장 유연한 패턴
- Micrometer 메트릭, 분산 락, 멱등성 보장처럼 인프라 횡단 관심사는 AOP로 분리하면 비즈니스 코드가 극적으로 단순해짐
- 적용 전 체크리스트(public, 비 self-invocation, 비 final)를 항상 확인

---

**지난 글:** [Spring AOP Pointcut 표현식 심화: execution·within·@annotation 완전 정복](/posts/spring-aop-pointcut-expression/)

<br>
읽어주셔서 감사합니다. 😊
