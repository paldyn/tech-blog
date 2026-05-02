---
title: "HandlerMapping과 HandlerAdapter 심화: 요청이 컨트롤러를 찾는 방법"
description: "DispatcherServlet이 HTTP 요청을 처리할 때 HandlerMapping으로 핸들러를 탐색하고 HandlerAdapter로 실행을 위임하는 과정을 내부 구현과 함께 상세히 분석합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "HandlerMapping", "HandlerAdapter", "RequestMappingHandlerMapping", "ArgumentResolver", "ReturnValueHandler", "Spring MVC"]
featured: false
draft: false
---

[지난 글](/posts/spring-dispatcher-servlet/)에서 DispatcherServlet이 10단계로 요청을 처리하는 흐름을 살펴봤습니다. 이번 글에서는 그 흐름의 핵심인 **HandlerMapping**과 **HandlerAdapter**를 내부 구현까지 파고들어 분석합니다. 이 두 컴포넌트를 정확히 이해하면 URL 매핑 충돌, 파라미터 바인딩 오류, 커스텀 어노테이션 주입 등의 문제를 정확히 진단하고 해결할 수 있습니다.

## HandlerMapping: URL에서 Handler까지

`HandlerMapping`의 책임은 단 하나입니다. 들어온 HTTP 요청을 처리할 수 있는 핸들러를 찾아서 `HandlerExecutionChain`으로 감싸 반환하는 것입니다.

```java
public interface HandlerMapping {
    // null이면 "이 HandlerMapping은 처리할 수 없음"
    HandlerExecutionChain getHandler(HttpServletRequest request)
            throws Exception;
}
```

DispatcherServlet은 등록된 `HandlerMapping` 구현체를 `Order` 순서대로 순회하며 `null`이 아닌 결과를 반환하는 첫 번째 구현체를 사용합니다.

### RequestMappingHandlerMapping

`@RequestMapping` 계열 어노테이션을 처리하는 기본 구현체입니다. 애플리케이션 시작 시 `@Controller` 빈을 모두 스캔해 메서드와 매핑 조건을 `MappingRegistry`에 등록합니다.

```java
// 내부적으로 이런 구조로 관리됩니다 (단순화)
class MappingRegistry {
    Map<RequestMappingInfo, HandlerMethod> mappingLookup;
    // RequestMappingInfo: URL + HTTP 메서드 + 파라미터 조건 + ...
    // HandlerMethod: 빈 참조 + java.lang.reflect.Method
}
```

요청이 들어오면 URL 패턴 매칭 → HTTP 메서드 확인 → 기타 조건(`params`, `headers`, `consumes`, `produces`) 확인 순으로 후보를 좁힙니다. 최종 후보가 여러 개면 가장 구체적인 패턴이 선택됩니다(`/api/users/123`이 `/api/users/*`보다 우선).

### HandlerExecutionChain 구조

```java
public class HandlerExecutionChain {
    private final Object handler;                  // @Controller 메서드
    private List<HandlerInterceptor> interceptorList;  // 적용할 인터셉터들

    // 인터셉터 preHandle을 순서대로 실행
    boolean applyPreHandle(HttpServletRequest request,
                           HttpServletResponse response) throws Exception;

    // 인터셉터 postHandle을 역순으로 실행
    void applyPostHandle(HttpServletRequest request,
                         HttpServletResponse response,
                         ModelAndView mv) throws Exception;

    // 인터셉터 afterCompletion을 역순으로 실행
    void triggerAfterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Exception ex) throws Exception;
}
```

인터셉터의 `postHandle`과 `afterCompletion`이 역순으로 실행되는 이유는 스택 구조 때문입니다. Filter의 `chain.doFilter()` 후 처리가 역순인 것과 같은 원리입니다.

## HandlerAdapter: 핸들러 실행 추상화

`HandlerAdapter`는 다양한 타입의 핸들러를 DispatcherServlet이 통일된 방식으로 호출할 수 있게 하는 어댑터 패턴 구현입니다.

