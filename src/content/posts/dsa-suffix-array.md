---
title: "접미사 배열(Suffix Array): 문자열의 모든 접미사 정렬하기"
description: "접미사 배열의 개념과 O(n log² n) 구축 알고리즘, Kasai 알고리즘으로 LCP 배열을 O(n)에 구하는 방법, 부분 문자열 검색·최장 반복 부분 문자열·서로 다른 부분 문자열 개수 응용까지 완전히 분석합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 1
type: "knowledge"
category: "Algorithm"
tags: ["접미사배열", "LCP배열", "문자열", "Kasai", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-aho-corasick/)에서 트라이와 실패 링크로 다중 패턴을 동시에 탐색했다면, 이번에는 텍스트 쪽을 전처리하는 강력한 도구인 **접미사 배열(Suffix Array)**을 다룹니다. 접미사 배열은 문자열의 모든 접미사를 사전순으로 정렬한 인덱스 배열로, 한 번 구축하면 부분 문자열 검색, 최장 반복 부분 문자열, 서로 다른 부분 문자열 개수 등 다양한 문자열 문제를 빠르게 풀 수 있습니다.

## 접미사 배열이란

문자열 `S`의 길이가 n이면 접미사는 정확히 n개입니다. `S = "banana"`라면:

| 시작 인덱스 i | 접미사 |
|------|--------|
| 0 | banana |
| 1 | anana |
| 2 | nana |
| 3 | ana |
| 4 | na |
| 5 | a |

이들을 사전순으로 정렬하면 `a < ana < anana < banana < na < nana`이고, **정렬된 순서대로 시작 인덱스만 모은 배열**이 접미사 배열입니다.

![접미사 배열 구축](/assets/posts/dsa-suffix-array-construction.svg)

접미사 문자열 자체를 저장하면 O(n²) 공간이 필요하지만, 인덱스만 저장하므로 O(n) 공간이면 충분합니다.

## 단순 구축: O(n² log n)

가장 직관적인 방법은 접미사들을 그대로 정렬하는 것입니다.

```python
def suffix_array_naive(s: str) -> list:
    n = len(s)
    return sorted(range(n), key=lambda i: s[i:])
```

비교 한 번에 최대 O(n)이 들고 정렬 비교가 O(n log n)번이므로 전체 O(n² log n)입니다. n이 수십만이면 사용할 수 없습니다.

## O(n log² n) 구축: 배가(Doubling) 기법

핵심 아이디어는 **접미사의 앞 k글자 기준 순위(rank)를 알고 있으면, 앞 2k글자 기준 순위는 (앞 k글자 순위, k칸 뒤 접미사의 k글자 순위) 쌍으로 비교할 수 있다**는 것입니다. k를 1, 2, 4, 8, …로 배가하면 log n 라운드 만에 전체 정렬이 완성됩니다.

```python
def suffix_array(s: str) -> list:
    n = len(s)
    sa = list(range(n))
    rank = [ord(c) for c in s]
    tmp = [0] * n
    k = 1

    while k < n:
        def key(i):
            second = rank[i + k] if i + k < n else -1
            return (rank[i], second)

        sa.sort(key=key)

        # 새 순위 부여: 키가 같으면 같은 순위
        tmp[sa[0]] = 0
        for j in range(1, n):
            tmp[sa[j]] = tmp[sa[j - 1]]
            if key(sa[j]) > key(sa[j - 1]):
                tmp[sa[j]] += 1
        rank = tmp[:]

        if rank[sa[-1]] == n - 1:
            break  # 모든 순위가 달라지면 조기 종료
        k *= 2

    return sa
```

라운드마다 O(n log n) 정렬을 log n번 수행하므로 O(n log² n)입니다. 정렬을 기수 정렬로 바꾸면 O(n log n), DC3 같은 전문 알고리즘은 O(n)까지 가능하지만, 실전에서는 배가 기법이면 충분한 경우가 대부분입니다.

## LCP 배열: Kasai 알고리즘

접미사 배열의 진가는 **LCP(Longest Common Prefix) 배열**과 결합할 때 나옵니다. `LCP[i]`는 정렬 순서상 인접한 두 접미사 `S[SA[i-1]:]`와 `S[SA[i]:]`의 최장 공통 접두사 길이입니다.

![LCP 배열](/assets/posts/dsa-suffix-array-lcp.svg)

