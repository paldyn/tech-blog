---
title: "트라이 응용: 자동완성, 접두사 검색, XOR 트라이"
description: "트라이의 대표 응용 패턴을 정리합니다. 자동완성과 접두사 카운팅, 사전순 k번째 단어, 비트 트라이로 최대 XOR 쌍 찾기, 단어 사각형 같은 백트래킹 결합 패턴까지 구현 코드와 함께 분석합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 2
type: "knowledge"
category: "Algorithm"
tags: ["트라이", "자동완성", "XOR트라이", "접두사검색", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-suffix-array/)에서 텍스트의 모든 접미사를 정렬해 두는 접미사 배열을 다뤘다면, 이번에는 시리즈 앞부분에서 익힌 트라이(Trie)를 실전 문제에 적용하는 패턴들을 모아 봅니다. 트라이는 "문자 단위로 분기하는 트리"라는 단순한 구조지만, 자동완성·접두사 통계·최대 XOR 검색처럼 전혀 달라 보이는 문제들을 같은 골격으로 풀어냅니다.

## 기본 골격 복습

응용 패턴마다 노드에 보관하는 정보가 달라질 뿐, 뼈대는 동일합니다.

```python
class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end = False
        self.pass_count = 0   # 이 노드를 지나는 단어 수 (응용 2)

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str):
        cur = self.root
        for c in word:
            if c not in cur.children:
                cur.children[c] = TrieNode()
            cur = cur.children[c]
            cur.pass_count += 1
        cur.is_end = True
```

## 응용 1: 자동완성 (Autocomplete)

검색창에 "ca"를 입력하면 "car", "cat"이 추천되는 기능입니다. 두 단계로 동작합니다.

1. 접두사 경로를 따라 내려간다 — O(m)
2. 그 노드 아래 서브트리를 DFS로 순회하며 단어 끝 노드를 수집한다

![트라이 자동완성](/assets/posts/dsa-trie-applications-autocomplete.svg)

```python
def autocomplete(trie: Trie, prefix: str, limit: int = 5) -> list:
    cur = trie.root
    for c in prefix:
        if c not in cur.children:
            return []          # 접두사 자체가 없음
        cur = cur.children[c]

    results = []

    def dfs(node, path):
        if len(results) >= limit:
            return
        if node.is_end:
            results.append(prefix + path)
        for c in sorted(node.children):   # 사전순 추천
            dfs(node.children[c], path + c)

    dfs(cur, "")
    return results
```

실서비스에서는 서브트리 전체 DFS 대신 **각 노드에 인기 상위 k개 후보를 미리 캐싱**해 두는 변형을 많이 씁니다. 그러면 질의가 O(m + k)로 줄어듭니다.

## 응용 2: 접두사 카운팅

"prefix로 시작하는 단어가 몇 개인가?"는 insert 때 갱신한 `pass_count`를 읽기만 하면 됩니다.

```python
def count_prefix(trie: Trie, prefix: str) -> int:
    cur = trie.root
    for c in prefix:
        if c not in cur.children:
            return 0
        cur = cur.children[c]
    return cur.pass_count
```

삽입·질의 모두 O(m)입니다. 해시 테이블로는 접두사 질의를 효율적으로 처리할 수 없다는 점이 트라이의 차별점입니다.

## 응용 3: 사전순 k번째 단어

`pass_count`가 있으면 서브트리를 통째로 건너뛰며 k번째 단어를 찾을 수 있습니다.

```python
def kth_word(trie: Trie, k: int) -> str:
    cur = trie.root
    path = []
    while True:
        if cur.is_end:
            k -= 1
            if k == 0:
                return "".join(path)
        for c in sorted(cur.children):
            child = cur.children[c]
            if k > child.pass_count:
                k -= child.pass_count   # 서브트리 통째로 스킵
            else:
                path.append(c)
                cur = child
                break
```

전체 정렬 없이 O(답 길이 × σ)로 끝납니다.

## 응용 4: XOR 트라이 — 최대 XOR 쌍