```java
public interface HandlerAdapter {
    // 이 어댑터가 해당 핸들러를 처리할 수 있는가?
    boolean supports(Object handler);

    // 핸들러를 실행하고 ModelAndView를 반환 (null 가능)
    ModelAndView handle(HttpServletRequest request,
                        HttpServletResponse response,
                        Object handler) throws Exception;
}
```

![HandlerMapping · HandlerAdapter 동작 원리](/assets/posts/spring-handler-mapping-adapter-flow.svg)

### RequestMappingHandlerAdapter 내부 구조

`@Controller` 메서드를 처리하는 `RequestMappingHandlerAdapter`는 두 핵심 하위 컴포넌트를 가집니다.

#### HandlerMethodArgumentResolver — 파라미터 바인딩

메서드 파라미터를 HTTP 요청에서 추출하는 역할입니다. Spring은 30개 이상의 기본 구현체를 제공합니다.

| 어노테이션/타입 | 처리하는 Resolver |
|----------------|-------------------|
| `@RequestParam` | `RequestParamMethodArgumentResolver` |
| `@PathVariable` | `PathVariableMethodArgumentResolver` |
| `@RequestBody` | `RequestResponseBodyMethodProcessor` |
| `HttpServletRequest` | `ServletRequestMethodArgumentResolver` |
| `@ModelAttribute` | `ModelAttributeMethodProcessor` |
| `@RequestHeader` | `RequestHeaderMethodArgumentResolver` |
| `Principal` | `PrincipalMethodArgumentResolver` |

`HandlerMethodArgumentResolver`의 `supportsParameter()`가 `true`를 반환하는 첫 번째 Resolver가 선택됩니다. 파라미터 타입과 어노테이션 조합으로 결정합니다.

#### HandlerMethodReturnValueHandler — 반환값 처리

메서드 반환값을 HTTP 응답으로 변환합니다.

```java
// @ResponseBody 또는 @RestController인 경우:
// RequestResponseBodyMethodProcessor → HttpMessageConverter → 응답 바디
// String 반환인 경우:
// ViewNameMethodReturnValueHandler → ViewResolver → View 렌더링
// ResponseEntity 반환인 경우:
// HttpEntityMethodProcessor → 상태코드 + 헤더 + 바디 처리
```

## 커스텀 ArgumentResolver 구현

`@LoginUser`라는 커스텀 어노테이션으로 세션의 로그인 사용자를 자동 주입하는 패턴은 실무에서 매우 자주 쓰입니다.

```java
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface LoginUser {}
```

```java
@Component
public class LoginUserArgumentResolver
        implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(LoginUser.class)
            && parameter.getParameterType().equals(UserSession.class);
    }

    @Override
    public Object resolveArgument(MethodParameter parameter,
                                   ModelAndViewContainer mavContainer,
                                   NativeWebRequest webRequest,
                                   WebDataBinderFactory binderFactory) {
        HttpSession session = webRequest
                .getNativeRequest(HttpServletRequest.class)
                .getSession(false);
        if (session == null) return null;
        return (UserSession) session.getAttribute("loginUser");
    }
}
```

Resolver를 등록합니다.

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final LoginUserArgumentResolver loginUserArgumentResolver;

    @Override
    public void addArgumentResolvers(
            List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(loginUserArgumentResolver);
    }
}
```

등록 후 컨트롤러에서 바로 사용할 수 있습니다.

```java
@GetMapping("/my-profile")
public ResponseEntity<UserProfile> myProfile(
        @LoginUser UserSession loginUser) {     // 자동 주입
    return ResponseEntity.ok(
            userService.getProfile(loginUser.getUserId()));
}
```

![커스텀 HandlerMapping / Adapter 등록](/assets/posts/spring-handler-mapping-adapter-types.svg)

## HandlerMapping 우선순위 제어

여러 HandlerMapping이 같은 URL을 처리할 수 있을 때 `Order`로 우선순위를 결정합니다.

```java
// RequestMappingHandlerMapping 기본 Order: 0
// BeanNameUrlHandlerMapping 기본 Order: 2
// SimpleUrlHandlerMapping: setOrder()로 수동 지정

