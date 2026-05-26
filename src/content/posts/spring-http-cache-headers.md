---
title: "Spring HTTP 캐시 헤더 — Cache-Control과 ETag 완전 정복"
description: "Spring MVC에서 Cache-Control, ETag, Last-Modified HTTP 캐시 헤더를 제어하는 방법과 ShallowEtagHeaderFilter, WebMvcConfigurer를 이용한 정적 리소스 캐시 전략을 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "HTTP Cache", "Cache-Control", "ETag", "Last-Modified", "Spring MVC"]
featured: false
draft: false
---

[지난 글](/posts/spring-cache-caffeine-redis/)에서 Spring Cache 추상화의 서버 측 공급자인 Caffeine과 Redis 설정을 살펴봤다. 이번에는 서버와 클라이언트 사이의 **HTTP 계층 캐시 헤더**를 Spring MVC에서 어떻게 제어하는지 집중해서 다룬다.

## HTTP 캐시란 무엇인가

서버 측 캐시(Caffeine, Redis)는 DB 부하를 줄이는 것이 목적이다. HTTP 캐시는 그 이전 단계로, **브라우저나 CDN에서 응답 자체를 재사용**함으로써 서버까지 요청이 도달하지 않도록 막는다. 네트워크 비용과 서버 처리 부하를 동시에 줄일 수 있다.

![HTTP 캐시 요청 응답 플로우](/assets/posts/spring-http-cache-headers-flow.svg)

HTTP 캐시는 크게 두 단계로 동작한다.

1. **신선도 기간(fresh period)**: `Cache-Control: max-age` 동안 브라우저가 서버에 요청조차 보내지 않고 캐시를 직접 사용
2. **재검증(revalidation)**: 신선도 만료 후 `If-None-Match`(ETag) 또는 `If-Modified-Since`(Last-Modified) 헤더를 포함한 조건부 GET을 보내 변경 여부만 확인. 변경 없으면 **304 Not Modified**(바디 없음)로 응답해 대역폭을 절약

## Cache-Control 헤더 이해

![Cache-Control 주요 지시자](/assets/posts/spring-http-cache-headers-directives.svg)

가장 중요한 응답 헤더는 `Cache-Control`이다. 주요 지시자를 이해하면 상황에 맞는 캐시 전략을 세울 수 있다.

| 지시자 | 의미 |
|---|---|
| `max-age=N` | N초 동안 신선도 유지 |
| `no-cache` | 저장은 허용, 사용 전 서버 재검증 필수 |
| `no-store` | 저장 자체 금지 (개인정보·결제 응답) |
| `public` | CDN·프록시 포함 모든 캐시 허용 |
| `private` | 브라우저 전용 캐시 (공유 캐시 금지) |
| `must-revalidate` | 만료 후 반드시 재검증 (오프라인 시 504 반환) |

## Spring에서 Cache-Control 설정

### ResponseEntity로 직접 설정

```java
@GetMapping("/products/{id}")
public ResponseEntity<Product> getProduct(@PathVariable Long id) {
    Product product = productService.findById(id);
    return ResponseEntity.ok()
        .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS)
            .cachePublic())
        .body(product);
}
```

`CacheControl` 빌더는 메서드 체인으로 여러 지시자를 조합할 수 있다.

```java
// 민감 데이터: 캐시 완전 금지
CacheControl.noStore()

// 인증 사용자 응답: 브라우저만 캐시
CacheControl.maxAge(30, TimeUnit.MINUTES).cachePrivate()

// API 응답: CDN까지 1시간, 만료 후 재검증 강제
CacheControl.maxAge(1, TimeUnit.HOURS)
            .cachePublic()
            .mustRevalidate()
```

