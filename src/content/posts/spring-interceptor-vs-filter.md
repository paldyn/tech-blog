---
title: "Spring 인터셉터 vs 서블릿 필터: 차이점과 실전 활용 가이드"
description: "서블릿 필터와 Spring HandlerInterceptor의 실행 시점·접근 범위 차이를 명확히 정리하고, 인터셉터 구현(preHandle·postHandle·afterCompletion), WebMvcConfigurer를 통한 등록 방법, 실전 활용 패턴(인증 체크, 요청 로깅, MDC 설정)을 코드 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "HandlerInterceptor", "Filter", "WebMvcConfigurer", "preHandle", "postHandle", "afterCompletion", "서블릿필터", "인터셉터"]
featured: false
draft: false
---

[지난 글](/posts/spring-exception-handler/)에서 `@ExceptionHandler`와 `@RestControllerAdvice`로 예외를 전역 처리하는 방법을 살펴봤습니다. 이번에는 요청이 컨트롤러에 도달하기 *전후*로 공통 로직을 끼워 넣는 두 가지 메커니즘—서블릿 필터와 Spring 인터셉터—의 차이와 올바른 선택 기준을 정리합니다.

## 두 메커니즘의 실행 위치

![Servlet Filter vs Spring Interceptor 처리 흐름](/assets/posts/spring-interceptor-vs-filter-flow.svg)

위 다이어그램에서 확인할 수 있듯이 두 메커니즘은 실행 위치가 근본적으로 다릅니다.

- **서블릿 필터(Filter)**: 서블릿 컨테이너(Tomcat 등)가 관리. `DispatcherServlet` 앞에서 실행되므로 Spring Context와 완전히 독립적입니다.
- **Spring Interceptor**: `DispatcherServlet` 내부에서 실행. Spring의 `ApplicationContext`에 접근할 수 있고, 핸들러(컨트롤러) 정보도 받을 수 있습니다.

## 서블릿 필터(javax/jakarta.servlet.Filter)

필터는 `javax.servlet.Filter`(Jakarta EE에서는 `jakarta.servlet.Filter`) 인터페이스를 구현합니다.

```java
@WebFilter(urlPatterns = "/api/*")
public class RequestLoggingFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request,
                         ServletResponse response,
                         FilterChain chain) throws IOException, ServletException {
        HttpServletRequest httpReq = (HttpServletRequest) request;
        long start = System.currentTimeMillis();

        // 진입부: 요청 처리 전 로직
        log.info("[FILTER] {} {}", httpReq.getMethod(), httpReq.getRequestURI());

        chain.doFilter(request, response); // 다음 필터 또는 서블릿으로 위임

        // 반환부: 응답이 완성된 후 로직
        long elapsed = System.currentTimeMillis() - start;
        log.info("[FILTER] 응답 완료 {}ms", elapsed);
    }
}
```

Spring Boot에서 필터를 등록하는 더 권장되는 방법은 `FilterRegistrationBean`입니다.

```java
@Bean
public FilterRegistrationBean<RequestLoggingFilter> loggingFilter() {
    FilterRegistrationBean<RequestLoggingFilter> bean =
            new FilterRegistrationBean<>(new RequestLoggingFilter());
    bean.addUrlPatterns("/api/*");
    bean.setOrder(1);
    return bean;
}
```

`@WebFilter`는 `@ServletComponentScan`이 있어야 동작하고, `FilterRegistrationBean`은 `@Configuration` 클래스에서 바로 등록할 수 있어 더 유연합니다.

Spring의 `OncePerRequestFilter`를 상속하면 포워드나 인클루드 시 중복 실행을 방지하면서 Spring Bean 주입도 받을 수 있습니다.

```java
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {
        String token = resolveToken(request);
        if (token != null && tokenProvider.validate(token)) {
            Authentication auth = tokenProvider.getAuthentication(token);
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String bearer = request.getHeader("Authorization");
        if (bearer != null && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        return null;
    }
}
```

## Spring HandlerInterceptor

`HandlerInterceptor` 인터페이스는 세 가지 콜백을 제공합니다.

| 메서드 | 호출 시점 | 반환값 |
|---|---|---|
| `preHandle()` | 핸들러 실행 직전 | `false` 반환 시 이하 처리 중단 |
| `postHandle()` | 핸들러 실행 직후(뷰 렌더링 전) | - |
| `afterCompletion()` | 응답 완료 후(뷰 렌더링 포함) | - |

REST API에서는 뷰 렌더링이 없으므로 `postHandle`과 `afterCompletion`의 타이밍 차이가 거의 없습니다. `afterCompletion`은 `preHandle`이 `true`를 반환한 인터셉터에 대해서만 호출되며, 예외가 발생해도 항상 실행되는 점에서 리소스 정리에 적합합니다.

### 인터셉터 구현과 등록

![HandlerInterceptor 구현 및 등록](/assets/posts/spring-interceptor-vs-filter-code.svg)

```java
@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Autowired
    private TokenService tokenService;

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {
        // handler가 HandlerMethod가 아닌 경우(정적 리소스 등) 통과
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }

        HandlerMethod hm = (HandlerMethod) handler;
        // @NoAuth 어노테이션이 있으면 인증 생략
        if (hm.hasMethodAnnotation(NoAuth.class)) {
            return true;
        }

        String token = extractToken(request);
        if (token == null || !tokenService.isValid(token)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"인증이 필요합니다\"}");
            return false;
        }

        // 인증된 사용자 정보를 요청 속성에 저장
        request.setAttribute("userId", tokenService.getUserId(token));
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler, Exception ex) {
        // MDC나 ThreadLocal 정리
        MDC.clear();
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        return (header != null && header.startsWith("Bearer "))
                ? header.substring(7) : null;
    }
}
```

