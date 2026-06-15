---
title: "requires와 exports — 모듈 의존과 공개 제어"
description: "모듈 선언의 두 주역인 requires와 exports를 깊이 봅니다. requires의 transitive·static 변형이 무엇을 바꾸는지, exports와 한정 exports(... to)의 차이, exports와 opens의 경계까지 — 의존과 공개를 정밀하게 제어하는 법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "requires", "exports", "모듈", "JPMS", "transitive", "캡슐화"]
featured: false
draft: false
---

[지난 글](/posts/java-module-info/)에서 `module-info.java`의 지시어들을 훑었습니다. 그중 실무에서 압도적으로 자주 쓰는 두 가지가 **`requires`(의존)** 와 **`exports`(공개)** 입니다. 이 둘은 단순해 보이지만 `transitive`·`static`·한정(qualified) 같은 변형이 있어, 제대로 쓰면 모듈 간 경계를 아주 정밀하게 설계할 수 있습니다. 이번 글은 이 두 지시어와 그 변형들을 깊이 보고, 자주 헷갈리는 `exports`와 `opens`의 경계까지 정리합니다.

## requires — 무엇에 의존하는가

`requires`는 "이 모듈이 동작하려면 저 모듈이 필요하다"를 선언합니다. 여기 적은 모듈만 사용할 수 있고, 적지 않은 모듈의 타입은 컴파일 단계에서부터 보이지 않습니다. 즉 의존성이 코드가 아니라 **선언으로 명시**됩니다.

```java
module com.app.order {
    requires com.app.util;   // util 모듈에 의존
    requires java.sql;       // JDK의 java.sql 모듈에 의존
}
```

기본 `requires`는 두 가지 성질을 가집니다. 첫째, **컴파일과 런타임 모두**에서 필요합니다. 둘째, **전이되지 않습니다(non-transitive)** — `com.app.order`를 쓰는 다른 모듈이 자동으로 `com.app.util`을 볼 수 있는 건 아닙니다. 그 모듈도 필요하면 직접 `requires com.app.util`을 적어야 합니다.

## requires transitive — 의존을 다시 노출

그런데 모듈의 *공개 API*가 다른 모듈의 타입을 노출할 때가 있습니다. 예를 들어 `com.app.order`의 public 메서드가 `com.app.util`의 `Money` 타입을 반환한다면, `order`를 쓰는 쪽은 `Money`도 다룰 수 있어야 합니다. 이때 매번 사용자에게 "`util`도 직접 requires하세요"라고 요구하는 건 번거롭습니다. 해법이 **`requires transitive`** 입니다.

![requires transitive로 의존이 전이되는 모습](/assets/posts/java-requires-exports-transitive.svg)

`com.app.order`가 `requires transitive com.app.util`이라고 선언하면, `order`를 requires하는 모듈은 `util`을 **자동으로 함께 읽게** 됩니다(암묵적 readability). API에서 노출하는 타입의 모듈은 transitive로 거는 것이 원칙입니다. 그래야 사용자가 그 타입을 자연스럽게 쓸 수 있습니다.

## requires static — 컴파일에만 필요

세 번째 변형은 **`requires static`** 입니다. "컴파일할 때는 필요하지만, 런타임에는 없어도 된다(선택적)"는 뜻입니다. 컴파일 타임 애너테이션 프로세서, 또는 있으면 좋지만 없어도 동작하는 선택적 의존에 씁니다. 런타임에 그 모듈이 module path에 없어도 시작 시점 검증에서 실패하지 않습니다.

| 형태 | 컴파일 | 런타임 | 전이 |
|---|---|---|---|
| `requires X` | 필요 | 필요 | 안 됨 |
| `requires transitive X` | 필요 | 필요 | **됨** |
| `requires static X` | 필요 | **선택** | 안 됨 |

## exports — 무엇을 공개하는가

`exports`는 패키지 단위로 외부 공개를 엽니다. 핵심은 **패키지 단위**라는 점 — 클래스 하나가 아니라 패키지 전체가 단위입니다. exports한 패키지 안의 `public`/`protected` 멤버는 외부 모듈에서 컴파일·런타임 모두 접근할 수 있고, exports하지 않은 패키지는 `public`이라도 모듈 내부 전용입니다.

```java
module com.app.service {
    exports com.app.service.api;      // 전체 공개
    exports com.app.service.spi to    // 한정 공개
        com.app.plugin;
}
```

## 한정 exports — 특정 모듈에만

`exports ... to`를 쓰면 **지정한 모듈에만** 패키지를 공개합니다. 이를 한정(qualified) exports라고 합니다.

![exports와 한정 exports(... to)의 차이](/assets/posts/java-requires-exports-qualified.svg)

위 그림처럼 그냥 `exports`는 누구에게나 열리지만, `exports ... to friend`는 `friend` 모듈에만 열리고 나머지에는 닫힌 채로 남습니다. 큰 프레임워크에서 "내부 협력 모듈끼리는 공유하되, 외부 사용자에게는 숨기고 싶은" 패키지에 유용합니다. 외부에는 캡슐화를 유지하면서 내부 모듈 간에는 협력하는 절충안입니다.

## exports와 opens는 다르다

마지막으로 자주 혼동하는 지점입니다. `exports`는 **컴파일 타임 접근**(코드에서 import해서 사용)을 엽니다. 하지만 리플렉션으로 `private` 필드에 접근하는 동작 — JSON 라이브러리(Jackson 등)나 DI 프레임워크가 흔히 하는 일 — 은 `exports`만으로는 막힙니다. 이때 필요한 것이 **`opens`** 입니다.

```java
module com.app.web {
    exports com.app.web.api;      // 컴파일 타임 접근
    opens com.app.web.dto;        // 런타임 리플렉션 접근(직렬화 등)
}
```

`opens`는 그 패키지에 대한 **깊은 리플렉션(deep reflection)** 을 허용해, 프레임워크가 private 멤버까지 들여다볼 수 있게 합니다. 컴파일 타임 공개가 목적이면 `exports`, 리플렉션 허용이 목적이면 `opens`입니다. 둘은 별개이며 함께 쓰기도 합니다.

## 정리

- `requires`는 의존을 선언한다. 기본형은 **컴파일+런타임 필요, 전이 안 됨**.
- `requires transitive`는 의존을 사용자에게 다시 노출한다. **API에서 노출하는 타입의 모듈은 transitive로** 거는 게 원칙.
- `requires static`은 컴파일에만 필요하고 런타임에는 선택적인 의존에 쓴다.
- `exports`는 **패키지 단위**로 공개를 연다. exports 안 한 패키지는 `public`이라도 모듈 내부 전용.
- `exports ... to`(한정 exports)는 지정한 모듈에만 공개해, 외부엔 닫고 내부 협력만 연다.
- `exports`(컴파일 타임 접근)와 `opens`(런타임 리플렉션 접근)는 별개다 — 프레임워크엔 `opens`가 필요하다.
- 다음 글에서는 `uses`/`provides`와 ServiceLoader로 모듈 간 느슨한 결합을 구현하는 서비스를 다룬다.

---

**지난 글:** [module-info.java — 모듈 선언 파일 작성하기](/posts/java-module-info/)

**다음 글:** [모듈 서비스 — provides/uses와 ServiceLoader](/posts/java-services-modules/)

<br>
읽어주셔서 감사합니다. 😊
