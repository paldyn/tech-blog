---
title: "Spring MVC 파라미터 바인딩 완전 정복: @PathVariable부터 @ModelAttribute까지"
description: "@PathVariable, @RequestParam, @RequestHeader, @CookieValue, @RequestBody, @ModelAttribute, @MatrixVariable 등 Spring MVC의 모든 파라미터 바인딩 어노테이션을 상세한 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "PathVariable", "RequestParam", "RequestBody", "ModelAttribute", "RequestHeader", "CookieValue", "MatrixVariable", "파라미터바인딩", "Spring MVC"]
featured: false
draft: false
---

[지난 글](/posts/spring-restful-mapping/)에서 RESTful URI 설계 원칙과 HTTP 메서드별 매핑 어노테이션을 살펴봤습니다. 이번 글에서는 컨트롤러 메서드가 HTTP 요청의 **어느 부분에서 값을 꺼내는지**를 결정하는 파라미터 바인딩 어노테이션을 전부 다룹니다.

## 파라미터 바인딩이란

Spring MVC는 `DispatcherServlet`이 컨트롤러 메서드를 호출할 때 **HandlerMethodArgumentResolver**를 통해 메서드 파라미터에 값을 주입합니다. 어노테이션 종류에 따라 요청의 다른 부분에서 값을 추출합니다.

![Spring MVC 파라미터 바인딩 전체 지도](/assets/posts/spring-parameter-binding-types.svg)

## @PathVariable: 경로 변수

URL 패턴의 `{변수}` 부분을 메서드 파라미터에 바인딩합니다.

```java
// GET /users/42
@GetMapping("/users/{id}")
public UserDto getUser(@PathVariable Long id) {
    return userService.findById(id);
}

// 파라미터 이름이 다를 때 명시적으로 지정
@GetMapping("/posts/{postId}/comments/{commentId}")
public CommentDto getComment(
        @PathVariable("postId") Long pid,
        @PathVariable("commentId") Long cid) {
    return commentService.find(pid, cid);
}

// 선택적 경로 변수 (Spring 5.3+)
@GetMapping({"/categories", "/categories/{id}"})
public Object getCategory(
        @PathVariable(required = false) Long id) {
    return id == null
        ? categoryService.findAll()
        : categoryService.findById(id);
}
```

`required = false`와 선택적 경로 변수를 함께 쓸 때는 두 패턴을 배열로 선언해야 합니다.

## @RequestParam: 쿼리 파라미터 & 폼 필드

URL 쿼리 파라미터(`?key=value`) 또는 `application/x-www-form-urlencoded` 폼 데이터를 바인딩합니다.

```java
// GET /users?status=active&page=0&size=20
@GetMapping("/users")
public Page<UserDto> list(
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
    return userService.findAll(status, page, size);
}

// 다중 값: GET /filter?tag=java&tag=spring
@GetMapping("/filter")
public List<Post> filter(
        @RequestParam List<String> tag) {
    return postService.findByTags(tag);
}

// 모든 쿼리 파라미터를 Map으로
@GetMapping("/search")
public List<Product> search(
        @RequestParam Map<String, String> params) {
    return productService.search(params);
}
```

`@RequestParam`을 생략해도 Spring MVC는 메서드 파라미터가 단순 타입(String, int 등)이면 쿼리 파라미터로 해석합니다. 단, 명시적으로 쓰는 것이 의도를 분명히 합니다.

## @RequestHeader: 요청 헤더

```java
@GetMapping("/api/resource")
public ResponseEntity<ResourceDto> getResource(
        @RequestHeader("Authorization") String authHeader,
        @RequestHeader(value = "X-Client-Version",
                       required = false,
                       defaultValue = "unknown") String clientVersion) {
    log.info("client version: {}", clientVersion);
    return ResponseEntity.ok(resourceService.get(authHeader));
}

// 모든 헤더를 HttpHeaders 객체로 수신
@PostMapping("/webhook")
public void handleWebhook(
        @RequestHeader HttpHeaders headers,
        @RequestBody byte[] body) {
    String signature = headers.getFirst("X-Hub-Signature-256");
    webhookService.process(signature, body);
}
```

## @CookieValue: 쿠키 값

```java
@GetMapping("/profile")
public UserProfileDto getProfile(
        @CookieValue(value = "JSESSIONID",
                     required = false) String sessionId,
        HttpSession session) {
    // 세션 기반 인증 컨텍스트에서 활용
    return profileService.getBySession(session);
}
```

쿠키 기반 세션보다 Spring Security의 `SecurityContextHolder`를 사용하는 것이 보안상 안전하지만, 서드파티 쿠키 처리나 레거시 시스템 통합 시 유용합니다.

## @RequestBody: 바디 역직렬화

요청 바디 전체를 `HttpMessageConverter`(기본값: Jackson)가 역직렬화하여 Java 객체로 만듭니다.

![@RequestBody 역직렬화 흐름](/assets/posts/spring-parameter-binding-requestbody.svg)

```java
@PostMapping("/users")
public ResponseEntity<UserDto> create(
        @RequestBody @Valid CreateUserRequest req) {
    UserDto created = userService.create(req);
    return ResponseEntity
            .created(URI.create("/api/v1/users/" + created.getId()))
            .body(created);
}

// DTO 클래스
public record CreateUserRequest(
        @NotBlank String name,
        @Email @NotBlank String email,
        @Size(min = 8) String password
) {}
```

