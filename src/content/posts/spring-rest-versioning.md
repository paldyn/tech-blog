---
title: "REST API 버전 관리 — URI·헤더·Content-Type 전략 비교"
description: "REST API를 변경할 때 기존 클라이언트를 깨뜨리지 않는 버전 관리 전략을 다룹니다. URI Path, Query Parameter, Custom Header, Accept Header 4가지 방법의 장단점 비교, Spring에서의 구현, Deprecated 알림 헤더, 하위 호환 변경과 하위 비호환 변경의 구분, 실무 권장 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "REST", "API버전관리", "URI버전", "헤더버전", "Deprecated", "Sunset", "하위호환성", "API설계"]
featured: false
draft: false
---

[지난 글](/posts/spring-rest-paging-filter-sort/)에서 `Pageable`로 페이징·필터·정렬을 구현하는 방법을 살펴봤습니다. API는 살아있는 계약입니다. 비즈니스 요구사항이 바뀌면 응답 구조가 바뀌어야 하는데, 이미 배포된 클라이언트(모바일 앱, 파트너사 시스템)가 있다면 갑자기 응답 형식을 바꿀 수 없습니다. **API 버전 관리**는 변경이 필요한 API를 새 버전으로 제공하면서 기존 클라이언트가 구 버전을 계속 사용할 수 있도록 하는 전략입니다. 이 글에서는 4가지 버전 관리 방법을 비교하고, Spring에서 구현하는 실무 패턴을 정리합니다.

## 버전이 필요한 시점 — 하위 호환 vs 하위 비호환

모든 변경이 버전업을 요구하지는 않습니다. 변경을 두 종류로 나눠 판단합니다.

**하위 호환 변경(Backward Compatible)** — 기존 클라이언트가 영향받지 않으므로 버전업 불필요:
- 새 필드 추가 (클라이언트가 모르는 필드는 무시)
- 새 엔드포인트 추가
- 선택적 요청 파라미터 추가

**하위 비호환 변경(Breaking Change)** — 기존 클라이언트가 깨지므로 버전업 필요:
- 기존 필드 이름 변경 또는 삭제
- 필드 타입 변경 (`String` → `Integer`)
- 응답 구조 변경 (단일 객체 → 배열)
- 필수 요청 파라미터 추가
- 기존 엔드포인트 삭제

```java
// Breaking Change 예시
// V1 응답: { "userName": "홍길동" }
// V2 응답: { "name": "홍길동" }   ← 필드명 변경 = Breaking Change
```

## 4가지 버전 관리 전략

![REST API 버전 관리 전략 비교](/assets/posts/spring-rest-versioning-compare.svg)

### 1. URI Path 버전 — 실무 표준

URL 경로에 버전을 포함합니다. 가장 직관적이고 캐시하기 쉬워서 실무에서 가장 많이 쓰입니다.

```
GET /api/v1/users
GET /api/v2/users
```

장점은 URL만 보고 버전을 알 수 있다는 것, CDN·캐시 적용이 쉽다는 것, 브라우저에서 직접 테스트가 가능하다는 것입니다. 단점은 "URI는 리소스를 나타내야 한다"는 REST 원칙과 다소 어긋난다는 것(리소스가 같아도 버전마다 다른 URI)입니다.

### 2. Query Parameter 버전

쿼리 파라미터로 버전을 지정합니다.

```
GET /api/users?version=1
GET /api/users?api-version=2
```

URI가 깔끔해 보이지만, 쿼리 파라미터가 없는 요청의 기본 버전을 어떻게 정의할지 관리가 필요합니다. 캐시는 쿼리 파라미터를 포함한 URL을 기준으로 하므로, 프록시 캐시 설정에 주의해야 합니다.

### 3. Custom Header 버전

HTTP 헤더에 버전을 담습니다.

```
GET /api/users
X-API-Version: 2
```

URL이 깔끔하고 리소스 URI가 버전에 독립적입니다. 단점은 브라우저 주소창에서 직접 테스트가 어렵고, 클라이언트가 헤더를 명시적으로 설정해야 한다는 것입니다.

### 4. Accept Header 버전 (Content Negotiation)

HTTP 표준 `Accept` 헤더의 미디어 타입에 버전을 포함합니다.

```
GET /api/users
Accept: application/vnd.company.users.v2+json
```

REST의 자기 서술적 메시지 원칙에 가장 충실한 방법이지만, 구현과 디버깅이 가장 복잡합니다. GitHub API가 이 방식을 사용합니다.

## Spring에서 구현하기

![Spring에서 API 버전 구현](/assets/posts/spring-rest-versioning-code.svg)

### URI Path 버전 — 컨트롤러 분리

가장 단순한 방법은 버전별 컨트롤러를 분리하는 것입니다.

