---
title: "아호-코라식 알고리즘: 다중 패턴 동시 탐색"
description: "아호-코라식(Aho-Corasick) 알고리즘의 트라이 구성, 실패 링크(Failure Link)·사전 링크(Dictionary Link) BFS 구축, O(n + 총 매칭)으로 k개 패턴 동시 탐색, 바이러스 스캐너·형태소 분석기 응용까지 완전히 분석합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 10
type: "knowledge"
category: "Algorithm"
tags: ["아호-코라식", "트라이", "실패링크", "다중패턴", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-boyer-moore/)에서 단일 패턴을 빠르게 찾는 Boyer-Moore를 다뤘다면, 아호-코라식은 **수천 개의 패턴을 동시에** 텍스트에서 탐색합니다. 동시 탐색이 필요한 바이러스 스캐너, 형태소 분석기, 네트워크 침입 탐지 시스템의 핵심 알고리즘입니다.

## 아이디어: 트라이 + KMP 실패 함수

k개 패턴 각각에 KMP를 적용하면 O(k·n)이 필요합니다. 아호-코라식은:

1. 패턴들을 **트라이(Trie)**로 합쳐 구축
2. KMP의 실패 함수를 트라이 전체에 확장한 **실패 링크(Failure Link)** 구축
3. 텍스트를 **한 번** 스캔하며 모든 패턴 동시 탐색 → O(n + 총 매칭)

![아호-코라식 트라이 구조](/assets/posts/dsa-aho-corasick-trie.svg)

## 트라이 노드 구현

```python
from collections import deque

class AhoCorasickNode:
    def __init__(self):
        self.goto = {}      # 자식 노드
        self.fail = None    # 실패 링크
        self.output = []    # 이 노드에서 끝나는 패턴들
        self.dict_link = None  # 사전 링크 (출력 체인 단축)
```

## 트라이 구성 및 실패 링크 구축

```python
class AhoCorasick:
    def __init__(self):
        self.root = AhoCorasickNode()
        self.root.fail = self.root

    def add_pattern(self, pattern: str, pid: int):
        cur = self.root
        for c in pattern:
            if c not in cur.goto:
                cur.goto[c] = AhoCorasickNode()
            cur = cur.goto[c]
        cur.output.append(pid)

    def build(self):
        """BFS로 실패 링크와 사전 링크 구축"""
        queue = deque()

        # 루트의 자식: 실패 링크 = 루트
        for child in self.root.goto.values():
            child.fail = self.root
            queue.append(child)

        while queue:
            node = queue.popleft()
            for c, child in node.goto.items():
                # 실패 링크: 현재 노드 fail에서 c로 가는 경로
                fail = node.fail
                while fail is not self.root and c not in fail.goto:
                    fail = fail.fail
                child.fail = fail.goto.get(c, self.root)
                if child.fail is child:
                    child.fail = self.root

                # 사전 링크: 실패 링크 체인에서 출력 있는 첫 노드
                if child.fail.output:
                    child.dict_link = child.fail
                else:
                    child.dict_link = child.fail.dict_link

                queue.append(child)
```

## 탐색

```python
    def search(self, text: str) -> list:
        """모든 매칭 (패턴 id, 종료 위치) 반환"""
        results = []
        cur = self.root

        for i, c in enumerate(text):
            # 실패 링크 타기: c로 이동 불가면 fail로
            while cur is not self.root and c not in cur.goto:
                cur = cur.fail
            cur = cur.goto.get(c, self.root)

            # 현재 노드에서 출력 수집
            temp = cur
            while temp is not None:
                for pid in temp.output:
                    results.append((pid, i))
                temp = temp.dict_link

        return results
```

![아호-코라식 탐색](/assets/posts/dsa-aho-corasick-search.svg)

## 완전한 사용 예시

```python
ac = AhoCorasick()
patterns = ["he", "she", "his", "hers"]
for i, p in enumerate(patterns):
    ac.add_pattern(p, i)
ac.build()

text = "ushers"
results = ac.search(text)
for pid, end in results:
    p = patterns[pid]
    start = end - len(p) + 1
    print(f'패턴 "{p}" 발견: 위치 {start}~{end}')

# 패턴 "she" 발견: 위치 1~3
# 패턴 "he" 발견: 위치 2~3
# 패턴 "hers" 발견: 위치 2~5
```

## goto 함수 최적화: 완전 자동화

재귀적 goto 함수(Transition Function)를 사전에 모두 계산해두면 탐색 시 while 루프가 필요 없습니다.

```python
def build_goto(self):
    """BFS로 goto 함수 완전 구축 (실패 링크 재귀 사전 제거)"""
    queue = deque()
    for c in set(self._all_chars):
        if c not in self.root.goto:
            self.root.goto[c] = self.root  # 루트에서 없는 문자 → 루트 자신
        else:
            queue.append(self.root.goto[c])

    while queue:
        node = queue.popleft()
        for c in self._all_chars:
            if c not in node.goto:
                node.goto[c] = node.fail.goto[c]  # 실패 링크의 goto 재사용
            else:
                queue.append(node.goto[c])
```

이제 탐색 루프는 단순히 `cur = cur.goto[c]`만 하면 됩니다.

## 복잡도 분석

| 단계 | 시간 | 공간 |
|------|------|------|
| 트라이 구축 | O(총 패턴 길이 합 Σm) | O(Σm · |σ|) |
| 실패 링크 구축 | O(Σm) | O(Σm) |
| 탐색 | O(n + 총 매칭 수) | O(1) 추가 |

k개 패턴 각각 KMP를 적용하면 O(k·n)이지만, 아호-코라식은 **O(n + 총 출력)**으로 패턴 수에 독립적입니다.

## 응용 분야

| 분야 | 적용 |
|------|------|
| 바이러스 스캐너 | 수만 개 서명을 동시에 스캔 |
| 형태소 분석기 | 사전 패턴 동시 매칭 |
| 침입 탐지(SNORT) | 패킷에서 악성 시그니처 탐지 |
| 텍스트 필터링 | 금지어 동시 탐지 |
| DNA 서열 분석 | 다중 모티프 동시 탐색 |

## 실패 링크 vs KMP 실패 함수

| 항목 | KMP 실패 함수 | 아호-코라식 실패 링크 |
|------|--------------|----------------------|
| 구조 | 1D 배열 | 트라이 노드 포인터 |
| 대상 | 단일 패턴 | 다중 패턴 |
| 의미 | 접두사=접미사 최대 길이 | 현재 경로의 최대 접미사가 일치하는 트라이 노드 |
| 구축 | O(m) | O(Σm) BFS |

아호-코라식은 트라이를 KMP 오토마톤으로 변환하는 것과 같습니다.

---

**지난 글:** [보이어-무어 알고리즘: 실용적인 고속 문자열 검색](/posts/dsa-boyer-moore/)

**다음 글:** [접미사 배열(Suffix Array): 문자열의 모든 접미사 정렬하기](/posts/dsa-suffix-array/)

<br>
읽어주셔서 감사합니다. 😊
