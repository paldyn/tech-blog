---
title: "@Controller와 @RequestMapping 완전 정복: URL 매핑 전략 총정리"
description: "@Controller, @RestController, @RequestMapping의 모든 속성과 매핑 전략을 예제 코드와 함께 정리하고, 클래스·메서드 레벨 매핑 조합, 파라미터 바인딩, 반환값 처리까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "Controller", "RequestMapping", "GetMapping", "PathVariable", "RequestParam", "RequestBody", "ResponseEntity", "Spring MVC"]
featured: false
draft: false
---

[지난 글](/posts/spring-handler-mapping-adapter/)에서 HandlerMapping이 URL을 탐색하고 HandlerAdapter가 실행을 위임하는 내부 구조를 살펴봤습니다. 이번 글에서는 개발자가 직접 작성하는 `@Controller`와 `@RequestMapping`의 모든 기능을 체계적으로 정리합니다. 매핑 조건부터 파라미터 바인딩, 반환값 처리까지 한 번에 짚겠습니다.

## @Controller vs @RestController

`@Controller`는 `@Component`를 포함하므로 Spring 컴포넌트 스캔 대상이 됩니다. 기본적으로 메서드 반환값을 뷰 이름으로 해석합니다.

```java
@Controller
public class PageController {

    @GetMapping("/home")
    public String home(Model model) {
        model.addAttribute("message", "안녕하세요!");
        return "home";   // → templates/home.html (Thymeleaf)
    }
}
```

`@RestController`는 `@Controller`와 `@ResponseBody`를 합친 합성 어노테이션입니다. 모든 메서드의 반환값이 `HttpMessageConverter`를 거쳐 응답 바디에 직접 쓰입니다.

```java
// @RestController = @Controller + @ResponseBody
@RestController
public class ApiController {

    @GetMapping("/api/status")
    public Map<String, String> status() {
        return Map.of("status", "ok");  // → JSON 자동 직렬화
    }
}
```

같은 컨트롤러에서 뷰와 JSON 응답을 혼용해야 하면 `@Controller`를 쓰되 특정 메서드에 `@ResponseBody`를 붙입니다.

## @RequestMapping 속성 완전 정리

![@RequestMapping 속성 완전 정리](/assets/posts/spring-controller-requestmapping-annotations.svg)

### path / value: URL 패턴

```java
@RequestMapping(path = "/api/users")       // 단일 경로
@RequestMapping(value = {"/api/users", "/api/members"})  // 복수 경로

// 경로 변수
@GetMapping("/orders/{orderId}/items/{itemId}")
public OrderItem getItem(@PathVariable Long orderId,
                          @PathVariable Long itemId) { ... }

// 와일드카드 (spring-web 6.0+: PathPatternParser 사용)
@GetMapping("/files/**")   // 0개 이상의 경로 세그먼트
@GetMapping("/doc/*.html") // 단일 세그먼트 와일드카드
```

클래스 레벨 `@RequestMapping`과 메서드 레벨이 합쳐집니다.

```java
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @GetMapping("/{id}")     // → /api/v1/users/{id}
    @PostMapping             // → /api/v1/users
    @DeleteMapping("/{id}")  // → /api/v1/users/{id}
}
```

### method: HTTP 메서드

```java
// 전통적인 방식
@RequestMapping(path = "/users", method = RequestMethod.GET)

// 단축 어노테이션 (실무 권장)
@GetMapping("/users")
@PostMapping("/users")
@PutMapping("/users/{id}")
@PatchMapping("/users/{id}")
@DeleteMapping("/users/{id}")
```

### params: 쿼리 파라미터 조건

특정 파라미터가 있거나 없을 때만 매핑합니다. API 버전 관리나 피처 플래그에 활용합니다.

```java
// type 파라미터가 premium인 요청만 처리
@GetMapping(value = "/content", params = "type=premium")
public Content premiumContent() { ... }

// debug 파라미터가 없는 요청만 처리
@GetMapping(value = "/content", params = "!debug")
public Content normalContent() { ... }
```

### headers: 요청 헤더 조건

```java
@GetMapping(value = "/api/users",
            headers = "X-API-Version=2")
public Page<UserDtoV2> listV2(Pageable pageable) { ... }
```

### consumes: 요청 Content-Type

```java
@PostMapping(value = "/upload",
             consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public String handleUpload(@RequestParam MultipartFile file) { ... }

@PostMapping(value = "/api/users",
             consumes = MediaType.APPLICATION_JSON_VALUE)
public UserDto createFromJson(@RequestBody CreateUserRequest req) { ... }
```

### produces: 응답 Accept 헤더 조건

```java
@GetMapping(value = "/report",
            produces = MediaType.APPLICATION_PDF_VALUE)
public byte[] generatePdf() { ... }

@GetMapping(value = "/report",
            produces = MediaType.APPLICATION_JSON_VALUE)
public ReportDto getReportJson() { ... }
```

같은 URL에 `produces`만 다른 두 메서드를 등록하면 클라이언트의 `Accept` 헤더에 따라 다른 메서드가 호출됩니다. 컨텐츠 협상(Content Negotiation)이라고 합니다.

## 파라미터 바인딩

![Controller 실전 코드 패턴](/assets/posts/spring-controller-requestmapping-example.svg)

### @PathVariable: 경로 변수

```java
@GetMapping("/users/{id}")
public UserDto getUser(@PathVariable Long id) { ... }

// 경로 변수 이름과 파라미터 이름이 다를 때
@GetMapping("/users/{userId}")
public UserDto getUser(@PathVariable("userId") Long id) { ... }

// 선택적 경로 변수 (Spring 6.1+)
@GetMapping({"/users", "/users/{id}"})
public UserDto getUser(@PathVariable(required = false) Long id) { ... }
```

