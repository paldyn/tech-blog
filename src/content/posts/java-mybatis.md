---
title: "MyBatis — SQL을 분리해 관리하는 SQL 매퍼"
description: "MyBatis는 SQL을 직접 작성하되 파라미터 바인딩과 결과 매핑의 반복만 덜어주는 SQL 매퍼입니다. 매퍼 인터페이스와 XML 매핑, 동적 SQL, JDBC·JPA·jOOQ 사이에서의 위치, 그리고 선택 기준까지 정리하며 데이터 접근 묶음을 마무리합니다."
author: "PALDYN Team"
pubDate: "2026-06-22"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "MyBatis", "SQL매퍼", "데이터접근", "동적SQL"]
featured: false
draft: false
---

[지난 글](/posts/java-jooq/)에서 SQL을 자바 코드로 타입 안전하게 작성하는 jOOQ를 살펴봤습니다. 데이터 접근에는 또 하나의 큰 갈래가 있습니다. SQL을 자바 코드 안에 두지도, 객체로 추상화하지도 않고, **SQL은 SQL대로 분리해 두고 자바와 연결만** 하는 방식입니다. 한국과 일본을 중심으로 특히 널리 쓰이는 이 접근의 대표 주자가 **MyBatis** 입니다. 이번 글에서는 MyBatis의 동작 방식과 위치를 정리하며 데이터 접근 묶음을 마무리합니다.

## MyBatis가 자동화하는 것, 하지 않는 것

MyBatis를 한마디로 정의하면 **SQL 매퍼(SQL Mapper)** 입니다. JPA처럼 SQL을 생성해 주지 않습니다. SQL은 개발자가 직접 씁니다. 대신 JDBC에서 가장 지루하고 오류가 잦았던 두 가지 — **파라미터 바인딩과 결과 매핑** — 의 반복만 덜어줍니다.

![MyBatis — 인터페이스와 SQL을 매핑](/assets/posts/java-mybatis-mapping.svg)

구조는 단순합니다. 자바 쪽에는 메서드만 선언된 **매퍼 인터페이스** 가 있고, 그에 대응하는 **SQL은 별도의 XML 파일**(또는 어노테이션)에 둡니다. 둘은 같은 `id`로 연결됩니다. 인터페이스의 `findById`를 호출하면, MyBatis가 같은 id의 SQL을 찾아 실행하고, 결과 행을 `Member` 객체로 매핑해 돌려줍니다. SQL의 통제권은 개발자가 쥐되, 컬럼을 하나하나 꺼내 객체에 채우는 반복은 사라지는 것입니다.

## 코드로 보는 매퍼

매퍼 인터페이스와 XML이 어떻게 짝을 이루는지 살펴봅시다. 먼저 자바 인터페이스입니다.

```java
public interface MemberMapper {
    Member findById(Long id);
    List<Member> findByAgeGreaterThan(int age);
    int insert(Member member);
}
```

이 인터페이스에 대응하는 SQL은 XML 매퍼에 둡니다. `namespace`로 인터페이스를, 각 구문의 `id`로 메서드를 가리킵니다.

```xml
<mapper namespace="com.example.MemberMapper">

  <select id="findById" resultType="Member">
    SELECT id, name, age
    FROM member
    WHERE id = #{id}
  </select>

  <insert id="insert">
    INSERT INTO member (name, age)
    VALUES (#{name}, #{age})
  </insert>

</mapper>
```

`#{id}`는 MyBatis의 바인딩 자리표시자로, 내부적으로 `PreparedStatement`의 `?`로 변환됩니다. 즉 **SQL 인젝션으로부터 안전** 합니다. (반대로 `${}`는 문자열을 그대로 끼워 넣으므로 사용자 입력에는 절대 쓰면 안 됩니다 — 이 차이는 MyBatis에서 가장 중요한 보안 포인트입니다.) `resultType`만 지정하면 컬럼과 같은 이름의 필드로 자동 매핑되고, 이름이 다르면 `resultMap`으로 세밀하게 지정할 수 있습니다.

## 동적 SQL — MyBatis의 진짜 강점

MyBatis가 단순한 매핑 도구를 넘어서는 지점은 **동적 SQL** 입니다. 조건에 따라 `WHERE` 절이 달라지는 검색 쿼리는 문자열 결합으로 만들기에 까다롭고 위험한데, MyBatis는 이를 XML 태그로 깔끔하게 표현합니다.

