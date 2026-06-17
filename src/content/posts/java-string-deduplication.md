---
title: "문자열 중복 제거 — G1이 똑같은 문자열을 합치는 법"
description: "String Deduplication은 내용이 같은 여러 String 객체가 하나의 내부 배열을 공유하도록 만들어 힙 메모리를 절약하는 G1 GC 기능입니다. 동작 원리와 활성화 방법, 그리고 String 인터닝·중복 제거의 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "GC", "String", "메모리"]
featured: false
draft: false
---

[지난 글](/posts/java-escape-analysis/)에서 JIT가 객체 할당 자체를 없애는 이스케이프 분석을 봤습니다. 그런데 모든 객체가 그렇게 사라질 수 있는 건 아닙니다. 특히 **문자열**은 애플리케이션 힙의 상당 부분을 차지하는 단골입니다. 여러 분석에 따르면 자바 애플리케이션 힙의 25% 안팎이 `String`이고, 그중 상당수는 내용이 서로 똑같습니다 — `"true"`, `"KR"`, 같은 URL, 같은 사용자 이름이 수천 번씩 중복되죠. G1 GC의 **문자열 중복 제거(String Deduplication)** 는 이 낭비를 GC가 알아서 줄여 주는 기능입니다.

## 같은 내용, 다른 배열

자바의 `String`은 사실 두 부분으로 나뉩니다. `String` 객체 자체(메타데이터와 참조)와, 실제 문자를 담은 내부 배열(자바 9부터는 `byte[]`)입니다. 내용이 같은 문자열을 여러 번 만들면, `String` 객체도 여러 개고 내부 배열도 각각 별도로 존재합니다.

![내부 배열 공유](/assets/posts/java-string-deduplication-heap.svg)

문자열 중복 제거의 아이디어는 단순합니다. **`String` 객체는 그대로 두되, 내용이 같은 것들의 내부 배열만 하나로 합쳐 공유**시키는 것입니다. `String`이 불변(immutable)이고 내부 배열이 외부로 노출되지 않기 때문에 이 공유는 완전히 안전합니다. 어차피 아무도 그 배열을 바꿀 수 없으니까요.

## G1이 GC 중에 처리한다

이 기능은 G1 GC에 통합되어 있으며 기본적으로 꺼져 있습니다. 켜려면 플래그가 필요합니다.

```bash
java -XX:+UseG1GC -XX:+UseStringDeduplication app.jar
```

동작은 GC 사이클에 얹혀 일어납니다.

![G1 String Deduplication 흐름](/assets/posts/java-string-deduplication-flow.svg)

Young GC 동안 일정 나이를 넘긴 `String`들이 중복 제거 후보 큐에 올라갑니다. 그러면 별도의 백그라운드 스레드가 각 후보의 내부 배열 해시를 계산하고, 전용 해시 테이블에서 같은 내용의 배열이 이미 있는지 찾습니다. 있으면 후보의 내부 배열 참조를 기존 것으로 바꾸고, 떨어져 나온 중복 배열은 다음 GC에서 수거됩니다. 애플리케이션 스레드를 멈추지 않고 GC 작업에 묻어가므로 추가 STW(Stop-The-World) 비용이 거의 없습니다.

```text
# -Xlog:stringdedup*=debug 로그 예시
Concurrent String Deduplication 3658.0K->1834.2K (49.8%)
   [Inspected: 12,043, Skipped: 211, New: 5,902, Known: 6,141]
```

위 로그는 한 사이클에서 약 3.6MB의 문자열 배열을 검사해 절반 가까이를 절약했다는 뜻입니다. `Known`은 이미 알려진 배열로 합쳐진 건수, `New`는 처음 본 배열입니다.

## 인터닝(intern)과는 다르다

여기서 `String.intern()`과 혼동하기 쉽습니다. 둘은 목적은 비슷해도 메커니즘이 다릅니다.

```java
String a = new String("KR");
String b = new String("KR");

a == b;                 // false — 서로 다른 String 객체
a.intern() == b.intern(); // true  — 풀의 동일 객체로 통일
```

`intern()`은 **개발자가 명시적으로 호출**해 `String` **객체 자체**를 문자열 풀의 동일 인스턴스로 통일합니다. 반면 중복 제거는 **GC가 자동으로** `String` 객체는 그대로 둔 채 **내부 배열만** 공유합니다. 그래서 중복 제거 후에도 `a == b`는 여전히 `false`입니다 — 객체는 둘이고 배열만 하나입니다. 동작에 영향을 주지 않으면서 메모리만 줄이는 것이 핵심입니다.

## 켤까 말까

문자열 중복 제거는 "켜면 무조건 이득"인 기능은 아닙니다. 판단 기준은 이렇습니다.

- **켜면 좋은 경우**: 힙이 크고 문자열 비중이 높으며, 중복이 많은 워크로드(캐시, 메시지 처리, 다수의 동일 라벨/코드 등). 메모리 압박이 실제 병목일 때.
- **굳이 필요 없는 경우**: 문자열이 적거나 거의 유일한 값들이라면, 해시 계산·테이블 관리 비용만 들고 절약은 적습니다.

언제나 그렇듯 **측정이 먼저**입니다. 힙 덤프나 `-Xlog:stringdedup`으로 중복 문자열이 실제로 많은지 확인한 뒤 켜는 것이 옳습니다.

## 정리

문자열 중복 제거는 G1 GC가 내용이 같은 문자열들의 내부 배열을 안전하게 하나로 합쳐 메모리를 절약하는 기능입니다. `String`의 불변성과 객체/배열 분리 구조가 이를 가능하게 합니다. 명시적 `intern()`과 달리 코드 변경 없이 GC가 자동으로 처리하지만, 중복이 실제로 많은 워크로드에서만 의미가 있습니다. 다음 글에서는 JIT의 또 다른 고전적 최적화인 루프 언롤링으로 넘어갑니다.

---

**지난 글:** [이스케이프 분석 — 힙 할당을 없애는 JIT 최적화](/posts/java-escape-analysis/)

**다음 글:** [루프 언롤링 — JIT가 반복문을 펼치는 이유](/posts/java-loop-unrolling/)

<br>
읽어주셔서 감사합니다. 😊
