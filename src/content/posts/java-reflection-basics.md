---
title: "리플렉션 기초 — 런타임에 타입을 들여다보기"
description: "리플렉션은 컴파일 시점에 타입을 몰라도 런타임에 클래스 구조를 조회하고 조작하게 해 줍니다. Class 객체를 얻는 세 가지 방법, 필드·메서드·생성자 접근의 출발점, 그리고 리플렉션의 비용과 주의점을 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "리플렉션", "Reflection", "Class", "메타프로그래밍"]
featured: false
draft: false
---

[지난 글](/posts/java-modular-migration/)에서 모듈 마이그레이션을 다루며 "강한 캡슐화 때문에 리플렉션 접근이 막힌다"는 함정을 잠깐 언급했습니다. 그 리플렉션이 정확히 무엇이길래 모듈 시스템이 그렇게 신경 쓸까요? 우리가 평소 쓰는 코드는 `User u = new User()`처럼 타입을 **컴파일 시점에 알고** 작성합니다. 하지만 스프링의 DI, JSON 직렬화, JUnit의 테스트 탐색 같은 프레임워크는 어떤 타입이 올지 컴파일 시점에 알 수 없습니다. 이들이 런타임에 클래스 구조를 들여다보고 조작하는 메커니즘이 **리플렉션(reflection)** 입니다. 이번 글은 그 기초를 정리합니다.

## 무엇이 다른가 — 컴파일 시점 지식 vs 런타임 발견

리플렉션의 본질은 "타입에 대한 지식을 언제 갖느냐"의 차이입니다.

![일반 호출과 리플렉션의 차이](/assets/posts/java-reflection-basics-concept.svg)

일반 코드는 `User`라는 타입과 `setName`이라는 메서드를 컴파일러가 알고 검증합니다. 오타가 있으면 컴파일이 실패하죠. 반면 리플렉션은 타입 이름을 **문자열**로 받아 런타임에 클래스를 찾고, 메서드 이름도 문자열로 호출합니다. 컴파일러는 그 문자열이 올바른지 모릅니다. 유연한 대신, 컴파일 시점 안전망을 포기하는 거래입니다.

이 유연성이 필요한 곳이 프레임워크입니다. "설정 파일에 적힌 클래스 이름을 읽어 객체를 만든다", "어떤 객체든 받아 그 필드를 모두 JSON으로 직렬화한다" 같은 일은, 대상 타입을 미리 알 수 없으므로 리플렉션 없이는 불가능합니다.

## 모든 것의 시작 — Class 객체

리플렉션의 관문은 `Class` 객체입니다. 모든 타입은 JVM에 로드될 때 자신을 설명하는 `Class` 객체를 하나씩 갖습니다. 이걸 손에 넣는 방법은 세 가지입니다.

![Class 객체를 얻는 세 가지 방법과 멤버 접근](/assets/posts/java-reflection-basics-classobject.svg)

```java
// 1) 컴파일 시점에 타입을 아는 경우 — 클래스 리터럴
Class<User> c1 = User.class;

// 2) 인스턴스를 이미 가진 경우
User u = new User();
Class<? extends User> c2 = u.getClass();

// 3) 이름만 문자열로 아는 경우 — 가장 동적
Class<?> c3 = Class.forName("com.app.User");
```

세 번째 `Class.forName`이 리플렉션의 진짜 힘입니다. 클래스 이름이 코드에 등장하지 않고 런타임 문자열로 결정되므로, 컴파일 시점에 존재하지 않아도 되는 타입을 다룰 수 있습니다. JDBC 드라이버 로딩(`Class.forName("org.postgresql.Driver")`)이 전통적인 예입니다.

## Class 객체로 무엇을 하나

`Class` 객체를 얻으면 그 타입의 모든 멤버에 접근할 수 있습니다.

