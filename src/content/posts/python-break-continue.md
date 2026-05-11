---
title: "break와 continue: 루프 흐름 세밀하게 제어하기"
description: "Python break와 continue의 동작 차이, 중첩 루프 탈출 전략(플래그·함수·예외), continue vs 컴프리헨션 비교, 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "break", "continue", "루프", "제어흐름", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-while-loop/)에서 `while` 루프의 기본 흐름을 살펴봤다. 루프 안에서 반복을 중단하거나 특정 회차를 건너뛰어야 할 때 `break`와 `continue`를 사용한다. 두 키워드는 이름이 비슷하지만 동작이 완전히 다르다.

## break — 루프 완전 탈출

`break`를 만나면 **현재 루프 전체**를 즉시 종료하고 루프 바깥 다음 코드로 이동한다.

```python
for n in range(10):
    if n == 5:
        break
    print(n)
# 0 1 2 3 4
```

`n == 5`가 되는 순간 `for` 루프가 종료된다. 5 이후 6, 7, 8, 9는 출력되지 않는다.

`while` 루프에서도 동일하다.

```python
total = 0
i = 0
while True:
    total += i
    i += 1
    if total > 100:
        break
print(f"합계 {total}, 마지막 i={i}")
```

![break vs continue 동작 비교](/assets/posts/python-break-continue-overview.svg)

## continue — 현재 회차만 건너뜀

`continue`를 만나면 **현재 반복의 나머지 코드**를 건너뛰고 다음 반복으로 즉시 이동한다. 루프 자체는 계속된다.

```python
for n in range(6):
    if n % 2 == 0:
        continue      # 짝수는 건너뜀
    print(n)
# 1 3 5
```

`n=0, 2, 4`일 때는 `continue`로 `print(n)` 을 건너뛰고 다음 값으로 넘어간다.

## 중첩 루프에서 break

`break`는 **가장 안쪽 루프만 탈출**한다. 바깥 루프는 계속 실행된다.

```python
for i in range(3):
    for j in range(3):
        if j == 1:
            break     # 안쪽 for만 탈출
        print(i, j)
# 0 0
# 1 0
# 2 0
```

`j == 1`이 되면 안쪽 루프를 탈출하지만 바깥 `for i` 루프는 계속 돌아 `i=1, 2` 도 실행된다.

### 중첩 루프 전체 탈출 전략

**방법 1: 플래그 변수**

```python
found = False
for row in matrix:
    for cell in row:
        if cell == target:
            found = True
            break
    if found:
        break
```

**방법 2: 함수 + return (가장 권장)**

```python
def find_in_matrix(matrix, target):
    for row in matrix:
        for cell in row:
            if cell == target:
                return True
    return False
```

함수로 감싸면 `return`으로 어느 깊이에서든 즉시 탈출할 수 있어 가장 깔끔하다.

## continue vs 리스트 컴프리헨션

단순 필터링이라면 `continue` 대신 컴프리헨션이 더 Pythonic하다.

```python
lines = ["# 주석", "코드1", "# 주석2", "코드2"]

# continue 방식
result = []
for line in lines:
    if line.startswith("#"):
        continue
    result.append(line)

# 컴프리헨션 방식 (권장)
result = [l for l in lines if not l.startswith("#")]
```

단, 필터링 후 복잡한 처리가 있거나 부수 효과(파일 쓰기 등)가 필요하다면 `continue` 방식이 적합하다.

![break / continue 실전 패턴](/assets/posts/python-break-continue-patterns.svg)

## 자주 하는 실수

```python
# 실수: continue 뒤 코드가 절대 실행 안 됨
for n in range(5):
    continue
    print(n)   # 절대 실행되지 않음

# 실수: 무한 루프 안에서 break 조건 누락
i = 0
while True:
    i += 1
    if i > 100:
        pass   # break를 pass로 실수 → 무한 루프
```

## 정리

- `break` — 루프 **전체** 즉시 종료, 가장 안쪽 루프만 영향
- `continue` — 현재 **회차만** 건너뜀, 루프는 계속
- 중첩 루프 전체 탈출엔 함수 + `return`이 가장 깔끔
- 단순 필터는 `continue` 보다 리스트 컴프리헨션이 Pythonic

---

**지난 글:** [while 루프: 조건 기반 반복과 무한 루프 제어](/posts/python-while-loop/)

**다음 글:** [루프의 else: break 없이 완주했을 때만 실행되는 블록](/posts/python-else-on-loop/)

<br>
읽어주셔서 감사합니다. 😊
