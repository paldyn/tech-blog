---
title: "XML로 빈 설정하기 — <bean> 태그 완전 정복"
description: "스프링 XML 설정 파일의 구조와 <bean> 태그의 id·class·scope·init-method 속성, constructor-arg·property 자식 태그를 예제와 함께 완전히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["spring", "xml", "bean", "di", "constructor-arg", "property", "scope"]
featured: false
draft: false
---

[지난 글](/posts/spring-ioc-container/)에서 IoC 컨테이너의 계층 구조와 부트스트랩 과정을 살펴봤습니다. 컨테이너가 빈을 생성하려면 "어떤 클래스를, 어떤 방식으로, 어떤 의존성과 함께 만들라"는 지시서가 필요합니다. 스프링 초창기에는 XML이 이 지시서 역할을 담당했습니다. 오늘날 자바 설정이 대세지만, 레거시 프로젝트 유지보수나 외부 라이브러리 빈 등록 시 XML을 읽고 쓸 줄 알아야 합니다.

## applicationContext.xml 기본 구조

스프링 XML 설정 파일은 `<beans>` 루트 요소 아래에 `<bean>` 정의를 나열합니다.

![applicationContext.xml 구조](/assets/posts/spring-bean-xml-config-structure.svg)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="
           http://www.springframework.org/schema/beans
           https://www.springframework.org/schema/beans/spring-beans.xsd">

    <bean id="orderService" class="com.example.OrderService">
        <constructor-arg ref="discountPolicy"/>
    </bean>

    <bean id="discountPolicy"
          class="com.example.RateDiscountPolicy"/>

</beans>
```

파일은 `src/main/resources/` 하위에 위치하면 `ClassPathXmlApplicationContext`가 `classpath:` 접두사로 찾습니다.

## `<bean>` 핵심 속성

| 속성 | 필수 | 설명 |
|------|------|------|
| `id` | 권장 | 빈 이름. 컨테이너 내 유일해야 함 |
| `name` | 선택 | 쉼표로 구분한 별칭 목록 |
| `class` | 필수 | 완전 클래스명(FQCN) |
| `scope` | 선택 | `singleton`(기본), `prototype`, `request`, `session` |
| `init-method` | 선택 | 초기화 후 호출할 메서드 이름 |
| `destroy-method` | 선택 | 컨테이너 종료 시 호출할 메서드 |
| `lazy-init` | 선택 | `true`이면 첫 `getBean()` 시점에 초기화 |
| `depends-on` | 선택 | 먼저 초기화될 빈 이름(순서 제어) |
| `factory-method` | 선택 | 정적 팩토리 메서드 이름 |
| `factory-bean` | 선택 | 인스턴스 팩토리 빈 이름 |

### scope 선택 기준

```xml
<!-- 싱글톤: 컨테이너 당 인스턴스 하나 (기본값) -->
<bean id="orderService" class="com.example.OrderService" scope="singleton"/>

<!-- 프로토타입: getBean() 마다 새 인스턴스 -->
<bean id="shoppingCart" class="com.example.ShoppingCart" scope="prototype"/>
```

싱글톤 빈에 프로토타입 빈을 의존성으로 주입할 때는 매 요청마다 새 인스턴스가 필요하다면 `ObjectFactory` 또는 `@Lookup`을 써야 합니다. 단순 XML 주입으로는 컨테이너 기동 시 한 번만 주입되기 때문입니다.

## 생성자 주입 — `<constructor-arg>`

```xml
<bean id="orderService" class="com.example.OrderService">
    <!-- 빈 참조 -->
    <constructor-arg ref="discountPolicy"/>
    <!-- 리터럴 값 -->
    <constructor-arg value="3"/>
    <!-- 인덱스로 순서 명시 -->
    <constructor-arg index="0" ref="discountPolicy"/>
    <!-- 타입으로 지정 -->
    <constructor-arg type="int" value="3"/>
    <!-- 이름으로 지정 (디버그 정보 필요) -->
    <constructor-arg name="maxRetry" value="3"/>
