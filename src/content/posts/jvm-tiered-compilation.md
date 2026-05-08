---
title: "JVM 티어드 컴파일: C1·C2 협력 전략과 실전 튜닝"
description: "JVM의 Tiered Compilation 5단계 레벨 전환 전략을 심층 분석합니다. C1·C2 컴파일러가 큐 상태와 프로파일 성숙도에 따라 협력하는 방식, PrintCompilation 로그 해석, 서버리스·고처리량·벤치마크 환경별 최적 설정을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "Tiered Compilation", "C1", "C2", "HotSpot", "PrintCompilation", "워밍업", "JMH", "성능 튜닝"]
featured: false
draft: false
---

[지난 글](/posts/jvm-jit-compilation/)에서 JIT 컴파일의 핵심 최적화 기법—메서드 인라이닝, 탈출 분석, 루프 벡터화—을 살펴봤습니다. 이번 글에서는 C1과 C2 컴파일러가 실제로 어떤 기준으로 역할을 나누고, 런타임 부하에 따라 어떻게 협력하는지를 티어드 컴파일(Tiered Compilation) 관점에서 정리합니다.

## 티어드 컴파일이란

Java 7 이전에는 `-client`(C1)와 `-server`(C2) 중 하나만 선택해야 했습니다. `-client`는 컴파일이 빠르지만 최적화 수준이 낮고, `-server`는 더 나은 최종 성능을 내지만 JVM 시작 후 한동안 느립니다. Java 7에서 도입되고 Java 8부터 기본값이 된 **Tiered Compilation**은 두 컴파일러를 조합해 "빠른 시작 + 높은 처리량"을 동시에 달성합니다.

핵심 아이디어는 간단합니다. 처음에는 C1이 빠르게 네이티브 코드를 생성해 인터프리터 부담을 줄이고, 그동안 수집한 정밀한 프로파일 데이터를 C2에 전달해 궁극적으로 고도로 최적화된 코드로 교체하는 것입니다.

## 5단계 레벨 구조

HotSpot JVM은 컴파일 수준을 0~4단계(Level)로 정의합니다.

![티어드 컴파일 5단계 전환 흐름](/assets/posts/jvm-tiered-compilation-levels.svg)

| Level | 실행 주체 | 프로파일링 | 목적 |
|---|---|---|---|
| 0 | Interpreter | 전체 계측 | 초기 실행, 프로파일 수집 |
| 1 | C1 | 없음 | 단순 메서드 빠른 컴파일 |
| 2 | C1 | 제한 (호출·루프 카운터만) | C2 큐 포화 시 중간 단계 |
| 3 | C1 | 완전 계측 (타입·분기까지) | C2 입력용 프로파일 생성 |
| 4 | C2 | 없음 (소비) | 공격적 최적화, 최고 처리량 |

일반 메서드의 기본 경로는 **0 → 3 → 4**입니다. 매우 단순한 메서드(예: getter, 상수 반환)는 프로파일 없이도 C1이 즉시 최적화할 수 있으므로 **0 → 1**로 끝나거나, 아예 인라이닝되어 독립 컴파일 없이 사라집니다.

## C2 큐 백프레셔 메커니즘

애플리케이션이 급속히 워밍업될 때 C2 컴파일 큐가 포화될 수 있습니다. 이 경우 JVM은 Level 3 코드를 Level 1(프로파일링 없는 C1)로 **강등**합니다. 이렇게 하면 즉각적인 성능 저하 없이 C2 큐 부담을 낮추고, C2 여유가 생기면 Level 3 재진입 → Level 4 전환이 다시 시작됩니다.

```
# 전환 경로 요약
0 → 3 → 4          일반 경로
0 → 1               Trivial Method
3 → 2 → 1           C2 큐 포화 시 백프레셔
4 → 0               Deoptimization (가정 위반)
```

이 동적 조정이 없다면 CPU 집약적인 초기화 구간에서 C2 큐가 넘쳐 중요한 Hot Path가 오랫동안 Level 3에만 머무르게 됩니다.

## PrintCompilation 로그 해석

`-XX:+PrintCompilation`을 활성화하면 컴파일 이벤트를 실시간으로 확인할 수 있습니다.

![성능 곡선과 PrintCompilation 로그](/assets/posts/jvm-tiered-compilation-profile.svg)

출력 형식은 다음과 같습니다.

```
<타임스탬프ms>  <컴파일ID>  <Flags>  <Level>  <클래스::메서드>  (<크기>bytes)
```

중요 플래그 의미:

```
%   OSR 컴파일 (On-Stack Replacement, 루프 실행 중 전환)
!   예외 핸들러 포함
s   synchronized 메서드
b   블로킹 컴파일 (드물게 발생)
n   native wrapper
made not entrant   코드 무효화됨 (Deoptimization)
made zombie        Code Cache에서 해제 예정
```

```java
// OSR(On-Stack Replacement) 예: 장시간 루프 실행 중 JIT 전환
long sum = 0;
for (int i = 0; i < 50_000_000; i++) {
    sum += i;
    // 임계값 초과 시 루프 실행 도중 네이티브 코드로 전환 ← OSR
}
```

OSR은 이미 실행 중인 루프를 멈추지 않고 JIT 코드로 전환하는 기법입니다. 스택 프레임을 JIT 규격으로 변환하는 비용이 있지만, 장시간 루프를 인터프리터로 끝까지 실행하는 것보다 훨씬 효율적입니다.

## 워밍업과 JMH

