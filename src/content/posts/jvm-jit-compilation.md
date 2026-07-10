---
title: "JVM JIT 컴파일 심화: C1·C2 컴파일러와 최적화 기법"
description: "JVM의 Just-In-Time 컴파일 메커니즘을 심층 분석합니다. C1·C2 컴파일러의 역할 분담, 메서드 인라이닝·탈출 분석·루프 최적화 등 핵심 기법, Code Cache 관리, Deoptimization 시나리오까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "JIT", "C1", "C2", "HotSpot", "메서드 인라이닝", "탈출 분석", "Code Cache", "Deoptimization"]
featured: false
draft: false
---

[지난 글](/posts/jvm-execution-engine/)에서 JVM 실행 엔진의 전체 구조와 Interpreter·JIT Compiler·GC가 협력하는 방식을 살펴봤습니다. 이번 글에서는 JIT 컴파일의 내부 메커니즘을 한 단계 깊이 파고들어, HotSpot JVM이 어떤 방식으로 바이트코드를 극한으로 최적화하는지 살펴봅니다.

## JIT 컴파일이 필요한 이유

Java는 소스 코드를 플랫폼 독립적인 바이트코드(`.class`)로 컴파일합니다. 바이트코드는 각 JVM 구현이 해석·실행하므로 이식성이 뛰어나지만, Interpreter가 줄 단위로 해석하는 방식은 네이티브 코드보다 수십 배 느릴 수 있습니다. JIT(Just-In-Time) 컴파일러는 이 간격을 메웁니다. 자주 실행되는 코드 경로—**Hot Path**—를 감지해 최적화된 네이티브 기계어로 변환하고 Code Cache에 보관함으로써, 이후 호출에서는 인터프리터를 거치지 않고 바로 실행합니다.

## HotSpot의 두 컴파일러: C1과 C2

HotSpot JVM(OpenJDK 기준)은 두 개의 JIT 컴파일러를 탑재하고 있습니다.

| 컴파일러 | 별칭 | 목표 | 최적화 수준 | 컴파일 시간 |
|---|---|---|---|---|
| C1 | Client Compiler | 빠른 시작 | 기본 | 짧음 |
| C2 | Server Compiler | 최대 처리량 | 공격적 | 긺 |

C1은 애플리케이션 시작 직후 따뜻한 코드를 빠르게 네이티브로 변환해 초기 응답 시간을 낮춥니다. C2는 장시간 동안 충분히 프로파일된 코드에만 투입되어 인라이닝, 탈출 분석, SIMD 벡터화 같은 공격적 최적화를 수행합니다. 이 두 단계가 협력하는 방식을 **티어드 컴파일**이라고 하며, 다음 글에서 별도로 다룹니다.

## JIT 컴파일 파이프라인

바이트코드가 JIT 컴파일되는 흐름을 정리하면 다음과 같습니다.

![JIT 컴파일 파이프라인](/assets/posts/jvm-jit-compilation-pipeline.svg)

1. **바이트코드 로딩** — 클래스 로더가 `.class`를 Metaspace에 적재합니다.
2. **Interpreter 실행** — 처음에는 바이트코드를 한 줄씩 해석합니다.
3. **Profiler 계측** — 메서드 호출 횟수, 분기 결과, 수신 타입 등을 수집합니다.
4. **Hot Method 판정** — 호출 횟수가 `-XX:CompileThreshold`(기본 10,000)를 초과하면 컴파일 큐에 삽입합니다.
5. **JIT 컴파일** — C1 또는 C2가 최적화된 네이티브 코드를 생성합니다.
6. **Code Cache 저장** — 생성된 코드는 힙 외부 메모리 영역인 Code Cache에 캐시됩니다.

```java
// 이 루프가 CompileThreshold를 초과하면 JIT 컴파일 대상이 됩니다
long sum = 0;
for (int i = 0; i < 1_000_000; i++) {
    sum += compute(i);   // compute()도 Hot Method가 될 수 있음
}
```

## 핵심 최적화 기법 3가지

![JIT 주요 최적화 기법](/assets/posts/jvm-jit-compilation-optimizations.svg)

### 1. 메서드 인라이닝 (Method Inlining)

JIT 컴파일러가 적용하는 가장 중요한 최적화입니다. 호출 대상 메서드의 본문을 호출 지점에 직접 삽입하여 스택 프레임 생성, 인수 전달, 반환 비용을 모두 제거합니다. 동시에 인라이닝된 코드에 상수 전파, 데드 코드 제거 등 추가 최적화를 연속 적용할 수 있게 됩니다.

```java
// 인라이닝 전: add() 호출마다 스택 프레임 생성
int result = add(x, y);

// 인라이닝 후: C2가 아래와 동일하게 처리
int result = x + y;
```

인라이닝 깊이와 크기는 `-XX:MaxInlineSize`(기본 35바이트), `-XX:InlineSmallCode` 등으로 제어할 수 있습니다. 메서드가 너무 크거나 `final`이 아닌 가상 메서드(polymorphic call site)는 인라이닝이 거부될 수 있습니다.

### 2. 탈출 분석 (Escape Analysis)

객체가 현재 메서드 스코프를 벗어나지 않는다면, 그 객체를 Heap이 아닌 스택(또는 레지스터)에 할당할 수 있습니다. 이를 **스칼라 치환(Scalar Replacement)**이라고 합니다. Point 객체의 `x`, `y` 필드가 두 개의 지역 변수로 대체되므로 GC 대상이 사라집니다.