### WebMvcConfigurer로 정적 리소스에 일괄 적용

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/static/**")
            .addResourceLocations("classpath:/static/")
            .setCacheControl(
                CacheControl.maxAge(365, TimeUnit.DAYS)
                            .cachePublic()
                            .immutable());  // 변경 불가 선언
    }
}
```

`immutable()`은 `Cache-Control: immutable` 지시자를 추가한다. 브라우저에게 "이 URL의 콘텐츠는 절대 변경되지 않는다"고 알리므로 재검증 요청 자체를 생략한다. 내용 해시를 URL에 포함하는 Webpack/Vite 빌드 산출물에 적합하다.

## ETag로 조건부 재검증

ETag(Entity Tag)는 응답 내용의 해시값 또는 버전 식별자다. 클라이언트는 이전 응답에서 받은 ETag를 `If-None-Match` 헤더에 담아 재요청한다.

### ShallowEtagHeaderFilter 자동 ETag 생성

Spring이 제공하는 `ShallowEtagHeaderFilter`는 응답 바디의 MD5 해시를 ETag로 자동 생성한다.

```java
@Bean
public FilterRegistrationBean<ShallowEtagHeaderFilter> shallowEtagFilter() {
    FilterRegistrationBean<ShallowEtagHeaderFilter> bean =
        new FilterRegistrationBean<>(new ShallowEtagHeaderFilter());
    bean.addUrlPatterns("/api/*");
    bean.setOrder(Ordered.LOWEST_PRECEDENCE - 2);
    return bean;
}
```

이 필터를 등록하면 API 응답에 자동으로 `ETag: "abc123..."` 헤더가 붙는다. 동일 요청이 재도달하면 필터가 ETag를 비교해 변경 없을 경우 **304 Not Modified**로 자동 응답한다.

주의점: ShallowETag는 **응답 바디를 메모리에 버퍼링**한 후 해시를 계산하므로 스트리밍 응답이나 파일 다운로드에는 적합하지 않다.

### 컨트롤러에서 직접 ETag 처리

더 정밀한 제어가 필요하면 `WebRequest.checkNotModified()`를 활용한다.

```java
@GetMapping("/articles/{id}")
public ResponseEntity<Article> getArticle(
        @PathVariable Long id,
        WebRequest webRequest) {

    Article article = articleService.findById(id);
    String eTag = "\"" + article.getVersion() + "\""; // 버전 기반 ETag
    long lastModified = article.getUpdatedAt()
                               .toEpochSecond(ZoneOffset.UTC);

    // 변경 없으면 304를 자동 반환 (아래 코드 이후 실행 안 됨)
    if (webRequest.checkNotModified(eTag, lastModified)) {
        return null;
    }

    return ResponseEntity.ok()
        .eTag(eTag)
        .lastModified(article.getUpdatedAt().toInstant())
        .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES))
        .body(article);
}
```

`checkNotModified()`는 요청의 `If-None-Match`와 `If-Modified-Since`를 서버값과 비교해 일치하면 응답 상태를 304로 설정하고 `true`를 반환한다.

## Last-Modified 헤더

ETag 대신 마지막 수정 시각을 이용한 검증도 가능하다.

```java
@GetMapping("/reports/{date}")
public ResponseEntity<Report> getReport(
        @PathVariable LocalDate date,
        WebRequest webRequest) {

    Report report = reportService.getReport(date);
    Instant lastModified = report.getGeneratedAt().toInstant();

    if (webRequest.checkNotModified(lastModified.toEpochMilli())) {
        return null;
    }

    return ResponseEntity.ok()
        .lastModified(lastModified)
        .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS))
        .body(report);
}
```

ETag와 Last-Modified를 동시에 사용하면 브라우저는 두 조건 모두 일치할 때만 304를 수신한다. 가능하면 ETag를 우선하고 Last-Modified는 보조 수단으로 사용하는 것이 좋다.

## 실전 캐시 전략 패턴

```java
// 1. 공개 API 응답 — CDN 캐시 + 재검증
CacheControl.maxAge(10, TimeUnit.MINUTES)
            .cachePublic()

// 2. 인증 사용자 응답 — 브라우저만 캐시
CacheControl.maxAge(5, TimeUnit.MINUTES)
            .cachePrivate()

// 3. 실시간 데이터 — 캐시 안 하되 연결 유지 비용 절약 목적 ETag만
CacheControl.noCache()

// 4. 개인정보·금융 — 완전 금지
CacheControl.noStore()

// 5. 버전 포함된 정적 파일 — 영구 캐시
CacheControl.maxAge(365, TimeUnit.DAYS)
            .cachePublic()
            .immutable()
```

## Spring Boot 자동 구성과 기본값

Spring Boot는 정적 리소스에 기본적으로 `Cache-Control: max-age=0` (revalidate)을 적용한다. 운영 환경에서는 `spring.web.resources.cache.cachecontrol.max-age=365d` 프로퍼티로 변경하거나 `WebMvcConfigurer`로 명시적으로 설정하는 것을 권장한다.

```yaml
spring:
  web:
    resources:
      cache:
        cachecontrol:
          max-age: 365d
          cache-public: true
```

## 정리

HTTP 캐시 헤더는 서버 측 캐시보다 앞 단에서 동작해 서버 부하 자체를 줄인다. Spring MVC에서는 `CacheControl` 빌더, `ShallowEtagHeaderFilter`, `WebRequest.checkNotModified()`를 조합해 상황에 맞는 HTTP 캐시 전략을 구현할 수 있다. 정적 리소스에는 `immutable` + `max-age` 조합, API 응답에는 ETag 기반 재검증이 가장 실용적인 출발점이다.

---

**지난 글:** [Spring Cache — Caffeine과 Redis 공급자 완전 정복](/posts/spring-cache-caffeine-redis/)

**다음 글:** [Spring 비동기 스레드풀 — @Async와 ThreadPoolTaskExecutor 완전 정복](/posts/spring-async-threadpool/)

<br>
읽어주셔서 감사합니다. 😊
