---
title: "PreparedStatement — SQL 인젝션을 막는 매개변수 바인딩"
description: "PreparedStatement는 SQL 구조와 값을 분리해 SQL 인젝션을 원천 차단하고, 사전 컴파일로 성능까지 챙기는 JDBC의 표준 도구입니다. Statement와의 차이, 값 바인딩 원리, 흔한 오해와 한계까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-22"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "JDBC", "PreparedStatement", "SQL인젝션", "보안"]
featured: false
draft: false
---

[지난 글](/posts/java-jdbc-basics/)에서 JDBC의 다섯 단계 흐름을 살펴보며 `?` 자리표시자와 `PreparedStatement`를 슬쩍 등장시켰습니다. 사실 이 한 가지 선택은 JDBC를 쓸 때 가장 중요한 보안 결정입니다. 문자열을 직접 이어 붙여 SQL을 만드는 순간 애플리케이션은 **SQL 인젝션** 공격에 무방비로 노출되고, 매년 반복되는 데이터 유출 사고의 상당수가 바로 이 실수에서 비롯됩니다. 이번 글에서는 `PreparedStatement`가 어떻게 이 문제를 원천 차단하는지, 그리고 성능 면에서 어떤 이득을 주는지 정리합니다.

## Statement의 위험 — 값과 구조가 섞인다

먼저 잘못된 방식부터 봅시다. 사용자 입력을 문자열로 이어 붙여 SQL을 만드는 코드입니다.

![문자열 결합 vs 매개변수 바인딩](/assets/posts/java-prepared-statement-injection.svg)

위 그림의 위쪽처럼 `"... WHERE name = '" + input + "'"` 형태로 SQL을 만들면, 사용자가 입력한 문자열이 SQL 텍스트의 일부가 되어 버립니다. 정상적인 이름이 들어오면 문제가 없지만, 공격자가 `' OR '1'='1`을 입력하면 SQL은 `WHERE name = '' OR '1'='1'`로 바뀝니다. 이 조건은 항상 참이므로 **전체 회원 정보가 그대로 노출**됩니다. 입력값이 데이터가 아니라 SQL의 구조를 바꿔 버린 것입니다.

## PreparedStatement의 방어 — 분리

`PreparedStatement`는 SQL 텍스트와 값을 **물리적으로 분리된 채널**로 전송합니다. SQL에는 값이 들어갈 자리를 `?`로만 표시하고, 실제 값은 `setString`·`setLong` 같은 메서드로 따로 넘깁니다.

```java
String sql = "SELECT * FROM member WHERE name = ?";

try (Connection conn = DriverManager.getConnection(url, "user", "pw");
     PreparedStatement ps = conn.prepareStatement(sql)) {

    ps.setString(1, input);          // 값은 별도 채널로 전달

    try (ResultSet rs = ps.executeQuery()) {
        while (rs.next()) {
            System.out.println(rs.getString("name"));
        }
    }
}
```

이 구조에서는 `input`에 무엇이 들어오든 그것은 항상 "하나의 값"으로만 취급됩니다. 공격자가 `' OR '1'='1`을 넣어도 DB는 그 전체를 이름 문자열로 보고 "이름이 정확히 `' OR '1'='1`인 회원"을 찾을 뿐입니다. 그런 회원은 없으므로 결과는 비어 있습니다. 값이 SQL 구조를 침범할 길이 애초에 막혀 있는 것입니다.

## 사전 컴파일 — 보안과 성능을 함께

`PreparedStatement`라는 이름의 "Prepared"는 SQL을 **미리 준비(사전 컴파일)** 한다는 뜻입니다. `prepareStatement`를 호출하면 DB는 SQL의 구조를 한 번 파싱하고 실행 계획을 세워둡니다. 이후에는 값만 바꿔 가며 같은 구조를 반복 실행할 수 있습니다.

![사전 컴파일 — 한 번 파싱, 여러 번 실행](/assets/posts/java-prepared-statement-precompile.svg)

```java
String sql = "INSERT INTO log (member_id, action) VALUES (?, ?)";

try (PreparedStatement ps = conn.prepareStatement(sql)) {
    for (long id : memberIds) {
        ps.setLong(1, id);
        ps.setString(2, "LOGIN");
        ps.executeUpdate();          // 같은 구조를 값만 바꿔 반복
    }
}
```

같은 SQL을 반복 실행할 때 파싱 비용을 아끼고 실행 계획을 재사용할 수 있다는 것이 성능상의 이점입니다. 보안과 성능을 동시에 챙길 수 있으니, 입력값이 들어가는 모든 SQL에서 `PreparedStatement`를 쓰는 것이 사실상 표준입니다.

## 타입에 맞는 set 메서드

값을 바인딩할 때는 컬럼 타입에 맞는 `setXxx` 메서드를 써야 합니다. 첫 번째 인자는 `?`의 위치로, **1부터 시작하는 인덱스**입니다(`ResultSet`의 컬럼 인덱스와 마찬가지로 0이 아닙니다).

```java
ps.setLong(1, memberId);          // BIGINT
ps.setString(2, name);            // VARCHAR
ps.setBigDecimal(3, price);       // DECIMAL
ps.setTimestamp(4, Timestamp.valueOf(LocalDateTime.now()));
ps.setNull(5, Types.VARCHAR);     // NULL은 setNull로
```

`NULL`을 넣을 때 `setString(5, null)`이 동작하는 드라이버도 있지만, 타입 정보가 모호해질 수 있어 `setNull(5, Types.VARCHAR)`처럼 명시하는 것이 안전합니다.

## 흔한 오해 — 바인딩으로 막을 수 없는 것

`PreparedStatement`가 만능은 아닙니다. 바인딩 파라미터(`?`)로 넘길 수 있는 것은 **값** 뿐입니다. 테이블 이름, 컬럼 이름, `ORDER BY` 방향(`ASC`/`DESC`) 같은 **SQL 구조의 일부는 `?`로 바인딩할 수 없습니다.**

```java
// 이렇게는 동작하지 않는다 — 컬럼명은 값이 아니다
String sql = "SELECT * FROM member ORDER BY ? ?";   // X
```

이런 부분을 사용자 입력으로 동적으로 만들어야 한다면, 바인딩 대신 **허용된 값의 화이트리스트**로 검증해야 합니다. 예를 들어 정렬 컬럼은 `Set.of("name", "created_at")`에 포함된 경우에만 SQL에 끼워 넣는 식입니다. 사용자 입력을 그대로 컬럼명 자리에 붙이면, `PreparedStatement`를 쓰더라도 그 부분은 여전히 인젝션에 노출됩니다.

## 정리

`PreparedStatement`는 SQL 구조와 값을 별도 채널로 분리해 전송함으로써 SQL 인젝션을 원천적으로 차단하고, 사전 컴파일로 반복 실행 성능까지 챙기는 JDBC의 표준 도구입니다. 입력값이 들어가는 SQL이라면 예외 없이 `PreparedStatement`와 `?` 바인딩을 써야 하며, 다만 테이블·컬럼명 같은 구조 요소는 바인딩으로 막을 수 없으므로 화이트리스트 검증을 병행해야 합니다. 단건 처리의 안전한 실행을 익혔으니, 다음 글에서는 여러 SQL을 하나의 작업 단위로 묶는 트랜잭션을 다룹니다.

---

**지난 글:** [JDBC 기초 — 자바와 데이터베이스를 잇는 표준](/posts/java-jdbc-basics/)

**다음 글:** [JDBC 트랜잭션 — 여러 SQL을 하나의 단위로 묶기](/posts/java-jdbc-transaction/)

<br>
읽어주셔서 감사합니다. 😊
