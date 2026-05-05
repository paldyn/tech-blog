---
title: "RESTful URL 매핑 전략: 자원·행위·계층을 URL에 담는 법"
description: "REST 아키텍처 스타일에 따른 URI 설계 원칙과 Spring MVC @GetMapping/@PostMapping/@PutMapping/@PatchMapping/@DeleteMapping 단축 어노테이션의 올바른 사용법을 실무 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "REST", "RESTful", "URI설계", "GetMapping", "PostMapping", "PutMapping", "DeleteMapping", "Spring MVC", "HTTP메서드"]
featured: false
draft: false
---

[지난 글](/posts/spring-controller-requestmapping/)에서 `@Controller`와 `@RequestMapping`의 속성(path, method, consumes, produces 등)을 살펴봤습니다. 이번 글에서는 그 위에 REST 아키텍처 스타일을 얹어, **어떤 URL에 어떤 HTTP 메서드를 매핑해야 하는지** 설계 원칙과 Spring MVC 어노테이션을 함께 정리합니다.

## REST란 무엇인가

REST(Representational State Transfer)는 2000년 로이 필딩(Roy Fielding)의 박사 논문에서 제안된 분산 하이퍼미디어 아키텍처 스타일입니다. 핵심 제약은 **자원(Resource) 식별**, **상태 없음(Stateless)**, **통일 인터페이스(Uniform Interface)** 세 가지입니다.

Spring MVC 맥락에서 REST의 실천적 의미는 간단합니다. URL은 **명사(자원)** 를 표현하고, HTTP 메서드가 **동사(행위)** 를 담당합니다.

## URI 설계 원칙

![RESTful URI 설계 원칙](/assets/posts/spring-restful-mapping-uri-design.svg)

### 규칙 1: 명사를 쓰고 복수형을 사용하라

```
❌ GET /getUsers
❌ POST /createUser
✅ GET /users
✅ POST /users
```

`/users`는 "사용자 컬렉션"이라는 자원을 표현합니다. `GET`이냐 `POST`냐에 따라 조회인지 생성인지 결정됩니다.

### 규칙 2: 계층 관계는 슬래시 구분자로 표현하라

```
✅ GET  /users/{id}             단일 사용자
✅ GET  /users/{id}/orders      사용자의 주문 목록
✅ GET  /orders/{id}/items      주문의 아이템 목록
✅ POST /orders/{id}/items      주문에 아이템 추가
```

중첩이 3단계를 넘으면 가독성이 급격히 떨어집니다. 그 이상이면 쿼리 파라미터로 필터링하는 방식이 낫습니다.

### 규칙 3: 소문자 케밥-케이스(kebab-case)를 사용하라

```
✅ /product-categories
✅ /shipping-addresses
❌ /ProductCategories
❌ /product_categories
```

URL은 대소문자를 구분할 수 있으나, 관례적으로 소문자를 씁니다. 언더스코어는 일부 환경에서 밑줄로 가려지므로 하이픈을 사용합니다.

### 규칙 4: CRUD 외 행위는 서브 리소스로 명사화하라

```
❌ POST /orders/5/doCancel
✅ POST /orders/5/cancel

❌ PUT  /users/3/activate-account
✅ POST /users/3/activation
```

상태 전이를 나타내는 동사를 쓰고 싶을 때는 해당 동작을 "이벤트 리소스"로 모델링합니다.

## HTTP 메서드와 Spring MVC 어노테이션

![HTTP 메서드 × CRUD 매핑 전략](/assets/posts/spring-restful-mapping-http-methods.svg)

Spring MVC는 `@RequestMapping(method=RequestMethod.GET)` 대신 **단축 어노테이션**을 제공합니다.

```java
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    // 목록 조회 → 200 OK
    @GetMapping
    public List<UserDto> list(@RequestParam(defaultValue = "0") int page,
                               @RequestParam(defaultValue = "20") int size) {
        return userService.findAll(page, size);
    }

    // 단건 조회 → 200 OK
    @GetMapping("/{id}")
    public UserDto get(@PathVariable Long id) {
        return userService.findById(id);
    }

    // 생성 → 201 Created + Location 헤더
    @PostMapping
    public ResponseEntity<UserDto> create(
            @RequestBody @Valid CreateUserRequest req) {
        UserDto created = userService.create(req);
        URI location = URI.create("/api/v1/users/" + created.getId());
        return ResponseEntity.created(location).body(created);
    }

    // 전체 교체 → 200 OK
    @PutMapping("/{id}")
    public UserDto replace(@PathVariable Long id,
                            @RequestBody @Valid UpdateUserRequest req) {
        return userService.replace(id, req);
    }

    // 부분 수정 → 200 OK
    @PatchMapping("/{id}")
    public UserDto patch(@PathVariable Long id,
                          @RequestBody Map<String, Object> updates) {
        return userService.patch(id, updates);
    }

    // 삭제 → 204 No Content
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        userService.delete(id);
    }
}
```

