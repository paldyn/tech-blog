---
title: "편집 거리 (Edit Distance): 레벤슈타인 알고리즘 완전 분석"
description: "두 문자열을 최소 횟수의 삽입·삭제·교체로 변환하는 편집 거리(Levenshtein Distance)의 DP 점화식, O(m·n) 공간 최적화, 역추적으로 실제 연산 복원, 맞춤법 교정·DNA 서열 비교 응용까지 심층 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 1
type: "knowledge"
category: "Algorithm"
tags: ["편집거리", "레벤슈타인", "동적프로그래밍", "문자열", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-longest-common-subsequence/)에서 LCS의 2D DP를 살펴봤다면, 편집 거리는 그 연장선에 있는 핵심 주제입니다. 두 문자열을 얼마나 다르게 만들기 위해 최소 몇 번의 편집이 필요한지를 정량화하는 이 알고리즘은 오타 교정, DNA 서열 분석, git diff 등 수많은 실용 도구의 뼈대입니다.

## 문제 정의

**편집 거리(Edit Distance)**, 또는 **레벤슈타인 거리(Levenshtein Distance)**는 두 문자열 s1, s2를 변환하기 위해 필요한 최소 단순 편집 연산(삽입·삭제·교체)의 횟수입니다.

- `insert`: 문자 한 개 삽입  
- `delete`: 문자 한 개 삭제  
- `replace`: 문자 한 개를 다른 문자로 교체

예: `"kitten"` → `"sitting"` = **3**번

1. `k` → `s` (교체)  
2. `e` → `i` (교체)  
3. 끝에 `g` 삽입

## 점화식

`dp[i][j]`: s1의 앞 i글자 → s2의 앞 j글자로 변환하는 최소 연산 횟수

```python
# 초기화
for i in range(m+1): dp[i][0] = i  # s2를 빈 문자열로 만들기
for j in range(n+1): dp[0][j] = j  # 빈 문자열에서 s2 만들기

# 점화식
for i in range(1, m+1):
    for j in range(1, n+1):
        if s1[i-1] == s2[j-1]:
            dp[i][j] = dp[i-1][j-1]      # 문자 일치: 연산 불필요
        else:
            dp[i][j] = 1 + min(
                dp[i-1][j],   # 삭제
                dp[i][j-1],   # 삽입
                dp[i-1][j-1]  # 교체
            )
```

직관적으로:
- **삭제**: s1의 i번째 문자를 지우고 나머지를 변환 → `dp[i-1][j] + 1`  
- **삽입**: s2의 j번째 문자를 s1 뒤에 붙여 → `dp[i][j-1] + 1`  
- **교체**: i번째 ↔ j번째 문자를 교체하고 나머지 변환 → `dp[i-1][j-1] + 1`

![편집 거리 DP 테이블](/assets/posts/dsa-edit-distance-dp-table.svg)

## 완전한 Python 구현

```python
def edit_distance(s1: str, s2: str) -> int:
    m, n = len(s1), len(s2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i-1] == s2[j-1]:
                dp[i][j] = dp[i-1][j-1]
            else:
                dp[i][j] = 1 + min(
                    dp[i-1][j],
                    dp[i][j-1],
                    dp[i-1][j-1]
                )
    return dp[m][n]

print(edit_distance("kitten", "sitting"))  # 3
print(edit_distance("sunday", "saturday")) # 3
```

시간 복잡도 **O(m·n)**, 공간 복잡도 **O(m·n)**

## 공간 최적화: O(n)으로 줄이기

DP 점화식을 보면, `dp[i][j]`는 `dp[i-1][...]`과 `dp[i][j-1]`만 참조합니다. 따라서 두 행만 유지하면 됩니다.

```python
def edit_distance_optimized(s1: str, s2: str) -> int:
    m, n = len(s1), len(s2)
    prev = list(range(n + 1))

    for i in range(1, m + 1):
        curr = [i] + [0] * n
        for j in range(1, n + 1):
            if s1[i-1] == s2[j-1]:
                curr[j] = prev[j-1]
            else:
                curr[j] = 1 + min(
                    prev[j],    # 삭제
                    curr[j-1],  # 삽입
                    prev[j-1]   # 교체
                )
        prev = curr
    return prev[n]
```

공간을 **O(n)**으로 절감. 실제 프로덕션 맞춤법 교정기에서 사전 전체와 비교할 때 필수적인 최적화입니다.

## 역추적: 실제 편집 연산 복원

