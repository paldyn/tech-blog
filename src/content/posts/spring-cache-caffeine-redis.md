---
title: "Spring Cache — Caffeine과 Redis 공급자 완전 정복"
description: "Spring Cache 추상화 위에서 Caffeine 로컬 캐시와 Redis 분산 캐시를 각각 설정하는 방법, 직렬화 전략, TTL 관리, 그리고 두 공급자를 조합하는 멀티 캐시 패턴까지 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "Cache", "Caffeine", "Redis", "CacheManager", "Spring Boot"]
featured: false
draft: false
---

[지난 글](/posts/spring-cache-abstraction/)에서 Spring Cache 추상화 레이어와 `@Cacheable`, `@CacheEvict`, `@CachePut` 어노테이션의 동작 원리를 살펴봤다. 이번 글에서는 실제 캐시 저장소로 가장 많이 쓰이는 **Caffeine**과 **Redis**를 어떻게 연결하고 튜닝하는지 상세히 다룬다.

## 왜 공급자를 신중히 골라야 하나

Spring Cache의 강점은 CacheManager 인터페이스 뒤로 구현을 숨긴다는 것이다. `@Cacheable`을 붙인 비즈니스 코드는 어떤 공급자를 쓰든 바뀌지 않는다. 그러나 **잘못된 공급자 선택**은 GC 부담 증가, 네트워크 레이턴시 오버헤드, 인스턴스 간 캐시 불일치 같은 문제로 이어진다.

![Caffeine vs Redis 공급자 비교](/assets/posts/spring-cache-caffeine-redis-compare.svg)

핵심 판단 기준은 하나다. **모든 애플리케이션 인스턴스가 같은 캐시 데이터를 봐야 하는가?** 단일 인스턴스이거나 읽기 전용 설정 값 정도라면 Caffeine이 충분하다. 수평 확장 환경에서 캐시 일관성이 필요하다면 Redis가 필요하다.

## Caffeine 설정

Caffeine은 구글 Guava Cache를 대체하기 위해 만들어진 고성능 JVM 로컬 캐시다. `W-TinyLFU` 알고리즘 기반으로 메모리 효율이 높고, 네트워크 없이 나노초 단위 응답이 가능하다.

### 의존성 추가

```xml
<!-- Maven -->
<dependency>
  <groupId>com.github.ben-manes.caffeine</groupId>
  <artifactId>caffeine</artifactId>
</dependency>
```

Spring Boot의 `spring-boot-starter-cache`와 함께 사용하면 자동 구성이 활성화된다.

### application.yml 방식 (간단한 설정)

```yaml
spring:
  cache:
    type: caffeine
    caffeine:
      spec: maximumSize=500,expireAfterWrite=10m
```

`spec` 문자열은 Caffeine의 `CaffeineSpec` 포맷을 따른다. `expireAfterWrite=10m`은 마지막 쓰기 후 10분, `expireAfterAccess=5m`은 마지막 접근 후 5분에 만료된다.

### Java Config 방식 (세밀한 제어)

```java
@Configuration
@EnableCaching
public class CaffeineConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.setCaffeine(Caffeine.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(10, TimeUnit.MINUTES)
            .recordStats());   // 캐시 히트율 통계 활성화
        return manager;
    }
}
```

`recordStats()`를 활성화하면 `cache.stats().hitRate()`, `missCount()` 등 상세 지표를 얻을 수 있다. 운영 환경에서는 Micrometer와 연동해 Prometheus로 내보내는 것을 권장한다.

### 캐시별 개별 설정

```java
@Bean
public CacheManager cacheManager() {
    CaffeineCacheManager manager = new CaffeineCacheManager();
    // 기본 설정
    manager.setCaffeine(Caffeine.newBuilder()
        .maximumSize(500)
        .expireAfterWrite(10, TimeUnit.MINUTES));

    // 특정 캐시에 별도 Caffeine 인스턴스 등록
    manager.registerCustomCache("users",
        Caffeine.newBuilder()
            .maximumSize(100)
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .build());
    return manager;
}
```

## Redis 설정

Redis는 네트워크를 통해 접근하는 외부 인메모리 저장소다. 모든 애플리케이션 인스턴스가 동일한 Redis에 연결하므로 수평 확장 환경에서도 캐시 일관성이 유지된다.

### 의존성 추가

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

### application.yml

```yaml
spring:
  cache:
    type: redis
  data:
    redis:
      host: localhost
      port: 6379
      timeout: 2000ms
```

`spring.cache.type=redis`를 지정하면 Spring Boot 자동 구성이 `RedisCacheManager`를 생성한다.

### Java Config — 직렬화와 TTL 설정

Redis는 값을 바이트 배열로 직렬화해서 저장하므로 **직렬화 전략**이 중요하다. 기본값인 Java 직렬화는 클래스 변경에 취약하기 때문에 JSON 직렬화를 권장한다.

