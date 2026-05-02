---
title: "Servlet · Filter · Listener 완전 정복: 웹 컨테이너 3요소의 역할과 실전 활용"
description: "Jakarta EE 웹 컨테이너의 3요소 Servlet, Filter, Listener의 생명주기와 동작 원리를 이해하고, Spring Boot에서 각각을 등록·활용하는 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "Servlet", "Filter", "Listener", "Jakarta EE", "Spring Boot", "FilterChain", "Web"]
featured: false
draft: false
---

[지난 글](/posts/spring-aop-usecases/)에서 AOP의 실전 활용 사례—로깅·캐싱·분산 락까지—를 살펴봤습니다. 이번 글부터는 Spring MVC 웹 계층으로 넘어가, 요청이 컨트롤러에 도달하기 전에 거치는 인프라 구조를 하나씩 해부합니다. 가장 먼저 살펴볼 것은 Jakarta EE(구 Java EE) 웹 컨테이너의 핵심 3요소인 **Servlet, Filter, Listener**입니다. 이 세 가지를 정확히 이해해야 DispatcherServlet과 Spring MVC의 동작 방식을 제대로 이해할 수 있습니다.

## 웹 컨테이너가 하는 일

웹 컨테이너(Servlet Container)는 HTTP 요청을 받아 자바 애플리케이션에 전달하고 응답을 돌려주는 런타임 환경입니다. Tomcat, Jetty, Undertow가 대표적입니다. 컨테이너는 세 가지 주요 메커니즘으로 요청을 처리합니다.

| 구성 요소 | 인터페이스 | 역할 |
|-----------|-----------|------|
| Servlet | `jakarta.servlet.Servlet` | HTTP 요청의 최종 처리자 |
| Filter | `jakarta.servlet.Filter` | 요청·응답을 인터셉트해 전/후 처리 |
| Listener | `jakarta.servlet.EventListener` | 컨테이너 이벤트 수신 |

![Servlet · Filter · Listener 아키텍처](/assets/posts/spring-servlet-filter-listener-architecture.svg)

## Servlet: 요청의 최종 처리자

Servlet은 HTTP 요청을 받아 비즈니스 로직을 실행하고 응답을 생성하는 자바 클래스입니다. `HttpServlet`을 상속하고 메서드를 오버라이드하는 것이 기본 패턴입니다.

```java
@WebServlet(urlPatterns = "/hello")
public class HelloServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req,
                         HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("text/plain; charset=UTF-8");
        resp.getWriter().write("안녕하세요!");
    }
}
```

Servlet의 생명주기는 컨테이너가 완전히 관리합니다.

1. **init()** — 컨테이너 시작 시 최초 1회 호출. DB 커넥션 등 무거운 초기화를 여기서 수행합니다.
2. **service()** — 요청마다 호출됩니다. HTTP 메서드에 따라 doGet/doPost 등으로 분기합니다.
3. **destroy()** — 컨테이너 종료 시 호출. 자원 해제를 수행합니다.

Spring MVC에서는 `DispatcherServlet`이 이 `HttpServlet`을 상속합니다. 따라서 모든 웹 요청은 결국 Servlet 스펙을 따릅니다.

### Servlet과 스레드 안전성

Servlet 인스턴스는 컨테이너당 보통 **1개**만 생성되고, 요청마다 다른 스레드가 `service()` 메서드를 호출합니다. 따라서 Servlet에 인스턴스 변수를 두면 스레드 안전 문제가 발생합니다.

```java
// 위험 — 멀티스레드 환경에서 경쟁 조건 발생
public class UnsafeServlet extends HttpServlet {
    private int count = 0;          // ❌ 인스턴스 변수

    @Override
    protected void doGet(HttpServletRequest req,
                         HttpServletResponse resp) {
        count++;                    // ❌ 비원자적 연산
    }
}

// 안전 — 메서드 로컬 변수 또는 AtomicInteger 사용
public class SafeServlet extends HttpServlet {
    private final AtomicInteger count = new AtomicInteger(0); // ✅

    @Override
    protected void doGet(HttpServletRequest req,
                         HttpServletResponse resp) {
        int current = count.incrementAndGet();                 // ✅
    }
}
```

## Filter: 요청·응답의 중간 처리자

Filter는 Servlet에 요청이 도달하기 전과 응답이 클라이언트에 전달되기 전에 끼어들어 처리할 수 있는 컴포넌트입니다. 여러 Filter가 체인 형태로 연결됩니다.

### Filter의 핵심 메서드

```java
public interface Filter {
    // 컨테이너 시작 시 1회
    default void init(FilterConfig cfg) throws ServletException {}

    // 매 요청마다 호출
    void doFilter(ServletRequest req,
                  ServletResponse res,
                  FilterChain chain)
            throws IOException, ServletException;

    // 컨테이너 종료 시
    default void destroy() {}
}
```

`chain.doFilter(req, res)` 호출 이전이 **요청 전 처리**, 호출 이후가 **응답 후 처리**입니다. `chain.doFilter()`를 호출하지 않으면 다음 Filter나 Servlet으로 요청이 전달되지 않습니다. 이 성질을 이용해 인증 실패 시 요청을 차단할 수 있습니다.

![Filter 구현과 Listener 등록 패턴](/assets/posts/spring-servlet-filter-listener-filterchain.svg)

