---
title: "Spring Cache 추상화 — @Cacheable · @CacheEvict 완전 정복"
description: "Spring Cache 추상화 구조와 @Cacheable·@CachePut·@CacheEvict 동작 원리, SpEL 키 표현식, 조건부 캐싱, Cache Stampede 방어, 그리고 Caffeine·Redis 공급자 설정까지 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "Cache", "Cacheable", "CacheEvict", "CachePut", "Caffeine", "Redis", "SpEL", "CacheStampede"]
featured: false
draft: false
---

[지난 글](/posts/spring-security-remember-me-session/)에서 세션 관리와 Remember-Me 인증을 살펴봤습니다. 인증 이후 서비스 레이어에서 발생하는 성능 문제 중 가장 빈번한 것은 **반복적인 DB 조회**입니다. Spring Cache 추상화는 어노테이션 하나로 캐시 공급자(Caffeine, Redis, EhCache 등)에 독립적인 캐싱 로직을 적용할 수 있게 해줍니다. 이번 글에서는 Spring Cache의 구조와 네 가지 어노테이션, SpEL 키 표현식, 그리고 실무에서 자주 마주치는 함정까지 정리합니다.

## Spring Cache 추상화 구조

Spring Cache 추상화는 `CacheManager`와 `Cache`인터페이스를 통해 다양한 캐시 공급자를 단일 API로 제어합니다. 어노테이션은 AOP 프록시를 통해 적용되므로, **비즈니스 로직에 캐시 관련 코드가 전혀 포함되지 않습니다.**

![Spring Cache 추상화 구조](/assets/posts/spring-cache-abstraction-overview.svg)

캐시 공급자 선택:
- **ConcurrentMapCacheManager**: 추가 의존성 없이 사용. 인메모리, TTL 없음, 개발·테스트 환경에 적합.
- **Caffeine**: 고성능 인메모리 캐시. TTL, 최대 크기, 참조 기반 제거(Weak, Soft)를 지원. 단일 서버.
- **Redis**: 분산 캐시. TTL, 영속성, 여러 인스턴스 공유. 네트워크 I/O 오버헤드 있음.
- **JCache (JSR-107)**: EhCache, Infinispan 등 JCache 호환 구현체.

## @EnableCaching 활성화

```java
@Configuration
@EnableCaching
public class CacheConfig {
    // CacheManager 빈이 없으면 ConcurrentMapCacheManager 자동 등록
}
```

Spring Boot를 사용하면 `spring.cache.type` 설정으로 공급자를 선택하고, 의존성 클래스패스에 따라 `CacheManager`가 자동 구성됩니다.

## 네 가지 핵심 어노테이션

### @Cacheable

메서드 호출 전에 캐시를 확인합니다. **히트** 시 메서드를 건너뛰고 캐시 값을 반환, **미스** 시 메서드를 실행하고 결과를 캐시에 저장합니다.

```java
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository repo;

    @Cacheable(cacheNames = "products", key = "#id")
    public Product findById(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new NoSuchElementException());
    }

    @Cacheable(cacheNames = "productList",
               key = "#category + ':' + #page")
    public Page<Product> findByCategory(String category,
            int page) {
        return repo.findByCategory(category,
                PageRequest.of(page, 20));
    }
}
```

### @CachePut

메서드를 **항상 실행**하고 결과를 캐시에 저장합니다. 데이터 변경 후 캐시를 최신 값으로 갱신할 때 사용합니다.

```java
@CachePut(cacheNames = "products", key = "#result.id")
public Product update(UpdateProductRequest req) {
    Product product = repo.findById(req.id()).orElseThrow();
    product.update(req.name(), req.price());
    return repo.save(product);  // 반환값이 캐시에 저장됨
}
```

### @CacheEvict

캐시 항목을 **삭제**합니다. 데이터가 변경·삭제되어 캐시를 무효화해야 할 때 사용합니다.

```java
@CacheEvict(cacheNames = "products", key = "#id")
public void delete(Long id) {
    repo.deleteById(id);
}

// 전체 캐시 삭제
@CacheEvict(cacheNames = "productList", allEntries = true)
public void evictAllLists() { /* no-op */ }
```

`beforeInvocation = true`로 설정하면 메서드 실행 전에 캐시를 삭제합니다. 기본값(false)은 메서드 성공 후 삭제합니다.

### @Caching

위 세 어노테이션을 조합합니다. 하나의 메서드에서 여러 캐시를 동시에 제어해야 할 때 사용합니다.

```java
@Caching(
    put   = { @CachePut(cacheNames = "products",
                        key = "#result.id") },
    evict = { @CacheEvict(cacheNames = "productList",
                          allEntries = true) }
)
public Product create(CreateProductRequest req) {
    return repo.save(new Product(req));
}
```

## SpEL 키 표현식 · 조건부 캐싱

![SpEL 키 표현식 · 조건부 캐싱](/assets/posts/spring-cache-abstraction-spel.svg)

### key 표현식

SpEL(Spring Expression Language)로 캐시 키를 동적으로 구성합니다.

| 표현식 | 의미 |
|--------|------|
| `#id` | 파라미터 `id` 값 |
| `#req.userId` | 파라미터 `req` 객체의 `userId` 필드 |
| `#root.methodName` | 현재 메서드명 |
| `#root.args[0]` | 첫 번째 파라미터 |
| `#result` | 반환값 (`@CachePut`, `unless`에서만 사용 가능) |

