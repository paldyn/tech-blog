---
title: "Java 다차원 배열 완전 정복 — 2D 배열부터 가변 배열까지"
description: "Java 2차원 배열의 힙 구조, 가변 배열(Jagged Array), 행렬 전치·회전, Arrays.deepToString, 캐시 효율까지 다차원 배열의 모든 것을 실전 코드와 함께 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "배열", "2차원 배열", "다차원 배열", "Jagged Array", "행렬"]
featured: false
draft: false
---

[지난 글](/posts/java-arrays-basics/)에서 1차원 배열의 선언·생성·복사·정렬을 살펴봤다. 이번에는 **다차원 배열**, 특히 2차원 배열의 내부 구조와 실전 패턴을 깊이 파고든다. Java의 다차원 배열은 C/C++과 달리 "배열의 배열"이라는 독특한 구조를 가져서, 이 차이를 모르면 디버깅할 때 당황하기 쉽다.

## Java 2차원 배열은 "배열의 배열"

Java에는 진정한 의미의 2차원 배열이 없다. `int[][] mat`는 정확히는 **int 배열을 가리키는 참조들의 배열**이다. 외부 배열은 각 행 배열의 참조를 담고, 각 행 배열은 힙에서 독립된 객체로 존재한다.

![2차원 배열 메모리 구조](/assets/posts/java-multi-dimensional-array-structure.svg)

이 구조가 주는 핵심 특성은 두 가지다.

1. **행마다 독립 힙 객체** → 행의 길이를 서로 다르게 만들 수 있다(가변 배열)
2. **연속 메모리 보장 없음** → 대용량 행렬에서 캐시 효율이 낮을 수 있다

## 선언과 초기화

```java
// 1) 고정 크기 할당
int[][] mat = new int[3][4]; // 3행 4열, 모두 0

// 2) 리터럴 초기화
int[][] grid = {
    {1, 2, 3},
    {4, 5, 6},
    {7, 8, 9}
};

// 3) 외부 크기만 먼저 지정 (행별로 나중에 할당)
int[][] jagged = new int[3][];
jagged[0] = new int[1];
jagged[1] = new int[3];
jagged[2] = new int[2];
```

`new int[3][4]`는 내부적으로 외부 배열 1개 + 행 배열 3개, 총 4개의 힙 객체를 생성한다.

## 행과 열 접근

```java
int[][] mat = {{1,2,3},{4,5,6},{7,8,9}};

int rows = mat.length;       // 3 — 행 수
int cols = mat[0].length;    // 3 — 첫 행의 열 수

// 특정 원소 접근
int val = mat[1][2]; // 6 (1행 2열)

// 행 전체를 배열로 꺼내기
int[] row1 = mat[1]; // {4, 5, 6}
```

가변 배열에서는 `mat[i].length`가 행마다 다를 수 있으므로 `mat[0].length`를 열 수로 일반화하면 안 된다.

## 이중 for 순회

```java
int[][] mat = {{1,2,3},{4,5,6},{7,8,9}};

// 인덱스가 필요한 경우
for (int i = 0; i < mat.length; i++) {
    for (int j = 0; j < mat[i].length; j++) {
        System.out.printf("%3d", mat[i][j]);
    }
    System.out.println();
}

// 인덱스가 불필요한 경우
for (int[] row : mat) {
    for (int v : row) {
        System.out.print(v + " ");
    }
    System.out.println();
}
```

`mat[i].length`를 사용하면 가변 배열도 안전하게 순회할 수 있다.

## 행렬 전치와 회전

행렬 전치(transpose)는 `mat[i][j]`와 `mat[j][i]`를 교환하는 연산이다.

