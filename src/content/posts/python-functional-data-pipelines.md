---
title: "함수형 데이터 파이프라인: 실전 설계 패턴"
description: "순수 함수 조합으로 데이터 파이프라인을 구축하는 방법, 불순 코드를 경계로 격리하는 설계, pandas 파이프라인, 제너레이터 파이프라인, 병렬 처리 통합을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "함수형파이프라인", "데이터처리", "순수함수", "파이프라인설계", "pandas"]
featured: false
draft: false
---

[지난 글](/posts/python-memoization-pattern/)에서 메모이제이션으로 계산을 최적화하는 방법을 살펴봤다. 이번 글에서는 지금까지 배운 함수형 도구들(순수 함수, 불변성, pipe, compose, partial, memoize)을 조합해 **실전 데이터 파이프라인**을 설계하는 방법을 다룬다.

## 함수형 파이프라인의 핵심 원칙

함수형 파이프라인은 두 가지 원칙에 기반한다.

**원칙 1: 각 단계는 순수 함수다.** 데이터를 받아 새 데이터를 반환한다. 외부 상태를 변경하지 않는다.

**원칙 2: 불순한 코드(IO, DB, API)는 파이프라인의 경계에만 위치한다.** 읽기는 시작, 쓰기는 끝에만.

![함수형 파이프라인 구조](/assets/posts/python-functional-data-pipelines-arch.svg)

```python
# 나쁜 패턴: 각 단계에 IO가 섞임
def process():
    data = read_from_db()          # IO
    data = validate(data)
    data = save_to_cache(data)     # IO in 중간!
    data = transform(data)
    write_to_file(data)            # IO

# 좋은 패턴: IO를 경계로
def process():
    raw = read_from_db()           # IO (경계)
    result = pipeline(raw)         # 순수 변환
    write_to_file(result)          # IO (경계)

def pipeline(data):
    return pipe(data, validate, transform)   # 순수
```

## 실전 예시: 판매 데이터 처리

![실전 파이프라인 예시](/assets/posts/python-functional-data-pipelines-example.svg)

```python
from toolz import pipe
from typing import TypedDict

class SaleRecord(TypedDict):
    month: str
    product: str
    price: int
    qty: int

class EnrichedRecord(TypedDict):
    month: str
    product: str
    price: int
    qty: int
    revenue: int
    tax: int

# 순수 함수들
def parse_line(line: str) -> SaleRecord:
    month, product, price, qty = line.strip().split(",")
    return SaleRecord(
        month=month,
        product=product,
        price=int(price),
        qty=int(qty),
    )

def validate(record: SaleRecord) -> SaleRecord:
    if record["price"] <= 0:
        raise ValueError(f"Invalid price: {record['price']}")
    if record["qty"] <= 0:
        raise ValueError(f"Invalid qty: {record['qty']}")
    return record

def enrich(record: SaleRecord) -> EnrichedRecord:
    revenue = record["price"] * record["qty"]
    return {**record, "revenue": revenue, "tax": int(revenue * 0.1)}

def format_report(record: EnrichedRecord) -> str:
    return f"{record['month']} | {record['product']} | 매출: {record['revenue']:,}원"

# 파이프라인 조립
def process_line(line: str) -> str:
    return pipe(line, parse_line, validate, enrich, format_report)

# 실행
lines = [
    "2024-01,Product A,1500,5",
    "2024-01,Product B,3000,2",
]
reports = [process_line(line) for line in lines]
```

## 대용량 데이터: 제너레이터 파이프라인

데이터가 수백만 줄이라면 모든 데이터를 메모리에 올리지 않고 스트림으로 처리해야 한다.

```python
from typing import Iterator

def stream_lines(filepath: str) -> Iterator[str]:
    with open(filepath) as f:
        yield from f

def parse_stream(lines: Iterator[str]) -> Iterator[SaleRecord]:
    return (parse_line(line) for line in lines if line.strip())

def validate_stream(records: Iterator[SaleRecord]) -> Iterator[SaleRecord]:
    for record in records:
        try:
            yield validate(record)
        except ValueError as e:
            print(f"[SKIP] {e}")

def enrich_stream(records: Iterator[SaleRecord]) -> Iterator[EnrichedRecord]:
    return (enrich(r) for r in records)

# 메모리 효율적인 파이프라인
def run_pipeline(filepath: str) -> None:
    pipeline = enrich_stream(
        validate_stream(
            parse_stream(
                stream_lines(filepath)
            )
        )
    )
    for record in pipeline:
        save_to_db(record)   # 경계에서 IO
```

각 단계가 제너레이터이므로 `yield`로 데이터를 지연 처리한다. 100GB 파일도 상수 메모리로 처리할 수 있다.

## pandas 파이프라인

pandas `DataFrame`에는 `.pipe()` 메서드가 있어 함수형 파이프라인 패턴을 그대로 적용할 수 있다.

```python
import pandas as pd
from functools import partial

def remove_duplicates(df: pd.DataFrame) -> pd.DataFrame:
    return df.drop_duplicates()

def fill_missing(df: pd.DataFrame, strategy: str = "mean") -> pd.DataFrame:
    if strategy == "mean":
        return df.fillna(df.mean(numeric_only=True))
    return df.dropna()

def normalize_prices(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["price"] = (df["price"] - df["price"].min()) / (df["price"].max() - df["price"].min())
    return df

# 파이프라인
result = (
    raw_df
    .pipe(remove_duplicates)
    .pipe(fill_missing, strategy="mean")
    .pipe(normalize_prices)
)
```

## 병렬 처리 통합

순수 함수 파이프라인은 병렬 처리와 자연스럽게 결합된다. 각 레코드 처리가 독립적이므로 `multiprocessing.Pool.map`을 바로 쓸 수 있다.

```python
from multiprocessing import Pool

def process_record(line: str) -> EnrichedRecord:
    return pipe(line, parse_line, validate, enrich)   # 순수 함수만

with Pool() as pool:
    records = pool.map(process_record, lines)   # 병렬 처리
```

함수형 파이프라인의 진가는 이처럼 스케일 업이 쉽다는 점이다. 순수 함수를 쓰기 때문에 멀티프로세싱, 비동기, 배치 처리로 전환할 때 비즈니스 로직을 거의 변경하지 않아도 된다. 다음 글에서는 함수형 설계의 마지막 주제인 **부작용 격리 패턴**을 정리한다.

---

**지난 글:** [메모이제이션 패턴: 계산 결과 캐싱 전략](/posts/python-memoization-pattern/)

**다음 글:** [부작용 격리 패턴: 순수와 불순을 분리하는 설계](/posts/python-side-effect-isolation/)

<br>
읽어주셔서 감사합니다. 😊
