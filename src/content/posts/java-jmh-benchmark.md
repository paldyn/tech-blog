---
title: "JMH — 신뢰할 수 있는 마이크로벤치마크"
description: "JMH(Java Microbenchmark Harness)는 웜업·측정 반복과 다중 포크, Blackhole·@State로 데드코드 제거와 상수 폴딩을 막아 정확한 성능 측정을 돕습니다. 손으로 짠 벤치마크가 틀리는 이유와 JMH 기본 사용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "JMH", "벤치마크", "성능"]
featured: false
draft: false
---

[지난 글](/posts/java-loop-unrolling/)에서 "손으로 측정하면 거의 틀린다"고 했습니다. 이번 글은 그 약속을 지키는 글입니다. JIT 컴파일, 웜업, 데드코드 제거, 상수 폴딩 — 지금까지 본 모든 최적화가 우리의 측정을 교란합니다. `System.nanoTime()`으로 감싸 시간을 재는 순진한 방법은 거의 항상 잘못된 숫자를 줍니다. **JMH(Java Microbenchmark Harness)** 는 OpenJDK 팀이 이 함정들을 체계적으로 막기 위해 만든 표준 벤치마크 도구입니다.

## 왜 손코딩 벤치마크는 틀리는가

가장 먼저 이해할 것은, 손으로 짠 벤치마크가 단순히 "부정확"한 게 아니라 **근본적으로 틀린** 값을 준다는 점입니다.

![손코딩 벤치의 함정과 JMH의 방어](/assets/posts/java-jmh-benchmark-pitfalls.svg)

대표적인 함정 세 가지입니다.

- **데드코드 제거(DCE)**: 계산 결과를 어디에도 쓰지 않으면, JIT는 "이 코드는 효과가 없다"고 판단해 통째로 삭제합니다. 그러면 측정값은 "아무것도 안 한 시간"이 됩니다.
- **상수 폴딩(Constant Folding)**: 입력이 상수면 컴파일러가 결과를 미리 계산해 박아 넣습니다. 매번 계산하는 줄 알았던 것이 사실은 한 번도 계산되지 않습니다.
- **웜업 누락**: 시작 직후의 측정은 인터프리터/C1 단계의 성능입니다. 안정 상태(C2 컴파일 완료)의 성능과는 전혀 다릅니다.

## JMH의 실행 구조

JMH는 이 함정들을 구조적으로 막습니다. 핵심은 측정을 **웜업 반복**과 **측정 반복**으로 나누고, 전체를 **여러 포크(별도 JVM)** 에서 반복하는 것입니다.

![JMH 실행 구조](/assets/posts/java-jmh-benchmark-lifecycle.svg)

웜업 반복에서 JIT가 핫코드를 C2로 컴파일하고 캐시를 데운 뒤, 측정 반복에서만 시간을 수집합니다. 그리고 포크를 여러 번 하는 이유는, JVM마다 프로파일 수집 결과나 메모리 배치가 미묘하게 달라 같은 코드도 실행마다 편차가 생기기 때문입니다. 여러 포크의 결과를 모아 통계적으로 신뢰할 수 있는 평균과 분산을 제시합니다.

## 기본 사용법

JMH 벤치마크는 `@Benchmark`를 붙인 메서드로 작성합니다. 측정 모드와 시간 단위, 웜업/측정 횟수를 애너테이션으로 지정합니다.

```java
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.NANOSECONDS)
@Warmup(iterations = 5, time = 1)
@Measurement(iterations = 5, time = 1)
@Fork(3)
@State(Scope.Thread)
public class HashBenchmark {

    private String input;

    @Setup
    public void setup() {
        input = "benchmark-input-value";
    }

    @Benchmark
    public int sha256(Blackhole bh) {
        int h = input.hashCode();
        bh.consume(h);      // 결과를 소비 → DCE 방지
        return h;
    }
}
```

여기서 두 가지 방어 장치가 핵심입니다.

- **`@State`**: 입력값을 필드로 보관해 컴파일러가 상수로 폴딩하지 못하게 막습니다. `setup()`은 측정에서 제외됩니다.
- **`Blackhole`와 반환값**: 계산 결과를 `bh.consume(...)`으로 소비하거나 반환하면, JIT가 "이 결과는 쓰인다"고 판단해 데드코드로 제거하지 못합니다.

## 결과 읽기

JMH는 단일 숫자가 아니라 통계를 출력합니다.

```text
Benchmark            Mode  Cnt   Score    Error  Units
HashBenchmark.sha256 avgt   15  12.443 ±  0.231  ns/op
```

`Score`는 평균이고 `Error`는 신뢰 구간(보통 99.9%)의 오차입니다. **오차를 무시한 평균 비교는 위험합니다.** 두 벤치마크의 점수 차이가 각자의 오차 범위보다 작으면, 그 차이는 통계적으로 의미가 없을 수 있습니다. 항상 `Score ± Error`를 함께 보고, 차이가 오차보다 충분히 클 때만 "더 빠르다"고 결론 내려야 합니다.

## 그래도 마지막은 실제 부하다

JMH는 마이크로벤치마크 도구입니다. 작은 코드 조각의 상대 성능을 비교하는 데는 탁월하지만, 그것이 전체 애플리케이션 성능을 보장하지는 않습니다. 마이크로벤치마크에서 빠른 코드가 실제 워크로드에서는 캐시 동작·메모리 압박·경합 때문에 다르게 동작할 수 있습니다. JMH로 후보를 좁히되, 최종 판단은 실제와 유사한 부하 테스트로 확인하는 것이 안전합니다.

## 정리

JMH는 데드코드 제거·상수 폴딩·웜업 누락이라는 마이크로벤치마크의 고질적 함정을, 웜업/측정 분리와 다중 포크, `Blackhole`·`@State`로 막아 줍니다. 손으로 시간을 재는 대신 JMH를 쓰고, 결과는 항상 오차와 함께 해석하세요. 다음 글에서는 이런 측정과 튜닝의 출발점이 되는 JVM 플래그 체계를 정리합니다 — 무수히 많은 `-XX` 옵션을 어떻게 이해하고 다룰지에 관한 이야기입니다.

---

**지난 글:** [루프 언롤링 — JIT가 반복문을 펼치는 이유](/posts/java-loop-unrolling/)

**다음 글:** [JVM 플래그 — 표준·-X·-XX 옵션 이해하기](/posts/java-jvm-flags/)

<br>
읽어주셔서 감사합니다. 😊
