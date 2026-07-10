---
title: "JVM 실행 엔진: Interpreter와 JIT 컴파일러"
description: "JVM 실행 엔진의 구성 요소인 Interpreter, C1/C2 JIT Compiler, Garbage Collector의 역할과 협력 방식, 티어드 컴파일 흐름, Deoptimization 개념까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "실행 엔진", "Interpreter", "JIT Compiler", "C1", "C2", "Tiered Compilation", "Deoptimization", "HotSpot"]
featured: false
draft: false
---

[지난 글](/posts/jvm-heap-structure/)에서 JVM Heap의 세대 구조와 객체 생명주기를 살펴봤습니다. 클래스 로더가 바이트코드를 메모리에 올리고 나면, 이번에는 **실행 엔진(Execution Engine)**이 그 바이트코드를 실제 CPU 명령어로 바꾸어 실행합니다. Java가 인터프리터 언어처럼 시작해 C++에 근접한 성능에 도달하는 이유가 바로 여기에 있습니다.

## 실행 엔진의 세 축

JVM 실행 엔진은 세 가지 핵심 컴포넌트로 구성됩니다.

![JVM 실행 엔진 구성 요소](/assets/posts/jvm-execution-engine-overview.svg)

**Interpreter**는 바이트코드를 명령어 단위로 읽어 그때그때 네이티브 명령어로 변환합니다. 시작이 빠르고 어떤 코드도 즉시 실행할 수 있다는 장점이 있지만, 같은 바이트코드를 반복 실행할 때마다 매번 번역하는 비용이 발생합니다.

**JIT(Just-In-Time) Compiler**는 반복 실행되는 "뜨거운(hot)" 코드를 발견하면 한 번에 네이티브 코드로 컴파일해 Code Cache에 저장합니다. 이후 해당 코드가 다시 호출될 때는 번역 없이 캐시된 네이티브 코드가 직접 실행됩니다.

**Garbage Collector**는 JVM Specification에서 실행 엔진의 일부로 정의됩니다. 실행 중 참조가 끊긴 객체를 탐지하고 Heap에서 회수하여 메모리를 재사용 가능 상태로 만듭니다.

## Tiered Compilation: C1과 C2

HotSpot JVM은 두 가지 JIT 컴파일러를 계층적으로 활용합니다. Java 8부터 기본으로 활성화된 **Tiered Compilation** 방식입니다.

![JIT 컴파일 파이프라인](/assets/posts/jvm-execution-engine-jit-pipeline.svg)

| 단계 | 컴파일러 | 호출 임계값 | 특징 |
|------|----------|------------|------|
| 0 | Interpreter | — | 바이트코드 직접 실행, 프로파일링 수집 |
| 1–3 | C1 (Client) | ~2,000 | 빠른 컴파일, 기본 최적화, 프로파일링 계속 |
| 4 | C2 (Server) | ~15,000 | 공격적 최적화, 최고 성능 네이티브 코드 생성 |

C1은 빠르게 컴파일해 인터프리터보다 나은 성능을 즉시 제공합니다. C2는 충분한 프로파일링 데이터가 쌓인 후 **인라이닝, 탈출 분석, 루프 언롤링** 같은 공격적인 최적화를 적용합니다.

```java
// JVM은 이런 코드에서 sum() 메서드를 인라이닝한다
public int sum(int[] arr) {
    int total = 0;
    for (int v : arr) total += v;
    return total;
}

// C2 최적화 후 호출부에서 실제로는:
// int total = 0; for (int v : arr) total += v; ← sum() 호출 없음
```

## 탈출 분석 (Escape Analysis)

C2의 가장 강력한 최적화 중 하나입니다. 객체가 생성된 메서드 밖으로 "탈출"하지 않는다고 판단되면, JVM은 그 객체를 Heap 대신 **스택**에 할당합니다. 스택 할당 객체는 메서드 반환과 동시에 사라지므로 GC 대상이 되지 않습니다.

```java
void processItem(int id) {
    // Point 객체가 이 메서드 밖으로 나가지 않음
    // → C2가 스택 할당으로 최적화 (Heap 할당·GC 없음)
    Point p = new Point(id, id * 2);
    System.out.println(p.x + p.y);
}
```