```java
Class<?> c = Class.forName("com.app.User");

// 타입 정보
System.out.println(c.getName());        // com.app.User
System.out.println(c.getSimpleName());  // User
System.out.println(c.getSuperclass());  // class java.lang.Object

// 멤버 조회
c.getDeclaredFields();       // 이 클래스가 선언한 모든 필드
c.getDeclaredMethods();      // 이 클래스가 선언한 모든 메서드
c.getDeclaredConstructors(); // 모든 생성자
```

`getXxx()`와 `getDeclaredXxx()`의 차이를 알아 두면 좋습니다. `getMethods()`는 상속받은 것을 포함한 **public** 멤버만, `getDeclaredMethods()`는 접근 제어자와 무관하게 **이 클래스가 직접 선언한** 멤버를 모두 돌려줍니다. 상위 클래스의 private까지 보려면 `getSuperclass()`로 올라가며 반복해야 합니다.

## 객체 생성과 메서드 호출

조회를 넘어 실제로 객체를 만들고 메서드를 호출할 수도 있습니다.

```java
Class<?> c = Class.forName("com.app.User");

// 기본 생성자로 인스턴스 생성
Object instance = c.getDeclaredConstructor().newInstance();

// 메서드를 이름으로 찾아 호출
Method setName = c.getMethod("setName", String.class);
setName.invoke(instance, "kim");

Method getName = c.getMethod("getName");
Object name = getName.invoke(instance);  // "kim"
```

`getMethod`에는 메서드 이름과 **파라미터 타입들**을 함께 줘야 합니다. 오버로딩된 메서드를 구분하기 위해서입니다. `invoke`의 첫 인자는 메서드를 호출할 대상 인스턴스이고(static 메서드면 `null`), 나머지가 실제 인자입니다. 다음 글에서 `Method`, `Field`를 더 깊이 다룹니다.

## 비용과 주의점

리플렉션은 강력하지만 공짜가 아닙니다. 실무에서 반드시 기억할 점들이 있습니다.

```text
1. 성능 — 직접 호출보다 느리다 (JIT 최적화가 제한적)
   → 핫 루프에서 매번 getMethod/invoke를 반복하지 말 것

2. 컴파일 안전성 상실 — 문자열 오타는 런타임에야 터진다
   → NoSuchMethodException, ClassNotFoundException

3. 캡슐화 우회 — setAccessible(true)로 private 접근 가능
   → 모듈 시스템의 강한 캡슐화와 충돌 (--add-opens 필요)
```

그래서 리플렉션은 "애플리케이션 일반 코드에서 일상적으로 쓰는 도구"가 아니라, **프레임워크와 라이브러리가 내부적으로 쓰는 도구**입니다. 우리가 직접 쓸 때는 비용과 안전성 상실을 의식하고, 결과(`Method`, `Constructor`)를 캐시해 반복 조회를 피하는 식으로 신중하게 사용해야 합니다.

## 정리

- 리플렉션은 컴파일 시점에 타입을 몰라도 **런타임에 클래스 구조를 조회·조작**하게 해 주는 메커니즘이다.
- 모든 리플렉션의 관문은 `Class` 객체이며, `타입.class` · `obj.getClass()` · `Class.forName("이름")` 세 방법으로 얻는다.
- `Class.forName`은 타입 이름을 문자열로 받아 런타임에 결정하므로 가장 동적이다(JDBC 드라이버 로딩이 고전적 예).
- `getXxx()`는 상속 포함 public 멤버, `getDeclaredXxx()`는 접근 제어자 무관하게 직접 선언한 멤버를 돌려준다.
- `newInstance()`/`invoke()`로 객체 생성과 메서드 호출까지 가능하다.
- 리플렉션은 성능 비용·컴파일 안전성 상실·캡슐화 우회라는 대가가 있어, 주로 프레임워크가 내부적으로 쓰고 일반 코드는 신중히 사용한다.

---

**지난 글:** [모듈 마이그레이션 — classpath에서 module path로](/posts/java-modular-migration/)

**다음 글:** [Class·Method·Field — 리플렉션 핵심 객체 다루기](/posts/java-class-method-field/)

<br>
읽어주셔서 감사합니다. 😊
