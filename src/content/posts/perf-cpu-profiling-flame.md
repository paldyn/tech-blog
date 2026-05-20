---
title: "CPU 프로파일링과 플레임 차트 — 병목 함수 찾기"
description: "Chrome DevTools Performance 탭으로 CPU 프로파일을 녹화하는 방법, 플레임 차트·Bottom-Up·Call Tree 뷰로 병목 함수를 찾는 방법, performance.mark/measure로 코드 구간을 마킹하는 실전 기법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "성능", "CPU프로파일링", "플레임차트", "DevTools", "Performance", "최적화", "병목"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "perf-memory-profiling"
  title: "메모리 프로파일링 — 누수 탐지와 힙 스냅샷"
next:
  slug: "sec-xss"
  title: "XSS — 크로스 사이트 스크립팅 완전 방어 가이드"
---

[지난 글](/posts/perf-memory-profiling/)에서 힙 스냅샷으로 메모리 누수를 탐지하는 방법을 살펴봤습니다. 이번에는 성능 최적화 섹션의 마지막 주제인 **CPU 프로파일링**입니다. "어떤 함수가 가장 많은 CPU 시간을 쓰는가?"를 찾아내는 플레임 차트와 Bottom-Up 뷰, 그리고 `performance.mark`로 코드 구간을 직접 마킹하는 방법을 다룹니다.

---

## CPU 프로파일링 시작

Chrome DevTools → **Performance** 탭에서 녹화 버튼을 클릭하면 CPU 프로파일 수집이 시작됩니다.

```
1. DevTools → Performance 탭
2. ⚙ 설정 → CPU throttling: 4x slowdown (모바일 환경 시뮬레이션)
3. 🔴 Record 버튼 클릭
4. 측정하고 싶은 동작 수행 (예: 버튼 클릭, 리스트 렌더링)
5. ⏹ Stop
6. 하단 Panel → "Bottom-Up" 또는 "Flame Chart" 탭 선택
```

CPU throttling 4x는 고사양 데스크탑에서 중저가 안드로이드 환경을 시뮬레이션합니다. 실제 사용자 환경에 가까운 프로파일을 얻을 수 있습니다.

---

## 플레임 차트 읽기

플레임 차트는 **콜스택을 시간 축으로 펼쳐서** 어떤 함수가 얼마나 오래 실행되었는지 한눈에 보여줍니다.

![플레임 차트 읽기](/assets/posts/perf-cpu-profiling-flame-chart.svg)

### 읽는 법

- **가로폭** = 실행 시간. 넓은 막대가 오래 걸린 함수
- **세로 위치** = 콜스택 깊이. 아래로 갈수록 더 내부 호출
- **가장 아래 가장 넓은 막대** = 실제 CPU 시간을 소비하는 함수 (리프 함수)

병목을 찾는 핵심은 **"탑(탑처럼 생긴 넓고 깊은 구조)"**을 찾는 것입니다. 상위 함수가 넓고 하위 함수도 비슷하게 넓다면, 그 탑의 바닥 함수가 실제 시간을 소비하는 곳입니다.

---

## Bottom-Up 뷰 — 셀프 시간 기준 정렬

```
DevTools Performance → Bottom-Up 탭
"Self Time" 컬럼을 클릭해 내림차순 정렬
→ 가장 위 항목이 실제 CPU 시간을 가장 많이 쓴 함수
```

**Self Time**은 해당 함수 자체(자식 함수 제외)에 사용된 시간입니다. `Total Time`이 크더라도 자식 함수 때문일 수 있으므로, Self Time으로 실제 병목을 찾습니다.

```js
// Bottom-Up에서 높은 Self Time을 가진 함수 예시

// ❌ 정렬 시 매번 Date 파싱 → new Date()의 Self Time이 높게 나옴
const sorted = items.sort((a, b) =>
  new Date(a.dateStr) - new Date(b.dateStr) // 비교마다 파싱
);

// ✅ 미리 변환 후 정렬 — compareFunc에서 Date 파싱 제거
const sorted = items
  .map(item => ({ ...item, timestamp: Date.parse(item.dateStr) }))
  .sort((a, b) => a.timestamp - b.timestamp);
```

---

## performance.mark / measure — 코드 구간 마킹

