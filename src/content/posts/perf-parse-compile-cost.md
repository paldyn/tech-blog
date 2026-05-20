---
title: "JS 파싱·컴파일 비용 — 번들 크기가 성능에 미치는 영향"
description: "JavaScript 파일이 브라우저에 도달한 뒤 실행되기까지의 파이프라인, 파싱·컴파일 비용의 실체, 코드 스플리팅·트리 셰이킹·지연 로딩으로 TTI를 줄이는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "성능", "파싱", "컴파일", "번들", "코드스플리팅", "트리셰이킹", "TTI", "V8"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "state-swr"
  title: "SWR — stale-while-revalidate 서버 상태 관리"
next:
  slug: "perf-debounce-throttle"
  title: "디바운스와 스로틀 — 이벤트 호출 빈도 제어"
---

[지난 글](/posts/state-swr/)에서 SWR로 서버 상태를 간결하게 관리하는 방법을 살펴봤습니다. 이번 글부터는 JavaScript **성능 최적화** 섹션을 시작합니다. 그 첫 번째 주제는 흔히 간과되는 **파싱·컴파일 비용**입니다. 네트워크 다운로드가 끝난 뒤에도 브라우저는 JS 파일을 실행하기까지 상당한 CPU 작업을 수행하며, 이 비용은 저사양 기기에서 특히 두드러집니다.

---

## 파이프라인 개요

브라우저가 JavaScript를 실행하기까지는 크게 네 단계를 거칩니다.

![JS 파싱·컴파일 파이프라인](/assets/posts/perf-parse-compile-cost-pipeline.svg)

1. **다운로드** — 네트워크에서 파일 수신. 크기가 클수록 시간이 오래 걸립니다.
2. **파싱** — 소스 텍스트를 AST(추상 구문 트리)로 변환. 메인 스레드를 점유합니다.
3. **컴파일** — AST를 바이트코드 또는 기계어로 변환. V8에서는 Ignition(인터프리터)이 먼저 바이트코드를 만들고, 자주 실행되는 함수는 TurboFan(JIT 컴파일러)이 최적화합니다.
4. **실행** — 실제 코드 실행. 이 시점에서 사용자는 페이지와 상호작용할 수 있습니다.

핵심은 **파싱과 컴파일이 메인 스레드를 차지한다**는 것입니다. 이 시간이 길면 페이지가 렌더링되어도 조작이 먹히지 않는 구간이 생깁니다. 이 지표를 **TTI(Time to Interactive)**라 부릅니다.

---

## 파싱 비용의 실체

같은 크기라도 이미지보다 JavaScript의 처리 비용이 훨씬 높습니다. 170KB 이미지를 디코딩하는 비용 vs 170KB JS를 파싱·컴파일하는 비용을 비교하면 JS가 5~10배 더 비쌉니다.

Addy Osmani의 벤치마크에 따르면 저사양 안드로이드 기기(2019년형 기준)는 데스크탑 대비 파싱 시간이 3~5배 더 걸립니다.

```js
// V8 파싱 모드 — Eager vs Lazy
function rarely() {
  // 이 함수는 처음 호출될 때까지 Lazy Parse(스켈레톤만 파싱)
  // 실제 바이트코드 생성은 첫 호출 시점으로 지연됨
  return heavyComputation();
}

// 최상위 코드, 즉시 실행 함수 → Eager Parse (즉시 파싱)
const result = (() => 42)();
```

V8은 모든 함수를 처음부터 완전히 파싱하지 않고, **Lazy Parse**로 함수 본문을 건너뛰다가 실제 호출 직전에 파싱합니다. 최상위 코드와 IIFE, `()=>`로 감싸지 않은 표현식은 즉시 파싱됩니다.

---

## 컴파일 비용 — Ignition과 TurboFan

V8의 컴파일 파이프라인은 두 단계로 나뉩니다.

```js
function add(a, b) {
  return a + b;
}

// 처음 몇 번은 Ignition 바이트코드로 실행
for (let i = 0; i < 10000; i++) add(i, 1);

// 핫 경로로 판정 → TurboFan이 기계어로 최적화
// 하지만 타입이 바뀌면 Deoptimization 발생!
add('hello', 'world'); // string → 재컴파일
```

