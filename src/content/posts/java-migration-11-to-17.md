---
title: "Java 11 → 17 마이그레이션"
description: "LTS에서 LTS로 이동하는 비교적 매끄러운 구간인 Java 11 → 17 마이그레이션을 다룹니다. 강한 캡슐화(JEP 396)로 인한 내부 API 차단 대응, 새로 정식화된 언어 기능(records·sealed·switch 표현식·text blocks), 최신 GC 도입을 실전 관점에서 정리합니다."
author: "PALDYN Team"
pubDate: "2026-07-05"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "마이그레이션", "Java17", "Java11", "LTS", "강한캡슐화"]
featured: false
draft: false
---

[지난 글](/posts/java-migration-8-to-11/)에서 가장 험난한 구간인 8→11을 다뤘다. 그에 비하면 **11 → 17** 은 훨씬 수월하다. 모듈 시스템이라는 대격변은 이미 8→11에서 지났고, 11과 17 사이에는 하위 호환을 깨는 구조적 변화가 거의 없기 때문이다. 그래서 이 글은 "무엇이 깨지는가"보다 "무엇을 새로 얻는가"에 무게를 둔다. 그럼에도 딱 하나 주의해야 할 지점이 있으니, 먼저 그것부터 짚는다.

## 유일한 주의점: 강한 캡슐화

8→11에서 내부 API 접근이 "경고"로 바뀌었다면, 17에서는 그 경고가 **실제 차단** 으로 강화됐다. Java 16의 JEP 396(Strongly Encapsulate JDK Internals)이 기본값을 바꾸면서, 11에서는 잘 돌아가던 내부 API 리플렉션 코드가 17에서는 예외를 던진다.

![강한 캡슐화(JEP 396)의 영향](/assets/posts/java-migration-11-to-17-encapsulation.svg)

11에서 이런 경고를 보고도 무시했다면 17에서 문제가 표면화된다.

```
// Java 11: 경고만 출력, 동작은 계속
WARNING: An illegal reflective access operation has occurred

// Java 17: 같은 코드가 예외로 실패
java.lang.reflect.InaccessibleObjectException:
  Unable to make field private final ... accessible:
  module java.base does not "opens java.lang" to unnamed module
```

해법은 8→11 때와 같다. **내부 API에 의존하는 라이브러리를 17 호환 버전으로 업데이트하는 것** 이 정석이다. 대부분의 최신 프레임워크(Spring Boot 3, Hibernate 6 등)는 이미 이 문제를 해결한 상태다. 라이브러리를 당장 올릴 수 없을 때만 `--add-opens` 로 특정 패키지를 임시 개방한다.

```bash
# 불가피할 때만 — 근본 해법은 라이브러리 업데이트
java --add-opens java.base/java.lang=ALL-UNNAMED \
     --add-opens java.base/java.util=ALL-UNNAMED \
     -jar app.jar
```

11에서 실행 시 `-Dsun.misc.URLClassPath.disableJarChecking` 같은 우회나 `--illegal-access=warn` 로그를 미리 점검해 두면, 17로 올라가기 전에 위험 지점을 파악할 수 있다.

## 새로 정식화된 언어 기능

11에서 17로 오면, 12~17에 걸쳐 프리뷰를 거쳐 정식화된 언어 기능이 한꺼번에 활성화된다. 모두 하위 호환이므로 기존 코드는 그대로 두고, 새 코드에 선택적으로 도입하면 된다.

![11 → 17로 얻는 언어 기능](/assets/posts/java-migration-11-to-17-gains.svg)

특히 실무 코드를 눈에 띄게 간결하게 만드는 것은 **레코드와 switch 표현식** 이다. 11 시절의 장황한 코드가 17에서 어떻게 줄어드는지 비교해보자.

```java
// Java 11 스타일 — 데이터 클래스 + 값 매핑
public final class Point {
    private final int x;
    private final int y;
    public Point(int x, int y) { this.x = x; this.y = y; }
    public int getX() { return x; }
    public int getY() { return y; }
    // equals, hashCode, toString ... 수십 줄
}

String describe(String grade) {
    switch (grade) {
        case "A": return "우수";
        case "B": return "양호";
        default:  return "재검토";
    }
}
```

```java
// Java 17 스타일 — 레코드 + switch 표현식
public record Point(int x, int y) {}  // equals/hashCode/toString 자동 생성

String describe(String grade) {
    return switch (grade) {           // 표현식 — fall-through 없음
        case "A" -> "우수";
        case "B" -> "양호";
        default  -> "재검토";
    };
}
```

`instanceof` 패턴 매칭도 캐스팅 보일러플레이트를 없앤다.

```java
// Java 17 — instanceof 후 자동으로 캐스팅된 변수 사용
Object obj = fetch();
if (obj instanceof String s && !s.isBlank()) {
    // s는 이미 String으로 캐스팅됨
    System.out.println(s.length());
}
```

## GC와 런타임의 이득

언어 기능 외에도, 17에서는 저지연 GC인 **ZGC와 Shenandoah가 정식(production-ready)** 이 되어 큰 힙에서도 밀리초 단위의 짧은 정지 시간을 얻을 수 있다. 컨테이너 리소스 인식, 시작 시간 개선(CDS), 향상된 NPE 메시지 등 운영 품질을 높이는 개선도 함께 따라온다.

```bash
# 17에서 저지연 GC 선택 (기본은 여전히 G1)
java -XX:+UseZGC -jar app.jar
```

## 마이그레이션 순서 요약

11→17은 8→11의 축소판이다. 같은 원칙을 더 가볍게 적용하면 된다.

| 단계 | 할 일 |
|------|------|
| 1 | 라이브러리를 17 호환 버전으로 업데이트 |
| 2 | `--illegal-access` 관련 경고·내부 API 접근 점검 |
| 3 | JDK 17로 컴파일 (대개 소스 변경 불필요) |
| 4 | 테스트·런타임 검증 후 배포 |
| 5 | (선택) 레코드·switch 표현식으로 점진적 현대화 |

핵심은 5번이 **선택 사항** 이라는 점이다. 마이그레이션 자체는 소스를 거의 건드리지 않고 끝나며, 새 문법 도입은 이후 여유 있게 진행하면 된다.

## 정리

- 11→17은 하위 호환을 깨는 변화가 거의 없어 **비교적 매끄럽다.**
- 유일한 실질적 주의점은 **강한 캡슐화(JEP 396)** 로 내부 API 접근이 경고에서 차단으로 바뀐 것 — 라이브러리 업데이트로 해결한다.
- 레코드·sealed·switch 표현식·text blocks·패턴 매칭이 **한꺼번에 정식화** 되며, 모두 선택적으로 도입 가능하다.
- ZGC·Shenandoah 정식화로 저지연 GC의 이점을 바로 누릴 수 있다.

다음 글에서는 가상 스레드 등 큰 변화가 담긴 **17 → 21 마이그레이션** 을 다룬다.

---

**지난 글:** [Java 8 → 11 마이그레이션](/posts/java-migration-8-to-11/)

**다음 글:** [Java 17 → 21 마이그레이션](/posts/java-migration-17-to-21/)

<br>
읽어주셔서 감사합니다. 😊
