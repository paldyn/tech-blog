---
title: "개방 주소법 (Open Addressing)"
description: "해시 테이블에서 링크드 리스트 없이 배열 내 빈 슬롯을 탐색하는 개방 주소법 — 선형 탐사, 이차 탐사, 이중 해싱의 원리와 구현을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 2
type: "knowledge"
category: "Algorithm"
tags: ["개방 주소법", "open addressing", "선형 탐사", "이중 해싱", "해시 테이블"]
featured: false
draft: false
---

[지난 글](/posts/dsa-collision-resolution/)에서 분리 체이닝으로 충돌을 해결하는 방법을 살펴봤습니다. 이번에는 링크드 리스트를 전혀 사용하지 않고 **배열 내에서 빈 슬롯을 찾아 저장**하는 **개방 주소법(Open Addressing)**을 다룹니다. Python의 내장 `dict`와 `set`이 이 방식으로 구현되어 있습니다.

## 개방 주소법의 기본 아이디어

충돌이 발생하면 **탐사(probing)** 규칙에 따라 다음 슬롯을 확인합니다. 빈 슬롯을 찾을 때까지 계속 탐사하며, 삽입은 그 빈 슬롯에 이루어집니다. 검색도 동일한 탐사 순서로 키를 찾을 때까지 진행합니다.

## 선형 탐사 (Linear Probing)

![선형·이차 탐사 비교](/assets/posts/dsa-open-addressing-probing.svg)

가장 단순한 방식입니다.

```
h(k, i) = (h(k) + i) % m   (i = 0, 1, 2, ...)
```

한 칸씩 앞으로 이동하며 빈 슬롯을 탐색합니다. CPU 캐시 지역성이 뛰어나 실제로 빠르지만, **1차 클러스터링(Primary Clustering)** 문제가 있습니다. 한 번 긴 연속 점유 구간이 생기면 이후 삽입이 그 구간에 계속 쌓여 더욱 길어지는 악순환이 발생합니다.

## 이차 탐사 (Quadratic Probing)

```
h(k, i) = (h(k) + i²) % m
```

i²만큼 건너뛰며 탐사합니다. 1차 클러스터링은 해소되지만 같은 h(k)를 가진 키들이 동일한 탐사 경로를 따르는 **2차 클러스터링(Secondary Clustering)**이 남습니다.

## 이중 해싱 (Double Hashing)

![이중 해싱](/assets/posts/dsa-open-addressing-double-hashing.svg)

두 번째 해시 함수로 탐사 간격을 결정합니다.

```
h(k, i) = (h1(k) + i * h2(k)) % m
```

h2(k)가 키마다 다른 값을 반환하므로 탐사 경로가 거의 모두 다릅니다. 클러스터링이 최소화되어 가장 균일한 분포를 만들지만, 해시 계산을 두 번 해야 하는 비용이 있습니다. Python의 `dict` 구현이 변형된 이중 해싱을 사용합니다.

## Python으로 선형 탐사 구현

```python
class LinearProbingHashMap:
    _DELETED = object()   # 삭제 마커 (Tombstone)

    def __init__(self, capacity=16):
        self.capacity = capacity
        self.size = 0
        self.keys = [None] * capacity
        self.values = [None] * capacity

    def _hash(self, key):
        return hash(key) % self.capacity

    def put(self, key, value):
        idx = self._hash(key)
        for i in range(self.capacity):
            pos = (idx + i) % self.capacity
            if self.keys[pos] is None or self.keys[pos] is self._DELETED:
                self.keys[pos] = key
                self.values[pos] = value
                self.size += 1
                return
            if self.keys[pos] == key:
                self.values[pos] = value   # 업데이트
                return
        raise RuntimeError("Hash table is full")

    def get(self, key):
        idx = self._hash(key)
        for i in range(self.capacity):
            pos = (idx + i) % self.capacity
            if self.keys[pos] is None:
                raise KeyError(key)          # 빈 슬롯 = 없음
            if self.keys[pos] != self._DELETED and self.keys[pos] == key:
                return self.values[pos]
        raise KeyError(key)

    def delete(self, key):
        idx = self._hash(key)
        for i in range(self.capacity):
            pos = (idx + i) % self.capacity
            if self.keys[pos] is None:
                raise KeyError(key)
            if self.keys[pos] == key:
                self.keys[pos] = self._DELETED   # Tombstone
                self.size -= 1
                return
        raise KeyError(key)
```

## Tombstone (삭제 마커)의 필요성

삭제 시 슬롯을 `None`으로 비우면 해당 슬롯 이후에 삽입된 키의 검색 체인이 끊깁니다. 예를 들어 `h(A)=h(B)=3`이고, A가 슬롯 3, B가 슬롯 4에 있을 때 A를 삭제해 슬롯 3을 `None`으로 만들면 B 검색 시 슬롯 3을 보고 "없음"으로 판단합니다. 따라서 **삭제된 슬롯에는 Tombstone 마커**를 놓고, 검색에는 통과·삽입에는 재사용합니다.

## Robin Hood Hashing

현대 고성능 해시맵(Rust의 `HashMap` 등)에서 쓰는 선형 탐사 최적화입니다. 키를 삽입할 때 현재 슬롯에 있는 키의 "집에서 떨어진 거리"(PSL, Probe Sequence Length)와 비교해, 삽입할 키가 더 가난하면(PSL가 더 크면) 두 키를 교체합니다. 이로써 모든 키의 PSL이 균등해져 최악 검색 시간이 개선됩니다.

## 세 탐사 방식 정리

| 방식 | 클러스터링 | 캐시 효율 | 삭제 난이도 |
|---|---|---|---|
| 선형 탐사 | 1차 (심각) | 최우수 | Tombstone |
| 이차 탐사 | 2차 (완화) | 보통 | Tombstone |
| 이중 해싱 | 거의 없음 | 낮음 | Tombstone |

개방 주소법은 **부하율 α < 0.7**을 유지해야 성능이 보장됩니다. α ≥ 0.8이면 탐사 횟수가 급격히 증가합니다.

---

**지난 글:** [충돌 해결 — 분리 체이닝](/posts/dsa-collision-resolution/)

**다음 글:** [일관된 해싱 (Consistent Hashing)](/posts/dsa-consistent-hashing/)

<br>
읽어주셔서 감사합니다. 😊
