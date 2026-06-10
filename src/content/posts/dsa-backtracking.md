---
title: "백트래킹: 상태 공간 탐색과 가지치기"
description: "백트래킹의 핵심 개념인 상태 공간 트리, 가지치기(Pruning), 그리고 N-Queens·순열·부분 집합 합 문제를 Python으로 완전 구현합니다. 재귀 템플릿과 최적화 기법까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 2
type: "knowledge"
category: "Algorithm"
tags: ["백트래킹", "가지치기", "N-Queens", "순열", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-edit-distance/)에서 DP로 최적해를 구하는 법을 다뤘다면, 백트래킹은 제약 조건을 만족하는 **모든 해** 또는 **하나의 해**를 체계적으로 탐색하는 기법입니다. 브루트 포스와의 결정적 차이는 바로 **가지치기(Pruning)** — 불가능한 경로를 조기에 포기해 탐색 공간을 극적으로 줄입니다.

## 백트래킹이란

백트래킹은 **선택 → 제약 확인 → 실패 시 되돌림** 사이클을 반복하는 완전 탐색 전략입니다.

```
선택 가능한 옵션 반복:
  1. 옵션 선택 (상태 변경)
  2. 제약 조건 확인
     - 위반 → 즉시 백트랙 (가지치기)
     - 통과 → 다음 단계 재귀
  3. 선택 취소 (상태 복원)
```

상태 공간을 트리로 표현했을 때, 유효하지 않은 서브트리를 통째로 건너뛰는 것이 핵심입니다.

![백트래킹 탐색 트리](/assets/posts/dsa-backtracking-tree.svg)

## 백트래킹 템플릿

```python
def backtrack(state, choices):
    # 기저 조건: 해 발견
    if is_solution(state):
        record(state)
        return

    for choice in choices:
        # 가지치기: 유효하지 않은 선택 스킵
        if not is_valid(state, choice):
            continue

        # 선택
        apply(state, choice)

        # 재귀
        backtrack(state, remaining_choices(choices, choice))

        # 취소 (백트랙)
        undo(state, choice)
```

이 구조는 거의 모든 백트래킹 문제에 그대로 적용됩니다.

## N-Queens 문제

n×n 체스판에 n개의 퀸을 서로 공격하지 않도록 배치하는 문제.

```python
def solve_nqueens(n: int):
    result = []
    cols = [-1] * n           # cols[row] = 배치된 열
    col_used = [False] * n
    diag1 = [False] * (2 * n) # row - col + n
    diag2 = [False] * (2 * n) # row + col

    def backtrack(row: int):
        if row == n:
            result.append(cols[:])
            return
        for col in range(n):
            d1 = row - col + n
            d2 = row + col
            # 가지치기: 같은 열 또는 대각선
            if col_used[col] or diag1[d1] or diag2[d2]:
                continue
            # 배치
            cols[row] = col
            col_used[col] = diag1[d1] = diag2[d2] = True
            backtrack(row + 1)
            # 취소
            col_used[col] = diag1[d1] = diag2[d2] = False

    backtrack(0)
    return result

solutions = solve_nqueens(4)
print(len(solutions))  # 2
print(solutions[0])    # [1, 3, 0, 2]
```

![N-Queens 백트래킹](/assets/posts/dsa-backtracking-nqueens.svg)

## 순열 생성

```python
def permutations(nums: list) -> list:
    result = []
    used = [False] * len(nums)
    path = []

    def backtrack():
        if len(path) == len(nums):
            result.append(path[:])
            return
        for i, num in enumerate(nums):
            if used[i]:
                continue
            used[i] = True
            path.append(num)
            backtrack()
            path.pop()
            used[i] = False

    backtrack()
    return result

print(permutations([1, 2, 3]))
# [[1,2,3], [1,3,2], [2,1,3], ...]  총 6가지
```

