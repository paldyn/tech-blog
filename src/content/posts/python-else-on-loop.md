---
title: "루프의 else: break 없이 완주했을 때만 실행되는 블록"
description: "Python for/while else 구문의 정확한 동작 원리, 검색 실패 감지 패턴, 플래그 변수 대체, while else 재시도 패턴, 가독성 트레이드오프를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "for else", "while else", "break", "루프", "중급"]
featured: false
draft: false
---

[지난 글](/posts/python-break-continue/)에서 `break`와 `continue`를 다뤘다. Python에는 다른 언어에 없는 독특한 구문이 있다. 바로 **루프의 `else`** — `for`와 `while` 뒤에 `else` 블록을 붙일 수 있다. 처음 보는 사람 대부분이 "조건문의 else랑 같은 건가?" 하고 오해한다. 전혀 다르다.

## 핵심 규칙 한 줄

> `else` 블록은 **`break` 없이 루프가 완주됐을 때**만 실행된다.

`break`로 탈출하면 `else`는 건너뛴다. `break` 없이 모든 반복을 마치면 `else`가 실행된다.

```python
for i in range(5):
    if i == 3:
        break
else:
    print("완주!")   # break가 있으므로 실행 안 됨

for i in range(5):
    pass
else:
    print("완주!")   # break 없음 → 실행됨 → "완주!"
```

![루프의 else 동작 흐름](/assets/posts/python-else-on-loop-overview.svg)

## 검색 실패 감지 — 가장 흔한 사용처

리스트에서 특정 조건을 찾다가 못 찾은 경우를 처리할 때 유용하다.

**플래그 방식 (전통적)**

```python
found = False
for user in users:
    if user == "Carol":
        print("찾음")
        found = True
        break
if not found:
    print("Carol 없음")
```

**for-else 방식**

```python
for user in users:
    if user == "Carol":
        print("찾음")
        break
else:
    print("Carol 없음")   # break 없이 완주 = 못 찾음
```

`else`를 쓰면 `found` 변수가 필요 없다. "break가 발생하지 않았다"는 의미가 코드 구조에 직접 표현된다.

## 소수 판별 — 교과서적 예제

```python
def is_prime(n):
    if n < 2:
        return False
    for i in range(2, n):
        if n % i == 0:
            return False   # 약수 발견 → 소수 아님
    else:
        return True        # 약수 없이 완주 → 소수

print(is_prime(7))   # True
print(is_prime(6))   # False
```

`range(2, n)`을 `break` 없이 완주하면 약수가 없다는 뜻이므로 `else`에서 `True`를 반환한다.

## while-else

`while` 루프에도 `else`를 붙일 수 있다. 조건이 `False`가 되어 자연 종료됐을 때 실행된다.

```python
attempts = 0
while attempts < 3:
    attempts += 1
    if connect():
        print("연결 성공")
        break
else:
    print("3회 시도 모두 실패")   # break 없이 조건 소진
```

재시도 로직에서 "모두 실패했을 때"를 처리하는 데 깔끔하게 쓸 수 있다.

![루프 else 활용 패턴](/assets/posts/python-else-on-loop-patterns.svg)

## 주의: 가독성 트레이드오프

루프의 `else`는 Python 특유의 문법이라 처음 접하는 팀원에게 낯설 수 있다. 의도가 명확하지 않은 컨텍스트에서는 주석을 달거나 플래그 방식을 택하는 것도 합리적 선택이다.

```python
for item in collection:
    if condition(item):
        handle(item)
        break
else:
    # break 없이 완주 = condition을 만족하는 item 없음
    handle_not_found()
```

## 중첩 루프에서 주의점

`else`는 **직접 감싸는 루프**에만 적용된다.

```python
for i in range(3):
    for j in range(3):
        if j == 1:
            break
    # 안쪽 루프 else라면 여기
else:
    # 바깥쪽 for가 break 없이 완주했으므로 실행됨!
    print("바깥 루프 완주")
```

안쪽 루프의 `break`는 바깥 루프의 `else`에 영향을 주지 않는다.

## 정리

- `for/while else` — `break` 없이 루프 완주 시에만 실행 ("no-break 절")
- `break`로 탈출하면 `else` 건너뜀
- 검색 실패 감지, 소수 판별, 재시도 실패 처리에 유용
- 플래그 변수를 줄이고 의도를 코드 구조로 표현 가능
- 낯선 팀원을 위해 주석 추가 권장

---

**지난 글:** [break와 continue: 루프 흐름 세밀하게 제어하기](/posts/python-break-continue/)

**다음 글:** [match 문: Python 3.10 구조적 패턴 매칭](/posts/python-match-statement/)

<br>
읽어주셔서 감사합니다. 😊
