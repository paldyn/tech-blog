---
title: "OpenAPI 3.0 & Swagger UI로 REST API 문서화"
description: "springdoc-openapi를 사용해 Spring Boot 프로젝트에서 OpenAPI 3.0 기반 API 문서를 자동 생성하는 방법을 다룹니다. 의존성 설정, 전역 OpenAPI Bean 구성, @Operation·@ApiResponse 어노테이션 활용, JWT 인증 연동, Swagger UI 커스터마이징, 운영 환경 비활성화 전략을 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "OpenAPI", "Swagger", "springdoc", "API문서화", "REST", "SwaggerUI", "JWT인증"]
featured: false
draft: false
---

[지난 글](/posts/spring-rest-error-rfc7807/)에서 RFC 7807 Problem Details로 오류 응답을 표준화하는 방법을 살펴봤습니다. API의 오류 계약을 정의했다면, 이제 API 전체의 계약 — 엔드포인트 목록, 요청/응답 스키마, 인증 방식 — 을 문서화할 차례입니다. **OpenAPI 3.0**은 RESTful API를 기술하는 표준 명세이며, **Swagger UI**는 그 명세를 브라우저에서 시각화하고 직접 호출해볼 수 있는 UI입니다. `springdoc-openapi` 라이브러리는 Spring Boot 프로젝트의 컨트롤러를 런타임에 스캔해 OpenAPI 명세를 자동 생성합니다. 별도 YAML 파일을 작성하지 않고 코드와 어노테이션만으로 살아있는(live) API 문서를 만들 수 있습니다.

## springdoc-openapi 개요

`springdoc-openapi`는 Spring 팀이 관리하던 `springfox`의 실질적 후계 라이브러리입니다. Spring Boot 3 / Spring 6 환경에서는 `springdoc-openapi-starter-webmvc-ui` 2.x를 사용합니다.

![springdoc-openapi 동작 원리](/assets/posts/spring-rest-openapi-swagger-flow.svg)

의존성 한 줄만 추가하면 다음 두 엔드포인트가 자동 등록됩니다.

| 경로 | 설명 |
|---|---|
| `/v3/api-docs` | OpenAPI 3.0 JSON 명세 |
| `/swagger-ui.html` | Swagger UI (대화형 문서) |

```gradle
// build.gradle
implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.9'
```

```xml
<!-- pom.xml -->
<dependency>
  <groupId>org.springdoc</groupId>
  <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
  <version>2.8.9</version>
</dependency>
```

의존성만 추가하면 컨트롤러 스캔이 즉시 시작되며, 추가 설정 없이도 기본 Swagger UI가 동작합니다.

## 전역 OpenAPI 설정

API 제목, 버전, 설명, 라이선스, 보안 스키마 등의 전역 메타데이터는 `OpenAPI` Bean으로 구성합니다.

```java
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("사용자 관리 API")
                        .version("v1.0.0")
                        .description("사용자 등록·조회·수정·삭제 API입니다.")
                        .contact(new Contact()
                                .name("PALDYN Team")
                                .email("api@paldyn.com"))
                        .license(new License()
                                .name("MIT")
                                .url("https://opensource.org/licenses/MIT")))
                .addSecurityItem(new SecurityRequirement().addList("JWT"))
                .components(new Components()
                        .addSecuritySchemes("JWT", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("로그인 후 발급받은 Bearer 토큰")));
    }
}
```

`addSecurityItem`으로 전역 보안 스키마를 등록하면 Swagger UI의 모든 API 호출에 Authorization 헤더 입력창이 표시됩니다.

## 컨트롤러 문서화 어노테이션

![OpenAPI 어노테이션 활용](/assets/posts/spring-rest-openapi-swagger-code.svg)

주요 어노테이션은 다음과 같습니다.

| 어노테이션 | 위치 | 역할 |
|---|---|---|
| `@Tag` | 클래스 | API 그룹 이름·설명 |
| `@Operation` | 메서드 | 엔드포인트 요약·설명 |
| `@ApiResponse` | 메서드 | 응답 코드·설명 |
| `@Parameter` | 파라미터 | 경로·쿼리 파라미터 설명 |
| `@RequestBody` | 파라미터 | 요청 본문 설명 |
| `@Schema` | DTO 필드 | 필드 설명·예시·제약 |

```java
@Tag(name = "users", description = "사용자 관리 API")
@RestController
@RequestMapping("/api/users")
public class UserController {

    @Operation(
        summary = "사용자 단건 조회",
        description = "ID로 단일 사용자를 조회합니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공",
                 content = @Content(schema = @Schema(implementation = UserResponse.class)))
    @ApiResponse(responseCode = "404", description = "사용자 없음",
                 content = @Content(mediaType = "application/problem+json",
                                   schema = @Schema(implementation = ProblemDetail.class)))
    @GetMapping("/{id}")
    public UserResponse getUser(
            @Parameter(description = "사용자 ID", example = "42")
            @PathVariable Long id) {
        return userService.findById(id);
    }

    @Operation(summary = "사용자 목록 조회")
    @GetMapping
    public Page<UserResponse> listUsers(
            @Parameter(description = "페이지 번호(0부터)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "페이지 크기") @RequestParam(defaultValue = "20") int size) {
        return userService.findAll(PageRequest.of(page, size));
    }
}
```

