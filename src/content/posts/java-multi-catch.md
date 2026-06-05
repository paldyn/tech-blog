---
title: "multi-catch — 여러 예외를 한 번에 처리하기"
description: "Java multi-catch 완전 분석 — catch (A | B e) 구문, implicitly final 변수, LUB 타입 추론, catch 블록 순서와 예외 계층 주의사항, multi-catch 활용 패턴"
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "multi-catch", "예외처리", "catch", "Java7", "LUB"]
featured: false
draft: false
---

[지난 글](/posts/java-try-with-resources/)에서 `try-with-resources`로 자원을 안전하게 해제하는 방법을 살펴봤다. 이번에는 Java 7에서 함께 도입된 **multi-catch** 구문을 다룬다. 여러 예외를 동일하게 처리해야 할 때 발생하는 코드 중복을 깔끔하게 제거해준다.

## multi-catch가 해결하는 문제

서로 다른 두 예외를 같은 방식으로 처리하고 싶을 때 Java 7 이전에는 catch 블록을 여러 번 써야 했다.

```java
// Java 7 이전 — 동일한 처리 코드 중복
try {
    process();
} catch (IOException e) {
    log.error("처리 실패", e);
    throw new ServiceException(e);
} catch (SQLException e) {
    log.error("처리 실패", e); // 완전 동일!
    throw new ServiceException(e);
}
```

이 패턴의 문제는 단순 중복이 아니다. 한쪽을 수정할 때 다른 쪽을 빠뜨리는 실수가 실제로 발생한다.

## multi-catch 기본 구문

파이프(`|`)로 예외 타입을 구분해 하나의 catch 블록에서 처리한다.

```java
try {
    process();
} catch (IOException | SQLException e) {
    log.error("처리 실패", e);
    throw new ServiceException(e);
}
```

컴파일러는 이를 두 개의 개별 catch 블록으로 변환하지 않는다. 바이트코드 수준에서 `INSTANCEOF` 분기가 하나로 합쳐지므로 성능 차이도 없다.

![multi-catch 구문과 예외 계층 주의사항](/assets/posts/java-multi-catch-syntax.svg)

## implicitly final — 변수 재할당 금지

multi-catch에서 잡힌 변수 `e`는 **implicitly final**이다. 타입이 런타임에 확정되지 않으므로 재할당을 허용하면 타입 안전성이 깨진다.

```java
catch (IOException | SQLException e) {
    e = new IOException("대체"); // 컴파일 에러!
    // e의 타입은 IOException과 SQLException의 LUB
    // 재할당하면 타입 불변성 보장 불가
}
```

반면 일반 단일 catch 블록에서는 재할당이 허용된다(권장하지는 않지만).

## LUB — 최소 공통 상위 타입 추론

multi-catch 변수의 정적 타입은 **LUB(Least Upper Bound)**, 즉 열거된 예외 타입들의 최소 공통 상위 타입으로 추론된다.

```java
// IOException과 SQLException의 LUB는 Exception
catch (IOException | SQLException e) {
    // e의 컴파일 타임 타입: Exception
    // (둘 다 Exception을 직접 상속)
    Throwable t = e; // OK
    Exception ex = e; // OK
    IOException io = e; // 컴파일 에러! (타입 캐스팅 필요)
}
```

공통 인터페이스가 있다면 그것도 LUB 계산에 포함된다.

```java
interface Retryable { boolean isRetryable(); }
class NetException extends Exception implements Retryable { ... }
class TimeoutException extends Exception implements Retryable { ... }

catch (NetException | TimeoutException e) {
    // LUB: Exception & Retryable
    if (e.isRetryable()) retry(); // 인터페이스 메서드 호출 가능!
}
```

## 상위 타입 포함 시 컴파일 에러

multi-catch에서 한 타입이 다른 타입의 상위 타입이면 컴파일 에러다.

```java
// 컴파일 에러: IOException은 Exception의 하위 타입
catch (Exception | IOException e) { } // 'IOException' already caught by 'Exception'
```

이미 상위 타입이 잡으므로 하위 타입 선언이 의미 없다고 컴파일러가 판단한다.

![예외 계층과 catch 블록 전략](/assets/posts/java-multi-catch-hierarchy.svg)

## catch 블록 순서 — 구체적인 것을 먼저

multi-catch를 사용하더라도 여러 catch 블록을 쓸 때는 예외 계층을 고려해야 한다.

```java
try {
    openFile();
} catch (FileNotFoundException e) {
    // 가장 구체적 — 먼저
    System.err.println("파일 없음: " + e.getFileName());
} catch (IOException | NetworkException e) {
    // 중간 수준
    log.warn("IO/네트워크 오류", e);
} catch (Exception e) {
    // 가장 넓은 타입 — 마지막
    log.error("예상치 못한 오류", e);
}
```

상위 타입 catch가 먼저 나오면 하위 타입 catch는 도달 불가(unreachable)가 되어 컴파일 에러다.

## try-with-resources와 결합

두 기능은 자연스럽게 결합된다.

```java
try (
    Connection conn = dataSource.getConnection();
    PreparedStatement ps = conn.prepareStatement(sql)
) {
    ps.executeUpdate();
} catch (SQLException | IllegalStateException e) {
    log.error("DB 작업 실패", e);
    throw new DataAccessException(e);
}
```

`close()` 호출은 자동 처리되고, 발생 가능한 여러 예외는 multi-catch로 통합 처리한다.

## 언제 multi-catch를 쓰고 언제 쓰지 말아야 하나

**적합한 경우**
- 예외 타입은 다르지만 복구 전략이 동일할 때
- 예외를 래핑해서 다시 던지는 패턴(`throw new ServiceException(e)`)

**피해야 하는 경우**
- 예외별로 다른 복구 로직이 필요할 때 (억지로 합치면 가독성 저하)
- 예외 타입별로 다른 로그 메시지나 메트릭이 필요할 때

```java
// 잘못된 사용 — 처리가 실제로 다른데 억지로 합침
catch (FileNotFoundException | PermissionException e) {
    if (e instanceof FileNotFoundException fnfe) {
        createDefaultFile(fnfe.getFileName()); // FileNotFoundException 전용
    } else {
        requestPermission(); // PermissionException 전용
    }
}
// → 이럴 거면 개별 catch 블록으로 분리하는 것이 더 명확하다
```

---

**지난 글:** [try-with-resources — 자원 자동 해제의 모든 것](/posts/java-try-with-resources/)

**다음 글:** [커스텀 예외 — 도메인에 맞는 예외 클래스 설계](/posts/java-custom-exception/)

<br>
읽어주셔서 감사합니다. 😊
