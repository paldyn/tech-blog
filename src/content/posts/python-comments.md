---
title: "주석 완전 정복: 좋은 주석과 나쁜 주석"
description: "Python 주석의 종류(#, docstring)와 작성 원칙을 설명합니다. WHY를 설명하는 좋은 주석과 코드를 반복하는 나쁜 주석의 차이를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "주석", "docstring", "코드품질", "가독성"]
featured: false
draft: false
---

[지난 글](/posts/python-hello-world/)에서 첫 프로그램을 작성하고 실행했다. 코드를 쓰다 보면 곧 "이 코드가 왜 이렇게 되어 있지?"라는 의문이 생긴다. 6개월 후의 내가 또는 팀 동료가 코드를 이해하기 위해서는 주석이 필요하다. 그러나 주석을 많이 달면 좋은 것이 아니다. 잘못 쓴 주석은 코드를 더 이해하기 어렵게 만든다. 이번 편에서는 Python 주석의 종류와 올바른 작성법을 다룬다.

## Python 주석의 세 가지 종류

![Python 주석 종류](/assets/posts/python-comments-types.svg)

### 1. 인라인 주석 (`#`)

코드 줄 끝에 `#`으로 시작하는 짧은 설명.

```python
RETRY_COUNT = 3        # 최대 재시도 횟수
TIMEOUT = 30           # 초 단위 타임아웃

total = price * 1.1    # 부가세 10% 포함
x += 1                 # 페이지 번호 증가
```

인라인 주석은 코드와 최소 2칸 공백을 두고, `#` 뒤에 스페이스 1칸을 둔다. 가능하면 짧게 유지한다.

### 2. 블록 주석 (`#`)

코드 블록 위에 위치하는 설명 주석. 들여쓰기를 코드와 맞춘다.

```python
def process_payment(amount, card_info):
    # 결제 금액 유효성 검사
    # 카드사 API 제한: 최대 1,000,000원
    if amount > 1_000_000:
        raise ValueError("한도 초과")

    # PCI-DSS 규정: 카드번호 마스킹 필수
    masked = card_info.mask()
    log.info(f"결제 시도: {amount}원, 카드: {masked}")
```

블록 주석은 `#` 뒤에 반드시 스페이스를 둔다 (`#주석` 대신 `# 주석`). 전체 블록의 맥락을 설명할 때 사용한다.

### 3. 독스트링 (Docstring, `"""..."""`)

함수, 클래스, 모듈에 붙이는 공식 문서 문자열. `"""` 또는 `'''`으로 감싼다.

```python
def calculate_tax(price, rate=0.1):
    """가격에 세율을 적용한 세금 포함 금액을 반환한다.

    Args:
        price (float): 세전 가격
        rate (float): 세율 (기본값: 0.1 = 10%)

    Returns:
        float: 세금 포함 금액

    Raises:
        ValueError: price가 음수인 경우
        TypeError: price가 숫자가 아닌 경우

    Examples:
        >>> calculate_tax(1000)
        1100.0
        >>> calculate_tax(1000, 0.05)
        1050.0
    """
    if price < 0:
        raise ValueError(f"가격은 양수여야 합니다: {price}")
    return price * (1 + rate)
```

독스트링은 `help()` 함수와 IDE 자동완성에 활용된다.

```python
help(calculate_tax)
# → 독스트링 내용 출력

calculate_tax.__doc__  # 독스트링에 접근
```

한 줄 독스트링도 가능하다.

```python
def double(x):
    """주어진 숫자를 2배로 만들어 반환한다."""
    return x * 2
```

## 좋은 주석 vs 나쁜 주석

![좋은 주석과 나쁜 주석](/assets/posts/python-comments-good-vs-bad.svg)

가장 중요한 원칙: **코드가 말하는 것을 반복하지 마라. WHY를 설명하라.**

### 나쁜 주석: WHAT을 설명

```python
# i를 1 증가시킨다
i += 1

# 리스트를 정렬한다
items.sort()

# x가 10보다 크면 True를 반환한다
if x > 10:
    return True
```

이런 주석은 코드를 읽으면 이미 알 수 있는 내용이다. 오히려 코드와 주석을 동시에 읽어야 해서 인지 부하가 늘어난다. 코드가 바뀌면 주석도 업데이트해야 하는 부담도 생긴다.

### 좋은 주석: WHY를 설명

```python
# Fisher-Yates 셔플: O(n)이고 편향이 없다
# sorted(random.random() for ...) 방식은 O(n log n)이라 비효율적
random.shuffle(items)

# 카드사 API 제한: 요청 간격 100ms 이상 필요
# (문서: https://api.card.example.com/docs#rate-limit)
time.sleep(0.1)

# 음수 인덱스 사용: Python의 -1은 마지막 원소를 가리킴
# 새 요소는 항상 끝에 추가되므로 마지막을 가져오면 된다
latest = items[-1]
```

이런 주석은 코드를 읽어서는 알 수 없는 정보를 담는다. 왜 이 알고리즘을 선택했는지, 외부 제약이 무엇인지, 언뜻 이상해 보이는 코드의 이유가 무엇인지.

