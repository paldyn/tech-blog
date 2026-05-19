---
title: "datetime 기초: 날짜와 시간 다루기"
description: "Python datetime 모듈의 핵심 타입과 사용법을 설명합니다. date, time, datetime, timedelta, strftime, strptime, ISO 8601 변환, naive vs aware datetime을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "datetime", "날짜시간", "timedelta", "strftime", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-tempfile/)에서 임시 파일을 안전하게 다루는 방법을 살펴봤습니다. 이번에는 날짜와 시간을 다루는 `datetime` 모듈을 정리합니다. 날짜 계산, 포맷 변환, Unix 타임스탬프 처리, aware/naive datetime 구분 등 실무에서 매일 만나는 개념들을 다룹니다.

## datetime 모듈 구성

`datetime` 모듈에는 이름이 동일한 모듈(`datetime`)과 클래스(`datetime.datetime`)가 공존합니다. 헷갈리지 않으려면 클래스를 직접 임포트하는 방식을 씁니다.

```python
from datetime import date, time, datetime, timedelta, timezone
```

![datetime 모듈 핵심 타입](/assets/posts/python-datetime-basics-types.svg)

## date — 날짜만

```python
from datetime import date

today = date.today()             # 오늘 날짜
d = date(2026, 5, 20)            # 특정 날짜

print(d.year, d.month, d.day)    # 2026 5 20
print(d.weekday())               # 0=월 ~ 6=일
print(d.isoformat())             # "2026-05-20"
print(d.strftime("%Y년 %m월 %d일"))  # "2026년 05월 20일"

# ISO 형식 파싱
d2 = date.fromisoformat("2026-05-20")
```

## time — 시간만

```python
from datetime import time

t = time(9, 30, 0)               # 09:30:00
print(t.hour, t.minute, t.second)
print(t.isoformat())             # "09:30:00"
```

`time` 객체는 날짜 정보가 없습니다. 특정 날짜의 특정 시각을 나타내려면 `datetime`을 써야 합니다.

## datetime — 날짜 + 시간

```python
from datetime import datetime, timezone

# 현재 로컬 시각
now = datetime.now()

# 현재 UTC 시각 (타임존 인식)
utc_now = datetime.now(timezone.utc)

# 특정 시각 생성
dt = datetime(2026, 5, 20, 9, 30, 0)

# 속성 접근
print(dt.year, dt.month, dt.day)
print(dt.hour, dt.minute, dt.second)

# date/time 객체 추출
print(dt.date())   # date(2026, 5, 20)
print(dt.time())   # time(9, 30)
```

## timedelta — 시간 간격

```python
from datetime import datetime, timedelta

now = datetime.now()

# 7일 후
next_week = now + timedelta(days=7)

# 1시간 30분 전
earlier = now - timedelta(hours=1, minutes=30)

# 두 날짜의 차이
deadline = datetime(2026, 12, 31)
remaining = deadline - now
print(f"남은 일수: {remaining.days}일")
print(f"총 초: {remaining.total_seconds():.0f}초")

# 음수 timedelta도 가능
delta = timedelta(days=-3)
```

`timedelta`는 내부적으로 일(days)과 초(seconds), 마이크로초(microseconds)만 저장합니다. 월, 연 단위 연산은 지원하지 않습니다(월마다 일수가 달라서). 월/연 연산이 필요하면 `dateutil.relativedelta`를 씁니다.

## strftime / strptime — 포맷 변환

```python
from datetime import datetime

now = datetime.now()

# datetime → 문자열
print(now.strftime("%Y-%m-%d"))           # "2026-05-20"
print(now.strftime("%Y년 %m월 %d일 %H시 %M분"))
print(now.strftime("%A, %B %d, %Y"))      # "Tuesday, May 20, 2026"

# 문자열 → datetime
dt = datetime.strptime("2026-05-20 09:30", "%Y-%m-%d %H:%M")
```

| 코드 | 의미 | 예 |
|------|------|----|
| `%Y` | 4자리 연도 | 2026 |
| `%m` | 2자리 월 | 05 |
| `%d` | 2자리 일 | 20 |
| `%H` | 24시간 | 09 |
| `%M` | 분 | 30 |
| `%S` | 초 | 00 |
| `%A` | 요일 이름 | Tuesday |

![datetime 코드 패턴](/assets/posts/python-datetime-basics-code.svg)

## ISO 8601 형식

```python
from datetime import datetime, timezone

# isoformat() — ISO 8601 출력
dt = datetime(2026, 5, 20, 9, 30, tzinfo=timezone.utc)
print(dt.isoformat())        # "2026-05-20T09:30:00+00:00"

# fromisoformat() — ISO 8601 파싱 (Python 3.7+)
dt2 = datetime.fromisoformat("2026-05-20T09:30:00+00:00")

# Python 3.11+: 더 유연한 ISO 8601 파싱
dt3 = datetime.fromisoformat("2026-05-20T09:30:00Z")
```

API 응답이나 로그에서 날짜를 파싱할 때는 `fromisoformat()`이 `strptime()`보다 편리합니다.

## naive vs aware datetime

```python
from datetime import datetime, timezone

# naive: tzinfo 없음 (어느 시간대인지 모름)
naive = datetime(2026, 5, 20, 9, 30)
print(naive.tzinfo)   # None

# aware: tzinfo 있음 (명확한 시간대)
aware = datetime(2026, 5, 20, 9, 30, tzinfo=timezone.utc)
print(aware.tzinfo)   # UTC

# aware끼리만 비교 가능
# naive와 aware를 직접 비교하면 TypeError 발생
```

프로덕션 코드에서는 항상 aware datetime을 씁니다. 내부 저장은 UTC, 표시는 로컬 타임존으로 변환하는 패턴이 표준입니다. 타임존 관련 상세 내용은 다음 글에서 다룹니다.

## Unix 타임스탬프 변환

```python
from datetime import datetime, timezone
import time

# 현재 Unix 타임스탬프
ts = time.time()         # float (초, epoch 기준)

# 타임스탬프 → datetime (UTC 기준)
dt = datetime.fromtimestamp(ts, tz=timezone.utc)

# datetime → 타임스탬프
ts2 = dt.timestamp()
```

`datetime.utcnow()`는 naive UTC datetime을 반환하며 deprecated 예정입니다. 대신 `datetime.now(timezone.utc)`를 씁니다.

## 실전 패턴

```python
from datetime import datetime, timedelta, date

# 이번 달 첫날
first = date.today().replace(day=1)

# 특정 날짜가 과거인지 확인
def is_expired(dt: datetime) -> bool:
    return dt < datetime.now()

# 날짜 범위 생성
def date_range(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)
```

---

**지난 글:** [tempfile: 임시 파일과 디렉토리 안전하게 다루기](/posts/python-tempfile/)

**다음 글:** [zoneinfo로 타임존 다루기](/posts/python-zoneinfo-timezone/)

<br>
읽어주셔서 감사합니다. 😊