```java
static int[][] transpose(int[][] m) {
    int rows = m.length, cols = m[0].length;
    int[][] t = new int[cols][rows];
    for (int i = 0; i < rows; i++)
        for (int j = 0; j < cols; j++)
            t[j][i] = m[i][j];
    return t;
}

// 90도 시계 방향 회전 (n×n 정방 행렬)
static void rotate90(int[][] m) {
    int n = m.length;
    // 전치
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++) {
            int tmp = m[i][j];
            m[i][j] = m[j][i];
            m[j][i] = tmp;
        }
    // 행 뒤집기
    for (int[] row : m) {
        int lo = 0, hi = n - 1;
        while (lo < hi) { int t = row[lo]; row[lo++] = row[hi]; row[hi--] = t; }
    }
}
```

## 디버깅: deepToString과 deepEquals

```java
int[][] mat = {{1,2,3},{4,5,6}};

// 잘못된 방법 — 참조 주소 출력
System.out.println(mat);            // [[I@6d06d69c

// 올바른 방법
System.out.println(Arrays.deepToString(mat)); // [[1, 2, 3], [4, 5, 6]]

// 내용 비교
int[][] copy = {{1,2,3},{4,5,6}};
System.out.println(Arrays.equals(mat, copy));     // false (외부 배열만 비교)
System.out.println(Arrays.deepEquals(mat, copy)); // true  (전체 내용 비교)
```

![다차원 배열 활용 패턴](/assets/posts/java-multi-dimensional-array-patterns.svg)

## 캐시 효율: 행 우선 vs 열 우선

Java 2차원 배열은 같은 행의 원소가 연속 메모리에 위치하므로 **행 우선(row-major) 순회**가 효율적이다.

```java
int[][] mat = new int[1000][1000];

// 빠른 순회 (행 우선) — 같은 행은 캐시에 올라온 상태
for (int i = 0; i < 1000; i++)
    for (int j = 0; j < 1000; j++)
        mat[i][j]++;

// 느린 순회 (열 우선) — 매번 다른 행 배열로 캐시 미스
for (int j = 0; j < 1000; j++)
    for (int i = 0; i < 1000; i++)
        mat[i][j]++;
```

대용량 행렬 연산이 필요한 경우 1차원 배열로 선형화하면 연속 메모리가 보장된다.

```java
// 1D 배열로 n×m 행렬 시뮬레이션
int[] flat = new int[rows * cols];
// (i, j) 접근
flat[i * cols + j] = value;
```

## 3차원 이상

```java
int[][][] cube = new int[2][3][4]; // 2 × 3 × 4 큐브

// 접근
cube[0][1][2] = 42;

// 순회
for (int[][] plane : cube)
    for (int[] row : plane)
        for (int v : row)
            System.out.print(v + " ");
```

4차원 이상이 필요하면 차원이 늘어날수록 코드 가독성이 급격히 떨어지므로, 객체 모델링이나 `List<List<...>>`으로 대체하는 편이 좋다.

## 가변 배열(Jagged Array) 실전 사례

삼각형 숫자 테이블이나 파스칼의 삼각형처럼 행마다 열 수가 다를 때 가변 배열이 메모리를 절약한다.

```java
// 파스칼의 삼각형 (5행)
int[][] pascal = new int[5][];
for (int i = 0; i < 5; i++) {
    pascal[i] = new int[i + 1];
    pascal[i][0] = pascal[i][i] = 1;
    for (int j = 1; j < i; j++)
        pascal[i][j] = pascal[i-1][j-1] + pascal[i-1][j];
}
System.out.println(Arrays.deepToString(pascal));
// [[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]]
```

## 정리

Java 2차원 배열의 핵심은 "배열의 배열"이라는 구조다. 행마다 독립된 힙 객체라서 가변 배열이 가능하고, 디버깅 시 반드시 `Arrays.deepToString`을 쓰며, 성능이 중요한 순회에서는 행 우선 접근을 유지한다. 대용량 데이터라면 1D 배열 선형화를 고려하자.

---

**지난 글:** [Java 배열 완전 정복 — 선언부터 Arrays 유틸리티까지](/posts/java-arrays-basics/)

**다음 글:** [Java String 완전 정복 — 불변 객체와 String Pool](/posts/java-string-essentials/)

<br>
읽어주셔서 감사합니다. 😊
