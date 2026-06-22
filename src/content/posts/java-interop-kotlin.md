---
title: "Java와 Kotlin 상호운용"
description: "자바와 Kotlin은 같은 바이트코드로 컴파일되어 한 프로젝트에서 서로를 자유롭게 호출합니다. 양방향 호출의 원리, getter/setter와 프로퍼티의 대응, 플랫폼 타입과 null, companion·@JvmStatic 같은 마찰점, 그리고 점진적 도입 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-23"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "Kotlin", "상호운용", "JVM", "마이그레이션"]
featured: false
draft: false
---

[지난 글](/posts/java-vs-scala/)에서 함수형의 무게를 끌어안은 Scala를 살펴봤습니다. 이제 다시 Kotlin으로 돌아옵니다. 앞선 글들에서 자바와 Kotlin을 섞어 쓸 수 있다는 말을 여러 번 했는데, 이번 글에서는 그 **상호운용(interoperability)** 이 실제로 어떻게 작동하는지를 구체적으로 들여다봅니다. 기존 자바 프로젝트에 Kotlin을 점진적으로 들여오려는 팀에게 이 주제는 단순한 호기심이 아니라 현실적인 핵심입니다.

## 상호운용의 토대 — 같은 바이트코드

상호운용이 가능한 근본 이유는 이미 앞에서 봤습니다. 자바와 Kotlin은 둘 다 `.class` **바이트코드** 로 컴파일됩니다. 컴파일이 끝나고 나면, 어떤 클래스가 자바에서 왔는지 Kotlin에서 왔는지는 JVM에게 아무 의미가 없습니다. 그냥 똑같은 바이트코드일 뿐입니다.

![자바와 Kotlin — 양방향으로 서로를 호출한다](/assets/posts/java-interop-kotlin-bidirectional.svg)

그래서 상호운용은 **양방향** 입니다. Kotlin에서 자바 클래스를 호출하는 것도, 자바에서 Kotlin 클래스를 호출하는 것도 모두 됩니다. 한쪽 언어로 작성한 클래스는 다른 쪽 언어에게는 그저 또 하나의 클래스로 보입니다. 이 양방향성이 점진적 도입을 가능하게 하는 토대입니다.

## Kotlin에서 자바 호출하기

방향 중 더 매끄러운 쪽은 Kotlin → 자바입니다. Kotlin은 애초에 자바 생태계 위에서 동작하도록 설계되었기에, 자바 라이브러리와 클래스를 거의 그대로 호출합니다.

```kotlin
import java.util.ArrayList

val list = ArrayList<String>()   // 자바 컬렉션
list.add("홍길동")
list.add("이몽룡")

// 자바의 getter가 Kotlin에서는 프로퍼티처럼 보인다
val first = list[0]
println(list.size)               // getSize() → .size
```

여기서 흥미로운 변환이 하나 보입니다. 자바의 `getXxx()`/`setXxx()` 같은 접근자 메서드를 Kotlin은 **프로퍼티처럼** 다룹니다. 자바에서 `person.getName()`이던 것이 Kotlin에서는 `person.name`으로 읽힙니다. 자바의 관습을 Kotlin의 문법으로 자연스럽게 번역해 주는 것입니다.

## 마찰점 — null과 플랫폼 타입

다만 완전히 매끄럽지만은 않습니다. 가장 신경 써야 할 마찰점은 **null** 입니다. Kotlin은 타입에 null 가능성을 새기지만, 자바에는 그런 정보가 없습니다. 그래서 자바 메서드가 돌려주는 값을 Kotlin은 "널일 수도, 아닐 수도 있는" **플랫폼 타입**(`String!`)으로 봅니다.

![상호운용에서 신경 쓸 세 가지 마찰점](/assets/posts/java-interop-kotlin-friction.svg)

플랫폼 타입은 Kotlin의 null 검사를 강제하지 않으므로 편하지만, 자바가 실제로 null을 돌려주면 Kotlin 쪽에서 NPE가 날 수 있습니다. 자바 코드에 `@Nullable`/`@NotNull` 애너테이션을 달아 두면, Kotlin이 그 정보를 읽어 적절한 null 타입으로 인식해 줍니다. 자바와 Kotlin을 섞는 프로젝트에서 이 애너테이션은 작지만 중요한 다리 역할을 합니다.

## 자바에서 Kotlin 호출하기

반대 방향, 자바 → Kotlin도 잘 됩니다. 다만 Kotlin의 일부 기능은 바이트코드로 표현될 때 자바에서 부르기 약간 어색해질 수 있어, Kotlin 쪽에 약간의 배려가 필요합니다. 대표적인 것이 **companion object** 와 정적 멤버입니다.

```kotlin
class MathUtil {
    companion object {
        @JvmStatic
        fun square(n: Int): Int = n * n
    }
}
```

```java
// 자바에서 호출
int r = MathUtil.square(5);   // @JvmStatic 덕분에 깔끔하게 호출
```

Kotlin의 `companion object` 멤버는 기본적으로는 자바에서 `MathUtil.Companion.square(5)`처럼 불러야 하지만, `@JvmStatic`을 붙이면 자바에서 일반 정적 메서드처럼 `MathUtil.square(5)`로 호출됩니다. 이 밖에 최상위 함수를 담는 파일 이름을 지정하는 `@JvmName`, 기본값 매개변수를 자바용 오버로드로 펼치는 `@JvmOverloads` 등, Kotlin은 자바 친화적 호출을 돕는 애너테이션을 여럿 제공합니다.

## 점진적 도입 전략

이 상호운용성의 실질적 가치는 **점진적 도입** 에 있습니다. 거대한 자바 코드베이스를 한 번에 Kotlin으로 다시 쓸 필요가 없습니다. 빌드에 Kotlin을 추가하면, 자바와 Kotlin 소스가 한 모듈 안에 공존하며 서로를 호출합니다.

현실적인 전략은 보통 이렇습니다. 새로 추가하는 클래스부터 Kotlin으로 작성하고, 기존 자바 코드는 그대로 둡니다. 손볼 일이 생긴 파일을 하나씩 Kotlin으로 변환하며 범위를 넓혀 갑니다. IntelliJ의 자바→Kotlin 자동 변환은 이 과정을 크게 거듭니다. 이렇게 하면 위험을 분산하면서, 멈추지 않고 돌아가는 시스템 위에서 천천히 언어를 옮겨 갈 수 있습니다.

## 정리

자바와 Kotlin은 같은 바이트코드로 컴파일되므로 한 프로젝트에서 양방향으로 서로를 호출할 수 있습니다. Kotlin은 자바의 getter/setter를 프로퍼티로 자연스럽게 다루고, 자바는 `@JvmStatic`·`@JvmOverloads` 같은 배려를 받아 Kotlin을 매끄럽게 부릅니다. 가장 큰 마찰점은 null로, 자바의 값은 플랫폼 타입으로 보이며 `@Nullable`/`@NotNull` 애너테이션이 다리가 되어 줍니다. 이 상호운용성 덕분에 기존 자바 코드를 멈추지 않고 점진적으로 Kotlin을 들여올 수 있습니다. 이로써 네트워킹과 JVM 언어 생태계를 함께 돌아본 이번 묶음을 마무리합니다. 자바라는 언어가 홀로 서 있는 것이 아니라, 풍부한 통신 도구와 이웃 언어들 속에서 살아 숨 쉬고 있다는 사실을 확인할 수 있었습니다.

---

**지난 글:** [Java vs Scala — 함수형의 무게](/posts/java-vs-scala/)

<br>
읽어주셔서 감사합니다. 😊
