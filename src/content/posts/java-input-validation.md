---
title: "입력 검증 — 신뢰할 수 없는 데이터 다루기"
description: "신뢰 경계와 입력 검증의 원칙을 이해하고, SQL 인젝션·경로 순회·명령어 삽입 같은 인젝션 공격을 Java 코드에서 막는 방법을 다룹니다. 허용 목록 검증, PreparedStatement, Bean Validation, 경로 정규화 등 실전 방어 기법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-07-05"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "보안", "입력검증", "SQL인젝션", "인젝션", "Validation"]
featured: false
draft: false
---

[지난 글](/posts/java-jwt-jjwt/)에서 JWT로 요청을 보낸 사용자가 누구인지 인증했다. 그런데 인증된 사용자라도 그가 보내는 **데이터는 여전히 신뢰할 수 없다.** 실무에서 발생하는 침해 사고의 대부분은 검증 없이 받아들인 입력에서 비롯된다. 이번 글에서는 신뢰 경계라는 개념을 중심으로, SQL 인젝션·경로 순회·명령어 삽입 같은 인젝션 공격을 Java에서 막는 방법을 다룬다.

## 신뢰 경계라는 사고 틀

보안의 출발점은 데이터의 출처를 구분하는 것이다. 애플리케이션 외부에서 들어오는 모든 것 — HTTP 파라미터, JSON 바디, 헤더, 쿠키, 업로드 파일, 심지어 외부 API 응답까지 — 은 공격자가 조작할 수 있다고 가정해야 한다.

![신뢰 경계(Trust Boundary)](/assets/posts/java-input-validation-boundary.svg)

핵심 규칙은 두 가지다. 첫째, **입력은 경계를 넘는 최대한 이른 지점에서 검증** 한다. 검증되지 않은 데이터가 비즈니스 로직 깊숙이 흘러 들어가면, 어디서 무엇을 믿어도 되는지 추적이 불가능해진다. 둘째, **검증과 이스케이프를 혼동하지 않는다.** 검증은 "이 값이 올바른 형식인가"를, 이스케이프/파라미터화는 "이 값을 특정 컨텍스트(SQL, HTML, 셸)에 안전하게 넣는가"를 다룬다. 둘 다 필요하다.

## 허용 목록으로 검증하라

검증 규칙을 세울 때 방향이 중요하다. "나쁜 입력을 막는" 차단 목록(blocklist)은 언제나 새로운 우회로에 뚫린다. "허용할 형식만 통과시키는" 허용 목록(allowlist)이 훨씬 안전하다.

![허용 목록 vs 차단 목록](/assets/posts/java-input-validation-allowlist.svg)

```java
import java.util.regex.Pattern;

// ✅ 허용 목록: 이 형식만 통과, 나머지는 전부 거부
private static final Pattern USERNAME =
        Pattern.compile("^[a-zA-Z0-9_]{3,20}$");

public void validateUsername(String input) {
    if (input == null || !USERNAME.matcher(input).matches()) {
        throw new IllegalArgumentException(
                "사용자명은 3~20자의 영문·숫자·밑줄만 허용됩니다.");
    }
}
```

정규식으로 허용 목록을 정의할 때는 **`matches()`(전체 일치)를 쓰고, `find()`(부분 일치)를 쓰지 않도록** 주의한다. 또한 반드시 `^`와 `$`로 앵커를 걸어야 중간에 개행 문자를 끼워 넣는 우회를 막을 수 있다.

## SQL 인젝션: 파라미터 바인딩

가장 유명하고 여전히 흔한 인젝션이다. 문자열로 SQL을 조립하면 사용자 입력이 쿼리 구조 자체를 바꿔버린다.

```java
// ❌ SQL 인젝션에 취약 — 입력이 쿼리 구조를 변조
String sql = "SELECT * FROM users WHERE name = '" + name + "'";
// name = "x' OR '1'='1" → 모든 사용자 조회
// name = "x'; DROP TABLE users; --" → 테이블 삭제

Statement stmt = conn.createStatement();
ResultSet rs = stmt.executeQuery(sql);
```

