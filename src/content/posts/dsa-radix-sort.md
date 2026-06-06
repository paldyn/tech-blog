---
title: "기수 정렬(Radix Sort)"
description: "자릿수별 안정 정렬을 반복해 O(d(N+K))에 정수를 정렬하는 기수 정렬의 LSD·MSD 방식, 카운팅 정렬과의 연계, 실전 활용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 3
type: "knowledge"
category: "Algorithm"
tags: ["기수정렬", "RadixSort", "LSD", "MSD", "선형시간정렬"]
featured: false
draft: false
---

[지난 글](/posts/dsa-counting-sort/)에서 O(N + K) 카운팅 정렬을 다뤘습니다. 이번에는 카운팅 정렬을 서브루틴으로 활용해 큰 수도 빠르게 정렬하는 **기수 정렬(Radix Sort)**입니다. 자릿수(digit)별로 안정 정렬을 반복하면 전체를 O(d(N + K))에 처리할 수 있습니다.

## 핵심 아이디어

`[170, 45, 75, 90, 2, 24, 802, 66]`을 정렬한다고 합시다. 숫자를 직접 비교하는 대신 **각 자릿수를 키로** 삼아 안정 정렬을 반복합니다.

- **LSD(Least Significant Digit)**: 1의 자리 → 10의 자리 → … 순으로 낮은 자리부터 정렬
- **MSD(Most Significant Digit)**: 최고 자리부터 재귀적으로 정렬 (문자열 정렬에 유리)

LSD 방식이 구현이 단순하고 안정 정렬을 자연스럽게 보장합니다.

![LSD 기수 정렬: 자릿수별 정렬 과정](/assets/posts/dsa-radix-sort-process.svg)

## LSD 기수 정렬 구현

```cpp
void countByDigit(vector<int>& a, int exp) {
    int n = a.size();
    vector<int> c(10, 0), b(n);
    // 해당 자릿수 빈도 집계
    for (int x : a) c[(x / exp) % 10]++;
    // 누적합
    for (int i = 1; i < 10; i++) c[i] += c[i-1];
    // 역방향 배치 (안정 정렬)
    for (int i = n-1; i >= 0; i--)
        b[--c[(a[i]/exp)%10]] = a[i];
    a = b;
}

void radixSort(vector<int>& a) {
    int mx = *max_element(a.begin(), a.end());
    for (int exp = 1; mx/exp > 0; exp *= 10)
        countByDigit(a, exp);
}
```

![기수 정렬 LSD 구현 코드](/assets/posts/dsa-radix-sort-code.svg)

## 복잡도 분석

| 항목 | 값 |
|---|---|
| 시간 복잡도 | **O(d × (N + K))** |
| 공간 복잡도 | O(N + K) |
| 안정성 | 안정 정렬 |

- **d** = 최대 자릿수 (10진수 기준 log₁₀(최댓값))
- **K** = 기수 (10진수 = 10, 바이트 단위 = 256)
- N이 클수록, d와 K가 작을수록 퀵 정렬보다 빠릅니다.

32비트 정수의 경우 K=256(바이트 단위), d=4이므로 사실상 **O(4N) = O(N)**입니다.

## 바이트 기반 최적화 (실전)

10진수 대신 **256진수(바이트 단위)**로 처리하면 자릿수가 4로 고정되고 루프가 줄어 실제 속도가 훨씬 빠릅니다.

```cpp
void radixSort256(vector<unsigned>& a) {
    vector<unsigned> b(a.size());
    unsigned cnt[256];
    for (int shift = 0; shift < 32; shift += 8) {
        memset(cnt, 0, sizeof(cnt));
        for (unsigned x : a) cnt[(x >> shift) & 0xFF]++;
        for (int i = 1; i < 256; i++) cnt[i] += cnt[i-1];
        for (int i = (int)a.size()-1; i >= 0; i--)
            b[--cnt[(a[i]>>shift)&0xFF]] = a[i];
        swap(a, b);
    }
}
```

## MSD 방식: 문자열 정렬

문자열이나 가변 길이 키에는 MSD가 유리합니다. 첫 문자로 버킷을 나눈 뒤 각 버킷을 재귀적으로 정렬합니다.

```python
def msd_radix_sort(strings, pos=0):
    if len(strings) <= 1:
        return strings
    buckets = {}
    for s in strings:
        c = s[pos] if pos < len(s) else ''
        buckets.setdefault(c, []).append(s)
    result = []
    for key in sorted(buckets):
        group = buckets[key]
        if key == '':
            result.extend(group)
        else:
            result.extend(msd_radix_sort(group, pos + 1))
    return result
```

## 퀵 정렬과의 비교

| 기준 | 기수 정렬 | 퀵 정렬 |
|---|---|---|
| 비교 기반 | 아니오 | 예 |
| 최악 시간 | O(d(N+K)) | O(N²) |
| 평균 시간 | O(d(N+K)) | O(N log N) |
| 메모리 | O(N+K) 추가 | O(log N) 재귀 |
| 캐시 효율 | 보통 | 높음 |
| 안정성 | 안정 | 불안정 |

**기수 정렬이 빠른 조건**: N이 크고, 키의 자릿수(d)가 적고, 기수(K)가 작을 때. 반대로 d가 크거나 키 비교가 저렴하면 퀵 정렬이 실전에서 더 빠를 수 있습니다.

---

**지난 글:** [카운팅 정렬(Counting Sort)](/posts/dsa-counting-sort/)

**다음 글:** [버킷 정렬(Bucket Sort)](/posts/dsa-bucket-sort/)

<br>
읽어주셔서 감사합니다. 😊
