---
title: "Class·Method·Field — 리플렉션 핵심 객체 다루기"
description: "Field, Method, Constructor는 리플렉션으로 멤버를 조작하는 핵심 객체입니다. 필드 값 읽기·쓰기, 메서드 호출, 생성자로 객체 만들기, 그리고 setAccessible로 캡슐화를 넘는 법과 그 대가를 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "리플렉션", "Field", "Method", "Constructor", "setAccessible"]
featured: false
draft: false
---

[지난 글](/posts/java-reflection-basics/)에서 `Class` 객체가 리플렉션의 관문이라는 걸 봤습니다. 하지만 `Class`만으로는 실제 작업을 못 합니다. 필드 값을 읽고, 메서드를 호출하고, 객체를 만들려면 `Class`에서 갈라져 나오는 더 구체적인 객체들이 필요합니다. `Field`, `Method`, `Constructor`가 그것입니다. 이 세 객체는 `java.lang.reflect` 패키지에 있으며, 각각 필드·메서드·생성자를 런타임에 대표합니다. 이번 글은 이들을 실제로 다루는 법과, 리플렉션의 가장 강력하면서 위험한 기능인 `setAccessible`을 정리합니다.

## Class에서 멤버 객체로

`Class`는 멤버들의 디렉터리 역할을 합니다. 거기서 `Field`, `Method`, `Constructor`를 꺼냅니다.

![Class에서 Field, Method, Constructor로 갈라지는 구조](/assets/posts/java-class-method-field-members.svg)

각 객체는 조회 메서드와 조작 메서드를 갖습니다. `Field`는 `get`/`set`으로 값을 읽고 씁니다. `Method`는 `invoke`로 호출합니다. `Constructor`는 `newInstance`로 객체를 만듭니다. 공통적으로 `getName()`, `getModifiers()`, 타입 정보를 조회하는 메서드를 갖습니다.

## Field — 값 읽고 쓰기

`Field` 객체로 객체의 필드 값을 직접 다룰 수 있습니다. 게터/세터를 거치지 않습니다.

```java
class User { public String name; }

User user = new User();
Class<?> c = user.getClass();

Field nameField = c.getDeclaredField("name");

// 읽기
Object value = nameField.get(user);   // 현재 name 값

// 쓰기
nameField.set(user, "kim");           // user.name = "kim"
System.out.println(user.name);        // kim
```

`get`/`set`의 첫 인자는 대상 인스턴스입니다. static 필드라면 `null`을 줍니다. 타입이 정해진 변형도 있습니다 — `getInt`, `setLong` 같은 메서드는 박싱을 피해 기본형을 직접 다룹니다.

## Method — 호출하기

`Method` 객체로 메서드를 이름과 시그니처로 찾아 호출합니다.

```java
Class<?> c = Class.forName("com.app.Calculator");
Object calc = c.getDeclaredConstructor().newInstance();

// add(int, int) 메서드를 찾는다 — 파라미터 타입을 함께 줘야 한다
Method add = c.getMethod("add", int.class, int.class);

Object result = add.invoke(calc, 3, 4);  // calc.add(3, 4)
System.out.println(result);              // 7
```

`getMethod`에 파라미터 타입을 주는 이유는 오버로딩 구분입니다. `add(int,int)`와 `add(double,double)`이 둘 다 있으면 시그니처로만 구별됩니다. `invoke`의 반환값은 항상 `Object`라서, 기본형 반환도 박싱됩니다. static 메서드는 `invoke(null, ...)`로 호출합니다.

## Constructor — 객체 만들기

객체 생성은 `Constructor`의 `newInstance`로 합니다. 인자가 있는 생성자도 시그니처로 찾습니다.

```java
Class<?> c = Class.forName("com.app.User");

// User(String, int) 생성자
Constructor<?> ctor = c.getDeclaredConstructor(String.class, int.class);
Object user = ctor.newInstance("kim", 30);
```

과거에는 `Class.newInstance()`라는 단축 메서드가 있었지만, 예외 처리가 부실해 자바 9부터 deprecated 되었습니다. 지금은 `getDeclaredConstructor().newInstance()`가 권장 방식입니다.

## setAccessible — 캡슐화를 넘는 칼

여기까지는 public 멤버 이야기였습니다. 리플렉션의 진짜 힘은 **private 멤버에도 접근할 수 있다**는 데 있습니다. `setAccessible(true)`가 그 스위치입니다.

![setAccessible로 private에 접근하는 법과 두 얼굴](/assets/posts/java-class-method-field-access.svg)

```java
class User { private String password = "secret"; }

User user = new User();
Field pw = user.getClass().getDeclaredField("password");

pw.setAccessible(true);          // 접근 검사 우회
Object value = pw.get(user);     // "secret" — private이어도 읽힌다
```

이 기능 덕분에 스프링은 생성자 없이 `@Autowired` 필드에 의존성을 주입하고, Hibernate는 private 필드를 DB 컬럼에 매핑하고, JSON 라이브러리는 게터 없는 필드도 직렬화합니다. 프레임워크가 객체를 자유롭게 조립하는 토대가 바로 이것입니다.

대가도 분명합니다. `setAccessible`은 캡슐화를 우회하므로, 자바 9의 **강한 캡슐화**와 정면으로 부딪힙니다. 다른 모듈의 비공개 멤버에 접근하려 하면 `InaccessibleObjectException`이 납니다. 그 모듈이 `opens` 지시어로 패키지를 열어 줬거나, 실행 시 `--add-opens`로 강제로 열어야만 허용됩니다. 모듈 마이그레이션에서 `--add-opens`가 등장한 이유가 바로 이 충돌입니다.

## 비용을 줄이는 캐싱

`getMethod`/`getDeclaredField` 같은 조회는 비싼 작업입니다. 같은 멤버를 반복해서 다룬다면, 한 번 얻은 `Method`/`Field` 객체를 **캐시**해 재사용해야 합니다.

```java
// 안티패턴 — 매 호출마다 조회
for (User u : users) {
    Method m = u.getClass().getMethod("getName"); // 매번 검색
    m.invoke(u);
}

// 권장 — 조회는 한 번, invoke만 반복
Method m = User.class.getMethod("getName");
for (User u : users) {
    m.invoke(u);
}
```

조회 비용은 한 번만 치르고, 실제 호출(`invoke`)만 반복하는 것이 리플렉션 성능의 기본 원칙입니다.

## 정리

- `Field`·`Method`·`Constructor`는 `Class`에서 갈라져 나오는, 멤버를 런타임에 대표하는 객체다.
- `Field.get/set`으로 값을 직접 읽고 쓰며, 첫 인자는 대상 인스턴스(static이면 `null`)다.
- `Method.invoke`로 메서드를 호출하고, `getMethod`에는 오버로딩 구분을 위해 파라미터 타입을 함께 준다.
- 객체 생성은 `getDeclaredConstructor(...).newInstance(...)`가 권장 방식이다(`Class.newInstance()`는 deprecated).
- `setAccessible(true)`는 private 멤버 접근을 열어 DI·ORM·직렬화의 토대가 되지만, 모듈의 강한 캡슐화와 충돌해 `InaccessibleObjectException`을 부를 수 있다.
- 조회는 비싸므로 `Method`/`Field` 객체를 캐시하고, 반복은 `invoke`만 수행한다.

---

**지난 글:** [리플렉션 기초 — 런타임에 타입을 들여다보기](/posts/java-reflection-basics/)

**다음 글:** [동적 프록시 — 런타임에 인터페이스 구현 만들기](/posts/java-dynamic-proxy/)

<br>
읽어주셔서 감사합니다. 😊
