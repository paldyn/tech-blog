---
title: "Java Text Block 완전 정복 — 여러 줄 문자열 처리"
description: "Java 15에서 정식 도입된 Text Block의 문법, 들여쓰기 자동 제거 원리, 이스케이프 시퀀스, formatted() 활용까지 여러 줄 문자열을 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "Text Block", "여러 줄 문자열", "JEP 378", "문자열 리터럴", "Java 15"]
featured: false
draft: false
---

[지난 글](/posts/java-stringbuilder-stringbuffer/)에서 StringBuilder와 StringBuffer로 가변 문자열을 효율적으로 다루는 법을 살펴봤다. 이번에는 방향을 바꿔 **가독성** 문제를 해결하는 기능을 다룬다. SQL 쿼리, JSON, HTML 스니펫처럼 여러 줄에 걸친 문자열을 기존 방식으로 표현하면 `\n`, `\"`, `+` 투성이의 코드가 됐다. Java 13에서 Preview로 등장해 **Java 15 (JEP 378)에서 정식 도입**된 Text Block은 이 문제를 깔끔하게 해결한다.

## Text Block 기본 문법

Text Block은 삼중 큰따옴표(`"""`)로 시작하고 삼중 큰따옴표로 닫는다.

```java
String html = """
        <html>
          <body>
            <p>Hello, Java!</p>
          </body>
        </html>
        """;
```

**규칙 두 가지**를 기억하면 된다.

1. **여는 `"""`는 반드시 새 줄로 끝나야 한다.** `""" 내용` 처럼 같은 줄에 내용이 오면 컴파일 에러다.
2. **닫는 `"""`의 위치가 들여쓰기 기준을 결정한다.** 이 규칙이 Text Block에서 가장 중요한 개념이다.

![Text Block vs 기존 문자열 리터럴](/assets/posts/java-text-block-comparison.svg)

## 들여쓰기 자동 제거 — incidental whitespace

Text Block 안의 들여쓰기는 대부분 "우연히 생긴 공백"(incidental whitespace)이다. 코드 포매터에 맞춰 블록을 8칸 들여쓰더라도 실제 문자열에 그 8칸이 포함되길 원하지 않는 경우가 대부분이다. Java 컴파일러는 이를 자동으로 제거한다.

**알고리즘**: 닫는 `"""` 앞에 있는 공백 수를 계산하고, 각 줄의 앞 공백에서 그 수만큼 제거한다.

```java
// 닫는 """ 앞 공백 = 8칸 → 각 줄에서 8칸 제거
String sql = """
        SELECT id, name
          FROM users
         WHERE active = true
         ORDER BY name
        """;
// 결과: "SELECT id, name\n  FROM users\n WHERE active = true\n ORDER BY name\n"
```

닫는 `"""`가 줄의 첫 번째 열(0번 위치)에 있으면 아무것도 제거되지 않는다.

![Text Block 들여쓰기 자동 제거](/assets/posts/java-text-block-indent.svg)

### 마지막 줄바꿈 처리

Text Block은 기본적으로 **마지막에 줄바꿈(`\n`)이 포함**된다. 닫는 `"""`가 별도 줄에 있기 때문이다. 마지막 줄바꿈이 필요 없다면 닫는 `"""`를 마지막 내용과 같은 줄에 둔다.

```java
// trailing newline 포함 (닫는 """ 별도 줄)
String withNewline = """
        Hello
        """;  // "Hello\n"

// trailing newline 없음 (닫는 """ 같은 줄)
String noNewline = """
        Hello""";  // "Hello"
```

## 이스케이프 시퀀스

Text Block 안에서도 일반 이스케이프 시퀀스를 쓸 수 있다. 단, 기본적으로 줄바꿈과 큰따옴표 하나는 이스케이프 없이 그대로 쓰인다.

### 큰따옴표 처리

Text Block 안에서 `"` 하나 또는 두 개는 그대로 쓸 수 있다. 세 개가 연속으로 나오는 경우만 하나를 이스케이프해야 한다.

```java
String json = """
        {
          "name": "Alice",
          "bio": "She said \"Hello\"\"\""
        }
        """;
```

### `\s` — trailing 공백 보존

각 줄 끝의 공백은 기본적으로 제거된다. `\s`를 줄 끝에 두면 그 위치까지의 공백이 보존된다.

```java
String padded = """
        apple  \s
        banana \s
        cherry \s
        """;
// 각 줄 끝에 공백이 포함됨
```

### `\` — 줄 이음 (line continuation)

줄 끝에 `\`를 두면 실제 문자열에서 줄바꿈이 제거된다. 소스는 여러 줄로 나눠 쓰지만 결과는 한 줄이다.

```java
String oneLine = """
        This is a very long sentence that \
        spans two source lines but \
        is one line in the result.
        """;
