---
title: "타입 체크 성능 끌어올리기"
description: "tsc가 느려지는 원인을 측정 가능한 수치로 진단하고 줄이는 법을 다룬다. extendedDiagnostics와 generateTrace로 병목을 찾는 방법, 거대한 유니온·깊은 조건부 타입·과도한 추론이 만드는 비용, skipLibCheck와 명시적 반환 타입 같은 실전 처방까지 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-20"
archiveOrder: 1
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "성능", "tsc", "빌드", "진단"]
featured: false
draft: false
---

[지난 글](/posts/ts-any-elimination/)에서 `any`를 걷어내며 타입 안전성의 마지막 구멍을 메웠다. 타입을 정교하게 다듬을수록 코드는 더 많은 것을 증명해 주지만, 동시에 컴파일러가 해야 할 일도 늘어난다. 어느 순간 `tsc`가 수십 초씩 걸리고, 에디터의 빨간 줄이 몇 초 늦게 뜨기 시작하면 타입 검사 자체가 개발 속도를 갉아먹는다. 이번 글은 타입 체크가 왜 느려지는지 **측정 가능한 수치로** 진단하고, 그 비용을 줄이는 실전 방법을 다룬다.

## 느려지는 데는 이유가 있다

타입 체크 성능 문제는 대부분 "코드가 많아서"가 아니라 **특정 타입이 비싸서** 생긴다. 컴파일러는 모든 할당 지점에서 "이 타입이 저 타입에 할당 가능한가"를 증명하는데, 타입이 복잡할수록 이 증명 비용이 비선형적으로 늘어난다. 원인은 크게 네 가지다.

![타입 체크가 느려지는 4가지 원인](/assets/posts/ts-type-checking-performance-bottlenecks.svg)

거대한 유니온이나 교차 타입은 멤버 하나하나를 비교해야 하므로 멤버 수에 비례해 비싸진다. 깊은 조건부 타입이나 재귀 타입은 인스턴스화가 중첩되면서 폭발적으로 늘어나고, 때로는 재귀 한계(`Type instantiation is excessively deep`)에 부딪힌다. 복잡한 반환 타입을 명시하지 않으면 그 함수를 쓰는 모든 곳에서 매번 추론을 다시 한다. 마지막으로, `node_modules`의 거대한 `.d.ts`까지 전부 다시 검사하는 것도 흔한 낭비다.

## 추측하지 말고 측정하라

성능 작업의 첫 규칙은 "병목을 추측하지 말 것"이다. TypeScript는 자체 진단 도구를 제공한다. 먼저 전체 수치를 보고, 느린 부분이 특정되면 trace로 파고든다.

![성능 측정 명령](/assets/posts/ts-type-checking-performance-measure.svg)

`--extendedDiagnostics`는 검사한 파일 수, 타입 개수, 단계별 소요 시간을 출력한다.

```bash
tsc --noEmit --extendedDiagnostics
```

출력에서 눈여겨볼 항목은 `Check time`(실제 타입 검사 시간), `Instantiations`(타입 인스턴스화 횟수), `Types`(생성된 타입 개수)다. Instantiations가 수백만 단위라면 어딘가에서 조건부·매핑 타입이 폭발하고 있다는 신호다.

어느 코드가 범인인지까지 알고 싶으면 trace를 뜬다.

```bash
tsc --generateTrace trace_out
```

`trace_out/trace.json`을 [ui.perfetto.dev](https://ui.perfetto.dev)에서 열면, 어떤 파일·어떤 타입을 검사하는 데 시간이 오래 걸렸는지 타임라인으로 볼 수 있다. `checkSourceFile`이나 특정 심볼의 `checkExpression`이 유독 넓게 차지한다면 그 부분이 우선 개선 대상이다.

## 처방 1 — skipLibCheck로 라이브러리 검사 건너뛰기

가장 손쉽고 효과가 큰 설정은 `skipLibCheck`다. 우리가 작성하지도 않은 의존성의 `.d.ts`까지 전부 검사하는 것은 대부분 낭비다.

```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

이 옵션은 `.d.ts` 파일끼리의 타입 정합성 검사를 생략한다. 우리 코드와 라이브러리 사이의 타입 검사는 그대로 유지되므로 안전성 손실은 거의 없으면서, 큰 프로젝트에서는 체크 시간을 눈에 띄게 줄여 준다. 대부분의 프로젝트에서 기본값처럼 켜 두기를 권한다.

## 처방 2 — 공개 경계에 반환 타입을 명시하라

함수의 반환 타입을 명시하지 않으면, 컴파일러는 그 함수를 참조하는 모든 곳에서 본문을 다시 들여다보며 타입을 추론한다. 특히 복잡한 객체나 체이닝을 반환하는 함수라면 이 비용이 곱절로 쌓인다.

```typescript
// 추론에 맡김 — 호출처마다 재추론 가능
function buildConfig(env: Env) {
  return { /* 깊고 복잡한 객체 */ };
}

// 명시 — 한 번 정한 타입을 그대로 재사용
function buildConfig(env: Env): AppConfig {
  return { /* ... */ };
}
```

지역 변수까지 일일이 명시할 필요는 없다. 핵심은 **모듈 경계를 넘는 함수**, 즉 export 되는 함수나 공개 API의 반환 타입을 고정하는 것이다. 이렇게 하면 추론이 함수 안에서 끝나고 밖으로 새지 않는다.

## 처방 3 — 비싼 타입 표현을 단순화하라

조건부 타입과 매핑 타입을 깊게 중첩하면 우아하지만, 인스턴스화 비용이 빠르게 불어난다. 타입 수준 프로그래밍이 화려할수록 trace를 한 번 떠 보는 습관이 중요하다.

```typescript
// 재귀 깊이가 깊어지면 비싸진다
type DeepFlatten<T> = T extends readonly (infer U)[]
  ? DeepFlatten<U>
  : T;
```

이런 타입이 핫스팟으로 잡히면, 정말 그 수준의 일반화가 필요한지 다시 본다. 입력 형태가 사실상 정해져 있다면 구체적인 타입 몇 개로 직접 쓰는 편이 컴파일러에도, 읽는 사람에게도 낫다. 또한 같은 결과를 만든다면 교차 타입(`&`)을 길게 쌓기보다 인터페이스 `extends`로 표현하는 것이 캐싱에 유리하다.

## 무엇을 기억할까

타입 체크 성능은 "느낌"이 아니라 **수치**로 다뤄야 한다. `--extendedDiagnostics`로 큰 그림을 보고, `--generateTrace`로 범인을 특정한 뒤, `skipLibCheck`·반환 타입 명시·타입 단순화 같은 처방을 핫스팟에 집중적으로 적용한다. 마구잡이로 모든 코드를 고치는 대신, 측정으로 좁힌 한두 곳만 손봐도 체감 속도는 크게 달라진다. 다음 글에서는 이 성능 고민이 본격적으로 중요해지는 무대, 즉 수많은 패키지가 얽힌 대규모 코드베이스를 어떻게 구조적으로 다룰지 살펴본다.

---

**지난 글:** [any를 체계적으로 제거하기](/posts/ts-any-elimination/)

**다음 글:** [대규모 코드베이스 전략](/posts/ts-large-codebase-strategies/)

<br>
읽어주셔서 감사합니다. 😊
