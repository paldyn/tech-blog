---
title: "키워드 전용 인수: * 이후 매개변수 강제하기"
description: "Python의 * 구분자를 사용해 특정 매개변수를 반드시 이름으로만 전달하도록 강제하는 방법과, API 안전성을 높이는 실용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "함수", "키워드 전용 인수", "* 구분자", "API 설계"]
featured: false
draft: false
---

[지난 글](/posts/python-args-kwargs/)에서 `*args`와 `**kwargs`로 가변 인수를 받는 방법을 알아봤다. 이번에는 특정 인수를 반드시 이름으로만 전달하도록 강제하는 **키워드 전용 인수(keyword-only arguments)**를 살펴본다.

## 왜 필요한가

인수가 많고 특히 `bool` 플래그가 여럿일 때, 위치로만 호출하면 코드가 의미를 잃는다.

```python
# 이 호출이 무슨 뜻인가?
copy_file("a.txt", "b.txt", True, False, True)
```

세 개의 `True/False` 중 어느 플래그가 어느 의미인지 함수 선언을 보지 않으면 알 수 없다.

## * 구분자 문법

매개변수 목록에 단독 `*`를 넣으면 그 뒤에 오는 모든 매개변수는 **반드시 키워드로 전달**해야 한다.

```python
def copy_file(src, dst, *, overwrite=False, preserve_meta=True):
    ...
```

`*` 이전의 `src`, `dst`는 위치로도 키워드로도 전달할 수 있지만, `*` 이후의 `overwrite`, `preserve_meta`는 반드시 이름을 써야 한다.

```python
copy_file("a.txt", "b.txt", overwrite=True)   # OK
copy_file("a.txt", "b.txt", True)             # TypeError!
```

![키워드 전용 인수: * 구분자](/assets/posts/python-keyword-only-args-syntax.svg)

## 기본값 없는 키워드 전용 인수

기본값 없이 선언하면 호출 시 해당 인수를 반드시 키워드로 제공해야 한다. 사실상 필수 키워드 인수가 된다.

```python
def create_user(*, name, email):
    print(f"{name} <{email}>")

create_user(name="철수", email="cs@example.com")   # OK
create_user("철수", "cs@example.com")              # TypeError
```

이 패턴은 인수 이름이 인터페이스의 일부가 된다는 것을 명시적으로 드러낸다.

![키워드 전용 인수 실용 예제](/assets/posts/python-keyword-only-args-code.svg)

## *args 뒤에 오는 키워드 전용 인수

`*args` 뒤에 오는 매개변수도 자동으로 키워드 전용이 된다.

```python
def process(*items, separator=", ", limit=None):
    subset = items[:limit] if limit else items
    return separator.join(str(x) for x in subset)

print(process(1, 2, 3, 4))                # 1, 2, 3, 4
print(process(1, 2, 3, separator=" | "))  # 1 | 2 | 3
print(process(1, 2, 3, 4, limit=2))       # 1, 2
```

`*items`가 위치 인수를 소비하므로, 그 뒤의 `separator`와 `limit`는 반드시 이름으로 전달해야 한다.

## API 설계 관점

라이브러리 함수를 만들 때 키워드 전용 인수를 적극 활용한다.

```python
def read_csv(path, *, encoding="utf-8",
             delimiter=",", skip_header=False):
    ...
```

이렇게 하면:
- 호출자가 어떤 옵션을 켰는지 코드에서 바로 파악된다
- 나중에 매개변수 순서를 바꿔도 하위 호환성이 유지된다
- `read_csv("data.csv", True)` 같은 실수를 컴파일 타임에 잡는다

## 정리

`*` 구분자는 Python 3.0에서 도입됐다. 특히 인수가 많거나 불리언 플래그가 여럿인 함수에서 명시성을 강제해 버그를 예방한다.

---

**지난 글:** [*args와 **kwargs: 가변 인수 완전 정리](/posts/python-args-kwargs/)

**다음 글:** [위치 전용 인수: / 슬래시로 인터페이스 강화하기](/posts/python-positional-only-args/)

<br>
읽어주셔서 감사합니다. 😊