TurboFan은 **타입 추론** 기반으로 최적화합니다. 같은 함수에 다른 타입이 들어오면 **Deoptimization(Deopt)**이 발생해 다시 바이트코드로 돌아갑니다. 성능 임계 코드에서는 타입을 일관되게 유지하는 것이 중요한 이유입니다.

---

## 최적화 전략

파싱·컴파일 비용을 줄이는 방법은 결국 **브라우저에 전달하는 JS 양을 줄이는 것**입니다.

![파싱·컴파일 비용 절감 전략](/assets/posts/perf-parse-compile-cost-strategies.svg)

### 코드 스플리팅

```js
// ❌ 하나의 거대한 번들
import { modalA, modalB, chartLib } from './all-the-things.js';

// ✅ 라우트별·기능별 청크 분리 (Vite/Webpack)
const ChartPage = lazy(() => import('./ChartPage'));
const ModalA = lazy(() => import('./ModalA'));
```

Webpack이나 Vite는 `import()`를 만나면 자동으로 별도 청크를 생성합니다. 초기 번들에는 화면에 필요한 최소 코드만 포함되고, 나머지는 필요할 때 로드됩니다.

### 트리 셰이킹

```js
// ❌ 전체 lodash import → 70KB 파싱
import _ from 'lodash';

// ✅ 필요한 함수만 → 2KB 파싱
import { debounce } from 'lodash-es';
```

ESM(import/export)의 **정적 분석**을 이용해 번들러가 미사용 코드를 제거합니다. `require()` 기반 CJS는 런타임 분기를 쓸 수 있어 정적 분석이 어렵고 트리 셰이킹이 제한됩니다.

### 지연 로딩

```js
// 버튼 클릭 전까지 heavy.js 파싱·컴파일 발생 안 함
button.addEventListener('click', async () => {
  const { heavyFn } = await import('./heavy.js');
  heavyFn();
});
```

동적 `import()`는 프로미스를 반환하며, 호출 시점에 처음으로 해당 모듈을 다운로드·파싱·컴파일합니다. 초기 로드 비용을 완전히 사용자 행동 시점으로 미룰 수 있습니다.

---

## 측정 방법

```js
// Performance API로 파싱 비용 간접 측정
const t0 = performance.now();
await import('./heavy-module.js');
const t1 = performance.now();
console.log(`모듈 로드+파싱+컴파일: ${(t1 - t0).toFixed(1)}ms`);

// Chrome DevTools → Performance 탭
// "Evaluate Script" 항목 = 파싱 + 컴파일 시간
// "Compile Code" 항목 = TurboFan 최적화 시간
```

Chrome DevTools의 Performance 탭을 녹화하면 **Evaluate Script**, **Compile Code** 항목으로 각 모듈의 파싱·컴파일 시간을 확인할 수 있습니다. Lighthouse의 "Reduce JavaScript execution time" 항목도 이 비용을 포함합니다.

---

## 실전 권장사항

- 초기 번들 크기를 **200KB 이하(gzip 기준)**로 유지합니다. 저사양 기기에서의 파싱 시간은 킬로바이트와 직결됩니다.
- `import()` 동적 임포트로 라우트·모달·차트 같은 무거운 모듈을 지연 로딩합니다.
- `bundle-analyzer`(Webpack Bundle Analyzer, `vite-bundle-visualizer` 등)로 번들 구성을 주기적으로 점검합니다.
- 타입을 일관되게 유지해 TurboFan Deopt를 방지합니다.

---

## 정리

JavaScript의 비용은 네트워크 전송에서 끝나지 않습니다. 파싱과 컴파일은 메인 스레드를 점유하며, 번들 크기에 정비례해 TTI를 늘립니다. 코드 스플리팅·트리 셰이킹·지연 로딩으로 초기 페이로드를 최소화하고, DevTools Performance 패널로 실제 비용을 측정하는 습관이 중요합니다.

---

**지난 글:** [SWR — stale-while-revalidate 서버 상태 관리](/posts/state-swr/)

**다음 글:** [디바운스와 스로틀 — 이벤트 호출 빈도 제어](/posts/perf-debounce-throttle/)

<br>
읽어주셔서 감사합니다. 😊
