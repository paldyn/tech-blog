---
title: "Spring @RestController 완전 정복: @Controller와 차이, ResponseEntity 활용법"
description: "@RestController가 @Controller와 @ResponseBody를 합성한 메타 어노테이션임을 설명하고, ResponseEntity 빌더 패턴, HTTP 상태 코드 전략, CRUD REST API 완성 예시까지 실무 패턴을 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "@RestController", "@Controller", "ResponseEntity", "HTTP상태코드", "REST API", "@ResponseBody", "CRUD", "Spring MVC"]
featured: false
draft: false
---

[지난 글](/posts/spring-message-converter/)에서 `HttpMessageConverter`가 Java 객체를 JSON으로 변환하는 원리를 살펴봤습니다. 이번에는 그 위에서 동작하는 `@RestController`의 정체와 `ResponseEntity`를 사용해 HTTP 응답을 정교하게 제어하는 방법을 다룹니다.

## @RestController는 합성 어노테이션

`@RestController`는 새로운 기능을 추가한 어노테이션이 아닙니다. `@Controller`와 `@ResponseBody`를 조합한 **메타 어노테이션**입니다.

```java
// Spring 프레임워크 소스 (단순화)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Controller
@ResponseBody
public @interface RestController {
    @AliasFor(annotation = Controller.class)
    String value() default "";
}
```

`@ResponseBody`가 클래스 레벨에 선언되면 해당 클래스의 모든 메서드에 적용됩니다. 따라서 각 메서드마다 `@ResponseBody`를 반복하지 않아도 되고, ViewResolver 경로를 완전히 건너뜁니다.

![@Controller vs @RestController](/assets/posts/spring-restcontroller-compare.svg)

## @Controller와의 차이

| 구분 | @Controller | @RestController |
|---|---|---|
| 반환 처리 | ViewResolver → 템플릿 렌더링 | MessageConverter → HTTP body |
| @ResponseBody | 메서드마다 명시 필요 | 클래스 전체 자동 적용 |
| 주 용도 | Thymeleaf·JSP 뷰 | REST API |
| 뷰 + API 혼합 | 가능 (메서드별 @ResponseBody) | 권장하지 않음 |

전통적인 MVC 웹 애플리케이션(서버 사이드 렌더링)에서는 `@Controller`를 사용하고, REST API 서버에서는 `@RestController`를 사용합니다. 한 컨트롤러에서 뷰와 API를 동시에 제공해야 한다면 `@Controller`에 해당 메서드만 `@ResponseBody`를 붙이는 방식이 더 명확합니다.

## ResponseEntity로 응답 제어

단순히 Java 객체를 반환하면 상태 코드는 200, 헤더는 기본값으로 고정됩니다. **상태 코드, 헤더, 바디**를 모두 제어하려면 `ResponseEntity<T>`를 사용합니다.

```java
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    // 조회: 200 OK
    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUser(@PathVariable Long id) {
        UserDto dto = userService.findById(id);
        return ResponseEntity.ok(dto);
    }

    // 생성: 201 Created + Location 헤더
    @PostMapping
    public ResponseEntity<UserDto> createUser(
            @RequestBody CreateUserRequest request) {
        UserDto saved = userService.create(request);
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(saved.getId())
                .toUri();
        return ResponseEntity.created(location).body(saved);
    }

    // 수정: 200 OK
    @PutMapping("/{id}")
    public ResponseEntity<UserDto> updateUser(
            @PathVariable Long id,
            @RequestBody UpdateUserRequest request) {
        UserDto updated = userService.update(id, request);
        return ResponseEntity.ok(updated);
    }

    // 삭제: 204 No Content
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

![ResponseEntity 활용 패턴](/assets/posts/spring-restcontroller-responseentity.svg)

## ResponseEntity 빌더 체인

`ResponseEntity`는 정적 팩터리 메서드와 빌더 패턴을 함께 제공합니다.

```java
// 정적 팩터리 (자주 쓰는 상태코드 단축)
ResponseEntity.ok(body)                  // 200
ResponseEntity.created(uri).body(body)   // 201
ResponseEntity.accepted().build()        // 202
ResponseEntity.noContent().build()       // 204
ResponseEntity.notFound().build()        // 404
ResponseEntity.badRequest().build()      // 400