### @RequestParam: 쿼리 파라미터

```java
// GET /search?keyword=spring&page=1&size=20
@GetMapping("/search")
public Page<Post> search(
        @RequestParam String keyword,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) { ... }

// 여러 값: /filter?tag=java&tag=spring
@GetMapping("/filter")
public List<Post> filter(
        @RequestParam List<String> tag) { ... }
```

### @RequestBody: 요청 바디

```java
@PostMapping("/users")
public ResponseEntity<UserDto> create(
        @RequestBody @Valid CreateUserRequest request) {
    UserDto created = userService.create(request);
    URI location = URI.create("/api/v1/users/" + created.getId());
    return ResponseEntity.created(location).body(created);
}
```

`@Valid`를 함께 쓰면 `CreateUserRequest`의 Bean Validation 어노테이션(`@NotNull`, `@Size` 등)이 자동으로 검증됩니다.

### @RequestHeader: 헤더 값

```java
@GetMapping("/secured")
public String secured(
        @RequestHeader("Authorization") String authHeader,
        @RequestHeader(value = "X-Client-Version",
                       required = false) String clientVersion) {
    ...
}
```

### @ModelAttribute: 폼 데이터

```java
@PostMapping("/login")
public String login(@ModelAttribute LoginForm form,
                    BindingResult result,
                    HttpSession session) {
    if (result.hasErrors()) return "login";
    session.setAttribute("user", authenticate(form));
    return "redirect:/home";
}
```

## 반환값 처리

### ResponseEntity: 상태 코드 + 헤더 + 바디

```java
@GetMapping("/users/{id}")
public ResponseEntity<UserDto> getUser(@PathVariable Long id) {
    return userService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
}

@PostMapping("/users")
public ResponseEntity<UserDto> create(@RequestBody @Valid CreateUserRequest req) {
    UserDto saved = userService.create(req);
    return ResponseEntity
            .created(URI.create("/api/v1/users/" + saved.getId()))
            .body(saved);
}

@DeleteMapping("/users/{id}")
@ResponseStatus(HttpStatus.NO_CONTENT)
public void delete(@PathVariable Long id) {
    userService.delete(id);
}
```

### @ResponseStatus: 고정 상태 코드

반환값이 없거나 항상 같은 상태 코드를 반환할 때 사용합니다. `ResponseEntity`보다 간결합니다.

```java
@PostMapping("/notify")
@ResponseStatus(HttpStatus.ACCEPTED)
public void notify(@RequestBody NotificationRequest req) {
    notificationService.sendAsync(req);
}
```

## URL 패턴 매칭 우선순위

Spring MVC는 복수의 패턴이 매칭될 때 다음 순서로 우선순위를 결정합니다.

```
1. 정확한 경로: /users/profile
2. 접두사 와일드카드: /users/{id}
3. 더블 와일드카드: /users/**
4. 기본 패턴: /**
```

패턴이 같은 수준이면 더 구체적인(변수가 적고 리터럴이 많은) 패턴이 우선합니다. `@AntPathMatcher` 대신 Spring 5.3+의 `PathPatternParser`를 사용하면 성능이 향상됩니다.

```yaml
# Spring Boot 기본값: PathPatternParser 사용
spring:
  mvc:
    pathmatch:
      matching-strategy: path-pattern-parser
```

## 실전 팁: 컨트롤러 설계 원칙

```java
// ❌ 컨트롤러에 비즈니스 로직이 있는 경우
@GetMapping("/orders/{id}/total")
public BigDecimal getTotal(@PathVariable Long id) {
    Order order = orderRepository.findById(id).orElseThrow();
    return order.getItems().stream()
            .map(i -> i.getPrice().multiply(BigDecimal.valueOf(i.getQty())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
}

// ✅ 컨트롤러는 요청 파싱과 응답 조립만
@GetMapping("/orders/{id}/total")
public ResponseEntity<OrderTotalResponse> getTotal(
        @PathVariable Long id) {
    BigDecimal total = orderService.calculateTotal(id);
    return ResponseEntity.ok(new OrderTotalResponse(id, total));
}
```

컨트롤러의 책임은 **HTTP 요청을 파싱하고, 서비스를 호출하고, 응답을 조립하는 것**에 한정합니다. 비즈니스 로직은 서비스 계층으로 위임합니다.

## 핵심 정리

- `@RestController`는 `@Controller + @ResponseBody`. 반환값이 자동으로 JSON 직렬화됩니다.
- `@RequestMapping`의 `path`, `method`, `params`, `headers`, `consumes`, `produces` 속성을 조합해 매핑 조건을 세밀하게 제어합니다.
- 실무에서는 `@GetMapping`, `@PostMapping` 등 단축 어노테이션을 사용합니다.
- 파라미터 바인딩: `@PathVariable`(경로), `@RequestParam`(쿼리), `@RequestBody`(바디), `@RequestHeader`(헤더).
- 상태 코드 제어: `ResponseEntity`(동적), `@ResponseStatus`(고정).
- 컨트롤러는 HTTP 파싱·조립 전담. 비즈니스 로직은 서비스 계층에.

---

**지난 글:** [HandlerMapping과 HandlerAdapter 심화: 요청이 컨트롤러를 찾는 방법](/posts/spring-handler-mapping-adapter/)

<br>
읽어주셔서 감사합니다. 😊