## DTO 스키마 문서화

DTO 클래스에 `@Schema` 어노테이션을 붙여 각 필드의 의미·제약·예시를 기술합니다.

```java
@Schema(description = "사용자 응답 DTO")
public record UserResponse(
    @Schema(description = "사용자 ID", example = "42")
    Long id,

    @Schema(description = "이메일 주소", example = "user@example.com")
    String email,

    @Schema(description = "가입일시 (ISO 8601)")
    Instant createdAt
) {}
```

Record 타입도 `@Schema`가 완전히 지원됩니다. `example` 속성에 넣은 값은 Swagger UI에서 "Try it out" 실행 시 기본 예시 값으로 사용됩니다.

## application.yml 주요 설정

```yaml
springdoc:
  # OpenAPI JSON 경로 (기본값: /v3/api-docs)
  api-docs:
    path: /v3/api-docs

  # Swagger UI 경로 (기본값: /swagger-ui.html)
  swagger-ui:
    path: /swagger-ui.html
    # 태그 알파벳 순 정렬 (기본: 소스 순서)
    tags-sorter: alpha
    # 메서드 순 정렬 (GET, POST, PUT, DELETE 순)
    operations-sorter: method
    # 모든 섹션 펼친 상태로 시작
    doc-expansion: none

  # 특정 패키지만 스캔
  packages-to-scan: com.example.api.controller

  # 특정 경로만 포함
  paths-to-match: /api/**
```

## 보안 설정 연동 (Spring Security)

Spring Security와 함께 사용할 때 `/swagger-ui.html`, `/v3/api-docs/**` 경로를 허용해야 합니다.

```java
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(auth -> auth
                // Swagger UI 허용
                .requestMatchers(
                    "/swagger-ui.html",
                    "/swagger-ui/**",
                    "/v3/api-docs/**"
                ).permitAll()
                .anyRequest().authenticated()
        );
        return http.build();
    }
}
```

Swagger UI에서 JWT 토큰을 입력하고 "Authorize" 버튼을 클릭하면 이후 모든 API 호출에 `Authorization: Bearer <token>` 헤더가 자동으로 붙습니다.

## 운영 환경 Swagger UI 비활성화

API 문서를 개발/스테이징 환경에서만 노출하고 운영에서는 숨기려면 프로파일로 분리합니다.

```yaml
# application-prod.yml
springdoc:
  swagger-ui:
    enabled: false
  api-docs:
    enabled: false
```

또는 조건부 Bean 등록:

```java
@Profile("!prod")
@Configuration
public class SwaggerConfig {
    @Bean
    public OpenAPI openAPI() { ... }
}
```

운영 환경에서 API 문서를 노출하면 공격 표면이 넓어지므로 기본적으로 비활성화를 권장합니다.

## 그룹 분리(springdoc group)

하나의 앱에서 공개 API / 내부 관리 API를 별도 문서로 분리할 수 있습니다.

```java
@Bean
public GroupedOpenApi publicApi() {
    return GroupedOpenApi.builder()
            .group("public")
            .pathsToMatch("/api/v1/**")
            .build();
}

@Bean
public GroupedOpenApi adminApi() {
    return GroupedOpenApi.builder()
            .group("admin")
            .pathsToMatch("/admin/**")
            .build();
}
```

Swagger UI 상단 드롭다운에서 그룹을 전환할 수 있습니다.

## springdoc vs springfox

| 항목 | springdoc-openapi | springfox |
|---|---|---|
| OpenAPI 버전 | 3.0 | 2.0(Swagger) |
| Spring Boot 3 지원 | ✓ | ✗ (개발 중단) |
| 유지보수 | 활발 | 중단 상태 |
| 어노테이션 패키지 | `io.swagger.v3.oas.annotations` | `io.swagger.annotations` |

Spring Boot 2→3 마이그레이션 시 springfox를 springdoc으로 교체해야 합니다. 어노테이션 패키지가 달라 일괄 치환이 필요하지만, 의미 자체는 거의 동일합니다.

## 정리

`springdoc-openapi`는 의존성 한 줄로 OpenAPI 3.0 명세와 Swagger UI를 자동 제공합니다. `@Operation`, `@ApiResponse`, `@Schema`로 문서 품질을 높이고, `OpenAPI` Bean으로 전역 메타데이터를 구성합니다. 운영 환경에서는 반드시 Swagger UI를 비활성화해 보안을 지키고, `GroupedOpenApi`로 공개/내부 API를 분리해 관리합니다.

---

**지난 글:** [REST API 오류 응답 표준화 — RFC 7807 Problem Details](/posts/spring-rest-error-rfc7807/)

**다음 글:** [Spring REST Docs — 테스트 기반 API 문서 자동화](/posts/spring-rest-restdocs/)

<br>
읽어주셔서 감사합니다. 😊
