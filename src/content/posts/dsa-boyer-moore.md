---
title: "보이어-무어 알고리즘: 실용적인 고속 문자열 검색"
description: "보이어-무어(Boyer-Moore) 알고리즘의 Bad Character 휴리스틱, Good Suffix 휴리스틱, 오른쪽-왼쪽 비교 전략, 전처리 테이블 구축, 평균 O(n/m) 성능 분석까지 완전히 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 9
type: "knowledge"
category: "Algorithm"
tags: ["보이어-무어", "BadCharacter", "GoodSuffix", "문자열검색", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-manacher-algorithm/)에서 팰린드롬 탐색 O(n)을 다뤘다면, 보이어-무어는 일반 문자열 검색에서 **평균 O(n/m)**까지 달성하는 가장 실용적인 알고리즘입니다. 실제로 grep, vim, 대부분의 텍스트 편집기가 내부적으로 사용합니다.

## 두 가지 핵심 아이디어

보이어-무어는 두 휴리스틱을 결합합니다.

1. **Bad Character**: 불일치 문자를 이용해 건너뛰기
2. **Good Suffix**: 이미 일치한 접미사를 이용해 더 크게 건너뛰기

둘 다 사용 가능할 때 더 큰 값으로 이동합니다. 또한 **오른쪽 → 왼쪽**으로 비교한다는 것이 특징입니다.

## Bad Character 휴리스틱

패턴 j번 위치에서 불일치 발생 시, 텍스트의 해당 문자(bad character)가 패턴 안에 있다면 그 위치에 맞춰 정렬, 없으면 패턴 전체를 뛰어넘습니다.

```python
def build_bad_char(pattern: str) -> dict:
    return {c: i for i, c in enumerate(pattern)}
    # 마지막 위치만 저장 (앞에서 뒤로 순회하므로 마지막이 덮어씀)

def bad_char_shift(pattern, j, bad_char):
    c = pattern[j]  # 실제로는 텍스트의 불일치 문자
    last = bad_char.get(c, -1)
    return max(1, j - last)
```

![Bad Character 휴리스틱](/assets/posts/dsa-boyer-moore-bad-char.svg)

## Good Suffix 휴리스틱

패턴의 오른쪽 일부가 이미 일치했고(접미사 t), 그 앞 문자에서 불일치가 발생했을 때:

1. 패턴 안에 같은 t가 또 있다면: 그 위치에 맞춰 정렬
2. 없다면: t의 접미사가 패턴의 접두사로 나타나는 최대 길이로 이동

```python
def build_good_suffix(pattern: str) -> list:
    m = len(pattern)
    shift = [m] * (m + 1)
    border = [0] * (m + 1)

    # 케이스 1: 접미사 패턴 내 다른 위치
    i, j = m, m + 1
    border[i] = j
    while i > 0:
        while j <= m and pattern[i-1] != pattern[j-1]:
            if shift[j] == m:
                shift[j] = j - i
            j = border[j]
        i -= 1
        j -= 1
        border[i] = j

    # 케이스 2: 접미사 = 패턴 접두사
    j = border[0]
    for i in range(m + 1):
        if shift[i] == m:
            shift[i] = j
        if i == j:
            j = border[j]

    return shift
```

## 완전한 구현

```python
def boyer_moore(text: str, pattern: str) -> list:
    n, m = len(text), len(pattern)
    if m == 0:
        return []

    # 전처리
    bad_char = {c: i for i, c in enumerate(pattern)}
    good_suffix = build_good_suffix(pattern)

    matches = []
    s = 0  # 텍스트에서 패턴 시작 위치

    while s <= n - m:
        j = m - 1  # 오른쪽부터 비교

        while j >= 0 and pattern[j] == text[s + j]:
            j -= 1

        if j < 0:
            matches.append(s)
            s += good_suffix[0]
        else:
            # 두 휴리스틱 중 더 큰 값
            bc_shift = max(1, j - bad_char.get(text[s + j], -1))
            gs_shift = good_suffix[j + 1]
            s += max(bc_shift, gs_shift)

    return matches

text = "ABCBABCAB"
print(boyer_moore(text, "ABC"))  # [0, 5]
```

![Good Suffix 휴리스틱](/assets/posts/dsa-boyer-moore-good-suffix.svg)

## 성능 분석

```python
# 최고의 경우: 알파벳 크기 크고, 패턴이 텍스트에 매우 드문 경우
# → 매 이동마다 m칸씩 건너뛰어서 O(n/m)
text = "x" * 1000000
pattern = "abcdefgh"  # 8글자, 전혀 없음
# 비교 횟수: ~1,000,000 / 8 = 125,000번

# 최악의 경우: 모두 같은 문자
text = "a" * 1000000
pattern = "a" * 8
# 매 위치마다 8번 비교 → O(n*m)
```

| 케이스 | 시간 복잡도 |
|--------|-------------|
| 최선 | O(n/m) |
| 평균 | O(n/m) ~ O(n) |
| 최악 | O(n·m) |

최악을 방지하려면 Galil 규칙을 추가하면 O(n)이 보장됩니다.

## Boyer-Moore-Horspool (간소화)

Good Suffix를 제거하고 Bad Character만 사용하는 단순화 버전. 실용적으로도 충분히 빠릅니다.

```python
def horspool(text: str, pattern: str) -> list:
    n, m = len(text), len(pattern)

    # Bad Character 테이블: 패턴 마지막 문자 제외
    skip = {c: m for c in set(text)}
    for i in range(m - 1):
        skip[pattern[i]] = m - 1 - i

    matches = []
    s = 0
    while s <= n - m:
        j = m - 1
        while j >= 0 and pattern[j] == text[s + j]:
            j -= 1
        if j < 0:
            matches.append(s)
        s += skip.get(text[s + m - 1], m)

    return matches
```

Horspool은 구현이 단순하고 실제 텍스트에서 BM과 비슷한 성능을 냅니다.

## Sunday 알고리즘

Horspool을 더 개선한 버전. 이동 후 패턴 오른쪽 바로 다음 문자(s+m)를 기준으로 skip합니다.

```python
def sunday(text: str, pattern: str) -> list:
    n, m = len(text), len(pattern)
    shift = {c: m + 1 for c in set(text)}
    for i, c in enumerate(pattern):
        shift[c] = m - i  # 마지막 등장 위치 기준

    matches = []
    s = 0
    while s <= n - m:
        if text[s:s+m] == pattern:
            matches.append(s)
        if s + m >= n:
            break
        s += shift.get(text[s + m], m + 1)

    return matches
```

## 알고리즘 비교

| 알고리즘 | 전처리 | 평균 탐색 | 최악 탐색 | 적합 상황 |
|----------|--------|-----------|-----------|-----------|
| KMP | O(m) | O(n) | O(n) | 짧은 알파벳, 반복 패턴 |
| BM (전체) | O(m+σ) | O(n/m) | O(n·m) | 긴 알파벳, 긴 패턴 |
| BM-Horspool | O(m+σ) | O(n/m) | O(n·m) | 실용적, 단순 구현 |
| Rabin-Karp | O(m) | O(n) | O(n·m) | 다중 패턴 |

σ = 알파벳 크기 (ASCII: 256)

---

**지난 글:** [마나커 알고리즘: 팰린드롬 부분 문자열 선형 탐색](/posts/dsa-manacher-algorithm/)

**다음 글:** [아호-코라식 알고리즘: 다중 패턴 동시 탐색](/posts/dsa-aho-corasick/)

<br>
읽어주셔서 감사합니다. 😊
