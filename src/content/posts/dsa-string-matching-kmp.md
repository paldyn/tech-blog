---
title: "KMP 알고리즘: 문자열 검색의 표준"
description: "KMP(Knuth-Morris-Pratt) 알고리즘의 실패 함수(Failure Function) 구축 원리, O(n+m) 탐색 과정, 구현 세부 사항, 다중 패턴 검색과 주기성 탐지 응용까지 완전 분석합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 4
type: "knowledge"
category: "Algorithm"
tags: ["KMP", "문자열검색", "실패함수", "패턴매칭", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-bit-manipulation/)에서 비트 조작을 다뤘다면, 이번에는 문자열 알고리즘의 핵심인 KMP를 살펴봅니다. 단순 브루트 포스 O(n·m)에서 O(n+m)으로 개선하는 핵심 아이디어는 **이미 매칭된 정보를 버리지 않는 것**입니다.

## 문제: 왜 브루트 포스가 느린가

텍스트 `T = "AAAA...AB"` (A 9999개 + B), 패턴 `P = "AAAB"`를 찾는다면:

- 브루트 포스: 각 위치에서 최대 4번 비교, 약 40000번 비교
- 불일치 시 패턴을 한 칸만 이동 → 앞서 비교한 정보 완전 폐기

KMP는 **실패 함수(Failure Function)**를 이용해, 불일치 시 패턴을 얼마나 건너뛰어도 안전한지 미리 계산합니다.

## 실패 함수 (Failure Function)

`fail[i]`: 패턴 `P[0..i]`에서 **접두사(prefix) = 접미사(suffix)**가 되는 최대 길이 (P[0..i] 자체는 제외)

패턴 `"ABABCABAB"`:

| 인덱스 | 문자 | fail[] | 이유 |
|--------|------|--------|------|
| 0 | A | 0 | 길이 1, 자체 제외 → 0 |
| 1 | B | 0 | "AB" — 공통 없음 |
| 2 | A | 1 | "ABA" — "A" 일치 |
| 3 | B | 2 | "ABAB" — "AB" 일치 |
| 4 | C | 0 | "ABABC" — 없음 |
| 5 | A | 1 | "ABABCA" — "A" |
| 6 | B | 2 | "ABABCAB" — "AB" |
| 7 | A | 3 | "ABABCABA" — "ABA" |
| 8 | B | 4 | "ABABCABAB" — "ABAB" |

![KMP 실패 함수](/assets/posts/dsa-string-matching-kmp-failure.svg)

## 탐색 과정

불일치 발생 시 텍스트 포인터는 **절대 뒤로 가지 않고**, 패턴 포인터만 `fail[j-1]`로 이동합니다.

![KMP 탐색](/assets/posts/dsa-string-matching-kmp-search.svg)

## 완전한 Python 구현

```python
def kmp_search(text: str, pattern: str) -> list:
    n, m = len(text), len(pattern)
    if m == 0:
        return []

    # 1. 실패 함수 구축
    fail = [0] * m
    j = 0
    for i in range(1, m):
        while j > 0 and pattern[i] != pattern[j]:
            j = fail[j - 1]
        if pattern[i] == pattern[j]:
            j += 1
        fail[i] = j

    # 2. 탐색
    matches = []
    j = 0
    for i in range(n):
        while j > 0 and text[i] != pattern[j]:
            j = fail[j - 1]
        if text[i] == pattern[j]:
            j += 1
        if j == m:
            matches.append(i - m + 1)
            j = fail[j - 1]  # 다음 매칭을 위해 점프

    return matches

text = "ABABDABABCABABC"
pattern = "ABABC"
print(kmp_search(text, pattern))  # [5, 9]
```

실패 함수 구축 코드와 탐색 코드의 구조가 완전히 동일합니다. 실패 함수 구축은 패턴 자신을 텍스트로 삼아 탐색하는 것과 같기 때문입니다.

## 복잡도 증명: 왜 O(n)인가

텍스트 탐색 루프에서 `i`는 0에서 n-1까지 정확히 n번 증가합니다. `j`는 `i`가 증가할 때 최대 1 증가하고, `fail[j-1]`을 통해서만 감소합니다. 따라서 j의 총 증가량은 ≤ n, 총 감소량도 ≤ n이므로 `while` 루프 전체 실행 횟수는 **O(n)**입니다.

## 응용 1: 문자열 주기성 탐지

문자열 s가 어떤 문자열 t의 반복으로 구성되는지 확인:

```python
def min_period(s: str) -> int:
    n = len(s)
    fail = build_failure(s)
    period = n - fail[n - 1]
    # n이 period의 배수이면 완전한 반복
    if n % period == 0:
        return period
    return n  # 비주기 문자열

def build_failure(s):
    m = len(s)
    fail = [0] * m
    j = 0
    for i in range(1, m):
        while j > 0 and s[i] != s[j]:
            j = fail[j-1]
        if s[i] == s[j]:
            j += 1
        fail[i] = j
    return fail

print(min_period("abababab"))  # 2
print(min_period("abcabcabc")) # 3
print(min_period("abcde"))     # 5 (비주기)
```

KMP 실패 함수만으로 주기를 O(m)에 구하는 우아한 방법입니다.

## 응용 2: 다중 패턴 검색

여러 패턴을 동시에 검색할 때 Aho-Corasick(추후 다룰 예정)이 이상적이지만, 패턴이 서로 연결된 경우 KMP를 그대로 활용할 수 있습니다. 패턴들을 구분자 `#`로 이어 붙여 실패 함수를 구축합니다.

```python
def count_pattern_in_text(text, pattern):
    combined = pattern + "#" + text
    fail = build_failure(combined)
    m = len(pattern)
    return sum(1 for f in fail if f == m)

# "ABA"가 "ABABABA"에 몇 번 나타나는가 (겹침 허용)
print(count_pattern_in_text("ABABABA", "ABA"))  # 3
```

## KMP vs 다른 문자열 검색

| 알고리즘 | 전처리 | 탐색 | 특징 |
|----------|--------|------|------|
| 브루트 포스 | O(1) | O(n·m) | 구현 단순 |
| KMP | O(m) | O(n) | 균일한 성능 |
| Boyer-Moore | O(m+σ) | O(n/m) ~ O(n·m) | 평균 빠름, 최악 주의 |
| Rabin-Karp | O(m) | O(n) 평균 | 다중 패턴에 유리 |
| Z-Algorithm | O(m+n) | O(m+n) | 구현 단순, KMP와 동등 |

KMP는 패턴이 길고 반복적인 구조를 가질수록 성능 이점이 크고, 최악의 경우에도 항상 O(n+m)을 보장합니다.

---

**지난 글:** [비트 조작 (Bit Manipulation): 비트 연산과 마스킹 완전 정복](/posts/dsa-bit-manipulation/)

**다음 글:** [라빈-카프 알고리즘: 해시 기반 문자열 검색](/posts/dsa-string-matching-rabin-karp/)

<br>
읽어주셔서 감사합니다. 😊