```java
// V1 — 기존 응답 구조 유지
@RestController
@RequestMapping("/api/v1/users")
public class UserV1Controller {

    @GetMapping
    public List<UserV1Dto> list() {
        return userService.findAll().stream()
                .map(UserV1Dto::from)
                .toList();
    }

    @GetMapping("/{id}")
    public UserV1Dto get(@PathVariable Long id) {
        return UserV1Dto.from(userService.findById(id));
    }
}

// V2 — phoneNumber 필드 추가, name 구조 변경
@RestController
@RequestMapping("/api/v2/users")
public class UserV2Controller {

    @GetMapping
    public List<UserV2Dto> list() {
        return userService.findAll().stream()
                .map(UserV2Dto::from)
                .toList();
    }
}
```

공통 비즈니스 로직은 Service 레이어에 유지하고, DTO만 버전별로 분리합니다.

```java
// V1 DTO — 단순 name 필드
public record UserV1Dto(Long id, String name, String email) {
    public static UserV1Dto from(User user) {
        return new UserV1Dto(user.getId(), user.getName(), user.getEmail());
    }
}

// V2 DTO — name을 firstName/lastName으로 분리, phoneNumber 추가
public record UserV2Dto(Long id, String firstName, String lastName,
                        String email, String phoneNumber) {
    public static UserV2Dto from(User user) {
        String[] names = user.getName().split(" ", 2);
        return new UserV2Dto(user.getId(),
                names.length > 0 ? names[0] : user.getName(),
                names.length > 1 ? names[1] : "",
                user.getEmail(),
                user.getPhoneNumber());
    }
}
```

### Header 버전 — @GetMapping(headers = ...)

같은 URI에서 헤더로 버전을 분기할 때 `@GetMapping(headers = ...)` 또는 `@GetMapping(produces = ...)` 조건을 활용합니다.

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    // X-API-Version: 1 헤더가 있는 요청
    @GetMapping(headers = "X-API-Version=1")
    public List<UserV1Dto> listV1() {
        return userService.findAll().stream().map(UserV1Dto::from).toList();
    }

    // X-API-Version: 2 헤더가 있는 요청
    @GetMapping(headers = "X-API-Version=2")
    public List<UserV2Dto> listV2() {
        return userService.findAll().stream().map(UserV2Dto::from).toList();
    }

    // 헤더 없으면 최신 버전 (기본)
    @GetMapping
    public List<UserV2Dto> listDefault() {
        return listV2();
    }
}
```

## Deprecated 알림 — 구 버전 폐기 예고

RFC 8594는 폐기 예정 API에 `Deprecation` 헤더와 `Sunset` 헤더 사용을 권고합니다.

```java
@GetMapping("/api/v1/users")
public ResponseEntity<List<UserV1Dto>> listV1() {
    List<UserV1Dto> data = userService.findAll().stream()
            .map(UserV1Dto::from).toList();

    return ResponseEntity.ok()
            .header("Deprecation", "true")
            .header("Sunset", "2027-01-01")     // 폐기 예정일
            .header("Link", "</api/v2/users>; rel=\"successor-version\"")
            .body(data);
}
```

클라이언트는 응답 헤더에서 `Deprecation: true`를 확인하면 마이그레이션 계획을 수립할 수 있습니다.

## 버전 정책 — 몇 개 버전을 유지할 것인가

무한정 구 버전을 유지하면 운영 부담이 급증합니다. 명확한 정책이 필요합니다.

```
권장 정책:
- 현재 버전 + 최대 1~2개 이전 버전 유지
- 신 버전 출시 후 최소 6개월 마이그레이션 기간 제공
- 폐기 3개월 전부터 Deprecation 헤더 추가
- Sunset 날짜 이후 요청에 410 Gone 반환
```

```java
// 폐기된 버전 처리
@GetMapping("/api/v0/users")
public ResponseEntity<Void> listV0Deprecated() {
    return ResponseEntity
            .status(HttpStatus.GONE)            // 410 Gone
            .header("Link", "</api/v2/users>; rel=\"successor-version\"")
            .build();
}
```

## 실무 권장 전략

| 상황 | 권장 방법 |
|---|---|
| 공개 API (외부 파트너, 모바일 앱) | URI Path (`/v1/`, `/v2/`) |
| 내부 마이크로서비스 간 통신 | Custom Header 또는 URI Path |
| REST 표준을 엄격히 준수해야 하는 경우 | Accept Header |
| 단순 내부 관리 API | Query Parameter |

대부분의 경우 **URI Path 버전이 최선**입니다. 직관적이고, 문서화가 쉽고, 테스트가 쉬우며, 대부분의 API 게이트웨이와 CDN이 잘 지원합니다. REST 순수성은 실용성 앞에서 타협할 수 있습니다.

새 버전 출시 전에 항상 기존 클라이언트가 어떤 영향을 받는지 분석하고, Breaking Change를 최소화하는 API 설계를 유지하는 것이 버전 관리 비용을 줄이는 근본적인 방법입니다.

---

**지난 글:** [Spring REST API 페이징·필터·정렬 — Pageable과 Page 완전 가이드](/posts/spring-rest-paging-filter-sort/)

<br>
읽어주셔서 감사합니다. 😊
