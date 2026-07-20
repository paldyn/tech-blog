---
title: "블룸 필터 (Bloom Filter)"
description: "비트 배열과 여러 해시 함수를 이용해 공간을 극적으로 절약하는 확률적 자료구조 블룸 필터의 원리, 거짓 양성률, Python 구현을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 4
type: "knowledge"
category: "Algorithm"
tags: ["블룸 필터", "bloom filter", "확률적 자료구조", "거짓 양성", "비트 배열"]
featured: false
draft: false
---

[지난 글](/posts/dsa-consistent-hashing/)에서 분산 환경의 해싱을 살펴봤습니다. 이번 글은 "이 원소가 집합에 속하는가?"를 일반 해시셋보다 수백 배 적은 메모리로 답하는 **블룸 필터(Bloom Filter)**를 다룹니다. Chrome 브라우저부터 Cassandra까지 다양한 시스템에서 성능 최적화에 활용됩니다.

## 블룸 필터란

1970년 버튼 블룸(Burton Bloom)이 고안한 **확률적 자료구조(Probabilistic Data Structure)**입니다. m개의 비트 배열과 k개의 독립적인 해시 함수로 구성됩니다.

- **"없음" → 항상 정확**: 원소가 없다고 하면 확실히 없음
- **"있음" → 틀릴 수 있음**: 있다고 해도 실제로 없을 수 있음 (거짓 양성)

이 "완벽하지 않음"을 감수하는 대신 **메모리를 극적으로 절약**합니다.

## 구조와 동작

![블룸 필터 구조](/assets/posts/dsa-bloom-filter-structure.svg)

**삽입**: k개의 해시 함수로 m개의 비트 위치를 계산하고, 해당 비트를 모두 1로 설정합니다.

**조회**: k개의 비트 위치를 모두 확인합니다.
- 모두 1이면 → "있을 수 있음" (False Positive 가능)
- 하나라도 0이면 → "확실히 없음"

**삭제 불가**: 비트를 0으로 되돌리면 다른 원소의 비트도 같이 지워질 수 있어 일반 블룸 필터는 삭제를 지원하지 않습니다. (삭제 지원: Counting Bloom Filter)

## Python 구현

```python
import hashlib
import math

class BloomFilter:
    def __init__(self, n: int, fp_rate: float = 0.01):
        # 최적 m, k 계산
        self.m = math.ceil(-n * math.log(fp_rate) / (math.log(2) ** 2))
        self.k = max(1, round((self.m / n) * math.log(2)))
        self.bits = bytearray(math.ceil(self.m / 8))
        self.n = n

    def _hashes(self, item: str):
        for i in range(self.k):
            digest = hashlib.sha256(f"{i}:{item}".encode()).hexdigest()
            yield int(digest, 16) % self.m

    def add(self, item: str):
        for pos in self._hashes(item):
            self.bits[pos // 8] |= (1 << (pos % 8))

    def __contains__(self, item: str) -> bool:
        return all(
            self.bits[pos // 8] & (1 << (pos % 8))
            for pos in self._hashes(item)
        )

# 사용 예
bf = BloomFilter(n=1_000_000, fp_rate=0.01)
print(f"비트 수: {bf.m:,}  해시 수: {bf.k}")  # 9,585,058  7

bf.add("alice@example.com")
bf.add("bob@example.com")

print("alice@example.com" in bf)   # True
print("charlie@example.com" in bf) # False (확실)
print("dave@example.com" in bf)    # False or True (FP 가능)
```

## 거짓 양성률과 최적 파라미터

![거짓 양성률](/assets/posts/dsa-bloom-filter-fp-rate.svg)

거짓 양성률(FPR)은 다음 근사식으로 계산합니다.

```text
FPR ≈ (1 - e^(-kn/m))^k
```

최적 k는 `k_opt = (m/n) × ln(2) ≈ 0.693 × (m/n)`으로 주어집니다. 1% FPR을 달성하려면 원소당 약 9.6비트가 필요합니다.

**비교**: 해시셋(Python `set`)은 원소당 약 200~300비트를 사용합니다. 블룸 필터는 같은 조건에서 30배 이상 메모리를 절약합니다.

## 변형 자료구조

| 변형 | 특징 |
|---|---|
| Counting Bloom Filter | 비트 대신 카운터 사용 → 삭제 가능 |
| Scalable Bloom Filter | 가득 차면 새 레이어 추가 → 동적 확장 |
| Cuckoo Filter | FPR 비슷, 삭제 가능, 더 빠른 조회 |
| Blocked Bloom Filter | 캐시 지역성 최적화 |

## 핵심 특성 정리

- 삽입·조회 O(k) — k는 상수(보통 5~15)
- 공간 O(m) — 원소당 약 9~15비트 (FPR 1%~0.01%)
- **False Negative 없음**: "없음"은 완벽히 신뢰
- **False Positive 있음**: 비율은 파라미터로 제어 가능
- **삭제 불가** (기본형)

블룸 필터는 "비용이 높은 디스크/네트워크 조회 전에 빠른 1차 필터링"이 필요한 모든 상황에 적합합니다.

---

**지난 글:** [일관된 해싱 (Consistent Hashing)](/posts/dsa-consistent-hashing/)

**다음 글:** [집합 (Set)](/posts/dsa-set/)

<br>
읽어주셔서 감사합니다. 😊
