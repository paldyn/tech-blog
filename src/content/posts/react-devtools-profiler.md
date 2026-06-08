---
title: "React DevTools Profiler 활용법"
description: "React DevTools Profiler로 실제 렌더 병목을 찾는 방법을 단계별로 설명합니다. 커밋 차트 읽기, 플레임 그래프 분석, 리렌더 원인(Why did this render?) 추적까지 실전 가이드를 제공합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 5
type: "knowledge"
category: "React"
tags: ["ReactDevTools", "Profiler", "성능측정", "플레임그래프", "리렌더분석"]
featured: false
draft: false
---

[지난 글](/posts/react-performance-optimization/)에서 성능 최적화 전체 그림을 살펴봤다. 그 글에서도 강조했듯이, 최적화는 **측정이 먼저**다. 이번 글에서는 React 앱의 렌더 병목을 찾는 공식 도구인 **React DevTools Profiler**를 처음부터 끝까지 파고든다.

## React DevTools 설치

React DevTools는 Chrome과 Firefox의 브라우저 확장으로 설치한다. 설치 후 브라우저 개발자 도구에 **"Components"** 탭과 **"Profiler"** 탭이 추가된다.

## Profiler 탭 기본 구성

Profiler 탭을 열면 세 가지 영역이 있다.

```
┌─────────────────────────────────────────┐
│  ● (녹화 시작)  ↺ (리셋)  ⚙ (설정)     │  ← 툴바
├──────────────────────────────────────────┤
│  [커밋 바 차트] ──────────────────────   │  ← 각 커밋
├──────────────────────────────────────────┤
│           플레임 그래프 / 랭크드 차트    │  ← 트리
└──────────────────────────────────────────┘
```

**커밋(commit)**은 React가 화면을 실제로 업데이트한 단위다. 각 인터랙션마다 하나 이상의 커밋이 생긴다.

## 프로파일링 순서

![Profiler 사용법](/assets/posts/react-devtools-profiler-ui.svg)

### ① 녹화 시작

1. Profiler 탭 열기
2. 왼쪽 상단 **●(기록 시작)** 버튼 클릭
3. 측정할 인터랙션 수행 (버튼 클릭, 데이터 로드 등)
4. **■(기록 중지)** 클릭

### ② 커밋 차트 분석

상단에 막대 차트가 표시된다. 각 막대 = 커밋 1개. **막대가 높을수록 해당 커밋에서 렌더 시간이 더 걸렸다**는 의미다.

- 파란색: 빠른 커밋
- 노란색: 중간
- 빨간색·주황색: 느린 커밋 → 우선 분석 대상

### ③ 플레임 그래프 읽기

느린 커밋을 클릭하면 플레임 그래프가 나타난다.

```
App (12.4ms)         ← 루트. 가장 넓음
├── ProductList (9.2ms)   ← 병목 후보
│   ├── ProductItem × 8 (0.8ms each)
│   └── SortBar (0.3ms)
└── Header (회색: 스킵됨)
```

- **노란색/주황색 박스**: 이번 커밋에서 렌더된 컴포넌트
- **회색 박스**: memo 등으로 스킵된 컴포넌트 (렌더 없음)
- **넓은 박스**: 렌더 시간이 긴 컴포넌트 → 최적화 후보

박스를 클릭하면 오른쪽 패널에 렌더 시간, props 변화, **리렌더 원인**이 표시된다.

## "Why did this render?" 설정

가장 유용한 기능인 **리렌더 원인 추적**을 켜려면 먼저 설정이 필요하다.

```
⚙ 버튼 클릭
→ "Record why each component rendered while profiling" 체크
```

이후 프로파일링하면 각 컴포넌트 클릭 시 다음 정보가 표시된다.

```
Why did ProductCard render?
  Props changed:
    items (old: [...], new: [...])
  Hooks changed:
    useContext (CartContext)
```

![리렌더 원인 분석](/assets/posts/react-devtools-profiler-flamegraph.svg)

## 실전 분석 시나리오

### 시나리오 1: 버튼 클릭 시 느림

```
커밋 분석: App (15ms) → Cart (12ms) → CartList (11ms) → CartItem × 20
리렌더 원인: CartItem — "Props changed: onClick"
원인: 부모가 리렌더될 때마다 onClick 함수 새 참조 생성
해결: handleRemove = useCallback(...)
```

### 시나리오 2: 입력창 타이핑이 버벅임

```
커밋 분석: Form (8ms) → FilteredList (7ms)
리렌더 원인: FilteredList — "State changed: query"
원인: 타이핑할 때마다 expensiveFilter 재실행
해결: filteredItems = useMemo(() => expensiveFilter(items, query), [items, query])
```

## Ranked 차트 vs Flame 차트

Profiler에는 플레임 그래프 외에 **Ranked 차트**도 있다.

| 차트 | 표시 기준 | 사용 목적 |
|---|---|---|
| Flame | 컴포넌트 트리 구조 | 어디서 시간이 많이 소요되는지 트리 파악 |
| Ranked | 렌더 시간 내림차순 | 가장 느린 컴포넌트 한눈에 파악 |

빠르게 병목 컴포넌트만 찾으려면 Ranked 차트가 더 편하다.

## 개발 빌드에서만 사용

React DevTools Profiler는 **개발 모드 빌드**에서만 정확한 데이터를 제공한다. 프로덕션 빌드는 렌더 추적 코드가 제거되어 있어 측정값이 다를 수 있다. 프로덕션 성능을 측정하려면 `react-dom/profiling` 빌드를 사용한다.

```bash
# Vite 기준: 프로파일링 빌드
vite build --mode profiling
```

다음 글에서는 긴 목록의 렌더 병목을 근본적으로 해결하는 **가상화(Virtualization)** 기법을 다룬다.

---

**지난 글:** [React 성능 최적화 종합 가이드](/posts/react-performance-optimization/)

**다음 글:** [가상화(Virtualization)로 긴 목록 성능 최적화](/posts/react-virtualization/)

<br>
읽어주셔서 감사합니다. 😊