Kasai 알고리즘은 다음 성질을 이용합니다: 접미사 `S[i:]`의 LCP가 h였다면, 접미사 `S[i+1:]`의 LCP는 **최소 h-1**입니다. 따라서 원래 문자열 순서대로 접미사를 순회하면 h가 전체적으로 O(n)만 증가/감소합니다.

```python
def lcp_array(s: str, sa: list) -> list:
    n = len(s)
    rank = [0] * n
    for i in range(n):
        rank[sa[i]] = i

    lcp = [0] * n
    h = 0
    for i in range(n):
        if rank[i] > 0:
            j = sa[rank[i] - 1]  # 정렬상 바로 앞 접미사
            while i + h < n and j + h < n and s[i + h] == s[j + h]:
                h += 1
            lcp[rank[i]] = h
            if h > 0:
                h -= 1  # 다음 접미사는 최소 h-1 보장
        else:
            h = 0
    return lcp
```

전체 O(n)입니다.

## 응용 1: 부분 문자열 검색 — O(m log n)

접미사 배열이 정렬되어 있으므로, 패턴 P가 어떤 접미사의 접두사인지 **이분 탐색**으로 찾을 수 있습니다.

```python
def contains(s: str, sa: list, p: str) -> bool:
    lo, hi = 0, len(sa)
    while lo < hi:
        mid = (lo + hi) // 2
        suffix = s[sa[mid]:sa[mid] + len(p)]
        if suffix < p:
            lo = mid + 1
        else:
            hi = mid
    return lo < len(sa) and s[sa[lo]:sa[lo] + len(p)] == p
```

패턴 비교 한 번에 O(m), 이분 탐색 O(log n)이므로 검색은 O(m log n)입니다. 같은 텍스트에서 여러 패턴을 반복 검색할 때 KMP보다 유리합니다.

## 응용 2: 최장 반복 부분 문자열

두 번 이상 등장하는 가장 긴 부분 문자열은 **LCP 배열의 최댓값**입니다. 어떤 부분 문자열이 두 번 등장하면 두 등장 위치에서 시작하는 접미사들이 그 부분 문자열을 공통 접두사로 가지며, 정렬하면 그런 접미사들이 인접하게 모이기 때문입니다.

```python
s = "banana"
sa = suffix_array(s)
lcp = lcp_array(s, sa)
best = max(range(len(lcp)), key=lambda i: lcp[i])
print(s[sa[best]:sa[best] + lcp[best]])  # "ana"
```

## 응용 3: 서로 다른 부분 문자열 개수

접미사 `S[SA[i]:]`가 새로 만들어내는 부분 문자열 개수는 `(접미사 길이) - LCP[i]`입니다. 앞 LCP[i]글자로 시작하는 접두사들은 이미 이전 접미사에서 등장했기 때문입니다.

```python
def count_distinct_substrings(s: str) -> int:
    n = len(s)
    sa = suffix_array(s)
    lcp = lcp_array(s, sa)
    return sum(n - sa[i] - lcp[i] for i in range(n))

print(count_distinct_substrings("banana"))  # 15
```

## 접미사 배열 vs 접미사 트리 vs 트라이

| 항목 | 접미사 배열 | 접미사 트리 | 트라이 |
|------|------------|------------|--------|
| 공간 | O(n) (상수 작음) | O(n) (상수 큼) | O(Σ패턴 길이 × σ) |
| 구축 | O(n log² n) ~ O(n) | O(n) (Ukkonen, 복잡) | O(Σ패턴 길이) |
| 검색 | O(m log n) | O(m) | O(m) |
| 구현 난이도 | 중 | 상 | 하 |

접미사 트리는 이론적으로 더 강력하지만 구현이 어렵고 메모리 상수가 큽니다. 접미사 배열 + LCP 배열 조합은 접미사 트리로 푸는 문제 대부분을 동일한 점근 복잡도(또는 log 한 단계 추가)로 풀 수 있어 실전 표준입니다.

## 복잡도 정리

| 연산 | 시간 |
|------|------|
| 구축 (배가 기법) | O(n log² n) |
| LCP 배열 (Kasai) | O(n) |
| 부분 문자열 검색 | O(m log n) |
| 최장 반복 부분 문자열 | O(n) (구축 후) |

---

**지난 글:** [아호-코라식 알고리즘: 다중 패턴 동시 탐색](/posts/dsa-aho-corasick/)

**다음 글:** [트라이 응용: 자동완성, 접두사 검색, XOR 트라이](/posts/dsa-trie-applications/)

<br>
읽어주셔서 감사합니다. 😊