`@Valid`를 함께 사용하면 역직렬화 후 Bean Validation이 실행됩니다. 검증 실패 시 `MethodArgumentNotValidException`이 발생하고 기본적으로 400 Bad Request가 반환됩니다.

`@RequestBody`는 스트림을 한 번만 읽습니다. 같은 요청에서 두 번 `@RequestBody`를 받을 수 없고, `HttpServletRequest.getInputStream()`을 이미 읽은 후라면 빈 객체가 바인딩될 수 있습니다.

## @ModelAttribute: 폼 데이터 → 객체

쿼리 파라미터 또는 폼 필드를 객체의 프로퍼티에 순서대로 바인딩합니다.

```java
// POST /login (application/x-www-form-urlencoded)
@PostMapping("/login")
public String login(
        @ModelAttribute LoginForm form,
        BindingResult result,
        Model model) {
    if (result.hasErrors()) {
        return "login";
    }
    model.addAttribute("user", authenticate(form));
    return "redirect:/home";
}

public class LoginForm {
    @NotBlank private String username;
    @NotBlank private String password;
    // getters & setters
}
```

`@ModelAttribute`는 기본적으로 뷰 모델에도 추가됩니다. 뷰에 노출하고 싶지 않으면 `@ModelAttribute(binding = false)`를 쓰거나, REST 컨트롤러에서는 `@RequestBody`를 사용합니다.

### 클래스 레벨 @ModelAttribute

공통 모델 속성을 모든 요청 처리 전에 미리 설정합니다.

```java
@Controller
@RequestMapping("/admin")
public class AdminController {

    // 이 컨트롤러의 모든 메서드 실행 전에 호출
    @ModelAttribute("currentAdmin")
    public AdminDto loadCurrentAdmin(Principal principal) {
        return adminService.findByUsername(principal.getName());
    }

    @GetMapping("/dashboard")
    public String dashboard(Model model) {
        // model에 이미 "currentAdmin"이 담겨 있음
        return "admin/dashboard";
    }
}
```

## @MatrixVariable: 경로 세그먼트 내 파라미터

URI 경로 세그먼트 안에서 세미콜론으로 구분된 `key=value` 쌍을 바인딩합니다.

```java
// GET /cars;color=red;year=2024
@GetMapping("/cars")
public List<Car> getCars(
        @MatrixVariable String color,
        @MatrixVariable int year) {
    return carService.findByCriterion(color, year);
}

// GET /users/5;roles=admin,user
@GetMapping("/users/{id}")
public UserDto getUser(
        @PathVariable Long id,
        @MatrixVariable(name = "roles",
                        pathVar = "id",
                        required = false) List<String> roles) {
    return userService.findById(id);
}
```

`@MatrixVariable`은 Spring Boot 기본 설정에서 비활성화되어 있습니다. `WebMvcConfigurer`에서 `setRemoveSemicolonContent(false)`를 설정해야 합니다.

```java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        UrlPathHelper helper = new UrlPathHelper();
        helper.setRemoveSemicolonContent(false);
        configurer.setUrlPathHelper(helper);
    }
}
```

## 바인딩 순서 우선순위

같은 이름이 여러 위치에 있을 때 Spring MVC의 처리 순서는 다음과 같습니다.

```
1. @PathVariable  → 경로 변수 (가장 우선)
2. @RequestParam  → 쿼리 파라미터
3. @ModelAttribute → 폼 필드 (객체 바인딩)
4. 어노테이션 없음 → 이름으로 자동 매핑
```

충돌을 피하기 위해 항상 어노테이션을 명시하는 것이 좋습니다.

## 특수 파라미터 타입

어노테이션 없이도 Spring MVC가 자동으로 주입하는 타입들이 있습니다.

```java
@GetMapping("/demo")
public String demo(
        HttpServletRequest request,    // 서블릿 요청 객체
        HttpServletResponse response,  // 서블릿 응답 객체
        HttpSession session,           // HTTP 세션
        Principal principal,           // 인증된 사용자
        Locale locale,                 // Accept-Language 헤더
        Model model,                   // 뷰 모델
        UriComponentsBuilder uriBuilder) { // URI 빌더
    return "demo";
}
```

이 타입들은 `HandlerMethodArgumentResolver` 구현체가 어노테이션 없이도 타입으로 인식합니다.

## 핵심 정리

- `@PathVariable`: 경로 `{변수}` 바인딩
- `@RequestParam`: 쿼리 파라미터 · 폼 필드 (단순 타입)
- `@RequestHeader`: 요청 헤더 값
- `@CookieValue`: 쿠키 값
- `@RequestBody`: 바디 전체를 Jackson이 역직렬화 (JSON/XML)
- `@ModelAttribute`: 폼 필드를 객체 프로퍼티에 자동 바인딩
- `@MatrixVariable`: 경로 세그먼트 내 `;key=value` (기본 비활성)
- `@RequestBody` + `@Valid`를 함께 쓰면 역직렬화 직후 Bean Validation이 실행됩니다.

---

**지난 글:** [RESTful URL 매핑 전략: 자원·행위·계층을 URL에 담는 법](/posts/spring-restful-mapping/)

**다음 글:** [Spring MVC Model과 ViewResolver: 데이터를 뷰에 전달하는 방법](/posts/spring-model-view-resolver/)

<br>
읽어주셔서 감사합니다. 😊