트라이의 가장 화려한 응용입니다. **숫자를 이진 비트열로 보고 최상위 비트부터 트라이에 삽입**하면, "배열에서 x와 XOR했을 때 최대가 되는 수"를 O(비트 수)에 찾을 수 있습니다.

탐욕 원리는 단순합니다. XOR을 최대화하려면 상위 비트부터 **내 비트와 반대인 가지**를 골라야 합니다. 반대 가지가 없으면 어쩔 수 없이 같은 가지로 내려갑니다.

![XOR 트라이](/assets/posts/dsa-trie-applications-xor.svg)

```python
class XorTrie:
    def __init__(self, bits: int = 30):
        self.root = {}
        self.bits = bits

    def insert(self, num: int):
        cur = self.root
        for i in range(self.bits, -1, -1):
            b = (num >> i) & 1
            cur = cur.setdefault(b, {})

    def max_xor(self, num: int) -> int:
        cur = self.root
        result = 0
        for i in range(self.bits, -1, -1):
            b = (num >> i) & 1
            want = 1 - b                  # 반대 비트 우선
            if want in cur:
                result |= (1 << i)
                cur = cur[want]
            else:
                cur = cur[b]
        return result

def max_xor_pair(nums: list) -> int:
    trie = XorTrie()
    best = 0
    for x in nums:
        trie.insert(x)
        best = max(best, trie.max_xor(x))
    return best

print(max_xor_pair([3, 5, 6, 4]))  # 7 (4 ^ 3)
```

n개 수에 대해 전체 O(n · B)이며 (B = 비트 수), 브루트포스 O(n²)을 크게 개선합니다. "XOR 최대/최소", "구간 XOR 질의" 류 문제의 표준 풀이입니다.

## 응용 5: 백트래킹과 결합 — 단어 검색 가지치기

격자에서 여러 단어를 동시에 찾는 문제(Word Search II)는 트라이와 백트래킹의 결합이 빛나는 사례입니다. 격자 DFS를 진행하면서 **현재 경로가 트라이에 접두사로 존재하지 않으면 즉시 가지치기**합니다.

```python
def find_words(board: list, words: list) -> list:
    trie = Trie()
    for w in words:
        trie.insert(w)

    rows, cols = len(board), len(board[0])
    found = set()

    def dfs(r, c, node, path):
        ch = board[r][c]
        if ch not in node.children:
            return                        # 접두사 불일치 → 가지치기
        node = node.children[ch]
        if node.is_end:
            found.add(path + ch)

        board[r][c] = "#"                 # 방문 표시
        for dr, dc in ((1,0), (-1,0), (0,1), (0,-1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and board[nr][nc] != "#":
                dfs(nr, nc, node, path + ch)
        board[r][c] = ch                  # 복원

    for r in range(rows):
        for c in range(cols):
            dfs(r, c, trie.root, "")
    return list(found)
```

단어마다 격자를 따로 탐색하면 단어 수에 비례해 비용이 늘지만, 트라이로 합치면 **한 번의 DFS로 모든 단어를 동시에** 검사합니다. 아호-코라식과 같은 철학입니다.

## 패턴 정리

| 응용 | 노드에 추가하는 정보 | 질의 복잡도 |
|------|--------------------|------------|
| 자동완성 | (선택) 상위 k 후보 캐시 | O(m + 후보 수) |
| 접두사 카운팅 | pass_count | O(m) |
| k번째 단어 | pass_count | O(답 길이 × σ) |
| 최대 XOR | 없음 (비트 트라이) | O(B) |
| 다중 단어 격자 탐색 | is_end | DFS × 가지치기 |

트라이 응용 문제를 만나면 "노드에 무엇을 기록해야 질의가 빨라지는가?"부터 생각하면 대부분 풀립니다.

---

**지난 글:** [접미사 배열(Suffix Array): 문자열의 모든 접미사 정렬하기](/posts/dsa-suffix-array/)

**다음 글:** [최대공약수와 확장 유클리드 알고리즘](/posts/dsa-gcd-lcm-extended-euclid/)

<br>
읽어주셔서 감사합니다. 😊