### condition vs unless

```java
@Cacheable(
    cacheNames = "users",
    key = "#id",
    condition = "#id > 0",   // 저장 전 평가 (파라미터 기반)
    unless = "#result == null" // 저장 전 평가 (결과 기반)
)
public User findById(Long id) { ... }
```

`condition`은 메서드 실행 전후 모두에서 평가되어 `false`이면 캐시를 아예 사용하지 않습니다. `unless`는 메서드 실행 후 결과를 평가해 `true`이면 캐시에 저장하지 않습니다.

## Caffeine 공급자 설정

```groovy
implementation 'com.github.ben-manes.caffeine:caffeine'
```

```yaml
spring:
  cache:
    type: caffeine
    caffeine:
      spec: maximumSize=1000,expireAfterWrite=10m
```

또는 Java Config로 세밀하게 제어합니다.

```java
@Bean
public CacheManager cacheManager() {
    CaffeineCacheManager manager = new CaffeineCacheManager();
    manager.setCaffeine(Caffeine.newBuilder()
            .maximumSize(500)
            .expireAfterWrite(Duration.ofMinutes(10))
            .recordStats());  // 캐시 통계 활성화
    return manager;
}
```

## Redis 공급자 설정

```groovy
implementation 'org.springframework.boot:spring-boot-starter-data-redis'
```

```yaml
spring:
  cache:
    type: redis
    redis:
      time-to-live: 600000  # 10분 (ms)
      key-prefix: "myapp:"
      use-key-prefix: true
```

캐시마다 TTL을 다르게 설정하려면 `RedisCacheConfiguration`을 직접 구성합니다.

```java
@Bean
public RedisCacheManager cacheManager(
        RedisConnectionFactory factory) {
    Map<String, RedisCacheConfiguration> configs = Map.of(
        "products",    defaultConfig().entryTtl(Duration.ofMinutes(10)),
        "users",       defaultConfig().entryTtl(Duration.ofHours(1)),
        "productList", defaultConfig().entryTtl(Duration.ofMinutes(5))
    );
    return RedisCacheManager.builder(factory)
            .withInitialCacheConfigurations(configs)
            .build();
}

private RedisCacheConfiguration defaultConfig() {
    return RedisCacheConfiguration.defaultCacheConfig()
            .serializeValuesWith(RedisSerializationContext
                    .SerializationPair.fromSerializer(
                            new GenericJackson2JsonRedisSerializer()));
}
```

## Cache Stampede 방지 — sync=true

동시에 여러 요청이 캐시 미스를 발생시키면, 모든 요청이 DB를 조회하는 **캐시 스탬피드(Cache Stampede)** 문제가 생깁니다. `@Cacheable(sync = true)`를 사용하면 동시 미스 시 단 하나의 스레드만 실제 메서드를 실행하고, 나머지는 결과를 기다립니다.

```java
@Cacheable(cacheNames = "heavyReport",
           key = "#reportId",
           sync = true)
public Report generateHeavyReport(Long reportId) {
    // 수십 초 걸리는 작업
    return reportGenerator.generate(reportId);
}
```

단, `sync = true`는 Caffeine처럼 동기 조회를 지원하는 공급자에서만 동작하며, Redis는 지원하지 않습니다.

## 자기 호출(Self-invocation) 함정

Spring Cache는 AOP 프록시를 통해 동작합니다. 같은 클래스 내에서 `@Cacheable` 메서드를 직접 호출하면 프록시를 거치지 않아 **캐시가 전혀 동작하지 않습니다.**

```java
@Service
public class ProductService {

    // ❌ 자기 호출 — 캐시 동작 안 함
    public List<Product> findAll() {
        return this.findByCategory("ALL", 0);  // 프록시 우회
    }

    @Cacheable("products")
    public List<Product> findByCategory(String cat, int page) { ... }
}
```

해결책:
1. **다른 빈으로 메서드 분리**: 캐시가 필요한 메서드를 별도 `@Service`로 분리.
2. **ApplicationContext에서 자신 주입**: `@Autowired ProductService self;` 후 `self.findByCategory(...)` 호출. 단, 가독성이 떨어짐.

## @CacheConfig — 클래스 레벨 설정

```java
@Service
@CacheConfig(cacheNames = "products")
public class ProductService {

    @Cacheable(key = "#id")          // cacheNames 생략 가능
    public Product findById(Long id) { ... }

    @CacheEvict(key = "#id")
    public void delete(Long id) { ... }
}
```

`@CacheConfig`를 클래스에 붙이면 해당 클래스의 모든 캐시 어노테이션에서 `cacheNames`를 생략할 수 있습니다.

## 마무리

Spring Cache 추상화는 공급자 교체 없이 어노테이션 기반으로 캐싱 전략을 선언적으로 표현합니다. 개발 환경에서는 Caffeine 인메모리, 운영 환경에서는 Redis로 전환할 때 비즈니스 코드를 건드리지 않아도 됩니다. 다음 글에서는 Redis와 Caffeine을 이용한 **다단계(L1/L2) 캐시 전략**과 실무 캐시 설계 패턴을 다룹니다.

---

**지난 글:** [Spring Security Remember-Me와 세션 관리](/posts/spring-security-remember-me-session/)

**다음 글:** [Spring Cache — Caffeine · Redis 실전 설정](/posts/spring-cache-caffeine-redis/)

<br>
읽어주셔서 감사합니다. 😊
