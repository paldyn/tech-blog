---
title: "제거·폐기된 API 정리"
description: "Java 마이그레이션에서 반복적으로 마주치는 폐기·제거된 API를 한데 모아 정리합니다. @Deprecated의 생명주기(폐기 예고 → forRemoval → 제거), jdeprscan 진단, Thread.stop·finalize·SecurityManager·Date 등 주요 항목의 대체 방법을 실전 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-07-05"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "마이그레이션", "Deprecated", "API제거", "레거시", "jdeprscan"]
featured: false
draft: false
---

[지난 글](/posts/java-migration-17-to-21/)에서 17→21 마이그레이션을 다뤘다. 세 번의 마이그레이션 글을 관통하며 반복적으로 등장한 주제가 하나 있다. 바로 **폐기(deprecated)되거나 제거(removed)된 API** 다. 이번 글에서는 이 주제를 한데 모아, 폐기가 어떤 단계를 거쳐 제거로 이어지는지, 그리고 레거시 코드에서 자주 마주치는 항목들을 무엇으로 대체할지 정리한다. 마이그레이션 시리즈를 마무리하는 실전 참고서 격의 글이다.

## 폐기는 "예고"다

Java에서 `@Deprecated` 는 "이제 쓰지 말라"는 표시일 뿐, 즉시 사라진다는 뜻은 아니다. Java 9부터는 폐기가 두 단계로 세분화되어, 제거가 임박한 API를 명확히 구분한다.

![API 폐기·제거 생명주기](/assets/posts/java-deprecated-removed-apis-lifecycle.svg)

```java
// 단순 폐기 — 더 나은 대안이 있으니 지양 (당장 제거는 아님)
@Deprecated
public void oldMethod() { ... }

// 제거 예정 — 곧 사라짐, 반드시 이전 필요
@Deprecated(since = "9", forRemoval = true)
public void doomedMethod() { ... }
```

핵심은 **`forRemoval = true`** 를 놓치지 않는 것이다. 이 표시가 붙은 API는 예고된 제거 대상이므로, 폐기 경고를 방치하면 언젠가 JDK를 올릴 때 컴파일이 통째로 깨진다. 폐기 경고는 "나중에 갚아야 할 빚"이고, 방치할수록 이자가 붙는다.

## jdeprscan으로 미리 진단하기

어떤 폐기 API를 쓰고 있는지 일일이 눈으로 찾을 필요는 없다. JDK에 포함된 **jdeprscan** 이 컴파일된 클래스나 JAR을 스캔해 폐기 API 사용을 목록으로 뽑아준다.

```bash
# 애플리케이션이 사용하는 폐기 API 스캔
jdeprscan --release 21 app.jar

# 제거 예정(forRemoval) API만 집중 확인
jdeprscan --for-removal --release 21 app.jar
```

마이그레이션 전에 이 진단을 돌려두면, 어떤 API가 어느 단계에 있는지 미리 파악해 우선순위를 정할 수 있다. `jdeps`(모듈·내부 API 진단)와 함께 쓰면 마이그레이션 리스크를 크게 줄인다.

## 자주 마주치는 항목과 대체

레거시 코드를 현대화할 때 반복적으로 부딪히는 대표 항목들을 정리한다.

![주요 폐기·제거 API와 대체](/assets/posts/java-deprecated-removed-apis-notable.svg)

### Thread.stop() / suspend() / resume()

스레드를 강제로 멈추는 이 메서드들은 락을 쥔 채 중단시켜 객체 상태를 깨뜨릴 수 있어 오래전부터 폐기됐다. 올바른 방법은 **인터럽트나 플래그로 협조적 종료** 를 구현하는 것이다.

```java
// ✅ 협조적 종료 — 스레드가 스스로 안전한 지점에서 멈춤
class Worker implements Runnable {
    private volatile boolean running = true;
    public void stop() { running = false; }
    public void run() {
        while (running && !Thread.currentThread().isInterrupted()) {
            doWork();
        }
    }
}
```

### finalize()

객체 소멸 시점에 호출되던 `finalize()` 는 실행 시점이 보장되지 않고 GC 성능을 해쳐 폐기됐다. 자원 해제는 **try-with-resources**(가장 우선)나 **Cleaner** 로 대체한다.

```java
// ✅ try-with-resources — 결정적(deterministic) 자원 해제
try (var resource = new MyResource()) {
    resource.use();
} // 블록을 벗어나는 즉시 close() 호출
```

### 래퍼 생성자: new Integer(x)

`new Integer(5)` 같은 박싱 래퍼 생성자는 매번 새 객체를 만들어 캐시를 활용하지 못한다. **정적 팩터리 메서드** 나 오토박싱을 쓴다.

```java
// ❌ 폐기 — 캐시 미활용, 불필요한 객체 생성
Integer a = new Integer(127);

// ✅ 팩터리 — 작은 값은 캐시 재사용
Integer b = Integer.valueOf(127);
Integer c = 127; // 오토박싱도 내부적으로 valueOf 사용
```

### Date / Calendar

가변이고 API 설계가 혼란스러운 `java.util.Date`·`Calendar` 는 사실상 **java.time** 으로 대체됐다. 불변이고 스레드 안전한 현대 날짜·시간 API다.

```java
// ✅ java.time — 불변, 명확, 스레드 안전
LocalDate today = LocalDate.now();
LocalDate deadline = today.plusDays(30);
ZonedDateTime seoul = ZonedDateTime.now(ZoneId.of("Asia/Seoul"));
```

### SecurityManager와 Applet

`SecurityManager` 는 Java 17에서 제거 예정으로 폐기됐고, `Applet` API도 브라우저 지원 종료와 함께 폐기됐다. 격리는 OS·컨테이너 수준에서 처리하고, 애플릿이 하던 역할은 웹 표준 기술로 대체한다.

## 실전 원칙

| 원칙 | 설명 |
|------|------|
| 경고를 즉시 처리 | 폐기 경고는 방치할수록 마이그레이션 비용 증가 |
| forRemoval 우선 | 제거 예정 API부터 대체 |
| 진단 도구 활용 | jdeprscan·jdeps로 미리 목록화 |
| 릴리스 노트 확인 | 정확한 제거 버전은 JDK 릴리스 노트로 |
| 새 코드는 최신 API | 레거시 패턴을 새로 도입하지 않기 |

폐기·제거 대응의 본질은 기술이 아니라 **습관** 이다. JDK를 올릴 때마다 경고를 정리하는 작은 규율이, 몇 년 뒤 컴파일이 통째로 깨지는 대형 마이그레이션을 예방한다.

## 정리

- `@Deprecated` 는 즉시 제거가 아니라 **예고** 이며, `forRemoval = true` 가 제거 임박 신호다.
- **jdeprscan** 으로 폐기 API 사용을 미리 진단해 우선순위를 정한다.
- `Thread.stop`·`finalize`·래퍼 생성자·`Date/Calendar`·`SecurityManager` 등은 각각의 현대적 대안으로 대체한다.
- 폐기 경고를 **즉시 처리하는 습관** 이 대형 마이그레이션을 예방한다.

이로써 보안과 마이그레이션을 아우른 이번 시리즈 구간을 마무리한다. 각 주제의 세부 기술은 앞서 다룬 개별 글들에서 더 깊이 확인할 수 있다.

---

**지난 글:** [Java 17 → 21 마이그레이션](/posts/java-migration-17-to-21/)

<br>
읽어주셔서 감사합니다. 😊