티어드 컴파일 덕분에 현대 Java 애플리케이션은 시작 후 수 초 안에 Level 4에 도달하지만, **마이크로벤치마크**에서는 이 전환 구간이 측정 오염 원인이 됩니다. JMH(Java Microbenchmark Harness)가 워밍업 이터레이션을 필수로 요구하는 이유가 바로 이 때문입니다.

```java
// JMH 벤치마크 기본 구조
@Warmup(iterations = 5, time = 1, timeUnit = TimeUnit.SECONDS)
@Measurement(iterations = 10, time = 1, timeUnit = TimeUnit.SECONDS)
@Fork(value = 2)
@BenchmarkMode(Mode.Throughput)
@State(Scope.Thread)
public class MyBenchmark {

    @Benchmark
    public int measure() {
        return compute(42);
    }
}
```

워밍업 5회 × 1초 동안 Level 0→3→4 전환과 Deopt/Recompile 사이클이 안정화됩니다. 측정 구간은 Level 4 안정 상태에서만 수행됩니다. `@Fork(2)`는 JVM 인스턴스를 두 개 띄워 Code Cache 오염을 방지합니다.

## 환경별 튜닝 전략

### 서버리스·빠른 시작 환경

컨테이너가 수 초 내에 요청을 처리해야 하는 환경에서는 C2의 컴파일 시간 자체가 오버헤드입니다.

```bash
# C1 Level 1에서 멈춤: 빠른 코드 생성, 적은 CPU 소비
java -XX:TieredStopAtLevel=1 -jar app.jar

# 완전한 해결책: GraalVM Native Image (AOT 컴파일)
native-image -jar app.jar
```

### 장기 실행·고처리량 서버

JVM이 충분히 워밍업될 시간이 있고 처리량이 중요한 환경에서는 C2 컴파일러 스레드 수를 늘립니다.

```bash
# 기본값은 CPU 코어 수 기반으로 자동 산정
java -XX:CICompilerCount=4 \
     -XX:ReservedCodeCacheSize=256m \
     -XX:+UseStringDeduplication \
     -jar app.jar
```

`-XX:CICompilerCount`는 C1과 C2 스레드 합계입니다. JVM이 1/3을 C1에, 나머지를 C2에 배분합니다. 코어가 많은 머신에서는 증가시켜 Hot Method를 더 빠르게 Level 4로 끌어올릴 수 있습니다.

### 분석·벤치마크 환경

```bash
# 인터프리터 전용 (JIT 완전 비활성)
java -Xint -jar app.jar

# 즉시 컴파일 (프로파일 없이 모든 메서드 컴파일)
java -Xcomp -jar app.jar

# 컴파일 이벤트 실시간 추적
java -XX:+PrintCompilation -jar app.jar 2>&1 | tee compile.log

# 컴파일된 코드 어셈블리 덤프 (hsdis 라이브러리 필요)
java -XX:+UnlockDiagnosticVMOptions \
     -XX:+PrintAssembly \
     -XX:CompileCommand=print,com.example.MyClass::hotMethod \
     -jar app.jar
```

## C1/C2 인식이 코드 작성에 미치는 영향

티어드 컴파일 동작 방식을 알면 코드 작성 시 더 나은 선택을 할 수 있습니다.

**메서드 크기를 작게 유지하세요.** C2의 인라이닝은 메서드 크기가 `-XX:MaxInlineSize`(기본 35바이트) 이하일 때 가장 잘 작동합니다. 복잡한 로직을 한 메서드에 몰아넣으면 인라이닝 기회가 줄어듭니다.

**단형 호출 지점(monomorphic call site)을 선호하세요.** 한 호출 지점에서 항상 같은 구현체를 받으면 C2는 가상 디스패치를 제거하고 직접 인라이닝합니다. 지나치게 많은 구현체가 한 지점을 통과하면(megamorphic) 인라이닝이 포기되고 간접 호출이 남습니다.

**반복문 구조를 단순하게 유지하세요.** 복잡한 제어 흐름이 섞인 루프는 루프 언롤링과 벡터화가 적용되지 않습니다. 배열을 순회하는 내부 루프는 최대한 단순하게, 부수 효과 없이 작성하는 것이 좋습니다.

## 핵심 정리

- 티어드 컴파일은 Level 0(Interpreter) → 3(C1 완전 계측) → 4(C2 최적화) 기본 경로로 빠른 시작과 고처리량을 동시에 달성합니다.
- C2 큐가 포화되면 Level 3 → 1 강등으로 백프레셔를 처리하고, 여유 생기면 다시 Level 4로 승격합니다.
- `-XX:+PrintCompilation`으로 컴파일 이벤트를 추적하고, `made not entrant` 빈도로 Deoptimization 발생 여부를 모니터링합니다.
- JMH 벤치마크에서는 워밍업 이터레이션을 통해 Level 4 안정 상태에서만 측정해야 신뢰할 수 있는 결과를 얻습니다.
- 서버리스 환경에는 `-XX:TieredStopAtLevel=1` 또는 GraalVM Native Image, 고처리량 서버에는 `-XX:CICompilerCount` 증가와 Code Cache 확보를 적용합니다.

---

**지난 글:** [JVM JIT 컴파일 심화: C1·C2 컴파일러와 최적화 기법](/posts/jvm-jit-compilation/)

**다음 글:** [JVM 바이트코드 기초](/posts/jvm-bytecode-basics/)

<br>
읽어주셔서 감사합니다. 😊
