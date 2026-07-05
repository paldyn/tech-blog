---
title: "Java 17 → 21 마이그레이션"
description: "가상 스레드라는 동시성 패러다임 변화를 담은 Java 17 → 21 마이그레이션을 다룹니다. 새로 정식화된 기능(가상 스레드·switch 패턴 매칭·레코드 패턴·순차 컬렉션), 가상 스레드 도입 시 재검토할 관행(스레드 풀·synchronized·ThreadLocal), 단계별 이동 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-07-05"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "마이그레이션", "Java21", "Java17", "LTS", "가상스레드"]
featured: false
draft: false
---

[지난 글](/posts/java-migration-11-to-17/)에서 매끄러웠던 11→17을 다뤘다. **17 → 21** 역시 하위 호환 면에서는 순탄하지만, 성격이 조금 다르다. 문법이 깨지지는 않는데, **가상 스레드(Virtual Threads)** 라는 동시성 모델의 근본적 변화가 담겨 있기 때문이다. 즉 "컴파일이 안 되는" 문제는 거의 없지만, "지금까지의 설계 관행을 다시 생각해야 하는" 지점이 생긴다. 이 글은 그 변화의 지형을 그린다.

## 무엇을 새로 얻는가

21은 여러 프리뷰 기능이 대거 정식화된 LTS다. 그중 단연 돋보이는 것은 가상 스레드지만, 코드를 간결하게 만드는 언어 기능도 함께 들어왔다.

![17 → 21의 핵심 신기능](/assets/posts/java-migration-17-to-21-highlights.svg)

가상 스레드를 뺀 나머지는 앞선 LTS와 마찬가지로 순수한 이득이다. **switch 패턴 매칭** 과 **레코드 패턴** 은 타입 분기와 데이터 분해 코드를 크게 줄인다.

```java
// Java 21 — switch 패턴 매칭 + 레코드 패턴
sealed interface Shape permits Circle, Rectangle {}
record Circle(double radius) {}
record Rectangle(double w, double h) {}

double area(Shape shape) {
    return switch (shape) {
        case Circle(double r)         -> Math.PI * r * r;   // 레코드 분해
        case Rectangle(double w, double h) -> w * h;        // 필드 직접 바인딩
    };  // sealed 덕분에 default 불필요 — 컴파일러가 완전성 검증
}
```

**순차 컬렉션(Sequenced Collections)** 은 `List`, `Deque`, `LinkedHashSet` 등에 `getFirst()`·`getLast()`·`reversed()` 같은 통일된 순서 API를 더한다.

```java
// Java 21 — 통일된 첫/마지막 원소 접근
List<String> list = List.of("a", "b", "c");
String first = list.getFirst();  // 기존 list.get(0)
String last  = list.getLast();   // 기존 list.get(list.size() - 1)
```

이 언어 기능들은 모두 하위 호환이므로, 17 코드는 대부분 손대지 않고 21에서 컴파일·실행된다.

## 진짜 변화: 가상 스레드

가상 스레드는 JVM이 관리하는 경량 스레드다. 기존 플랫폼 스레드가 OS 스레드에 1:1로 묶여 수천 개가 한계였다면, 가상 스레드는 **수백만 개까지** 만들 수 있다. 블로킹 I/O에서 대기하는 동안 캐리어(플랫폼) 스레드를 반납하기 때문이다. 중요한 것은, 이 이득을 얻기 위해 코드를 리액티브 스타일로 다시 쓸 필요가 없다는 점이다. **평범한 동기·블로킹 코드가 그대로 확장** 된다.

```java
// Java 21 — 요청마다 가상 스레드 하나, 블로킹 코드 그대로
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 1_000_000; i++) {
        executor.submit(() -> {
            // 평범한 블로킹 호출 — 리액티브로 바꿀 필요 없음
            var response = httpClient.send(request, ofString());
            process(response);
            return null;
        });
    }
} // executor.close()가 모든 작업 완료를 기다림
```

## 도입 시 재검토할 관행

가상 스레드의 함정은 문법이 아니라 **기존 관행** 에 있다. 플랫폼 스레드 시절에 최적이던 패턴 중 일부가 가상 스레드에서는 역효과를 낸다.

![가상 스레드 도입 시 재검토할 것](/assets/posts/java-migration-17-to-21-threads.svg)

가장 흔한 실수는 **가상 스레드를 풀링하는 것** 이다. 플랫폼 스레드는 생성 비용이 커서 풀로 재사용했지만, 가상 스레드는 생성 비용이 거의 없으므로 작업마다 새로 만드는 것이 정석이다. 고정 크기 스레드 풀에 가상 스레드를 담으면 오히려 동시성을 제한해 이점을 없앤다.

또 하나는 **긴 `synchronized` 블록** 이다. 가상 스레드가 `synchronized` 안에서 블로킹되면 캐리어 스레드에 고정(pinning)되어 반납되지 못한다. 이 문제가 우려되면 `java.util.concurrent.locks.ReentrantLock` 으로 교체하는 것을 검토한다(21에서 pinning을 진단하려면 `-Djdk.tracePinnedThreads=full` 을 쓴다). 마지막으로 스레드 수가 폭증하는 만큼 `ThreadLocal` 남용은 메모리 부담으로 이어질 수 있어, 필요하면 구조적 대안을 고려한다.

## 마이그레이션 전략

17→21의 이동 자체는 가볍다. 어려운 부분은 가상 스레드를 "언제, 어디에" 도입할지 결정하는 데 있다.

| 단계 | 할 일 |
|------|------|
| 1 | 라이브러리를 21 호환 버전으로 업데이트 |
| 2 | JDK 21로 컴파일·테스트 (대개 소스 무변경) |
| 3 | 운영 검증 후 배포 — 여기까지가 순수 마이그레이션 |
| 4 | (선택) I/O 바운드 경로부터 가상 스레드 점진 도입 |
| 5 | pinning·풀링 관행 점검 후 확대 |

핵심은 **3번까지와 4번 이후를 분리** 하는 것이다. 마이그레이션과 가상 스레드 도입을 한 번에 하려 하지 말고, 먼저 21로 안전하게 올린 뒤 I/O 바운드 경로부터 가상 스레드를 점진적으로 실험하는 편이 리스크가 낮다.

## 정리

- 17→21은 하위 호환이 좋아 소스 변경 없이 대부분 넘어간다.
- **가상 스레드** 가 최대 변화로, 동기·블로킹 코드를 리라이트 없이 대규모 확장할 수 있게 한다.
- 도입 시 **풀링 금지·긴 synchronized 회피·ThreadLocal 절제** 를 재검토한다.
- switch 패턴 매칭·레코드 패턴·순차 컬렉션은 선택적으로 도입하는 순수 이득이다.
- 마이그레이션과 가상 스레드 도입을 **분리** 해 단계적으로 진행한다.

다음 글에서는 이 마이그레이션들에서 반복적으로 부딪히는 **제거·폐기된 API** 를 한데 모아 정리한다.

---

**지난 글:** [Java 11 → 17 마이그레이션](/posts/java-migration-11-to-17/)

**다음 글:** [제거·폐기된 API 정리](/posts/java-deprecated-removed-apis/)

<br>
읽어주셔서 감사합니다. 😊
