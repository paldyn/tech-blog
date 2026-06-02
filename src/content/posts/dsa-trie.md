---
title: "트라이 (Trie)"
description: "문자열 집합을 O(m)으로 검색하고 접두사 공유로 메모리를 절약하는 트라이의 구조, 삽입·검색·삭제 구현, 자동완성과 사전 검색 적용 사례를 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 8
type: "knowledge"
category: "Algorithm"
tags: ["트라이", "Trie", "문자열 검색", "자동완성", "자료구조"]
featured: false
draft: false
---

[지난 글](/posts/dsa-priority-queue/)에서 힙 기반 우선순위 큐를 다뤘습니다. 이번에는 문자열 처리에 특화된 **트라이(Trie)**를 살펴봅니다. 트라이는 문자열 집합을 저장하는 트리로, 각 노드가 문자 하나를 나타내며 루트부터 리프까지의 경로가 하나의 문자열을 형성합니다. 검색·삽입이 O(m) (m = 문자열 길이)이며, 같은 접두사를 공유하는 단어들이 경로를 공유해 메모리를 절약합니다.

## 구조

![트라이 구조](/assets/posts/dsa-trie-structure.svg)

- 루트는 빈 노드
- 각 간선에 문자가 표기됨 (노드에 두기도 함, 구현에 따라 다름)
- `is_end=True` 노드는 단어의 끝을 표시
- 공유 접두사는 같은 경로를 사용 → "car", "card", "care"는 c→a→r까지 공유

## 구현

![트라이 구현](/assets/posts/dsa-trie-implementation.svg)

```python
class TrieNode:
    def __init__(self):
        self.children = {}    # char -> TrieNode
        self.is_end = False

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word):    # O(m)
        node = self.root
        for ch in word:
            if ch not in node.children:
                node.children[ch] = TrieNode()
            node = node.children[ch]
        node.is_end = True

    def search(self, word):    # O(m)
        node = self._traverse(word)
        return node is not None and node.is_end

    def starts_with(self, prefix):  # O(m)
        return self._traverse(prefix) is not None

    def _traverse(self, s):
        node = self.root
        for ch in s:
            if ch not in node.children:
                return None
            node = node.children[ch]
        return node
```

## 삭제

```python
def delete(self, word):
    def _delete(node, word, depth):
        if depth == len(word):
            if not node.is_end:
                return False  # 단어 없음
            node.is_end = False
            return len(node.children) == 0  # 자식 없으면 삭제 가능

        ch = word[depth]
        if ch not in node.children:
            return False
        should_delete = _delete(node.children[ch], word, depth + 1)
        if should_delete:
            del node.children[ch]
            return not node.is_end and len(node.children) == 0
        return False

    _delete(self.root, word, 0)
```

삭제는 단어가 다른 단어의 접두사인지 확인하면서 역방향으로 정리합니다.

## 자동완성 구현

```python
def autocomplete(self, prefix):
    node = self._traverse(prefix)
    if node is None:
        return []
    results = []
    self._dfs(node, prefix, results)
    return results

def _dfs(self, node, current, results):
    if node.is_end:
        results.append(current)
    for ch, child in sorted(node.children.items()):
        self._dfs(child, current + ch, results)

# 사용 예
trie = Trie()
for word in ['cat', 'car', 'card', 'care', 'dog']:
    trie.insert(word)

print(trie.autocomplete('car'))  # ['car', 'card', 'care'] — 없으면 car 없음
print(trie.autocomplete('ca'))   # ['car', 'card', 'care', 'cat']
```

## 트라이 vs 해시 테이블

| 항목 | 트라이 | 해시 테이블 |
|---|---|---|
| 단건 검색 | O(m) | O(m) 평균 |
| 접두사 검색 | O(m + k) | O(n × m) |
| 사전순 순회 | O(n × m) | 불가 (별도 정렬) |
| 메모리 | 공유 접두사로 절약 가능 | 전체 문자열 저장 |
| 구현 복잡도 | 높음 | 낮음 |

접두사 검색이 필요 없다면 해시 테이블이 더 단순합니다. 자동완성, 사전 검색, IP 라우팅 테이블처럼 **접두사 기반 연산이 핵심**일 때 트라이를 선택합니다.

## 압축 트라이 (Radix Tree)

단일 자식만 가진 노드 체인을 하나의 에지로 압축합니다.

```
일반 트라이:   r→e→d (3노드)
압축 트라이:   "red" (1에지)
```

Linux 커널의 `radix tree`, nginx 라우팅 테이블이 이 방식을 사용합니다.

## 메모리 최적화 — 배열 기반

알파벳 소문자만 다룰 때 딕셔너리 대신 크기 26 배열을 씁니다.

```python
class TrieNodeArray:
    def __init__(self):
        self.children = [None] * 26
        self.is_end = False

    def get_index(self, ch):
        return ord(ch) - ord('a')
```

메모리: 노드당 26포인터 (딕셔너리 오버헤드 없음). 문자 집합이 크면 딕셔너리가 유리합니다.

---

**지난 글:** [우선순위 큐 (Priority Queue)](/posts/dsa-priority-queue/)

**다음 글:** [세그먼트 트리 (Segment Tree)](/posts/dsa-segment-tree/)

<br>
읽어주셔서 감사합니다. 😊
