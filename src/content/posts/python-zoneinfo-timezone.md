---
title: "zoneinfo로 타임존 다루기"
description: "Python 3.9+ zoneinfo 모듈로 타임존을 처리하는 방법을 설명합니다. ZoneInfo, astimezone, DST 자동 처리, naive vs aware 변환, 고정 오프셋과의 차이를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "zoneinfo", "timezone", "datetime", "DST", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-datetime-basics/)에서 `datetime` 모듈의 핵심 타입과 날짜 계산을 살펴봤습니다. 이번에는 타임존(시간대) 처리를 다룹니다. 글로벌 서비스를 운영하거나 서로 다른 시간대의 데이터를 비교해야 할 때 타임존을 올바르게 다루는 것은 매우 중요합니다.

## 왜 타임존이 어려운가

날짜/시간 처리에서 가장 많이 실수하는 부분이 바로 타임존입니다. 세 가지 함정이 있습니다.

- **Naive datetime**: `datetime.now()`가 반환하는 값은 tzinfo가 없어 어느 시간대인지 알 수 없습니다.
- **DST(Daylight Saving Time)**: 미국, 유럽 등 많은 지역이 여름에 시계를 1시간 앞당깁니다. 단순 `+5:00` 같은 고정 오프셋은 이를 처리하지 못합니다.
- **KST(UTC+9)**: 한국은 DST가 없으므로 `timezone(timedelta(hours=9))`도 맞습니다만, 일반 원칙으로는 항상 `ZoneInfo`를 씁니다.

## zoneinfo 모듈 (Python 3.9+)

Python 3.9에서 `zoneinfo` 모듈이 표준 라이브러리에 추가되어 이전의 `pytz` 의존성 없이 IANA 타임존 데이터베이스를 활용할 수 있게 되었습니다.

```python
from datetime import datetime
from zoneinfo import ZoneInfo

# 서울 시각
kst = ZoneInfo("Asia/Seoul")
now_kst = datetime.now(kst)
print(now_kst)
# 2026-05-20 09:30:00+09:00

# 뉴욕 시각
ny = ZoneInfo("America/New_York")
now_ny = datetime.now(ny)
```

![zoneinfo 타임존 변환 흐름](/assets/posts/python-zoneinfo-timezone-flow.svg)

## 타임존 변환 — astimezone()

```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# UTC 시각 생성
utc_now = datetime.now(timezone.utc)
print(utc_now)
# 2026-05-20 00:30:00+00:00

# UTC → KST
kst_now = utc_now.astimezone(ZoneInfo("Asia/Seoul"))
print(kst_now)
# 2026-05-20 09:30:00+09:00

# KST → 뉴욕 (EDT, UTC-4)
ny_now = kst_now.astimezone(ZoneInfo("America/New_York"))
print(ny_now)
# 2026-05-19 20:30:00-04:00
```

`astimezone()`은 실제 시점을 유지한 채 표현만 바꿉니다. UTC 기준값은 동일합니다.

## DST 자동 처리

```python
from datetime import datetime
from zoneinfo import ZoneInfo

ny_tz = ZoneInfo("America/New_York")

# 여름 (EDT, UTC-4)
summer = datetime(2026, 7, 1, tzinfo=ny_tz)
print(summer.utcoffset())   # -1 day, 20:00:00 (즉 -04:00)
print(summer.strftime("%Z"))  # EDT

# 겨울 (EST, UTC-5)
winter = datetime(2026, 12, 1, tzinfo=ny_tz)
print(winter.utcoffset())   # -1 day, 19:00:00 (즉 -05:00)
print(winter.strftime("%Z"))  # EST
```

`ZoneInfo("America/New_York")`를 쓰면 날짜에 따라 EDT(여름)와 EST(겨울) 오프셋이 자동으로 달라집니다. 고정 오프셋(`timezone(timedelta(hours=-4))`)은 이를 처리하지 못합니다.

## naive → aware 변환

