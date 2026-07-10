---
title: "클래스 로더 위임 모델 심화"
description: "부모 위임 모델의 내부 동작, 위임이 깨지는 SPI 딜레마와 컨텍스트 클래스 로더로 해결하는 방법, Java 9 모듈 시스템과의 관계, OSGi·Tomcat이 위임을 재정의하는 이유까지 깊이 파헤칩니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "클래스 로더", "부모 위임 모델", "SPI", "컨텍스트 클래스 로더", "모듈 시스템", "OSGi"]
featured: false
draft: false
---

[지난 글](/posts/jvm-class-loader/)에서 Bootstrap·Platform·Application 세 계층의 클래스 로더와 로딩·링킹·초기화 3단계 프로세스를 살펴봤습니다. 이번 글은 그 핵심 보안 원칙인 **부모 위임 모델(Parent Delegation Model)**을 코드 레벨까지 분해하고, 위임이 역설적으로 문제를 일으키는 SPI 시나리오와 Java 9 모듈 시스템이 이를 어떻게 재정의했는지까지 다룹니다.

## loadClass()의 실제 구현

`ClassLoader.loadClass(String name, boolean resolve)` 소스를 보면 위임 모델이 그대로 드러납니다.

```java
protected Class<?> loadClass(String name, boolean resolve)
        throws ClassNotFoundException {
    synchronized (getClassLoadingLock(name)) {
        // 1. 이미 로드된 클래스이면 즉시 반환
        Class<?> c = findLoadedClass(name);
        if (c == null) {
            try {
                // 2. 부모가 있으면 부모에게 위임
                if (parent != null) {
                    c = parent.loadClass(name, false);
                } else {
                    // 3. 부모가 null = Bootstrap에게 위임
                    c = findBootstrapClassOrNull(name);
                }
            } catch (ClassNotFoundException e) {
                // 부모가 못 찾으면 여기서 직접 시도
            }
            if (c == null) {
                // 4. 직접 찾기
                c = findClass(name);
            }
        }
        if (resolve) resolveClass(c);
        return c;
    }
}
```

핵심은 **`findClass()`만 오버라이드하고 `loadClass()`는 건드리지 말라**는 JavaDoc 권고입니다. `loadClass()`를 오버라이드하면 1~3 단계의 캐시 확인과 부모 위임이 통째로 사라져 보안 구멍이 생깁니다.

## 위임 흐름 시각화

![부모 위임 모델 동작 흐름](/assets/posts/jvm-class-loader-delegation-flow.svg)

위 다이어그램처럼 `loadClass("com.example.Foo")` 요청은 Application → Platform → Bootstrap 순으로 올라가고, 각 계층이 실패한 뒤에야 다시 내려오며 직접 로드를 시도합니다. Bootstrap이 `java.base` 모듈 바깥의 클래스를 결코 로드하지 않으므로, 악의적인 `java.lang.String` 클래스를 classpath에 심어도 실제 `String`을 대체할 수 없습니다.

## 위임 캐시: findLoadedClass()

`loadClass()`가 처음 하는 일은 이미 로드된 클래스 검색입니다. JVM은 `(클래스 이름, 클래스 로더)` 쌍으로 클래스를 식별하기 때문에 **같은 이름이라도 다른 로더가 로드한 것은 별개의 Class 객체**입니다.

```java
ClassLoader cl1 = new MyClassLoader();
ClassLoader cl2 = new MyClassLoader();

Class<?> a = cl1.loadClass("com.example.Plugin");
Class<?> b = cl2.loadClass("com.example.Plugin");

System.out.println(a == b);          // false
System.out.println(a.equals(b));     // false
System.out.println(a.isAssignableFrom(b)); // false!
```

이 특성 때문에 플러그인 시스템에서 서로 다른 로더가 로드한 클래스끼리 `instanceof`나 캐스팅이 실패하는 문제가 발생합니다. 인터페이스를 반드시 **공통 부모 로더**가 로드하도록 설계해야 합니다.

## SPI 딜레마와 컨텍스트 클래스 로더

부모 위임 모델은 한 가지 역설을 품고 있습니다. **`java.sql.Driver` 인터페이스는 Bootstrap이 로드**하지만, 그 구현체인 `com.mysql.cj.jdbc.Driver`는 **classpath에 있으므로 Application ClassLoader**가 로드해야 합니다. Bootstrap은 자식 로더를 모르므로 직접 구현체를 찾을 수 없습니다.

이 문제를 해결하기 위해 도입된 것이 **스레드 컨텍스트 클래스 로더(Thread Context ClassLoader, TCCL)**입니다.

```java
// JDBC DriverManager 내부 (단순화)
ClassLoader tccl = Thread.currentThread()
                         .getContextClassLoader();

ServiceLoader<Driver> loader =
    ServiceLoader.load(Driver.class, tccl);

for (Driver d : loader) {
    // mysql-connector-j의 Driver 발견
    registeredDrivers.add(new DriverInfo(d));
}
```