탈출 분석이 효과를 발휘하려면 객체를 외부 컬렉션에 넣거나 필드에 저장하지 않아야 합니다. 짧은 생애의 로컬 객체를 작게 유지하는 것만으로도 GC 압박을 줄일 수 있습니다.

## Deoptimization: 가정이 깨질 때

C2는 "이 메서드의 구현체는 항상 하나뿐이다"처럼 런타임 관찰에 기반한 **낙관적 가정**을 세우고 최적화를 적용합니다. 그런데 나중에 새로운 클래스가 로드되어 이 가정이 깨지면 JVM은 컴파일된 코드를 폐기하고 다시 Interpreter로 돌아갑니다. 이를 **Deoptimization**이라 합니다.

```text
# Deoptimization 발생 시 로그에서 볼 수 있는 메시지
# (진단 목적 — 운영에서는 기본 비활성)
-XX:+PrintDeoptimizationDetails
# made not entrant: 기존 컴파일 코드 진입 불가 처리
# uncommon trap: 드문 경로 실행으로 가정 위반
```

Deoptimization 자체는 설계된 안전 장치이며, 일시적인 성능 저하 후 JVM이 새로운 정보를 반영해 다시 최적화합니다. 그러나 클래스 로딩이 빈번하거나 메가모픽(megamorphic) 호출 패턴이 반복되면 Deoptimization이 잦아져 성능을 깎아먹을 수 있습니다.

## Code Cache 관리

JIT 컴파일 결과는 Heap이 아닌 별도의 **Code Cache**에 저장됩니다. 기본 크기는 240MB이며 꽉 차면 JIT 컴파일이 중단되어 인터프리터 모드로 폴백됩니다. 워밍업 이후 급격히 성능이 떨어진다면 Code Cache 부족을 의심해야 합니다.

```text
# Code Cache 관련 옵션
-XX:ReservedCodeCacheSize=512m    # 크기 확장 (기본 240m)
-XX:+UseCodeCacheFlushing         # 오래된 컴파일 코드 자동 제거
-XX:+PrintCodeCache               # 사용 현황 출력 (진단용)
```

JVM 시작 후 실행 빈도가 낮은 코드가 먼저 컴파일되지 않도록 워밍업 기간을 갖는 것이 좋습니다. 컨테이너 환경에서는 `-XX:TieredStopAtLevel=1`로 C1만 사용해 빠른 시작을 선택하거나, **Class Data Sharing(CDS)**으로 JIT 워밍업 자체를 단축하는 방법도 활용됩니다.

## Interpreter와 JIT의 협력 요약

```text
바이트코드 실행 흐름
─────────────────────────────────────────────
호출 횟수 < 2000   → Interpreter (0단계)
호출 횟수 ≥ 2000   → C1 컴파일 (1–3단계)
호출 횟수 ≥ 15000  → C2 컴파일 (4단계, 최고 최적화)
가정 위반 시        → Deoptimization → Interpreter 복귀
─────────────────────────────────────────────
```

애플리케이션 관점에서 이 과정은 투명하게 진행됩니다. 개발자가 직접 컴파일 레벨을 제어하는 경우는 거의 없으며, GraalVM의 AOT 컴파일(Native Image)을 사용할 때만 이 JIT 파이프라인 전체가 빌드 시점으로 이동합니다.

## 실행 엔진 진단 옵션

```text
# JIT 컴파일 메서드 확인
-XX:+PrintCompilation

# 인라이닝 결과 확인 (상세)
-XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining

# 탈출 분석 결과 확인
-XX:+UnlockDiagnosticVMOptions -XX:+PrintEscapeAnalysis

# Tiered Compilation 비활성 (단순 벤치마크용)
-XX:-TieredCompilation
```

실행 엔진의 동작을 이해하면 **JMH(Java Microbenchmark Harness)**로 마이크로벤치마크를 설계할 때 워밍업 단계가 왜 필수인지, 벤치마크 결과가 왜 JIT 컴파일 전과 후에 달라지는지를 납득할 수 있습니다.

---

**지난 글:** [JVM Heap 구조 완전 분석](/posts/jvm-heap-structure/)

**다음 글:** [JVM JIT 컴파일 심화](/posts/jvm-jit-compilation/)

<br>
읽어주셔서 감사합니다. 😊