### Filter 실전 구현: 인증 필터

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtProvider jwtProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {
        String token = extractBearerToken(request);
        if (token != null && jwtProvider.validate(token)) {
            Authentication auth = jwtProvider.getAuthentication(token);
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        filterChain.doFilter(request, response);
    }

    private String extractBearerToken(HttpServletRequest req) {
        String header = req.getHeader(HttpHeaders.AUTHORIZATION);
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
```

Spring Security에서 제공하는 `OncePerRequestFilter`는 포워드·인클루드 시에도 한 번만 실행되는 것을 보장합니다.

### Spring Boot에서 Filter 순서 제어

Spring Boot에서 Filter의 실행 순서를 제어하는 방법은 세 가지입니다.

```java
// 방법 1: @Order (가장 간단)
@Component
@Order(1)
public class FirstFilter implements Filter { ... }

// 방법 2: FilterRegistrationBean (URL 패턴도 지정 가능)
@Bean
public FilterRegistrationBean<LoggingFilter> loggingFilter() {
    FilterRegistrationBean<LoggingFilter> reg =
            new FilterRegistrationBean<>(new LoggingFilter());
    reg.setOrder(2);
    reg.addUrlPatterns("/api/*");
    return reg;
}

// 방법 3: web.xml (전통적 방법, 레거시)
// <filter> ... <filter-mapping> ... 순서에 따라 실행
```

숫자가 낮을수록 먼저 실행되며, Spring Security의 기본 순서는 `-100`입니다.

## Listener: 이벤트 기반 훅

Listener는 컨테이너의 생명주기 이벤트를 구독하는 컴포넌트입니다. 요청 흐름 밖에서 동작한다는 점에서 Filter와 근본적으로 다릅니다.

### 주요 Listener 인터페이스

| Listener | 이벤트 | 활용 사례 |
|---------|--------|----------|
| `ServletContextListener` | 앱 시작/종료 | 초기화 로직, 자원 해제 |
| `HttpSessionListener` | 세션 생성/소멸 | 동시 접속자 수 추적 |
| `ServletRequestListener` | 요청 시작/종료 | 요청 단위 MDC 초기화 |
| `HttpSessionAttributeListener` | 세션 속성 변경 | 감사 로그 |

### 실전: 동시 접속자 수 추적

```java
@WebListener
public class SessionCountListener
        implements HttpSessionListener {

    private static final AtomicInteger count = new AtomicInteger(0);

    @Override
    public void sessionCreated(HttpSessionEvent se) {
        int current = count.incrementAndGet();
        log.info("세션 생성 — 현재 접속자: {}", current);
    }

    @Override
    public void sessionDestroyed(HttpSessionEvent se) {
        int current = count.decrementAndGet();
        log.info("세션 소멸 — 현재 접속자: {}", current);
    }

    public static int getCurrentCount() {
        return count.get();
    }
}
```

Spring Boot에서는 `@WebListener`와 함께 메인 클래스에 `@ServletComponentScan`을 추가하거나, `@Bean`으로 직접 등록하면 됩니다.

```java
// Spring Boot 빈 등록 방식 (ServletComponentScan 불필요)
@Bean
public HttpSessionListener sessionCountListener() {
    return new SessionCountListener();
}
```

## Filter vs AOP: 선택 기준

Filter와 Spring AOP는 모두 횡단 관심사를 처리하지만 동작 레이어가 다릅니다.

```
HTTP Request
    │
    ▼
Filter Chain ← Servlet 스펙 레이어 (URL 기준, Spring 컨텍스트 외부)
    │
    ▼
DispatcherServlet
    │
    ▼
Interceptor   ← Spring MVC 레이어 (Handler 기준, Spring 컨텍스트 내)
    │
    ▼
AOP Proxy     ← Spring 빈 레이어 (메서드 기준, Spring 빈만 대상)
    │
    ▼
@Controller Method
```

| 비교 | Filter | AOP |
|------|--------|-----|
| 적용 대상 | 모든 URL | Spring 빈의 메서드 |
| Spring 컨텍스트 | 접근 제한 | 완전 접근 |
| 주요 용도 | 인코딩, CORS, 보안 헤더 | 트랜잭션, 캐싱, 로깅 |
| 요청 차단 | `chain.doFilter()` 미호출 | 예외 발생 |

인증·인가처럼 Spring Security가 관여하는 경우, 보안 설정은 Filter 레이어에서 처리하는 것이 올바른 설계입니다. 비즈니스 로직의 횡단 관심사는 AOP로 처리합니다.

## 정리

- **Servlet**은 HTTP 요청의 최종 처리자. Spring MVC의 `DispatcherServlet`이 이를 상속합니다.
- **Filter**는 Servlet 앞뒤에서 동작하는 체인 구조의 미들웨어. `chain.doFilter()` 호출 전후로 요청·응답을 조작합니다.
- **Listener**는 컨테이너 이벤트를 구독해 초기화·정리 작업을 담당합니다. 요청 흐름 밖에서 동작합니다.
- Spring Boot에서는 `@Component + @Order`, `FilterRegistrationBean`, `@WebListener + @Bean` 등 다양한 방법으로 등록합니다.
- Filter는 URL 레이어, AOP는 빈 메서드 레이어에서 동작하므로 목적에 맞게 선택합니다.

---

**지난 글:** [Spring AOP 실전 활용 사례: 로깅·트랜잭션·캐싱·보안을 AOP로 분리하기](/posts/spring-aop-usecases/)

**다음 글:** [DispatcherServlet 완전 분석: Spring MVC 요청 처리 흐름의 시작](/posts/spring-dispatcher-servlet/)

<br>
읽어주셔서 감사합니다. 😊