## 주석을 쓰지 않아도 되는 코드

좋은 코드는 그 자체로 읽힌다. 변수명과 함수명을 잘 지으면 주석 없이도 의도를 전달할 수 있다.

```python
# 주석 필요한 나쁜 코드
# 나이가 18 이상이고 회원 여부가 참이면 주문 가능
if a >= 18 and b:
    c = True

# 주석 불필요한 좋은 코드
MIN_AGE = 18

def can_order(age, is_member):
    return age >= MIN_AGE and is_member
```

두 번째 코드는 변수명만으로 의도가 명확하다. `a`, `b`, `c` 같은 의미 없는 이름 대신 의미 있는 이름을 사용하면 주석이 필요 없다.

## 독스트링 형식: Google vs NumPy vs reStructuredText

독스트링의 형식은 프로젝트에 따라 달라진다. 가장 많이 사용되는 세 가지 형식.

```python
# Google 스타일 (가장 가독성 좋음, 권장)
def connect(host, port, timeout=30):
    """데이터베이스에 연결한다.

    Args:
        host: 서버 호스트명
        port: 포트 번호
        timeout: 연결 타임아웃(초), 기본값 30

    Returns:
        Connection 객체

    Raises:
        ConnectionError: 연결 실패 시
    """


# NumPy 스타일 (과학 계산 코드에서 많이 사용)
def normalize(array):
    """배열을 정규화한다.

    Parameters
    ----------
    array : ndarray
        정규화할 배열

    Returns
    -------
    ndarray
        정규화된 배열 (평균 0, 표준편차 1)
    """


# reStructuredText (Sphinx 문서화 도구와 호환)
def parse(text):
    """텍스트를 파싱한다.

    :param text: 파싱할 텍스트
    :type text: str
    :returns: 파싱된 결과
    :rtype: dict
    """
```

팀에서 하나의 형식을 선택해서 일관되게 사용하면 된다. 개인 프로젝트라면 Google 스타일이 가장 읽기 쉽다.

## 타입 힌트와 독스트링

Python 3.5+에서 타입 힌트를 사용하면 독스트링이 간결해진다.

```python
# 타입 힌트 없을 때: 독스트링에 타입 명시
def greet(name, formal=False):
    """인사 메시지를 반환한다.

    Args:
        name (str): 사용자 이름
        formal (bool): 공식 인사 여부, 기본값 False

    Returns:
        str: 인사 메시지
    """
    ...

# 타입 힌트 있을 때: 타입 정보 생략 가능
def greet(name: str, formal: bool = False) -> str:
    """인사 메시지를 반환한다.

    Args:
        name: 사용자 이름
        formal: 공식 인사 여부

    Returns:
        인사 메시지
    """
    ...
```

타입 힌트는 코드 자체에 타입 정보를 포함시켜 주석의 역할 일부를 대체한다. mypy, pyright 같은 정적 타입 검사기가 이 힌트를 활용한다.

## TODO, FIXME, HACK 주석

```python
# TODO: 나중에 구현할 것
# TODO: 캐시 레이어 추가 (이슈 #234)
def get_user(user_id):
    return db.query(user_id)

# FIXME: 알려진 버그 (경계 조건 처리 누락)
# FIXME: count가 0일 때 ZeroDivisionError 발생
average = total / count

# HACK: 임시 방편 (근본 해결책으로 교체 필요)
# HACK: 라이브러리 버그 우회 (버전 2.0 이후 제거 예정)
result = value + 0.0001  # float 비교 정밀도 문제 우회
```

이 키워드들은 IDE와 정적 분석 도구에서 특별히 표시된다. TODO는 나중에 할 일, FIXME는 알려진 버그, HACK은 임시 해결책을 나타낸다. 이슈 번호나 담당자를 함께 기록해두면 추적이 쉽다.

## 주석 삭제의 용기

주석을 추가하는 것보다 불필요한 주석을 삭제하는 것이 더 어렵다. 다음 주석들은 제거해야 한다.

```python
# 나쁜 주석들 (제거해야 함)

# 2024-03-15 Alice가 작성  (git blame이 알려줌)
# 아래 코드는 로그인 처리  (파일명과 함수명이 알려줌)
# 이 함수는 사용하지 않음  (그냥 삭제하라)
# v1.0에서 수정됨  (git history가 알려줌)

def login_user():
    pass
```

버전 정보, 작성자 정보는 git이 관리한다. 사용하지 않는 코드는 주석 처리하지 말고 그냥 삭제하라. git으로 언제든 복구할 수 있다.

다음 편에서는 Python의 가장 독특한 특징 중 하나인 들여쓰기를 깊이 다룬다. 다른 언어에서는 선택이지만 Python에서는 문법인 들여쓰기, 올바른 규칙과 자주 만나는 오류를 살펴볼 것이다.

---

**지난 글:** [Hello, World! Python 첫 프로그램 해부하기](/posts/python-hello-world/)

**다음 글:** [들여쓰기: Python이 공백을 문법으로 삼은 이유](/posts/python-indentation/)

<br>
읽어주셔서 감사합니다. 😊