단순히 거리가 아니라 어떤 연산을 수행했는지 알고 싶을 때는 역추적(backtracking)이 필요합니다.

```python
def edit_ops(s1: str, s2: str):
    m, n = len(s1), len(s2)
    dp = [[0]*(n+1) for _ in range(m+1)]
    for i in range(m+1): dp[i][0] = i
    for j in range(n+1): dp[0][j] = j
    for i in range(1, m+1):
        for j in range(1, n+1):
            if s1[i-1] == s2[j-1]:
                dp[i][j] = dp[i-1][j-1]
            else:
                dp[i][j] = 1 + min(
                    dp[i-1][j], dp[i][j-1], dp[i-1][j-1])

    # 역추적
    ops = []
    i, j = m, n
    while i > 0 or j > 0:
        if i > 0 and j > 0 and s1[i-1] == s2[j-1]:
            i -= 1; j -= 1  # 일치: 연산 없음
        elif i > 0 and j > 0 and dp[i][j] == dp[i-1][j-1] + 1:
            ops.append(f"replace s1[{i-1}]={s1[i-1]} → {s2[j-1]}")
            i -= 1; j -= 1
        elif i > 0 and dp[i][j] == dp[i-1][j] + 1:
            ops.append(f"delete s1[{i-1}]={s1[i-1]}")
            i -= 1
        else:
            ops.append(f"insert s2[{j-1}]={s2[j-1]}")
            j -= 1
    return dp[m][n], ops[::-1]
```

## 변형 문제들

### 가중치 편집 거리 (Weighted Edit Distance)

연산마다 비용을 다르게 줄 수 있습니다. 예를 들어 발음상 비슷한 글자 교체는 비용을 낮게 설정해 맞춤법 교정의 정확도를 높입니다.

```python
def weighted_edit(s1, s2, w_ins=1, w_del=1, w_rep=2):
    m, n = len(s1), len(s2)
    dp = [[0]*(n+1) for _ in range(m+1)]
    for i in range(m+1): dp[i][0] = i * w_del
    for j in range(n+1): dp[0][j] = j * w_ins
    for i in range(1, m+1):
        for j in range(1, n+1):
            cost = 0 if s1[i-1] == s2[j-1] else w_rep
            dp[i][j] = min(
                dp[i-1][j] + w_del,
                dp[i][j-1] + w_ins,
                dp[i-1][j-1] + cost
            )
    return dp[m][n]
```

### Damerau-Levenshtein

인접한 두 글자 위치 교환(transposition)도 1회 연산으로 인정하는 버전. 오타 중 `teh` → `the` 같은 전치(transposition)는 레벤슈타인 기준 2회지만 Damerau는 1회입니다.

### 최장 공통 부분 수열(LCS)과의 관계

LCS 길이를 `l`이라 하면:

```
edit_distance = m + n - 2 * l   (삽입·삭제만 허용 시)
```

교체(replace)를 허용하면 이 공식은 성립하지 않지만, LCS 기반으로 편집 거리를 유도하는 시각이 중요합니다.

## 응용 사례

![편집 거리 응용](/assets/posts/dsa-edit-distance-operations.svg)

| 분야 | 사용처 | 임계값 |
|------|--------|--------|
| 맞춤법 교정 | hunspell, aspell | ≤ 2 |
| DNA 서열 비교 | BLAST (변형) | 유사도 % |
| git diff / patch | 줄 단위 편집 거리 | - |
| 자연어 번역 평가 | TER (Translation Edit Rate) | 낮을수록 좋음 |
| 코드 표절 탐지 | 토큰 수준 편집 거리 | 임계값 이하 |

## 복잡도 요약

| 항목 | 값 |
|------|-----|
| 시간 | O(m·n) |
| 공간 (2D) | O(m·n) |
| 공간 (최적화) | O(min(m,n)) |
| 공간 (역추적 포함) | O(m·n) |

편집 거리 DP는 `m·n`이 수십억을 넘어가면 실용적이지 않습니다. 이 경우 Ukkonen의 근사 알고리즘(O(k·n)), Myers' diff 알고리즘(O(k·d)) 같은 방법으로 대체합니다.

---

**지난 글:** [최장 공통 부분 수열 (LCS): 역추적과 응용 문제](/posts/dsa-longest-common-subsequence/)

**다음 글:** [백트래킹: 상태 공간 탐색과 가지치기](/posts/dsa-backtracking/)

<br>
읽어주셔서 감사합니다. 😊