중복 원소가 있을 때는 정렬 후 `if i > 0 and nums[i] == nums[i-1] and not used[i-1]: continue` 조건으로 중복 건너뛰기.

## 부분 집합 합 (Subset Sum)

```python
def subset_sum(nums: list, target: int) -> list:
    result = []
    nums.sort()  # 정렬로 가지치기 효율 향상

    def backtrack(start: int, path: list, remaining: int):
        if remaining == 0:
            result.append(path[:])
            return
        for i in range(start, len(nums)):
            # 가지치기: 현재 값이 남은 합보다 크면 이후도 무의미
            if nums[i] > remaining:
                break
            path.append(nums[i])
            backtrack(i + 1, path, remaining - nums[i])
            path.pop()

    backtrack(0, [], target)
    return result

print(subset_sum([2, 3, 6, 7], 7))
# [[7], [3, 4]] → [[7]]  (정확한 조합)
```

`nums.sort()` + `if nums[i] > remaining: break` 두 줄이 가지치기의 핵심입니다. 정렬된 배열에서 남은 합보다 큰 원소는 이후 원소도 모두 불필요하기 때문입니다.

## 스도쿠 풀이

9×9 스도쿠는 백트래킹의 대표 응용 사례입니다.

```python
def solve_sudoku(board: list) -> bool:
    empty = find_empty(board)
    if not empty:
        return True  # 모든 칸 채움 — 해 발견

    row, col = empty
    for num in range(1, 10):
        if is_valid_sudoku(board, row, col, num):
            board[row][col] = num
            if solve_sudoku(board):
                return True
            board[row][col] = 0  # 백트랙

    return False  # 현재 경로로는 해 없음
```

## 가지치기 전략

### 1. 앞향 검사 (Forward Checking)

선택할 때마다 남은 변수들의 가능한 값 도메인을 갱신. 도메인이 비면 즉시 백트랙.

### 2. 제약 전파 (Constraint Propagation)

하나의 선택이 연쇄적으로 다른 변수의 도메인을 줄이도록 반영. Arc Consistency(AC-3 알고리즘)가 대표적.

### 3. 발생 순서 휴리스틱 (Variable Ordering)

가능한 값이 가장 적은 변수를 먼저 처리(MRV — Minimum Remaining Values). 조기에 실패를 발견해 전체 탐색을 줄입니다.

```python
def select_unassigned(variables, domains):
    # MRV 휴리스틱: 가장 도메인이 작은 변수 선택
    return min(
        (v for v in variables if not is_assigned(v)),
        key=lambda v: len(domains[v])
    )
```

## 복잡도 분석

| 문제 | 최악 시간 | 가지치기 효과 |
|------|-----------|--------------|
| 순열(n) | O(n!) | 중복 제거 시 ~n배 감소 |
| N-Queens | O(n!) | 실제 ~n^(n/2) |
| 스도쿠(9×9) | O(9^81) | 제약 전파로 수백만 배 감소 |
| 부분 집합 합 | O(2^n) | 정렬+가지치기로 ~절반 |

백트래킹의 성능은 **가지치기 품질**에 달려 있습니다. 제약이 강할수록 탐색 트리가 작아지고 실행 시간이 극적으로 줄어듭니다.

## 백트래킹 vs 다른 기법

| 기법 | 사용 시점 |
|------|-----------|
| 백트래킹 | 제약 조건 있는 조합 탐색 |
| 동적 프로그래밍 | 최적 부분 구조 + 중복 부분 문제 |
| 그리디 | 지역 최적이 전역 최적 보장 시 |
| BFS/DFS | 최단 경로 / 연결성 탐색 |

---

**지난 글:** [편집 거리 (Edit Distance): 레벤슈타인 알고리즘 완전 분석](/posts/dsa-edit-distance/)

**다음 글:** [비트 조작 (Bit Manipulation): 비트 연산과 마스킹 완전 정복](/posts/dsa-bit-manipulation/)

<br>
읽어주셔서 감사합니다. 😊