```xml
<select id="search" resultType="Member">
  SELECT * FROM member
  <where>
    <if test="name != null">
      AND name LIKE #{name}
    </if>
    <if test="minAge != null">
      AND age &gt;= #{minAge}
    </if>
  </where>
</select>
```

`<if>`로 조건을 켜고 끄고, `<where>`가 맨 앞의 불필요한 `AND`를 알아서 정리합니다. `<foreach>`로 `IN` 절을 동적으로 만들 수도 있습니다. 복잡한 검색 조건이 많은 업무 시스템에서 동적 SQL은 MyBatis를 선택하게 만드는 가장 큰 이유 중 하나입니다.

## 스펙트럼 위에서의 위치

지금까지 다룬 데이터 접근 도구들을 하나의 축 위에 놓으면 MyBatis의 위치가 분명해집니다. 한쪽 끝에는 모든 것을 손으로 하는 JDBC가, 반대쪽 끝에는 객체로 추상화하는 JPA가 있습니다.

![데이터 접근 도구의 스펙트럼](/assets/posts/java-mybatis-spectrum.svg)

JDBC는 SQL과 매핑을 모두 직접 처리해 제어권은 최대지만 반복이 많습니다. JPA는 SQL을 자동 생성해 추상화가 최대지만 그만큼 SQL에서 멀어집니다. **MyBatis는 그 사이의 절충점** 입니다. SQL의 제어권은 온전히 지키면서, 지루한 매핑만 덜어냅니다. jOOQ가 "SQL을 자바 코드로" 가져왔다면, MyBatis는 "SQL을 SQL 파일로 분리해" 둔다는 점에서 또 다른 선택지입니다.

## 선택 기준 — 무엇을 언제 쓰나

데이터 접근 도구에 절대적인 정답은 없습니다. 팀의 성향과 도메인의 성격에 따라 갈립니다.

- **JPA / Hibernate**: 도메인이 객체 중심이고 표준 CRUD가 많은 경우. 생산성이 높습니다.
- **MyBatis**: SQL을 직접 통제하고 싶고, 복잡한 동적 쿼리·튜닝이 잦은 경우. SQL이 한눈에 보입니다.
- **jOOQ**: SQL을 적극 쓰되 컴파일 타임 타입 안전성까지 원하는 경우.
- **JDBC**: 가장 단순하거나 다른 도구가 과한 경우, 또는 모든 도구의 바닥.

실무에서는 한 가지만 쓰기보다, 단순 CRUD는 JPA로 처리하고 복잡한 조회는 MyBatis나 jOOQ로 보완하는 식의 혼용도 흔합니다. 중요한 것은 각 도구가 무엇을 자동화하고 무엇을 개발자에게 맡기는지를 이해하고, 프로젝트의 요구에 맞게 고르는 안목입니다.

## 정리

MyBatis는 SQL을 직접 작성하되 파라미터 바인딩과 결과 매핑의 반복만 자동화하는 SQL 매퍼로, 매퍼 인터페이스와 XML/어노테이션의 SQL을 id로 연결해 동작합니다. `#{}` 바인딩으로 SQL 인젝션을 막고, `<if>`·`<where>`·`<foreach>` 같은 동적 SQL로 복잡한 조건 쿼리를 우아하게 다루는 것이 강점입니다. 데이터 접근 스펙트럼에서 JDBC와 JPA 사이의 절충점에 위치하며, SQL의 제어권을 지키고 싶은 팀에 잘 맞습니다. 이로써 JDBC의 기초부터 트랜잭션·배치·커넥션 풀, 그리고 JPA·Hibernate·jOOQ·MyBatis에 이르는 데이터 접근 도구의 지형도를 한 바퀴 돌아봤습니다. 각 도구의 장단을 알고 상황에 맞게 고르는 것, 그것이 데이터 접근을 잘 다루는 핵심입니다.

---

**지난 글:** [jOOQ — 타입 안전한 SQL을 자바로 작성하기](/posts/java-jooq/)

**다음 글:** [소켓 기초 — TCP 통신의 출발점](/posts/java-socket-basics/)

<br>
읽어주셔서 감사합니다. 😊
