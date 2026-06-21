---
title: "JDBC 기초 — 자바와 데이터베이스를 잇는 표준"
description: "JDBC는 자바 애플리케이션이 관계형 데이터베이스에 접근하는 표준 API입니다. 표준 인터페이스와 벤더별 드라이버의 분리 구조, Connection·Statement·ResultSet의 다섯 단계 흐름, try-with-resources를 이용한 자원 정리까지 기본기를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-22"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "JDBC", "데이터베이스", "SQL", "java.sql"]
featured: false
draft: false
---

[지난 글](/posts/java-mdc-tracing/)에서 로그를 추적 가능한 형태로 묶는 MDC까지 다루며 로깅 이야기를 마무리했습니다. 이번 글부터는 애플리케이션이 데이터와 직접 만나는 지점, 즉 데이터베이스 접근으로 넘어갑니다. 자바에서 관계형 데이터베이스에 접근하는 가장 밑바닥의 표준이 바로 **JDBC(Java Database Connectivity)** 입니다. JPA·Hibernate·MyBatis 같은 상위 도구도 결국 내부에서는 JDBC를 호출하므로, 이 기초를 이해해야 그 위의 추상화가 무엇을 감싸고 있는지 보입니다.

## JDBC가 푸는 문제 — 표준과 구현의 분리

데이터베이스는 MySQL, PostgreSQL, Oracle 등 종류가 다양하고, 각각 통신 프로토콜이 다릅니다. 만약 애플리케이션이 특정 DB의 통신 방식에 직접 의존하면, DB를 바꿀 때마다 데이터 접근 코드를 전부 다시 써야 합니다. JDBC는 이 문제를 **표준 인터페이스와 벤더별 구현(드라이버)의 분리** 로 풉니다.

![JDBC 아키텍처 — 표준 API와 드라이버의 분리](/assets/posts/java-jdbc-basics-architecture.svg)

애플리케이션은 `java.sql` 패키지의 표준 인터페이스(`Connection`, `Statement`, `ResultSet` 등)에만 의존해 코드를 작성합니다. 실제 DB와 통신하는 구체적인 구현은 각 벤더가 제공하는 **JDBC 드라이버**(jar 파일)가 담당합니다. 덕분에 DB를 교체하더라도 드라이버 jar와 접속 URL만 바꾸면 코드는 그대로 둘 수 있습니다. 이것이 JDBC의 가장 큰 가치입니다.

## 다섯 단계의 흐름

JDBC로 한 번 조회를 수행하는 흐름은 늘 비슷한 골격을 따릅니다. 연결을 얻고, SQL을 준비하고, 실행하고, 결과를 읽고, 정리합니다.

![JDBC 한 번의 조회 — 다섯 단계](/assets/posts/java-jdbc-basics-flow.svg)

이 다섯 단계를 코드로 옮기면 다음과 같습니다. 회원 한 명을 ID로 조회하는 예입니다.

```java
String url = "jdbc:mysql://localhost:3306/shop";
String sql = "SELECT id, name FROM member WHERE id = ?";

try (Connection conn = DriverManager.getConnection(url, "user", "pw");
     PreparedStatement stmt = conn.prepareStatement(sql)) {

    stmt.setLong(1, 77L);

    try (ResultSet rs = stmt.executeQuery()) {
        while (rs.next()) {
            long id = rs.getLong("id");
            String name = rs.getString("name");
            System.out.println(id + " : " + name);
        }
    }
}
```

`DriverManager.getConnection`이 드라이버를 찾아 연결을 만들고, `prepareStatement`가 SQL을 준비합니다. `executeQuery`는 조회 결과를 `ResultSet`으로 돌려주고, `rs.next()`로 한 행씩 커서를 이동하며 값을 읽습니다.

## 조회와 변경 — executeQuery와 executeUpdate

실행 메서드는 SQL의 종류에 따라 나뉩니다. `SELECT`처럼 결과 집합을 돌려받는 경우 `executeQuery`를 쓰고 `ResultSet`을 받습니다. `INSERT`·`UPDATE`·`DELETE`처럼 데이터를 변경하는 경우 `executeUpdate`를 쓰며, 영향받은 행의 개수를 `int`로 돌려받습니다.

```java
String sql = "UPDATE member SET name = ? WHERE id = ?";

try (Connection conn = DriverManager.getConnection(url, "user", "pw");
     PreparedStatement stmt = conn.prepareStatement(sql)) {

    stmt.setString(1, "김자바");
    stmt.setLong(2, 77L);

    int affected = stmt.executeUpdate();   // 변경된 행 수
    System.out.println(affected + "행 수정됨");
}
```

조회는 결과를, 변경은 개수를 돌려준다는 차이만 기억하면 됩니다.

## ResultSet 읽기 — 커서 모델

`ResultSet`은 모든 행을 한꺼번에 메모리에 올리는 리스트가 아니라, 결과 위를 한 행씩 가리키는 **커서**입니다. 처음에는 첫 행 앞에 위치하며, `next()`를 호출할 때마다 다음 행으로 이동하고, 더 읽을 행이 없으면 `false`를 반환합니다. 그래서 `while (rs.next())` 패턴이 관용적으로 쓰입니다.

컬럼 값은 이름(`getString("name")`)이나 1부터 시작하는 인덱스(`getString(2)`)로 읽을 수 있습니다. 인덱스가 0이 아니라 1부터라는 점은 초보자가 자주 틀리는 부분입니다. 가독성과 컬럼 순서 변경에 대한 안정성을 위해 보통 컬럼 이름으로 읽는 것을 권장합니다.

## 자원 정리는 try-with-resources로

JDBC에서 가장 흔하고 위험한 실수는 `Connection`·`Statement`·`ResultSet`을 닫지 않는 것입니다. 이들은 DB 서버와의 연결, 커서 같은 외부 자원을 점유하므로, 닫지 않으면 연결이 고갈되어 애플리케이션 전체가 멈출 수 있습니다.

예전에는 `finally`에서 일일이 `close`를 호출하고 그 안에서 또 예외를 처리하느라 코드가 장황했지만, 지금은 **try-with-resources** 로 깔끔하게 해결합니다. 위 예제처럼 `try (...)` 괄호 안에 자원을 선언하면, 블록을 벗어날 때 선언의 역순으로 자동으로 `close`가 호출됩니다. 예외가 나든 정상 종료든 정리가 보장되므로, 현대 JDBC 코드라면 예외 없이 이 방식을 써야 합니다.

## 정리

JDBC는 자바가 관계형 데이터베이스에 접근하는 표준 API로, 표준 인터페이스와 벤더별 드라이버를 분리해 DB를 바꿔도 코드는 그대로 둘 수 있게 해줍니다. 연결 획득 → Statement 준비 → 실행 → ResultSet 처리 → 정리라는 다섯 단계 골격을 가지며, 자원 정리는 try-with-resources로 처리하는 것이 정석입니다. 다만 위 예제에서 슬쩍 등장한 `?` 자리표시자와 `PreparedStatement`에는 SQL 인젝션 방지라는 더 중요한 이야기가 숨어 있습니다. 다음 글에서 이 부분을 깊이 다룹니다.

---

**지난 글:** [MDC로 로그 추적하기 — 요청을 처음부터 끝까지 잇는 컨텍스트](/posts/java-mdc-tracing/)

**다음 글:** [PreparedStatement — SQL 인젝션을 막는 매개변수 바인딩](/posts/java-prepared-statement/)

<br>
읽어주셔서 감사합니다. 😊
