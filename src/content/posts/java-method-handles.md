---
title: "MethodHandles — 리플렉션보다 빠른 메서드 핸들"
description: "MethodHandle은 리플렉션의 느림을 극복하기 위해 자바 7에서 도입된 저수준 호출 메커니즘입니다. Lookup·MethodType·MethodHandle의 삼각 구조, invokeExact의 엄격함, 그리고 invokedynamic과의 관계를 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "MethodHandle", "MethodHandles", "리플렉션", "invokedynamic", "성능"]
featured: false
draft: false
---

[지난 글](/posts/java-dynamic-proxy/)까지 리플렉션 기반 도구들을 살펴봤습니다. 그런데 리플렉션에는 늘 따라붙는 약점이 있었습니다 — 느리다는 것입니다. 매 `invoke`마다 접근 검사를 하고, 인자와 반환값을 `Object`로 박싱하며, JIT가 직접 호출만큼 최적화하기 어렵습니다. 자바 7은 이 약점을 정조준한 새로운 메커니즘을 들고 왔습니다. `java.lang.invoke` 패키지의 **MethodHandle**입니다. 이번 글은 MethodHandle이 리플렉션과 무엇이 다른지, 어떻게 쓰는지, 그리고 자바 람다와 문자열 결합의 보이지 않는 토대가 어떻게 여기에 닿는지를 정리합니다.

## 왜 또 다른 호출 메커니즘인가

리플렉션의 `Method.invoke`는 "범용성"을 위해 만들어졌습니다. 그래서 모든 인자를 `Object[]`로 받고, 매번 보안 검사를 통과해야 합니다. 이 범용성의 대가가 성능입니다.

MethodHandle은 다른 철학으로 설계됐습니다. 메서드를 가리키는 **타입이 명확한 함수 포인터**에 가깝고, JIT 컴파일러가 일반 메서드 호출처럼 인라이닝하고 최적화할 수 있게 만들어졌습니다.

![Reflection과 MethodHandle의 특성 비교](/assets/posts/java-method-handles-vs-reflection.svg)

핵심 차이는 "검사 시점"입니다. 리플렉션은 매 호출마다 접근 검사를 하지만, MethodHandle은 **얻을 때(lookup) 한 번만** 검사합니다. 일단 핸들을 손에 넣으면 그 뒤의 호출은 직접 호출에 가깝게 빠릅니다. 대신 MethodHandle은 리플렉션처럼 "이 클래스의 모든 필드를 나열" 같은 광범위한 **조회(introspection)** 용도로는 부적합합니다. 둘은 경쟁자가 아니라 역할이 다릅니다 — 리플렉션은 조회, MethodHandle은 빠른 호출.

## 삼각 구조 — Lookup · MethodType · MethodHandle

MethodHandle을 얻는 과정에는 세 개의 객체가 등장합니다.

![Lookup이 MethodType으로 MethodHandle을 찾는 흐름](/assets/posts/java-method-handles-pipeline.svg)

- **Lookup** — 접근 권한을 대표하는 토큰입니다. `MethodHandles.lookup()`으로 얻으며, 그 코드가 볼 수 있는 범위만 찾을 수 있습니다.
- **MethodType** — 메서드의 시그니처를 타입으로 표현합니다. `methodType(반환타입, 인자타입들)` 형태입니다.
- **MethodHandle** — Lookup이 MethodType으로 찾아 돌려주는, 실제 호출 가능한 핸들입니다.

```java
import java.lang.invoke.*;

MethodHandles.Lookup lookup = MethodHandles.lookup();

// String length() → 반환 int, 인자 없음
MethodType mt = MethodType.methodType(int.class);
MethodHandle lengthHandle =
    lookup.findVirtual(String.class, "length", mt);

int len = (int) lengthHandle.invoke("hello");  // 5
```

`findVirtual`은 인스턴스 메서드를, `findStatic`은 static 메서드를, `findConstructor`는 생성자를, `findGetter`/`findSetter`는 필드를 찾습니다. 각각에 알맞은 `MethodType`을 줍니다.

## invokeExact — 타입에 엄격하다

MethodHandle 호출에는 `invoke`와 `invokeExact` 두 방식이 있습니다. 둘의 차이는 성능과 직결되는 중요한 지점입니다.