// 완전한 빌더 방식
ResponseEntity
    .status(HttpStatus.PARTIAL_CONTENT)
    .header("Content-Range", "bytes 0-999/5000")
    .contentType(MediaType.APPLICATION_OCTET_STREAM)
    .body(partialData);
```

`HttpStatus` 열거형 대신 `int` 상태 코드를 넘길 수도 있지만, 가독성을 위해 열거형 사용을 권장합니다.

## HTTP 상태 코드 전략

REST API에서 상태 코드는 클라이언트와의 **계약**입니다. 관행적으로 널리 통용되는 매핑은 다음과 같습니다.

| 동작 | 상태 코드 | 비고 |
|---|---|---|
| 단건/목록 조회 성공 | 200 OK | body에 데이터 |
| 리소스 생성 | 201 Created | Location 헤더 권장 |
| 비동기 수락 | 202 Accepted | 처리 완료 전 반환 |
| 삭제/바디 없는 수정 | 204 No Content | body 없음 |
| 유효성 실패 | 400 Bad Request | 검증 오류 상세 포함 |
| 인증 필요 | 401 Unauthorized | WWW-Authenticate 헤더 |
| 권한 없음 | 403 Forbidden | |
| 리소스 없음 | 404 Not Found | |
| 서버 내부 오류 | 500 Internal Server Error | 민감 정보 노출 주의 |

**절대 피해야 할 패턴**: 모든 응답을 200으로 반환하고 body의 `code` 필드로 성공/실패를 구분하는 방식입니다. HTTP 의미론을 무시하면 클라이언트 개발, 모니터링, 로드밸런서 설정 등 모든 계층에서 추가 파싱 로직이 필요해집니다.

## 제네릭 와일드카드 주의

`ResponseEntity<?>`로 와일드카드를 쓰면 컴파일 타임 타입 검사를 잃습니다. 오류 응답과 정상 응답의 타입이 다를 때만 제한적으로 사용하고, 그마저도 `sealed interface`나 공통 응답 래퍼로 대체하는 것을 권장합니다.

```java
// 지양: 타입 정보 소실
public ResponseEntity<?> getUser(@PathVariable Long id) { ... }

// 권장: 구체 타입 명시
public ResponseEntity<UserDto> getUser(@PathVariable Long id) { ... }
```

## @GetMapping vs @RequestMapping

```java
// 동등한 두 방식
@RequestMapping(value = "/{id}", method = RequestMethod.GET)
@GetMapping("/{id}")   // 권장: 간결하고 의도가 명확
```

`@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, `@DeleteMapping`은 `@RequestMapping`의 composed annotation입니다. HTTP 동사별로 전용 어노테이션을 쓰면 코드가 짧아지고 IDE 지원도 더 잘 됩니다.

## 정리

- `@RestController` = `@Controller` + `@ResponseBody` (메타 어노테이션)
- 모든 메서드의 반환값이 MessageConverter를 거쳐 HTTP body로 직렬화
- `ResponseEntity`로 상태 코드 · 헤더 · 바디를 한 객체에서 제어
- 201 Created 시 `Location` 헤더, 204 No Content 시 body 없음이 REST 관행
- 에러 상황에도 의미 있는 4xx/5xx 상태 코드 반환

---

**지난 글:** [Spring HttpMessageConverter: JSON·XML 자동 변환의 핵심 원리](/posts/spring-message-converter/)

**다음 글:** [Spring Validation: @Valid, @Validated, Bean Validation 완전 정복](/posts/spring-validation-basics/)

<br>
읽어주셔서 감사합니다. 😊