@Bean
public SimpleUrlHandlerMapping resourceHandlerMapping() {
    SimpleUrlHandlerMapping mapping = new SimpleUrlHandlerMapping();
    mapping.setOrder(Integer.MAX_VALUE - 1);   // 거의 마지막에 처리
    Map<String, Object> urlMap = new HashMap<>();
    urlMap.put("/health", healthCheckHandler());
    mapping.setUrlMap(urlMap);
    return mapping;
}
```

낮은 Order 값이 먼저 적용됩니다. Spring의 `Ordered.HIGHEST_PRECEDENCE`는 `Integer.MIN_VALUE`, `LOWEST_PRECEDENCE`는 `Integer.MAX_VALUE`입니다.

## 매핑 충돌과 디버깅

매핑 충돌은 같은 URL 패턴에 여러 메서드가 매핑될 때 발생합니다.

```java
// 런타임 오류: Ambiguous mapping. Cannot map...
@GetMapping("/api/users/{id}")
public User getUserById(@PathVariable Long id) { ... }

@GetMapping("/api/users/{username}")
public User getUserByName(@PathVariable String username) { ... }
```

Spring은 변수명이 다르더라도 패턴이 동일하면 `Ambiguous mapping` 오류를 발생시킵니다. `@PathVariable` 타입이 달라도 마찬가지입니다.

매핑 상태를 확인할 때는 Actuator를 활용합니다.

```bash
# 등록된 모든 매핑 조회 (Spring Boot Actuator)
GET /actuator/mappings

# 응답 예시
{
  "handler": "com.example.UserController#getUserById(Long)",
  "predicate": "{GET [/api/users/{id}]}"
}
```

로그 레벨을 변경해 HandlerMapping 동작을 추적할 수도 있습니다.

```yaml
# application.yml
logging:
  level:
    org.springframework.web.servlet.DispatcherServlet: TRACE
    org.springframework.web.servlet.handler: TRACE
```

## 성능: RequestMappingInfo 캐싱

`RequestMappingHandlerMapping`은 시작 시 모든 매핑 정보를 메모리에 적재하고, 요청이 들어올 때는 빠른 룩업만 수행합니다. 런타임에 새 매핑을 추가하는 것은 기본적으로 불가능하며, 동적 매핑이 필요하면 `RequestMappingHandlerMapping`을 빈으로 직접 주입받아 `registerMapping()`을 호출할 수 있습니다.

```java
@RestController
public class DynamicMappingController {

    @Autowired
    private RequestMappingHandlerMapping handlerMapping;

    public void registerDynamic(String pattern, HandlerMethod method) {
        RequestMappingInfo info = RequestMappingInfo
                .paths(pattern)
                .methods(RequestMethod.GET)
                .build();
        handlerMapping.registerMapping(info, method.getBean(), method.getMethod());
    }
}
```

## 핵심 정리

- `HandlerMapping`은 요청 URL + 조건으로 핸들러를 탐색하고 `HandlerExecutionChain`을 반환합니다. 여러 구현체가 Order 순으로 순회됩니다.
- `HandlerAdapter`는 핸들러 타입에 상관없이 DispatcherServlet이 통일된 인터페이스로 실행하게 합니다.
- `RequestMappingHandlerAdapter`는 내부에 `ArgumentResolver`와 `ReturnValueHandler`를 조합해 파라미터 바인딩과 응답 변환을 처리합니다.
- `HandlerMethodArgumentResolver`를 구현하면 `@LoginUser`처럼 커스텀 어노테이션으로 파라미터를 자동 주입할 수 있습니다.
- 매핑 충돌은 URL 패턴이 완전히 동일한 경우 발생하며 Actuator `/actuator/mappings`로 현황을 확인합니다.

---

**지난 글:** [DispatcherServlet 완전 분석: Spring MVC 요청 처리 흐름의 시작](/posts/spring-dispatcher-servlet/)

**다음 글:** [@Controller와 @RequestMapping 완전 정복: URL 매핑 전략 총정리](/posts/spring-controller-requestmapping/)

<br>
읽어주셔서 감사합니다. 😊