인터셉터는 `WebMvcConfigurer.addInterceptors()`를 통해 등록합니다.

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Autowired
    private AuthInterceptor authInterceptor;

    @Autowired
    private LoggingInterceptor loggingInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 로깅 인터셉터: 모든 요청 (order 낮을수록 먼저)
        registry.addInterceptor(loggingInterceptor)
                .addPathPatterns("/**")
                .order(1);

        // 인증 인터셉터: API 경로만, 로그인/회원가입 제외
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/auth/login",
                        "/api/auth/signup",
                        "/api/public/**"
                )
                .order(2);
    }
}
```

`addPathPatterns`와 `excludePathPatterns`는 PathPattern 기반 매칭을 사용합니다. `/**`는 모든 경로, `/api/**`는 `/api/`로 시작하는 모든 경로를 의미합니다.

## 인터셉터 순서와 실행 흐름

인터셉터가 여러 개일 때 실행 순서는 `order()` 값이 작을수록 먼저 `preHandle`이 호출됩니다. 반환 경로(`postHandle`, `afterCompletion`)는 반대 순서입니다.

```
preHandle(A) → preHandle(B) → Controller
             → postHandle(B) → postHandle(A)
             → afterCompletion(B) → afterCompletion(A)
```

`preHandle`이 `false`를 반환하면 해당 인터셉터보다 나중에 등록된 인터셉터들은 `preHandle`도 호출되지 않습니다. 단, 이미 `preHandle`에서 `true`를 반환한 인터셉터들의 `afterCompletion`은 호출됩니다.

## 실전 활용: MDC 기반 요청 트레이싱

여러 로그 라인에 같은 요청을 묶는 요청 ID(traceId)를 MDC에 설정하는 패턴입니다.

```java
@Component
public class MdcInterceptor implements HandlerInterceptor {

    private static final String TRACE_ID_HEADER = "X-Trace-Id";

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) {
        String traceId = Optional
                .ofNullable(request.getHeader(TRACE_ID_HEADER))
                .orElse(UUID.randomUUID().toString().substring(0, 8));

        MDC.put("traceId", traceId);
        MDC.put("method", request.getMethod());
        MDC.put("uri", request.getRequestURI());
        response.setHeader(TRACE_ID_HEADER, traceId);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler, Exception ex) {
        MDC.clear(); // 스레드 풀 재사용 시 누수 방지
    }
}
```

Logback 패턴에 `%X{traceId}`를 추가하면 로그마다 traceId가 출력되어 분산 로그 추적이 쉬워집니다.

## 필터 vs 인터셉터 선택 기준

| 비교 항목 | 서블릿 필터 | Spring 인터셉터 |
|---|---|---|
| 동작 위치 | DispatcherServlet 앞 | DispatcherServlet 내부 |
| Spring Context 접근 | 제한적 (`OncePerRequestFilter` 사용 시 가능) | 완전히 가능 |
| Handler 정보 접근 | 불가 | `HandlerMethod` 조회 가능 |
| 적용 범위 | 서블릿 전체 (정적 리소스 포함) | Spring MVC 핸들러만 |
| 요청 본문(body) 수정 | `HttpServletRequestWrapper`로 가능 | 어렵거나 불가 |
| 주요 용도 | 인코딩, CORS, 보안 필터링, 요청 본문 변환 | 인증 체크, 로깅, MDC, 권한 확인 |

**필터를 선택해야 하는 경우**
- Spring과 무관하게 동작해야 할 때 (서블릿 컨테이너 수준)
- 요청/응답 body를 읽거나 수정해야 할 때 (`ContentCachingRequestWrapper`)
- 모든 서블릿 요청(정적 리소스 포함)에 적용해야 할 때
- Spring Security의 필터 체인에 참여해야 할 때

**인터셉터를 선택해야 하는 경우**
- `@Controller`, `@RestController`에만 적용하고 싶을 때
- `HandlerMethod`를 통해 컨트롤러·메서드 어노테이션을 확인해야 할 때
- Spring Bean을 완전히 주입받아 활용해야 할 때
- 경로 패턴 매핑을 세밀하게 제어하고 싶을 때

## 정리

- 필터는 서블릿 컨테이너 수준, 인터셉터는 Spring MVC 수준에서 동작한다
- `HandlerInterceptor`는 `preHandle`(컨트롤러 전), `postHandle`(뷰 렌더링 전), `afterCompletion`(응답 완료 후) 세 개의 콜백을 제공한다
- `WebMvcConfigurer.addInterceptors()`로 경로 패턴, 제외 패턴, 실행 순서를 세밀하게 제어할 수 있다
- 인증·MDC 설정처럼 Spring Bean이 필요하고 컨트롤러 정보를 활용해야 하는 경우는 인터셉터, 요청 본문 변환이나 서블릿 전체 적용이 필요한 경우는 필터가 적합하다

---

**지난 글:** [Spring 예외 처리 완전 정복: @ExceptionHandler, @ControllerAdvice, RFC 7807](/posts/spring-exception-handler/)

**다음 글:** [Spring Boot 파일 업로드·다운로드 완전 정복: MultipartFile부터 스트리밍까지](/posts/spring-file-upload-download/)

<br>
읽어주셔서 감사합니다. 😊