DevTools 타임라인에서 어떤 코드 구간이 어디에 해당하는지 찾기 어려울 때, `performance.mark`로 마킹하면 타임라인에서 직접 확인할 수 있습니다.

```js
// 특정 함수의 성능 측정
function measuredSort(items) {
  performance.mark('sort-start');

  const result = items
    .map(item => ({ ...item, ts: Date.parse(item.dateStr) }))
    .sort((a, b) => a.ts - b.ts);

  performance.mark('sort-end');
  performance.measure('정렬 작업', 'sort-start', 'sort-end');

  return result;
}

// 측정 결과 조회
const measures = performance.getEntriesByName('정렬 작업');
console.log(`정렬 시간: ${measures[0].duration.toFixed(2)}ms`);

// 모든 측정 정리
performance.clearMarks();
performance.clearMeasures();
```

`performance.measure`로 마킹된 구간은 DevTools Performance 타임라인의 **Timings** 행에 녹색 마커로 표시됩니다. 긴 녹화 중에서도 원하는 구간을 즉시 찾을 수 있습니다.

---

## 프로파일링 워크플로

![CPU 프로파일링 워크플로](/assets/posts/perf-cpu-profiling-flame-workflow.svg)

---

## 롱 태스크 식별 — PerformanceObserver

50ms 이상 걸리는 태스크는 **Long Task**로 분류되며 INP를 악화시킵니다. `PerformanceObserver`로 프로덕션에서도 자동 감지할 수 있습니다.

```js
// 롱 태스크 자동 감지 — 프로덕션 모니터링
const observer = new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    if (entry.duration > 50) {
      // 실제 사용자 환경에서 발생한 롱 태스크 수집
      sendToMonitoring({
        type: 'longtask',
        duration: entry.duration,
        startTime: entry.startTime,
        url: location.href,
      });
    }
  }
});

observer.observe({ type: 'longtask', buffered: true });
```

### 롱 태스크 분할

```js
// ❌ 단일 롱 태스크 — 메인 스레드 독점
function processAll(items) {
  return items.map(item => expensiveTransform(item)); // ~500ms
}

// ✅ 청크로 분할 — 브라우저에 제어권 반환
async function processChunked(items, chunkSize = 50) {
  const results = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    results.push(...chunk.map(item => expensiveTransform(item)));
    // 각 청크 후 다음 프레임 양보
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return results;
}
```

---

## Node.js CPU 프로파일링

```bash
# Node.js 내장 프로파일러
node --cpu-prof app.js
# isolate-*.cpuprofile 파일 생성 → Chrome DevTools에서 열기

# clinic.js — Node.js 전용 프로파일링 도구
npm install -g clinic
clinic flame -- node app.js
# 터미널에서 자동으로 플레임 차트 생성
```

---

## 최적화 전후 비교

```js
// 최적화 전후를 정량적으로 비교
async function benchmark(fn, label, runs = 100) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b) / runs;
  const p95 = times.sort((a, b) => a - b)[Math.floor(runs * 0.95)];
  console.log(`[${label}] avg: ${avg.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms`);
}

await benchmark(() => sortWithDateParsing(data), '최적화 전');
await benchmark(() => sortWithTimestamp(data), '최적화 후');
// [최적화 전] avg: 124.3ms, p95: 156.7ms
// [최적화 후] avg: 8.2ms, p95: 11.1ms
```

---

## 정리

CPU 프로파일링은 "추측이 아닌 측정"의 원칙이 가장 잘 드러나는 영역입니다.

- Performance 탭 → CPU throttling 4x → 모바일 환경 기준으로 측정합니다.
- 플레임 차트에서 가장 넓고 깊은 탑을 찾아 바닥의 리프 함수를 확인합니다.
- Bottom-Up 뷰에서 Self Time 정렬로 실제 CPU를 소비하는 함수를 빠르게 찾습니다.
- `performance.mark`로 관심 구간을 마킹하면 긴 녹화에서도 빠르게 탐색할 수 있습니다.
- 최적화 전후를 `benchmark` 함수로 정량 비교해 효과를 검증합니다.

---

**지난 글:** [메모리 프로파일링 — 누수 탐지와 힙 스냅샷](/posts/perf-memory-profiling/)

**다음 글:** [XSS — 크로스 사이트 스크립팅 완전 방어 가이드](/posts/sec-xss/)

<br>
읽어주셔서 감사합니다. 😊
