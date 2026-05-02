---
title: "DispatcherServlet 완전 분석: Spring MVC 요청 처리 흐름의 시작"
description: "Spring MVC의 핵심인 DispatcherServlet이 HTTP 요청을 받아 어떻게 HandlerMapping, HandlerAdapter, ViewResolver를 거쳐 응답을 생성하는지 단계별로 분석합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "DispatcherServlet", "Spring MVC", "HandlerMapping", "HandlerAdapter", "ViewResolver", "Front Controller"]
featured: false
draft: false
---

[지난 글](/posts/spring-servlet-filter-listener/)에서 Servlet, Filter, Listener가 웹 컨테이너에서 어떻게 동작하는지 살펴봤습니다. Spring MVC는 이 Servlet 스펙 위에 **DispatcherServlet**이라는 하나의 중앙 컨트롤러를 두고 모든 요청을 처리합니다. 이번 글에서는 DispatcherServlet이 어떤 전략으로 요청을 처리하고, 어떤 특수 빈들과 협력하는지 단계별로 파헤칩니다.

## Front Controller 패턴이란

전통적인 서블릿 기반 웹 개발에서는 URL마다 별도의 Servlet을 등록해야 했습니다. `/login`이면 `LoginServlet`, `/product/list`면 `ProductListServlet`처럼 Servlet이 폭발적으로 늘어납니다. **Front Controller 패턴**은 이를 해결하기 위해 하나의 진입점(DispatcherServlet)이 모든 요청을 받아 적절한 핸들러에 위임하는 구조입니다.

```
전통 방식:
/login    → LoginServlet
/product  → ProductServlet   ← Servlet 수만큼 등록 필요
/order    → OrderServlet

Front Controller 방식:
/*        → DispatcherServlet → (내부 라우팅) → @Controller
```

Spring MVC는 `DispatcherServlet`이 `/*` 또는 `/`에 매핑되어 모든 요청을 받고, 내부적으로 `HandlerMapping`을 통해 어느 `@Controller` 메서드를 호출할지 결정합니다.

## DispatcherServlet의 요청 처리 10단계

![DispatcherServlet 요청 처리 흐름](/assets/posts/spring-dispatcher-servlet-flow.svg)

DispatcherServlet이 요청을 처리하는 핵심 메서드는 `doDispatch()`입니다. 소스코드를 간략화하면 다음과 같습니다.

```java
protected void doDispatch(HttpServletRequest request,
                           HttpServletResponse response) throws Exception {
    // ① HandlerMapping으로 핸들러 탐색
    HandlerExecutionChain mappedHandler =
            getHandler(processedRequest);

    // ② 핸들러에 맞는 어댑터 선택
    HandlerAdapter ha = getHandlerAdapter(mappedHandler.getHandler());

    // ③ Interceptor preHandle
    if (!mappedHandler.applyPreHandle(processedRequest, response)) {
        return;
    }

    // ④ 실제 핸들러 실행 → ModelAndView 반환
    ModelAndView mv = ha.handle(processedRequest, response,
                                mappedHandler.getHandler());

    // ⑤ Interceptor postHandle
    mappedHandler.applyPostHandle(processedRequest, response, mv);

    // ⑥ ViewResolver → View → 렌더링
    processDispatchResult(processedRequest, response,
                          mappedHandler, mv, dispatchException);
}
```

`@RestController`를 사용하면 `ha.handle()` 내부에서 `HttpMessageConverter`가 반환값을 직렬화하고 응답에 직접 쓰기 때문에 ⑥의 ViewResolver 단계가 생략됩니다.

## 단계별 분석

### ① HandlerMapping — URL → Handler 탐색

`HandlerMapping`은 요청 URL, HTTP 메서드, 헤더 조건 등을 보고 처리할 핸들러(보통 `@Controller` 메서드)를 찾습니다. 기본 등록되는 구현체는 다음 두 가지입니다.

```java
// RequestMappingHandlerMapping: @RequestMapping 어노테이션 기반
// BeanNameUrlHandlerMapping: 빈 이름이 URL인 경우 (/foo → "foo" 빈)
```

탐색 결과로 `HandlerExecutionChain`이 반환됩니다. 이 체인에는 핸들러 자체뿐 아니라 해당 요청에 적용할 `HandlerInterceptor` 목록도 포함됩니다.

### ② HandlerAdapter — 핸들러 추상화

`HandlerAdapter`는 핸들러의 타입에 상관없이 DispatcherServlet이 통일된 방식으로 실행하도록 하는 어댑터입니다.

| 핸들러 타입 | 어댑터 |
|-------------|--------|
| `@Controller` 메서드 | `RequestMappingHandlerAdapter` |
| `HttpRequestHandler` 구현체 | `HttpRequestHandlerAdapter` |
| `Controller` 인터페이스 구현체 | `SimpleControllerHandlerAdapter` |

`RequestMappingHandlerAdapter`는 메서드 파라미터 바인딩(`@RequestParam`, `@PathVariable` 등)과 반환값 처리(`@ResponseBody`, `ModelAndView` 등)를 담당합니다.

### ③④ Interceptor — preHandle / postHandle

`HandlerInterceptor`는 Filter와 유사하지만 Spring MVC 컨텍스트 안에서 동작합니다.

