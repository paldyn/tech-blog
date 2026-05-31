---
title: "마스터 정리 (Master Theorem)"
description: "분할 정복 알고리즘의 점화식 T(n)=aT(n/b)+f(n)을 세 가지 경우로 빠르게 해결하는 마스터 정리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 2
type: "knowledge"
category: "Algorithm"
tags: ["마스터정리", "점화식", "분할정복", "알고리즘 분석", "Master Theorem"]
featured: false
draft: false
---

[지난 글](/posts/dsa-recurrence-relations/)에서 점화식의 개념과 재귀 트리를 이용한 풀이법을 다뤘습니다. 이번에는 분할 정복 형태의 점화식 T(n) = aT(n/b) + f(n)을 손쉽게 해결하는 **마스터 정리(Master Theorem)**를 살펴봅니다. 마스터 정리만 제대로 이해하면 병합 정렬·이진 탐색·Strassen 알고리즘의 복잡도를 암산 수준으로 도출할 수 있습니다.

## 마스터 정리의 핵심 아이디어

T(n) = aT(n/b) + f(n)에서

- **a** : 재귀 호출 수 (≥ 1)
- **b** : 문제 크기 축소 비율 (> 1)
- **f(n)** : 분할과 병합 비용

`c = log_b(a)` 를 기준값으로 정의합니다. n^c는 재귀 호출이 만들어내는 단말 노드 수(= 잎 레벨 비용)와 같습니다. f(n)과 n^c를 비교해 세 경우 중 하나를 적용합니다.

![마스터 정리 세 가지 경우](/assets/posts/dsa-master-theorem-cases.svg)

## Case 1 — 재귀 비용이 지배

**f(n) = O(n^(c−ε))** for some ε > 0

f(n)이 n^c보다 다항식적으로 작으면, 재귀 호출 쪽이 전체 비용을 지배합니다.

```
결론: T(n) = Θ(n^c) = Θ(n^(log_b a))
```

예: T(n) = 8T(n/2) + n²

- c = log₂8 = 3
- f(n) = n² = O(n^(3−1))  → ε = 1 > 0 ✓
- **T(n) = Θ(n³)** (일반 행렬 곱셈)

## Case 2 — 두 비용이 균형

**f(n) = Θ(n^c · log^k n)** for some k ≥ 0

가장 자주 등장하는 경우입니다. k = 0 이면 f(n) = Θ(n^c).

```
결론: T(n) = Θ(n^c · log^(k+1) n)
```

예: T(n) = 2T(n/2) + n

- c = log₂2 = 1
- f(n) = n = Θ(n¹) = Θ(n^c · log⁰n)  → k = 0 ✓
- **T(n) = Θ(n log n)** (병합 정렬)

## Case 3 — 결합 비용이 지배

**f(n) = Ω(n^(c+ε))** for some ε > 0 이고 **정규성 조건** a·f(n/b) ≤ δ·f(n) (δ < 1) 성립

f(n)이 n^c보다 다항식적으로 크면, 분할/결합 비용이 전체를 지배합니다.

```
결론: T(n) = Θ(f(n))
```

예: T(n) = 2T(n/2) + n²

- c = log₂2 = 1
- f(n) = n² = Ω(n^(1+1))  → ε = 1 ✓
- 정규성: 2·(n/2)² = n²/2 ≤ (1/2)·n² ✓
- **T(n) = Θ(n²)**

## 실전 적용 예시

![마스터 정리 적용 예시](/assets/posts/dsa-master-theorem-examples.svg)

## 적용 순서 (체크리스트)

```
1. a, b, f(n) 확인
2. c = log_b(a) 계산
3. f(n)과 n^c 비교:
   - f(n) = O(n^(c-ε))   → Case 1: T(n) = Θ(n^c)
   - f(n) = Θ(n^c)       → Case 2: T(n) = Θ(n^c · log n)
   - f(n) = Ω(n^(c+ε))  → Case 3: T(n) = Θ(f(n))  [정규성 확인]
```

## 마스터 정리가 적용 안 되는 경우

```python
# 아래 점화식들은 마스터 정리 불가
T(n) = T(n-1) + n          # 감소가 n/b 형태가 아님
T(n) = 2T(n/2) + n/log n   # f(n)이 n^c와 다항식 차이가 안 남
T(n) = T(sqrt(n)) + 1      # sqrt(n) = n^(1/2) 형태 — 변수 치환 필요
```

이런 경우에는 재귀 트리법이나 반복 대입법을 사용합니다.

## Python으로 확인하기

```python
import math

def master_theorem(a, b, fn_degree):
    """fn_degree: f(n) = n^fn_degree 라 가정 (단순 다항식 경우)"""
    c = math.log(a, b)
    eps = fn_degree - c
    if eps < -1e-9:
        case, result = 1, f"Θ(n^{c:.4g})"
    elif abs(eps) <= 1e-9:
        case, result = 2, f"Θ(n^{c:.4g} · log n)"
    else:
        case, result = 3, f"Θ(n^{fn_degree})"
    print(f"a={a}, b={b} → c={c:.4g}, Case {case}: {result}")

master_theorem(2, 2, 1)   # 병합 정렬 → Θ(n log n)
master_theorem(1, 2, 0)   # 이진 탐색 → Θ(log n)
master_theorem(7, 2, 2)   # Strassen  → Θ(n^2.807)
```

## 정리

- 마스터 정리는 `T(n) = aT(n/b) + f(n)` 형태의 점화식을 세 경우로 즉시 해결합니다.
- 핵심은 기준값 `c = log_b(a)`와 `f(n)`의 차수를 비교하는 것입니다.
- Case 2 (k=0)가 실무에서 가장 자주 등장하며, f(n) = Θ(n^c)이면 결과는 Θ(n^c log n)입니다.
- 다음 글에서는 본격적인 자료구조 파트의 첫 단계로 **스택(Stack)**을 다룹니다.

---

**지난 글:** [점화식](/posts/dsa-recurrence-relations/)

**다음 글:** [스택](/posts/dsa-stack/)

<br>
읽어주셔서 감사합니다. 😊
