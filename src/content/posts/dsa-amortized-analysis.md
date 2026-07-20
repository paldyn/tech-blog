---
title: "분할 상환 분석 (Amortized Analysis)"
description: "개별 연산이 비싸도 전체 평균이 저렴한 이유를 설명하는 분할 상환 분석과 세 가지 기법을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 6
type: "knowledge"
category: "Algorithm"
tags: ["분할상환분석", "amortized", "동적배열", "알고리즘 분석"]
featured: false
draft: false
---

[지난 글](/posts/dsa-asymptotic-notation/)에서 빅오·빅오메가·빅세타 표기법을 살펴봤습니다. 이번에는 특별한 상황에서 쓰이는 분석 기법인 **분할 상환 분석(Amortized Analysis)**을 알아봅니다. 이것은 Python의 `list.append()`나 Java의 `ArrayList.add()`가 왜 O(1)이라고 불리는지 이해하는 핵심입니다.

## 분할 상환 분석이란

분할 상환(amortized)은 회계 용어 '감가상각'에서 왔습니다. 비싼 장비를 한 번에 구입했지만 여러 해에 걸쳐 비용을 나눠 계상하는 것처럼, 알고리즘에서 **가끔 발생하는 비싼 연산의 비용을 여러 연산에 나눠 평균**을 구하는 방식입니다.

최악 경우 분석이 "최악 단일 연산"의 비용을 보는 반면, 분할 상환 분석은 **연산 시퀀스 전체**의 평균 비용을 봅니다.

## 동적 배열의 push — 왜 O(1)인가

가장 대표적인 예시입니다. 배열이 꽉 차면 두 배 크기의 새 배열을 만들고 모든 원소를 복사합니다.

![동적 배열 확장과 분할 상환 분석](/assets/posts/dsa-amortized-analysis-dynamic-array.svg)

```python
class DynamicArray:
    def __init__(self):
        self._data = [None]  # 초기 capacity = 1
        self._size = 0
        self._capacity = 1

    def append(self, val):
        if self._size == self._capacity:
            # 용량 초과: 두 배로 확장 — O(n) 연산!
            new_data = [None] * (self._capacity * 2)
            for i in range(self._size):
                new_data[i] = self._data[i]
            self._data = new_data
            self._capacity *= 2
        # 일반 삽입 — O(1)
        self._data[self._size] = val
        self._size += 1
```

확장이 일어나는 순간을 보면 capacity=1→2→4→8→...이고, 각 확장 시 복사 비용이 1, 2, 4, 8, ...입니다. n번 push 후 총 확장 비용은:

```text
1 + 2 + 4 + ... + n = 2n - 1
```

일반 push n번 비용은 n. 합치면 약 3n. 연산당 평균 = 3n/n = 3 = **O(1)**.

## 세 가지 분할 상환 기법

![분할 상환 분석의 3가지 기법](/assets/posts/dsa-amortized-analysis-methods.svg)

### 1. 총계법 (Aggregate Method)

가장 직관적입니다. n번 연산의 총 비용 T(n)을 직접 계산하고 n으로 나눕니다.

```python
# 총계법 적용 예: 이진 카운터 증가
# n번 increment의 총 비트 플립 횟수
# 자리 0: n번, 자리 1: n/2번, 자리 2: n/4번...
# 합계: n(1 + 1/2 + 1/4 + ...) < 2n
# 연산당 평균: 2n/n = 2 = O(1) amortized
def increment(bits):
    i = 0
    while i < len(bits) and bits[i] == 1:
        bits[i] = 0
        i += 1
    if i < len(bits):
        bits[i] = 1
```

### 2. 회계법 (Accounting Method)

각 연산에 실제 비용보다 많은 "크레딧"을 미리 부여하고, 비싼 연산이 발생할 때 저장된 크레딧으로 지불합니다.

```python
# 동적 배열 회계법:
# append마다 크레딧 3을 부여 (실제 비용 1 + 미래 복사 대비 2)
# capacity c에서 c/2 원소가 들어올 때 크레딧 c 누적
# 확장 시 c번 복사 = 쌓인 크레딧으로 정확히 충당
# → 각 append의 분할 상환 비용 = 3 = O(1)
```

### 3. 포텐셜법 (Potential Method)

자료구조의 "에너지" 상태를 나타내는 포텐셜 함수 Φ를 정의합니다. 분할 상환 비용 = 실제 비용 + Φ의 변화량.

```python
# 동적 배열 포텐셜법:
# Φ = 2 × size - capacity
# 일반 push: 실비용 1, ΔΦ = 2(size+1)-cap - (2·size-cap) = 2
# 분할상환비용 = 1 + 2 = 3
# 확장 push: 실비용 n+1, cap→2n, ΔΦ = 2(n+1)-2n - (2n-n) = -n+2
# 분할상환비용 = (n+1) + (-n+2) = 3
# 항상 3 = O(1)
```

## 실무에서의 함의

분할 상환 O(1)이 보장되더라도 **최악 단일 연산이 O(n)**일 수 있습니다. 이는 실시간 시스템에서 문제가 될 수 있습니다.

```python
import time

arr = []
times = []
for i in range(10000):
    start = time.perf_counter()
    arr.append(i)
    elapsed = time.perf_counter() - start
    times.append(elapsed)

# 대부분 매우 짧지만 확장 시 긴 시간이 산발적으로 발생
max_time = max(times)
avg_time = sum(times) / len(times)
print(f"최악: {max_time:.6f}s, 평균: {avg_time:.6f}s")
# 최악이 평균보다 수백~수천 배 클 수 있음
```

실시간 제어 시스템에서는 이런 급격한 레이턴시 스파이크가 위험할 수 있습니다. 이 경우 예측 가능한 O(1) 연결 리스트가 더 적합합니다.

## 분할 상환 O(1)인 주요 연산들

| 자료구조/연산 | 개별 최악 | 분할 상환 |
|---|---|---|
| Python `list.append()` | O(n) | O(1) |
| Java `ArrayList.add()` | O(n) | O(1) |
| Hash table insert | O(n) 리해싱 | O(1) |
| Splay tree 탐색 | O(n) | O(log n) |
| 피보나치 힙 `decrease-key` | O(log n) | O(1) |

## 정리

- 분할 상환 분석 = 연산 시퀀스 전체의 **평균 비용** 분석
- 동적 배열 append: 가끔 O(n)이지만 amortized O(1)
- 세 기법: 총계법(직관적), 회계법(크레딧), 포텐셜법(엄밀)
- 분할 상환 O(1)이어도 최악 개별 연산은 O(n) — 실시간 시스템 주의

---

**지난 글:** [점근적 표기법 (O, Ω, Θ)](/posts/dsa-asymptotic-notation/)

**다음 글:** [배열의 기초](/posts/dsa-array-basics/)

<br>
읽어주셔서 감사합니다. 😊