// "This is a very long sentence that spans two source lines but is one line in the result.\n"
```

## 실전 사용 예시

### SQL 쿼리

```java
String query = """
        SELECT u.id, u.name, o.total
          FROM users u
          JOIN orders o ON u.id = o.user_id
         WHERE u.active = true
           AND o.created_at >= ?
         ORDER BY o.created_at DESC
         LIMIT 100
        """;
PreparedStatement ps = conn.prepareStatement(query);
ps.setTimestamp(1, Timestamp.valueOf(since));
```

### JSON 바디

```java
String body = """
        {
          "model": "gpt-4o",
          "messages": [
            {"role": "user", "content": "Hello!"}
          ]
        }
        """;
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create(url))
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();
```

### HTML 템플릿

```java
String template = """
        <!DOCTYPE html>
        <html lang="ko">
        <head><title>%s</title></head>
        <body><h1>%s</h1></body>
        </html>
        """.formatted(title, heading);
```

## `formatted()` — 인라인 문자열 포매팅

Text Block에 바로 `.formatted(args...)`를 연결하면 `String.format()`과 동일한 효과를 낸다. 플레이스홀더(`%s`, `%d` 등)를 사용하면 된다.

```java
String name = "Alice";
int age = 30;

String profile = """
        이름: %s
        나이: %d
        가입일: %tF
        """.formatted(name, age, LocalDate.now());
```

Java 21부터는 **String Templates**(JEP 430, Preview)가 실험적으로 제공되어 `%s` 없이 `STR."이름: \{name}"` 형태로 삽입할 수 있다. 단, Java 23에서 Preview가 제거(철회)되어 현재는 표준 기능이 아니다. `formatted()`가 안전한 선택이다.

## 관련 String 인스턴스 메서드

Text Block과 함께 Java 15에서 추가된 두 가지 인스턴스 메서드가 있다.

```java
// stripIndent() — 일반 String에서도 incidental whitespace 제거
String raw = "    Hello\n    World\n";
System.out.println(raw.stripIndent());
// "Hello\nWorld\n" (공통 4칸 제거)

// translateEscapes() — \n \t 등의 이스케이프 시퀀스를 실제 문자로 변환
String escaped = "Hello\\nWorld";
System.out.println(escaped.translateEscapes());
// "Hello" + 실제 줄바꿈 + "World"
```

이 두 메서드는 Text Block이 컴파일 타임에 수행하는 처리를 런타임에서 일반 String에 적용할 때 유용하다.

## Text Block 컴파일 타임 처리 순서

JVM 스펙에 따르면 Text Block은 세 단계를 거쳐 최종 문자열이 된다.

1. **줄 끝 정규화**: 모든 줄 끝을 `\n`으로 변환 (OS 독립)
2. **incidental whitespace 제거**: 닫는 `"""`를 기준으로 공통 들여쓰기 제거
3. **이스케이프 시퀀스 해석**: `\n`, `\t`, `\s`, `\` 줄 이음 등 처리

이 과정은 모두 **컴파일 타임**에 수행된다. 런타임 오버헤드는 없다.

## 주의사항과 한계

**탭과 스페이스 혼용 금지**: 들여쓰기에 탭과 스페이스를 섞으면 컴파일러가 들여쓰기 너비를 정확히 계산하지 못한다. IDE 포매터가 탭을 스페이스로 변환하도록 설정하거나, 탭만 일관되게 사용해야 한다.

**동적 내용은 Text Block으로 표현 불가**: Text Block은 리터럴이므로 컴파일 타임에 값이 고정된다. 동적 값을 끼워넣으려면 `formatted()` 또는 `String.format()`을 써야 한다.

**기존 코드와의 호환성**: Text Block은 Java 15+ 에서만 사용 가능하다. Java 11 LTS를 지원해야 하는 프로젝트에서는 사용할 수 없다.

## 정리

Text Block은 SQL, JSON, HTML, XML처럼 여러 줄 구조를 가진 문자열을 코드 안에 자연스럽게 담을 수 있게 한다. 핵심은 세 가지다.

- 여는 `"""` 뒤에는 반드시 새 줄
- 닫는 `"""` 위치가 들여쓰기 제거 기준
- `.formatted()` 으로 동적 값 삽입

Java 17+ 프로젝트라면 다중 줄 문자열 리터럴이 필요할 때 Text Block을 기본 선택으로 삼는 것이 좋다.

---

**지난 글:** [Java StringBuilder · StringBuffer 완전 정복 — 가변 문자열의 모든 것](/posts/java-stringbuilder-stringbuffer/)

**다음 글:** [Java 클래스와 객체 — 설계도와 실체의 세계](/posts/java-class-and-object/)

<br>
읽어주셔서 감사합니다. 😊