```java
void process() {
    Point p = new Point();  // p가 이 메서드 밖으로 나가지 않음
    p.x = 10;
    p.y = 20;
    int dist = p.x * p.x + p.y * p.y;
}
// C2는 Point 객체를 아예 할당하지 않고 int 두 개로 치환
```

탈출 분석은 **동기화 제거(Lock Elision)**도 수행합니다. 스레드 간 공유되지 않는 객체에 걸린 `synchronized` 블록을 완전히 제거합니다.

### 3. 루프 최적화 (Loop Optimization)

루프는 프로그램 실행 시간의 대부분을 차지하므로 C2의 루프 최적화 전략이 중요합니다.

- **루프 언롤링(Loop Unrolling)**: 루프 본문을 여러 번 복제해 반복 횟수와 분기 비용을 줄입니다.
- **자동 벡터화(Auto-Vectorization)**: 배열 연산에 SIMD(AVX2, SSE) 명령어를 적용해 한 번에 여러 요소를 처리합니다.
- **루프 불변식 이동(Loop-Invariant Code Motion)**: 루프 내에서 반복마다 동일한 결과를 내는 계산을 루프 밖으로 끌어냅니다.

```java
int[] arr = new int[1024];
// C2는 아래를 SIMD 명령어로 벡터화할 수 있음
for (int i = 0; i < arr.length; i++) {
    arr[i] = arr[i] * 2;
}
```

## Deoptimization: 최적화 철회

JIT 컴파일러는 프로파일 정보를 기반으로 **추측적 최적화(Speculative Optimization)**를 수행합니다. 예를 들어 특정 호출 지점에서 항상 같은 구현체(`Shape` → `Circle`)가 들어온다면 인라이닝을 적용합니다. 그런데 런타임에 새로운 서브타입(`Square`)이 등장하면 이 가정이 깨집니다.

이때 JVM은 **Deoptimization**을 수행합니다. 해당 컴파일된 코드를 무효화하고 다시 Interpreter 모드로 전환합니다. 충분한 새 프로파일 데이터가 쌓이면 재컴파일(Recompilation)이 이루어지며, 이번에는 새 타입도 고려한 더 범용적인 코드가 생성됩니다.

```text
# Deoptimization 발생 확인 로그 옵션
-XX:+PrintDeoptimization
-XX:+TraceDeoptimization
```

Deoptimization이 빈번하면 성능 요동이 생깁니다. JMH 벤치마크에서 워밍업(warmup) 구간이 필요한 이유가 바로 이 Deopt/Recompile 사이클이 안정화되는 시간을 확보하기 위해서입니다.

## Code Cache 관리

JIT로 생성된 네이티브 코드는 **Code Cache**라는 힙 외부 메모리 영역에 저장됩니다. 이 공간이 포화되면 JIT 컴파일이 중단되고 `CodeCache is full. Compiler has been disabled.` 메시지가 출력되며 전체 성능이 인터프리터 수준으로 급락합니다.

```bash
# Code Cache 크기 설정 (프로덕션 권장: 256m 이상)
java -XX:ReservedCodeCacheSize=256m -XX:InitialCodeCacheSize=64m MyApp

# Code Cache 점유 현황 확인 (JVM이 실행 중일 때)
jcmd <pid> Compiler.codecache
```

Code Cache는 Java 9부터 세 개의 Segment로 나뉩니다: non-methods(JVM 내부 코드), profiled(C1 컴파일 코드), non-profiled(C2 컴파일 코드). 각 세그먼트는 `-XX:NonMethodCodeHeapSize`, `-XX:ProfiledCodeHeapSize`, `-XX:NonProfiledCodeHeapSize`로 개별 튜닝할 수 있습니다.

## 컴파일 동작 진단

JIT 컴파일러의 동작을 직접 확인하고 싶을 때 사용하는 플래그를 정리했습니다.

```bash
# 컴파일된 메서드 목록 출력
-XX:+PrintCompilation

# 인라이닝 결정 상세 출력 (Diagnostic 옵션 선행 필요)
-XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining

# 탈출 분석 결과 확인
-XX:+UnlockDiagnosticVMOptions -XX:+PrintEscapeAnalysis

# Tiered Compilation 완전 비활성 (단순 측정용)
-XX:-TieredCompilation

# 인터프리터 전용 실행 (JIT 없이 비교용)
-Xint
```

`-Xcomp`를 사용하면 모든 메서드를 첫 호출에 즉시 JIT 컴파일하지만, 프로파일 데이터 없이 컴파일하므로 C2의 공격적 최적화는 적용되지 않습니다. 정확한 성능 측정에는 **JMH**를 사용하고 충분한 워밍업 이터레이션을 설정하는 것이 원칙입니다.

## 핵심 정리

- JIT 컴파일러는 Hot Method를 네이티브 코드로 변환해 Interpreter 대비 수십 배 성능을 달성합니다.
- C1은 빠른 컴파일, C2는 공격적 최적화를 담당하며 두 단계가 티어드 컴파일로 협력합니다.
- 메서드 인라이닝 → 탈출 분석 → 루프 최적화 순으로 연쇄 최적화가 진행됩니다.
- Deoptimization은 추측 최적화의 가정이 깨질 때 코드를 다시 인터프리터로 되돌리는 안전 메커니즘입니다.
- Code Cache 포화는 심각한 성능 저하를 유발하므로 `-XX:ReservedCodeCacheSize`를 충분히 확보해야 합니다.

---

**지난 글:** [JVM 실행 엔진: Interpreter와 JIT 컴파일러](/posts/jvm-execution-engine/)

**다음 글:** [JVM 티어드 컴파일: C1·C2 협력 전략](/posts/jvm-tiered-compilation/)

<br>
읽어주셔서 감사합니다. 😊