```python
from datetime import datetime
from zoneinfo import ZoneInfo

# naive datetime (tzinfo 없음)
naive = datetime(2026, 5, 20, 9, 0)

# replace: 단순히 tzinfo를 붙임 (DST 고려 없음)
aware_simple = naive.replace(tzinfo=ZoneInfo("America/New_York"))

# 올바른 방법: 로컬 시각으로 해석 후 localize
# (pytz에서는 localize()를 써야 했지만, zoneinfo에서는 replace도 대부분 OK)
aware_kst = naive.replace(tzinfo=ZoneInfo("Asia/Seoul"))
print(aware_kst)  # 2026-05-20 09:00:00+09:00
```

한국처럼 DST가 없는 지역에서는 `replace()`가 정확합니다. DST가 있는 지역에서 모호한 시각(DST 전환 시 겹치는 1시간)을 다루려면 `fold` 속성을 씁니다.

## fold — DST 전환 모호성 해결

```python
from datetime import datetime
from zoneinfo import ZoneInfo

ny_tz = ZoneInfo("America/New_York")

# 2026년 11월 1일 01:30 — DST 종료로 이 시각이 두 번 등장
# fold=0: 첫 번째 (DST 여름 시각, UTC-4)
# fold=1: 두 번째 (겨울 시각, UTC-5)
dt_fold0 = datetime(2026, 11, 1, 1, 30, tzinfo=ny_tz, fold=0)
dt_fold1 = datetime(2026, 11, 1, 1, 30, tzinfo=ny_tz, fold=1)
print(dt_fold0.utcoffset())  # -04:00
print(dt_fold1.utcoffset())  # -05:00
```

![zoneinfo 코드 패턴](/assets/posts/python-zoneinfo-timezone-code.svg)

## available_timezones() — 사용 가능한 타임존 목록

```python
from zoneinfo import available_timezones

tz_set = available_timezones()
print(len(tz_set))   # 수백 개

# 아시아 타임존만
asian = sorted(tz for tz in tz_set if tz.startswith("Asia/"))
# ['Asia/Aden', 'Asia/Almaty', ..., 'Asia/Seoul', ...]
```

## Python 3.8 이하 — backport

Python 3.8 이하에서는 `zoneinfo`가 없습니다. `pip install backports.zoneinfo`를 설치하고:

```python
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo
```

또는 `pytz`를 사용합니다.

## 실전 패턴 — UTC 저장, KST 표시

```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

def now_utc() -> datetime:
    """항상 UTC aware datetime 반환"""
    return datetime.now(timezone.utc)

def to_kst(dt: datetime) -> datetime:
    """UTC datetime을 KST로 변환"""
    return dt.astimezone(ZoneInfo("Asia/Seoul"))

def format_kst(dt: datetime) -> str:
    kst_dt = to_kst(dt) if dt.tzinfo == timezone.utc else dt
    return kst_dt.strftime("%Y-%m-%d %H:%M KST")
```

데이터베이스에는 UTC로 저장하고, 사용자에게 보여줄 때 해당 지역 시간으로 변환하는 것이 글로벌 서비스의 표준 패턴입니다.

## pytz vs zoneinfo 비교

| 항목 | pytz (구형) | zoneinfo (Python 3.9+) |
|------|------------|------------------------|
| 설치 | `pip install pytz` 필요 | 표준 라이브러리 |
| DST 처리 | `localize()` 별도 호출 | `datetime(..., tzinfo=tz)` 직접 |
| IANA 데이터 | 패키지 내장 | OS 또는 `tzdata` 패키지 |
| 권장 | 레거시 유지보수 | 신규 코드 권장 |

---

**지난 글:** [datetime 기초: 날짜와 시간 다루기](/posts/python-datetime-basics/)

**다음 글:** [time 모듈 vs datetime: 언제 무엇을 쓸까](/posts/python-time-vs-datetime/)

<br>
읽어주셔서 감사합니다. 😊