```java
@Bean
public RedisCacheManager redisCacheManager(
        RedisConnectionFactory factory) {

    RedisCacheConfiguration defaultConfig =
        RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(30))
            .disableCachingNullValues()
            .serializeKeysWith(
                RedisSerializationContext.SerializationPair
                    .fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair
                    .fromSerializer(
                        new GenericJackson2JsonRedisSerializer()));

    // 캐시별 TTL 오버라이드
    Map<String, RedisCacheConfiguration> cacheConfigs = Map.of(
        "products", defaultConfig.entryTtl(Duration.ofHours(1)),
        "sessions", defaultConfig.entryTtl(Duration.ofMinutes(5))
    );

    return RedisCacheManager.builder(factory)
        .cacheDefaults(defaultConfig)
        .withInitialCacheConfigurations(cacheConfigs)
        .build();
}
```

### Redis 키 네이밍 전략

기본 키 형식은 `cacheName::cacheKey`다. `@Cacheable(value = "users", key = "#id")`이면 `users::42` 형태로 저장된다. prefix를 변경하려면 `RedisCacheConfiguration.prefixCacheNameWith("myapp:")`를 설정한다.

![Caffeine &amp; Redis CacheManager 설정 코드](/assets/posts/spring-cache-caffeine-redis-config.svg)

## 멀티 캐시 매니저 패턴

로컬 캐시(Caffeine)와 분산 캐시(Redis)를 동시에 운용하고, `@Cacheable`에서 선택적으로 사용하려면 `@Primary` + `@Qualifier` 패턴을 활용한다.

```java
@Bean
@Primary
public CacheManager caffeineCacheManager() {
    // 빠른 응답 필요 캐시: 기본값
    return new CaffeineCacheManager("config", "roles");
}

@Bean("redisCacheManager")
public CacheManager redisCacheManager(
        RedisConnectionFactory factory) {
    return RedisCacheManager.create(factory);
}
```

```java
// 기본 (Caffeine) 사용
@Cacheable(value = "config", key = "#key")
public String getConfig(String key) { ... }

// Redis 명시 사용
@Cacheable(
    value = "sessions",
    key   = "#userId",
    cacheManager = "redisCacheManager"
)
public UserSession getSession(Long userId) { ... }
```

## Cache-Aside 패턴과 갱신 전략

Spring Cache의 `@Cacheable`은 **Cache-Aside** 패턴을 구현한다. 캐시 히트면 DB를 건너뛰고, 미스면 DB에서 읽어 캐시에 저장한다. 데이터 갱신 시에는 두 가지 전략이 있다.

```java
// 전략 1: Write-Invalidate — 갱신 후 캐시 삭제
@CacheEvict(value = "users", key = "#user.id")
@Transactional
public void updateUser(User user) {
    userRepository.save(user);
}

// 전략 2: Write-Through — 갱신 후 캐시도 즉시 업데이트
@CachePut(value = "users", key = "#result.id")
@Transactional
public User updateUser(User user) {
    return userRepository.save(user);
}
```

Write-Invalidate는 구현이 단순하고 Cache Stampede(동시 캐시 미스로 DB 부하 폭증)에 주의해야 한다. Write-Through는 캐시 데이터가 항상 최신이지만 캐시와 DB 사이 정합성 관리가 더 복잡하다.

## Caffeine 통계 모니터링

운영 환경에서는 캐시 히트율을 추적해야 한다. `recordStats()`를 설정하면 Actuator + Micrometer를 통해 자동으로 지표가 노출된다.

```java
// CaffeineCache에서 직접 통계 접근
Cache cache = cacheManager.getCache("users");
CaffeineCache caffeineCache = (CaffeineCache) cache;
CacheStats stats = caffeineCache.getNativeCache().stats();

double hitRate    = stats.hitRate();    // 0.0 ~ 1.0
long   missCount  = stats.missCount();
long   evictions  = stats.evictionCount();
```

히트율이 80% 미만이면 `maximumSize`가 너무 작거나 TTL이 너무 짧다는 신호다. 반대로 100%에 가까우면 캐시 데이터가 너무 오래 살아 있어 갱신이 지연될 수 있다.

## 정리

| 선택 기준 | Caffeine | Redis |
|---|---|---|
| 단일 인스턴스 | ✅ 최적 | 오버스펙 |
| 수평 확장 | ❌ 비권장 | ✅ 필수 |
| 응답 속도 | 나노초 | 마이크로초 |
| 직렬화 비용 | 없음 | JSON/바이트 변환 |
| TTL 정밀 제어 | 제한적 | 밀리초 단위 |

대부분의 Spring Boot 프로젝트는 **로컬 설정 값 → Caffeine, 사용자 세션·공유 데이터 → Redis** 조합으로 시작하는 것이 실용적이다. 두 공급자를 동시에 쓸 때는 캐시 이름을 명확히 분리하고 어노테이션에 `cacheManager`를 명시하자.

---

**지난 글:** [Spring Cache 추상화 — @Cacheable · @CacheEvict 완전 정복](/posts/spring-cache-abstraction/)

**다음 글:** [Spring HTTP 캐시 헤더 — Cache-Control과 ETag 완전 정복](/posts/spring-http-cache-headers/)

<br>
읽어주셔서 감사합니다. 😊
