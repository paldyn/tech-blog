---
title: "디바운스와 스로틀 — 이벤트 호출 빈도 제어"
description: "스크롤·입력·리사이즈처럼 빈번하게 발생하는 이벤트를 제어하는 디바운스와 스로틀의 차이, 직접 구현 방법, requestAnimationFrame 결합 패턴, 실전 사용 지침을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "성능", "디바운스", "스로틀", "이벤트", "requestAnimationFrame", "최적화"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "perf-parse-compile-cost"
  title: "JS 파싱·컴파일 비용 — 번들 크기가 성능에 미치는 영향"
next:
  slug: "perf-memoization-pattern"
  title: "메모이제이션 패턴 — 계산 결과 캐싱으로 성능 향상"
---

[지난 글](/posts/perf-parse-compile-cost/)에서 파싱·컴파일 비용을 줄이는 방법을 살펴봤습니다. 이번에는 런타임 성능 최적화 중 가장 자주 쓰이는 두 기법인 **디바운스(debounce)**와 **스로틀(throttle)**을 다룹니다. 스크롤, 키 입력, 마우스 이동처럼 짧은 시간 안에 수십 번 발생하는 이벤트를 아무 처리 없이 두면 메인 스레드가 과부하 상태에 빠집니다.

---

## 문제: 이벤트 폭풍

```js
// ❌ 스크롤마다 DOM 쿼리 + 레이아웃 계산 — 1초에 60번 이상 실행
window.addEventListener('scroll', () => {
  const el = document.querySelector('.sticky');
  el.style.top = `${window.scrollY * 0.5}px`;
});
```

사용자가 빠르게 스크롤하면 초당 60~120개의 `scroll` 이벤트가 발생합니다. 각 핸들러에서 DOM 조작이나 API 호출이 있다면 프레임 드롭과 네트워크 낭비가 생깁니다.

---

## 디바운스 — 마지막 호출 후 N ms

**디바운스**는 연속 호출 중에는 실행을 억제하고, **마지막 호출로부터 N ms 이후**에 딱 한 번만 실행합니다.

![디바운스 vs 스로틀 호출 패턴](/assets/posts/perf-debounce-throttle-comparison.svg)

```js
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 검색: 타이핑이 300ms 멈추면 API 호출
const search = debounce((q) => fetchResults(q), 300);
input.addEventListener('input', (e) => search(e.target.value));
```

타이머를 매번 초기화하는 것이 핵심입니다. 이벤트가 계속 발생하는 동안에는 `clearTimeout`이 이전 타이머를 취소하므로 함수가 실행되지 않습니다.

### 사용 사례

- **검색 자동완성**: 타이핑 중간에 API를 부르지 않고, 멈춘 뒤에만 요청
- **폼 자동 저장**: 입력이 끝난 후 저장
- **윈도우 리사이즈**: 레이아웃 재계산을 리사이즈 종료 후에만 실행

---

## 스로틀 — 최대 N ms에 1회

**스로틀**은 N ms 간격 안에 들어온 추가 호출을 무시하고, **주기적으로 최대 1회**만 실행합니다.

```js
function throttle(fn, limit) {
  let inThrottle = false;
  return function (...args) {
    if (inThrottle) return;
    fn.apply(this, args);
    inThrottle = true;
    setTimeout(() => { inThrottle = false; }, limit);
  };
}

// 스크롤: 100ms마다 최대 1회만 위치 계산
const onScroll = throttle(() => updateStickyPosition(), 100);
window.addEventListener('scroll', onScroll);
```

### 사용 사례

- **스크롤 핸들러**: 스크롤 위치에 따른 UI 업데이트
- **마우스 추적**: 드래그 중 위치 계산
- **API 요청 제한**: 버튼 연타 방지, 리미트 초과 방지

---

## 구현 비교

![debounce·throttle 직접 구현](/assets/posts/perf-debounce-throttle-impl.svg)

---

## requestAnimationFrame 결합

스크롤·드래그처럼 **렌더링과 직결된** 작업에는 `setTimeout` 대신 `requestAnimationFrame`을 결합하면 프레임 드롭을 더 효과적으로 방지할 수 있습니다.

```js
function rafThrottle(fn) {
  let rafId = null;
  return function (...args) {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      fn.apply(this, args);
      rafId = null;
    });
  };
}

window.addEventListener('scroll', rafThrottle(() => {
  // 브라우저가 다음 프레임을 그리기 직전에 실행
  updateParallax();
}));
```

`requestAnimationFrame`은 브라우저의 렌더링 주기(보통 16.67ms/60fps)에 맞춰 콜백을 호출하므로 시각적 업데이트에 가장 적합한 타이밍을 자동으로 선택합니다.

---

## leading / trailing 옵션

실무에서 lodash의 `_.debounce`, `_.throttle`을 쓸 때 자주 접하는 옵션입니다.

```js
import { debounce } from 'lodash-es';

// leading: 첫 번째 호출 즉시 실행 (trailing 비활성화 가능)
const debouncedFn = debounce(handler, 300, { leading: true, trailing: false });

// trailing(기본값 true): 마지막 호출 후 delay ms에 실행
const debouncedFn2 = debounce(handler, 300, { leading: false, trailing: true });
```

- `leading: true, trailing: false` — 첫 입력에 즉시 반응하고 이후 연타는 무시 (버튼 클릭 방지에 적합)
- `leading: false, trailing: true` (기본) — 연타 후 조용해지면 한 번 실행 (검색 자동완성에 적합)

---

## 정리

| 기법 | 실행 시점 | 주요 사용처 |
|---|---|---|
| 디바운스 | 마지막 호출 후 N ms | 검색, 자동저장, 리사이즈 |
| 스로틀 | N ms마다 최대 1회 | 스크롤, 드래그, API 제한 |
| rAF 스로틀 | 다음 렌더 프레임 직전 | 파라랙스, 애니메이션 |

이벤트를 직접 다루는 코드를 작성할 때는 "이 핸들러가 1초에 몇 번 실행될 수 있는가?"를 먼저 생각하고, 그에 맞는 기법을 적용하는 습관이 성능 버그를 예방합니다.

---

**지난 글:** [JS 파싱·컴파일 비용 — 번들 크기가 성능에 미치는 영향](/posts/perf-parse-compile-cost/)

**다음 글:** [메모이제이션 패턴 — 계산 결과 캐싱으로 성능 향상](/posts/perf-memoization-pattern/)

<br>
읽어주셔서 감사합니다. 😊