</bean>
```

`index`, `type`, `name` 세 가지 방식으로 매개변수를 특정할 수 있습니다. 매개변수가 두 개 이상이면 `index` 또는 `name`을 명시하는 것이 안전합니다.

## 세터 주입 — `<property>`

```xml
<bean id="emailSender" class="com.example.EmailSender">
    <!-- 리터럴 값 -->
    <property name="host" value="smtp.example.com"/>
    <property name="port" value="587"/>
    <!-- 다른 빈 참조 -->
    <property name="templateEngine" ref="freeMarkerEngine"/>
    <!-- null 주입 -->
    <property name="proxy"><null/></property>
    <!-- List 주입 -->
    <property name="recipients">
        <list>
            <value>admin@example.com</value>
            <value>ops@example.com</value>
        </list>
    </property>
</bean>
```

`<property>` 내부에는 `<list>`, `<set>`, `<map>`, `<props>` 등 컬렉션 타입을 직접 정의할 수 있습니다.

## 생성자 vs 세터 주입 비교

![XML 빈 와이어링 방식 비교](/assets/posts/spring-bean-xml-config-wiring.svg)

스프링 팀은 **필수 의존성은 생성자**, **선택적 의존성은 세터**로 주입하기를 공식적으로 권장합니다. 생성자 주입은 빈을 불변 상태로 만들고 순환 의존성을 기동 시점에 발견할 수 있는 장점이 있습니다.

## 팩토리 메서드로 빈 정의

```xml
<!-- 정적 팩토리 메서드 -->
<bean id="calendar"
      class="java.util.Calendar"
      factory-method="getInstance"/>

<!-- 인스턴스 팩토리 메서드 -->
<bean id="connectionFactory"
      class="com.example.ConnectionFactory"/>

<bean id="connection"
      factory-bean="connectionFactory"
      factory-method="createConnection"/>
```

외부 라이브러리처럼 생성자를 직접 호출할 수 없는 경우 팩토리 메서드 방식을 씁니다.

## 파일 분리와 import

설정 파일이 커지면 도메인별로 나눠 `<import>`로 합칩니다.

```xml
<!-- applicationContext.xml -->
<beans ...>
    <import resource="classpath:config/datasource.xml"/>
    <import resource="classpath:config/service.xml"/>
    <import resource="classpath:config/repository.xml"/>
</beans>
```

`ApplicationContext` 생성 시 여러 파일을 직접 나열해도 됩니다.

```java
ApplicationContext ctx = new ClassPathXmlApplicationContext(
    "config/datasource.xml",
    "config/service.xml",
    "config/repository.xml"
);
```

## p-네임스페이스와 c-네임스페이스 (축약 표기)

XML을 더 짧게 쓰려면 `p:` (property) 와 `c:` (constructor-arg) 네임스페이스를 사용합니다.

```xml
<beans ...
       xmlns:p="http://www.springframework.org/schema/p"
       xmlns:c="http://www.springframework.org/schema/c">

    <!-- property 축약 -->
    <bean id="emailSender" class="com.example.EmailSender"
          p:host="smtp.example.com" p:port="587"/>

    <!-- constructor-arg 축약 -->
    <bean id="orderService" class="com.example.OrderService"
          c:discountPolicy-ref="discountPolicy" c:maxRetry="3"/>
</beans>
```

축약 표기는 간결하지만 IDE 자동완성 지원이 약하고 오타 추적이 어렵습니다. 팀 컨벤션을 따르세요.

## 정리

- `<bean>` 태그의 필수 속성은 `class`, 권장 속성은 `id`입니다.
- 생성자 주입은 `<constructor-arg>`, 세터 주입은 `<property>`로 설정합니다.
- `scope`, `init-method`, `lazy-init` 등 속성으로 빈 라이프사이클을 제어합니다.
- 설정 파일이 커지면 `<import>`로 분리하고, 개발 편의를 위해 `p:`/`c:` 네임스페이스를 활용합니다.
- 레거시 프로젝트 유지보수나 라이브러리 빈 등록 등 XML이 꼭 필요한 상황은 여전히 존재합니다.

---

**지난 글:** [IoC 컨테이너 — BeanFactory와 ApplicationContext](/posts/spring-ioc-container/)

**다음 글:** [자바로 빈 설정하기 — @Configuration과 @Bean](/posts/spring-bean-java-config/)

<br>
읽어주셔서 감사합니다. 😊