```java
MethodHandle add = lookup.findStatic(
    Math.class, "max",
    MethodType.methodType(int.class, int.class, int.class));

// invokeExact — 시그니처가 정확히 일치해야 한다
int r1 = (int) add.invokeExact(3, 7);   // OK

// 타입이 어긋나면 런타임 예외 (WrongMethodTypeException)
// long r = (long) add.invokeExact(3, 7);  // 반환 타입 불일치
```

`invokeExact`는 인자와 반환 타입이 핸들의 `MethodType`과 **정확히** 맞아야 합니다. 캐스팅 `(int)`도 시그니처의 일부로 검사됩니다. 이 엄격함 덕분에 JIT가 변환 코드 없이 직접 호출로 최적화할 수 있습니다. 반면 `invoke`는 필요한 타입 변환(박싱/언박싱, 형변환)을 자동으로 끼워 주어 편하지만 약간 느립니다. 성능이 중요하면 `invokeExact`를, 편의가 중요하면 `invoke`를 씁니다.

## 핸들을 조합하고 변형하기

MethodHandle의 또 다른 힘은 핸들을 함수처럼 **조합·변형**할 수 있다는 점입니다.

```java
// 일부 인자를 미리 고정 (부분 적용)
MethodHandle max = lookup.findStatic(Math.class, "max",
    MethodType.methodType(int.class, int.class, int.class));
MethodHandle maxWith10 = MethodHandles.insertArguments(max, 0, 10);
int r = (int) maxWith10.invoke(3);   // max(10, 3) = 10

// 인자 순서 바꾸기, 타입 변환, 핸들 합성 등도 지원
```

`insertArguments`(부분 적용), `bindTo`(첫 인자 고정), `filterArguments`(인자 전처리), `dropArguments`(인자 무시) 같은 변형으로, 핸들을 데이터처럼 다룰 수 있습니다. 리플렉션의 `Method`로는 불가능한 일입니다.

## 람다와 문자열 결합의 숨은 토대

여기서 한 가지를 짚어 둘 가치가 있습니다. 우리가 평소 쓰는 람다 표현식과 문자열 `+` 결합은, 컴파일되면 내부적으로 `invokedynamic` 바이트코드와 MethodHandle 기반의 부트스트랩 메커니즘을 씁니다.

```text
() -> doWork()    →  invokedynamic  →  LambdaMetafactory
"a" + x + "b"     →  invokedynamic  →  StringConcatFactory (Java 9+)
```

즉 MethodHandle은 우리가 직접 쓸 일이 흔치 않은 저수준 도구지만, 자바 언어 자체가 그 위에서 돌아가고 있습니다. 직접 손으로 쓸 일은 고성능 라이브러리·프레임워크나 동적 언어 구현 정도지만, "왜 자바 람다가 익명 클래스보다 가볍게 동작하는가"를 이해하려면 이 토대를 알아 두면 좋습니다.

## 정리

- MethodHandle은 리플렉션의 느림을 극복하기 위한 저수준 호출 메커니즘으로, **얻을 때 한 번만 접근 검사**하고 이후 호출은 직접 호출에 가깝게 빠르다.
- 리플렉션은 조회(introspection)에, MethodHandle은 빠른 호출에 특화된 서로 다른 도구다.
- `Lookup`(권한 토큰) → `MethodType`(시그니처) → `MethodHandle`(호출 가능한 핸들)의 삼각 구조로 얻는다.
- `invokeExact`는 시그니처가 정확히 일치해야 하며 가장 빠르고, `invoke`는 자동 타입 변환을 해 주는 대신 약간 느리다.
- `insertArguments`·`bindTo`·`filterArguments` 등으로 핸들을 함수처럼 조합·변형할 수 있다.
- 람다와 문자열 결합이 `invokedynamic`과 MethodHandle 기반 팩토리 위에서 동작하므로, 직접 쓸 일은 드물어도 자바의 토대를 이루는 기술이다.

---

**지난 글:** [동적 프록시 — 런타임에 인터페이스 구현 만들기](/posts/java-dynamic-proxy/)

**다음 글:** [애너테이션 기초 — 코드에 메타데이터 붙이기](/posts/java-annotation-basics/)

<br>
읽어주셔서 감사합니다. 😊