`ServiceLoader.load()`가 TCCL을 사용하면 Bootstrap 코드가 실질적으로 Application ClassLoader의 권한을 빌려 구현체를 찾습니다. 이것이 **위임 역전(Delegation Inversion)**이라 불리는 패턴입니다.

![컨텍스트 클래스 로더와 SPI 패턴](/assets/posts/jvm-class-loader-delegation-context.svg)

메인 스레드의 TCCL 기본값은 Application ClassLoader입니다. 스레드 풀을 직접 생성할 때는 부모 스레드의 TCCL을 상속받지만, 잘못된 TCCL을 가진 스레드에서 `ServiceLoader`를 사용하면 구현체를 발견하지 못하는 버그가 생깁니다.

```java
// TCCL을 명시적으로 설정해야 하는 경우
Thread worker = new Thread(() -> {
    ClassLoader original =
        Thread.currentThread().getContextClassLoader();
    try {
        // 필요한 ClassLoader로 교체
        Thread.currentThread()
              .setContextClassLoader(targetCL);
        doWork();
    } finally {
        // 반드시 복원
        Thread.currentThread()
              .setContextClassLoader(original);
    }
});
```

## Java 9 모듈 시스템과 위임의 변화

Java 9 이전에는 classpath의 모든 클래스가 Application ClassLoader 하나의 관할이었습니다. Java 9부터 **Named Module**이 도입되며 클래스 로더 계층에 모듈 경계가 추가됩니다.

```text
// module-info.java 예시
module com.example.app {
    requires java.sql;           // java.sql 모듈 의존
    exports com.example.api;     // 이 패키지만 외부 접근 허용
}
```

핵심 변화는 세 가지입니다.

**1. Platform ClassLoader 범위 확대**: Java 8의 Extension ClassLoader(`lib/ext/`)가 사라지고, 대신 JDK 플랫폼 모듈 전체를 Platform ClassLoader가 담당합니다.

**2. 강력한 캡슐화**: `exports` 선언 없이는 같은 Application ClassLoader 안에서도 다른 모듈의 패키지에 접근할 수 없습니다. 위반 시 `InaccessibleObjectException`이 발생합니다.

**3. Unnamed Module**: `--class-path`로 로드된 JAR는 Unnamed Module로 취급됩니다. Named Module의 모든 `exports`를 받을 수 있지만, Unnamed Module 자신은 exports 없이 접근하게 됩니다.

```java
// 모듈 경계 확인
Module myModule = MyClass.class.getModule();
System.out.println(myModule.isNamed()); // true/false

// reflection에서 모듈 열기 (테스트용)
myModule.addOpens("com.example.internal",
                  AnotherClass.class.getModule());
```

## OSGi와 Tomcat이 위임을 깨는 이유

부모 위임 모델을 **의도적으로 우회**하는 프레임워크도 존재합니다.

**Apache Tomcat**은 웹 애플리케이션마다 별도의 `WebappClassLoader`를 사용합니다. 기본 동작은 `WEB-INF/lib`를 먼저 검색하고 그다음 부모에게 위임하는 **역방향 위임**입니다. 각 웹 앱이 서로 다른 버전의 라이브러리를 격리하여 사용할 수 있게 됩니다.

```text
Tomcat ClassLoader 계층
────────────────────────
Bootstrap CL
  └── System CL (Tomcat 내부 클래스)
        └── Common CL (공유 라이브러리)
              ├── WebApp CL (app1: WEB-INF/lib)
              └── WebApp CL (app2: WEB-INF/lib)
```

**OSGi**는 한발 더 나아가 번들(Bundle)마다 독립적인 클래스 로더를 두고, 번들 간 의존성을 선언적 메타데이터로 관리합니다. 한 번들의 클래스는 그 번들이 명시적으로 내보내지(export) 않으면 다른 번들에서 접근 불가능합니다.

## 정리

| 개념 | 설명 |
|---|---|
| 부모 위임 모델 | loadClass: 부모 먼저, 직접은 마지막 |
| findClass() 오버라이드 | 위임 유지하며 커스텀 로딩 추가 |
| TCCL | SPI 역전 딜레마를 해결하는 임시 권한 위임 |
| Named Module | exports 없으면 같은 CL도 접근 차단 |
| Unnamed Module | classpath JAR, 기존 코드 호환 유지 |
| Tomcat WebappClassLoader | 역방향 위임으로 앱 간 버전 격리 |

부모 위임 모델은 단순하지만 강력한 설계입니다. 그러나 SPI, 프레임워크 격리, 핫 리로드 같은 요구사항에서는 이 원칙을 의도적으로 확장하거나 우회해야 할 때가 생깁니다. 다음 글에서는 클래스가 실제로 올라가는 공간인 **JVM 런타임 데이터 영역**의 구조를 낱낱이 파헤칩니다.

---

**지난 글:** [JVM 클래스 로더 시스템](/posts/jvm-class-loader/)

**다음 글:** [JVM 런타임 데이터 영역](/posts/jvm-runtime-data-areas/)

<br>
읽어주셔서 감사합니다. 😊