### PUT vs PATCH

두 메서드 모두 리소스를 수정하지만 의미가 다릅니다.

| | PUT | PATCH |
|---|---|---|
| **의미** | 리소스 전체 교체 | 리소스 부분 수정 |
| **멱등성** | 멱등 (같은 요청 반복 결과 동일) | 비멱등 (구현에 따라 다름) |
| **요청 바디** | 전체 필드 | 변경할 필드만 |

PUT으로 `name`만 전송하면 나머지 필드가 `null`로 교체될 수 있습니다. PATCH는 지정한 필드만 변경합니다.

## 서브 리소스 패턴

```java
@RestController
@RequestMapping("/api/v1/orders/{orderId}/items")
public class OrderItemController {

    @GetMapping
    public List<OrderItemDto> list(@PathVariable Long orderId) {
        return orderItemService.findByOrderId(orderId);
    }

    @PostMapping
    public ResponseEntity<OrderItemDto> add(
            @PathVariable Long orderId,
            @RequestBody @Valid AddItemRequest req) {
        OrderItemDto item = orderItemService.add(orderId, req);
        URI location = URI.create(
            "/api/v1/orders/" + orderId + "/items/" + item.getId());
        return ResponseEntity.created(location).body(item);
    }
}
```

클래스 레벨 `@RequestMapping`에 경로 변수를 포함할 수 있습니다. `orderId`는 클래스 레벨에서 선언되었더라도 메서드 파라미터에 `@PathVariable`을 붙이면 자동 바인딩됩니다.

## 버전 관리 전략

API가 변경될 때 기존 클라이언트를 깨뜨리지 않으려면 버전 관리가 필요합니다.

```java
// 전략 1: URI 버전 관리 (가장 직관적)
@GetMapping("/api/v1/users")
@GetMapping("/api/v2/users")

// 전략 2: 헤더 버전 관리
@GetMapping(value = "/api/users",
            headers = "X-API-Version=2")

// 전략 3: Accept 헤더 협상
@GetMapping(value = "/api/users",
            produces = "application/vnd.paldyn.v2+json")
```

실무에서는 **URI 버전 관리**가 가장 널리 쓰입니다. 헤더 방식은 캐싱 인프라와 충돌이 생길 수 있고, Content Type 방식은 클라이언트 구현이 복잡해집니다.

## 검색·필터·정렬은 쿼리 파라미터

```java
// GET /users?status=active&role=admin&sort=name&page=0&size=20
@GetMapping
public Page<UserDto> list(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String role,
        @RequestParam(defaultValue = "id") String sort,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
    return userService.search(status, role, sort, page, size);
}
```

자원 식별(누구의 데이터인지)은 경로 변수, 검색 조건·정렬·페이징은 쿼리 파라미터로 표현합니다.

## 비(非)CRUD 행위 처리

주문 취소, 이메일 인증, 비밀번호 리셋처럼 CRUD로 표현하기 어려운 행위는 두 가지 방식으로 처리합니다.

```java
// 방식 A: 서브 리소스 (선호)
@PostMapping("/orders/{id}/cancel")
@ResponseStatus(HttpStatus.NO_CONTENT)
public void cancelOrder(@PathVariable Long id) {
    orderService.cancel(id);
}

// 방식 B: 상태 업데이트로 모델링
@PatchMapping("/orders/{id}")
public OrderDto updateStatus(
        @PathVariable Long id,
        @RequestBody StatusUpdateRequest req) {   // { "status": "CANCELLED" }
    return orderService.updateStatus(id, req.getStatus());
}
```

방식 A는 의도가 명확합니다. 방식 B는 클라이언트가 전이 가능한 상태를 미리 알아야 합니다.

## 핵심 정리

- URI는 **명사(자원)** 를 표현하고, HTTP 메서드가 **행위**를 담당합니다.
- `@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, `@DeleteMapping`을 상황에 맞게 사용합니다.
- PUT은 전체 교체(멱등), PATCH는 부분 수정(비멱등)입니다.
- 201 Created 응답에는 `Location` 헤더로 생성된 URI를 알려줍니다.
- 검색·필터·페이징은 쿼리 파라미터로, CRUD 외 행위는 서브 리소스 명사화로 처리합니다.

---

**지난 글:** [@Controller와 @RequestMapping 완전 정복: URL 매핑 전략 총정리](/posts/spring-controller-requestmapping/)

**다음 글:** [Spring MVC 파라미터 바인딩 완전 정복: @PathVariable부터 @ModelAttribute까지](/posts/spring-parameter-binding/)

<br>
읽어주셔서 감사합니다. 😊