해법은 문자열을 필터링하는 게 아니라, **PreparedStatement로 값과 쿼리 구조를 분리** 하는 것이다. 바인딩된 파라미터는 항상 데이터로만 취급되어 쿼리 구조에 영향을 줄 수 없다.

```java
// ✅ PreparedStatement — 값은 데이터로만 취급됨
String sql = "SELECT * FROM users WHERE name = ?";
try (PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setString(1, name); // name에 무엇이 들어와도 구조는 불변
    try (ResultSet rs = ps.executeQuery()) {
        // 안전하게 처리
    }
}
```

JPA·MyBatis 같은 프레임워크를 쓸 때도 마찬가지다. `@Query` 의 이름 있는 파라미터나 MyBatis의 `#{}` 는 바인딩되지만, 문자열 연결(`${}`)은 인젝션에 노출된다.

## 경로 순회: 정규화 후 검증

파일명을 입력받아 파일을 읽거나 쓸 때, `../` 를 이용해 의도한 디렉터리 밖으로 빠져나가는 공격이 경로 순회(path traversal)다.

```java
import java.nio.file.*;

// ❌ 취약 — "../../etc/passwd" 같은 입력으로 탈출 가능
Path file = Paths.get("/app/uploads/", userFileName);

// ✅ 정규화 후, 허용된 기준 디렉터리 안에 있는지 검증
Path baseDir = Paths.get("/app/uploads").toRealPath();
Path resolved = baseDir.resolve(userFileName).normalize();
if (!resolved.startsWith(baseDir)) {
    throw new SecurityException("허용되지 않은 경로 접근: " + userFileName);
}
// resolved는 baseDir 하위임이 보장됨
```

`normalize()` 로 `..` 를 정리한 뒤 `startsWith(baseDir)` 로 기준 디렉터리 내부임을 확인하는 것이 핵심이다.

## Bean Validation으로 선언적 검증

Spring 등에서는 검증 로직을 애너테이션으로 선언할 수 있다. 검증 규칙이 DTO에 명시되어 읽기 쉽고, 컨트롤러 진입 지점에서 자동 적용된다.

```java
import jakarta.validation.constraints.*;

public record SignupRequest(
        @NotBlank @Size(min = 3, max = 20)
        @Pattern(regexp = "^[a-zA-Z0-9_]+$")
        String username,

        @Email @NotBlank
        String email,

        @Min(0) @Max(150)
        int age
) {}

// 컨트롤러: @Valid 로 진입 시점에 자동 검증
@PostMapping("/signup")
public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest req) {
    // 이 지점에 도달하면 req는 이미 검증을 통과한 상태
    return ResponseEntity.ok(userService.create(req));
}
```

## 정리

- 외부에서 들어오는 모든 데이터는 신뢰 경계를 넘는 **이른 지점에서 검증** 한다.
- 검증은 차단 목록이 아니라 **허용 목록** 으로, 정규식은 앵커를 걸고 `matches()` 로 전체 일치를 확인한다.
- SQL 인젝션은 **PreparedStatement**, 경로 순회는 **정규화 후 기준 디렉터리 검증** 으로 막는다.
- Bean Validation으로 검증 규칙을 DTO에 선언해 진입 지점에서 자동 적용한다.

다음 글에서는 특히 위험한 인젝션 계열인 **역직렬화 취약점** 을 깊이 있게 다룬다.

---

**지난 글:** [JWT — jjwt로 토큰 기반 인증 구현하기](/posts/java-jwt-jjwt/)

**다음 글:** [역직렬화 취약점 — 안전하지 않은 역직렬화 방어](/posts/java-deserialization-vuln/)

<br>
읽어주셔서 감사합니다. 😊
