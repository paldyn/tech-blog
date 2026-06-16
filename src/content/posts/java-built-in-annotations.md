---
title: "내장 애너테이션 — @Override·@Deprecated·@SuppressWarnings"
description: "자바가 java.lang에서 기본 제공하는 세 내장 애너테이션을 정리합니다. @Override가 재정의 실수를 잡는 원리, @Deprecated의 since·forRemoval 요소, @SuppressWarnings의 올바른 사용 범위를 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "애너테이션", "@Override", "@Deprecated", "@SuppressWarnings"]
featured: false
draft: false
---

[지난 글](/posts/java-annotation-basics/)에서 애너테이션이 코드에 붙는 메타데이터이고, 그 의미는 읽는 쪽이 부여한다는 것을 봤습니다. 그렇다면 직접 만들기 전에, 자바가 기본으로 제공하는 애너테이션부터 제대로 아는 게 순서입니다. `java.lang` 패키지에는 매일 마주치는 세 가지가 들어 있습니다 — `@Override`, `@Deprecated`, `@SuppressWarnings`. 이들은 모두 **컴파일러가 읽는** 애너테이션으로, 우리 코드의 안전성과 의도를 컴파일 단계에서 점검해 줍니다. 이번 글은 이 세 가지를 하나씩 정리합니다.

![@Override·@Deprecated·@SuppressWarnings 세 내장 애너테이션](/assets/posts/java-built-in-annotations-trio.svg)

## @Override — 재정의 의도를 컴파일러에 알린다

`@Override`는 "이 메서드는 상위 타입의 메서드를 재정의한 것"이라고 선언합니다. 붙이지 않아도 재정의는 동작하지만, 붙이면 컴파일러가 **정말 재정의가 맞는지** 검증해 줍니다.

이게 왜 중요한지는 고전적인 실수로 드러납니다.

![@Override가 잡아 주는 equals 시그니처 실수](/assets/posts/java-built-in-annotations-override.svg)

```java
class Animal {
    // Object.equals(Object)를 재정의하려는 의도
    @Override
    public boolean equals(Object o) {   // 파라미터가 Object — 올바른 재정의
        ...
    }
}
```

만약 파라미터를 실수로 `Animal a`로 적으면, 그것은 재정의가 아니라 **오버로딩**(이름만 같은 별개 메서드)이 됩니다. `Object.equals(Object)`는 그대로 남아 컬렉션이나 `equals` 비교가 엉뚱하게 동작합니다. `@Override`를 붙여 두면, 시그니처가 어긋나는 순간 컴파일러가 "재정의하는 상위 메서드가 없다"며 에러를 냅니다. 의도와 실제의 불일치를 런타임 버그가 되기 전에 잡는 안전망입니다.

그래서 재정의하는 모든 메서드에 `@Override`를 붙이는 것이 강력히 권장됩니다. 인터페이스 구현 메서드에도 붙일 수 있습니다(자바 6부터).

## @Deprecated — 사용 중단 표시

`@Deprecated`는 "이 API는 더 이상 권장하지 않는다"는 표시입니다. 붙은 요소를 다른 코드에서 사용하면 컴파일러가 경고를 냅니다.

```java
public class LegacyService {

    @Deprecated(since = "2.0", forRemoval = true)
    public void oldMethod() { ... }

    public void newMethod() { ... }  // 이것을 쓰라
}
```

자바 9부터 두 요소가 추가되어 deprecation에 맥락을 줄 수 있습니다.

- `since` — 언제부터 deprecated 되었는지(버전).
- `forRemoval` — 단순 비권장인지(`false`), 아예 제거 예정인지(`true`). `true`면 컴파일러가 더 강한 경고를 냅니다.

`@Deprecated`는 코드의 애너테이션이고, 그와 짝을 이루는 `@deprecated`(소문자) Javadoc 태그로 "대신 무엇을 쓰라"는 설명을 문서에 남기는 것이 좋은 관행입니다.

```java
/**
 * @deprecated 2.0부터 사용 중단. 대신 {@link #newMethod()}를 사용하세요.
 */
@Deprecated(since = "2.0", forRemoval = true)
public void oldMethod() { ... }
```

## @SuppressWarnings — 경고를 의도적으로 끈다

때로는 우리가 무엇을 하는지 알면서도 컴파일러 경고가 뜨는 상황이 있습니다. 대표적으로 제네릭 타입 소거로 인한 unchecked 경고입니다. 이럴 때 `@SuppressWarnings`로 특정 경고만 끕니다.

```java
@SuppressWarnings("unchecked")
List<String> list = (List<String>) rawList;  // 안전함을 우리가 보장
```

자주 쓰는 인자는 다음과 같습니다.

- `"unchecked"` — 검증되지 않은 제네릭 변환 경고.
- `"deprecation"` — deprecated API 사용 경고.
- `"rawtypes"` — 로(raw) 타입 사용 경고.
- `"all"` — 모든 경고(권장하지 않음).

여기서 가장 중요한 원칙은 **범위를 최소화**하는 것입니다. `@SuppressWarnings`는 클래스, 메서드, 지역 변수 어디에나 붙일 수 있는데, 가능한 한 좁은 범위에 붙여야 합니다. 클래스 전체에 `@SuppressWarnings("all")`을 붙이면, 정작 잡아야 할 진짜 경고까지 묻혀 버립니다. 경고를 끄는 것은 "이 경고는 검토했고 안전하다"는 선언이므로, 그 검토가 닿는 최소 단위(보통 변수나 한 메서드)에만 적용하는 것이 정석입니다.

## 정리

- `@Override`는 재정의 의도를 컴파일러에 알려, 시그니처가 어긋나면 컴파일 에러로 잡아 준다 — 재정의 메서드에는 항상 붙이는 것이 권장된다.
- `@Deprecated`는 사용 중단을 표시하고, 자바 9부터 `since`(버전)와 `forRemoval`(제거 예정 여부) 요소를 갖는다.
- `@Deprecated`는 Javadoc의 `@deprecated` 태그와 짝지어 "대안"을 문서에 남기는 것이 좋다.
- `@SuppressWarnings`는 `"unchecked"`, `"deprecation"` 등 특정 경고를 의도적으로 끄며, **가능한 한 좁은 범위**에만 붙여야 진짜 경고가 묻히지 않는다.
- 세 애너테이션 모두 컴파일러가 읽는 것으로, 런타임 동작이 아니라 컴파일 단계의 안전성과 의도 점검에 쓰인다.

---

**지난 글:** [애너테이션 기초 — 코드에 메타데이터 붙이기](/posts/java-annotation-basics/)

**다음 글:** [메타 애너테이션 — @Retention·@Target·@Documented·@Inherited](/posts/java-meta-annotations/)

<br>
읽어주셔서 감사합니다. 😊