```java
public class LoginCheckInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request,
                              HttpServletResponse response,
                              Object handler) {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("loginUser") == null) {
            response.sendRedirect("/login");
            return false;           // false → 이후 처리 중단
        }
        return true;
    }

    @Override
    public void postHandle(HttpServletRequest request,
                            HttpServletResponse response,
                            Object handler,
                            ModelAndView modelAndView) {
        // 뷰 렌더링 전 마지막 ModelAndView 조작 가능
    }

    @Override
    public void afterCompletion(HttpServletRequest request,
                                 HttpServletResponse response,
                                 Object handler, Exception ex) {
        // 렌더링 완료 후 항상 실행 — 로깅, 자원 정리
    }
}
```

Interceptor 등록은 `WebMvcConfigurer.addInterceptors()`에서 합니다.

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new LoginCheckInterceptor())
                .addPathPatterns("/**")
                .excludePathPatterns("/login", "/css/**", "/js/**");
    }
}
```

### ⑤ ViewResolver — 논리 뷰 이름 해석

`@Controller`가 반환하는 문자열(`"home"`)은 논리 뷰 이름입니다. `ViewResolver`가 이를 실제 뷰 파일 경로로 변환합니다.

```java
// application.properties
spring.thymeleaf.prefix=classpath:/templates/
spring.thymeleaf.suffix=.html

// "home" → classpath:/templates/home.html
```

`@RestController`의 경우 `StringHttpMessageConverter`, `MappingJackson2HttpMessageConverter` 등이 반환값을 HTTP 응답 바디로 변환합니다. 이 변환기들은 `RequestMappingHandlerAdapter`에 등록됩니다.

## DispatcherServlet 특수 빈 목록

![Spring MVC Java Config 핵심 설정](/assets/posts/spring-dispatcher-servlet-config.svg)

Spring Boot는 `DispatcherServletAutoConfiguration`과 `WebMvcAutoConfiguration`이 이 특수 빈들을 자동으로 설정해 줍니다. 필요한 경우에만 `WebMvcConfigurer`를 구현해 커스터마이징합니다.

## DispatcherServlet 초기화 과정

DispatcherServlet은 Servlet이므로 컨테이너가 `init()`을 호출할 때 초기화됩니다.

```java
// DispatcherServlet 초기화 순서 (단순화)
protected void initStrategies(ApplicationContext context) {
    initMultipartResolver(context);         // 파일 업로드
    initLocaleResolver(context);            // 국제화
    initThemeResolver(context);             // 테마
    initHandlerMappings(context);           // 핸들러 매핑
    initHandlerAdapters(context);           // 핸들러 어댑터
    initHandlerExceptionResolvers(context); // 예외 처리
    initRequestToViewNameTranslator(context);
    initViewResolvers(context);             // 뷰 해석
    initFlashMapManager(context);           // 리다이렉트 데이터
}
```

Spring Boot에서 `spring.mvc.servlet.load-on-startup=1`로 설정하면 서버 시작 시 즉시 초기화됩니다. 기본값은 첫 요청 시 지연 초기화입니다.

## Spring Boot에서의 DispatcherServlet

Spring Boot는 `spring-boot-starter-web` 의존성만 추가하면 다음이 자동으로 이루어집니다.

```java
// 자동으로 등록되는 빈 (직접 작성 불필요)
@Bean
public DispatcherServlet dispatcherServlet() {
    return new DispatcherServlet(applicationContext);
}

@Bean
public ServletRegistrationBean<DispatcherServlet> dispatcherServletRegistration() {
    ServletRegistrationBean<DispatcherServlet> reg =
            new ServletRegistrationBean<>(dispatcherServlet(), "/");
    reg.setName("dispatcherServlet");
    reg.setLoadOnStartup(1);
    return reg;
}
```

커스텀 설정이 필요하면 `WebMvcConfigurer`를 구현합니다. `@EnableWebMvc`는 Boot의 자동 설정을 덮어쓰므로 Boot 환경에서는 사용하지 않는 것이 원칙입니다.

## 예외 처리: HandlerExceptionResolver

`doDispatch()` 실행 중 예외가 발생하면 DispatcherServlet은 등록된 `HandlerExceptionResolver`를 순서대로 시도합니다.

```java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EntityNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(EntityNotFoundException ex) {
        return ErrorResponse.of("NOT_FOUND", ex.getMessage());
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ErrorResponse handleGeneral(Exception ex) {
        log.error("처리되지 않은 예외", ex);
        return ErrorResponse.of("INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
}
```

`@ControllerAdvice`는 내부적으로 `ExceptionHandlerExceptionResolver`를 통해 동작합니다. `ResponseEntityExceptionHandler`를 상속하면 Spring MVC의 기본 예외들도 처리할 수 있습니다.

## 핵심 정리

- **DispatcherServlet**은 Front Controller 패턴의 구현체로, 모든 HTTP 요청의 단일 진입점입니다.
- 요청 처리는 HandlerMapping → (Interceptor preHandle) → HandlerAdapter → Handler → (Interceptor postHandle) → ViewResolver 순입니다.
- `@RestController`는 ViewResolver를 거치지 않고 `HttpMessageConverter`가 직접 응답을 직렬화합니다.
- `HandlerInterceptor`는 스프링 컨텍스트 안에서 동작하며 Filter보다 세밀한 제어가 가능합니다.
- Spring Boot는 `DispatcherServletAutoConfiguration`으로 설정을 자동화합니다.

---

**지난 글:** [Servlet · Filter · Listener 완전 정복: 웹 컨테이너 3요소의 역할과 실전 활용](/posts/spring-servlet-filter-listener/)

**다음 글:** [HandlerMapping과 HandlerAdapter 심화: 요청이 컨트롤러를 찾는 방법](/posts/spring-handler-mapping-adapter/)

<br>
읽어주셔서 감사합니다. 😊
