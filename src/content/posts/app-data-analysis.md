---
title: "AI 데이터 분석 보조 시스템"
description: "자연어로 SQL 쿼리를 생성하고, 시각화 코드를 작성하며, 데이터 인사이트를 자동으로 요약하는 AI 데이터 분석 보조 시스템의 설계와 구현을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["데이터분석", "NL2SQL", "자연어쿼리", "이상탐지", "시각화자동화", "BI", "AnthropicSDK"]
featured: false
draft: false
---

[지난 글](/posts/app-content-generation/)에서 콘텐츠 생성 파이프라인을 구축했다. 이번에는 **AI 데이터 분석 보조** 시스템을 다룬다. 비기술 직군 직원도 "지난 분기 지역별 매출 추이를 보여줘"라고 말하면 SQL 쿼리를 직접 짜지 않아도 즉시 분석 결과를 얻을 수 있는 시스템이다. NL2SQL(자연어 → SQL 변환)이 핵심이지만, 여기서 더 나아가 시각화 코드 생성과 경영진 인사이트 요약까지 포함한다.

## NL2SQL: 자연어를 SQL로

NL2SQL은 단순히 "자연어 → SQL 변환"이 아니다. 복잡한 비즈니스 맥락과 테이블 스키마를 이해해야 하므로 체계적인 프롬프트 설계가 필요하다.

```python
import anthropic
import re

client = anthropic.Anthropic()

SCHEMA = """
테이블 목록:
- orders(id, user_id, product_id, amount, status, created_at, region)
- products(id, name, category, price, stock)
- users(id, name, email, tier, signup_date, region)
- returns(id, order_id, reason, refund_amount, created_at)

관계:
- orders.user_id → users.id
- orders.product_id → products.id
- returns.order_id → orders.id
"""

def nl_to_sql(question: str) -> str:
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        system=(
            f"다음 데이터베이스 스키마를 기반으로 SQL 쿼리를 생성하세요.\n\n"
            f"{SCHEMA}\n\n"
            "규칙:\n"
            "1. SELECT 쿼리만 생성하세요 (INSERT, UPDATE, DELETE 금지)\n"
            "2. SQL 쿼리만 출력하고 설명은 코드 블록 아래에 한 줄로\n"
            "3. 날짜 필터는 파라미터 바인딩 형식 사용\n"
            "4. 결과는 항상 ORDER BY를 포함해 정렬"
        ),
        messages=[{"role": "user", "content": question}],
    )
    return response.content[0].text

def extract_sql(raw_response: str) -> str:
    # ```sql ... ``` 블록에서 쿼리 추출
    match = re.search(r"```(?:sql)?\n(.*?)\n```", raw_response, re.DOTALL)
    return match.group(1).strip() if match else raw_response.strip()
```

![NL2SQL 데이터 분석 아키텍처](/assets/posts/app-data-analysis-nl2sql.svg)

## SQL 검증과 안전한 실행

LLM이 생성한 SQL을 그대로 실행하면 안 된다. 반드시 검증 단계를 거친다.

```python
import sqlparse
import psycopg2

FORBIDDEN_KEYWORDS = {"DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE", "ALTER", "CREATE"}

def validate_sql(sql: str) -> tuple[bool, str]:
    parsed = sqlparse.parse(sql)
    if not parsed:
        return False, "파싱 실패"

    stmt = parsed[0]
    if stmt.get_type() != "SELECT":
        return False, "SELECT 쿼리만 허용됩니다"

    tokens_upper = {str(t).upper() for t in stmt.flatten()}
    blocked = tokens_upper & FORBIDDEN_KEYWORDS
    if blocked:
        return False, f"허용되지 않는 키워드: {blocked}"

    return True, "OK"

def execute_query(sql: str, params: dict | None = None) -> list[dict]:
    valid, reason = validate_sql(sql)
    if not valid:
        raise ValueError(f"SQL 검증 실패: {reason}")

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(f"SET statement_timeout = '30s'")  # 타임아웃
            cur.execute(sql, params or {})
            columns = [desc[0] for desc in cur.description]
            return [dict(zip(columns, row)) for row in cur.fetchall()]
    finally:
        conn.close()
```

읽기 전용 DB 사용자 계정과 30초 타임아웃이 핵심 보안 장치다.

## 시각화 코드 자동 생성

쿼리 결과를 받으면 어떤 차트가 적합한지 AI가 판단하고 코드를 생성한다.

```python
import json

def generate_chart_code(question: str, data: list[dict]) -> str:
    sample = data[:3]  # 데이터 구조 파악용 샘플
    columns = list(data[0].keys()) if data else []

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=(
            "데이터를 시각화하는 Python 코드를 작성하세요.\n"
            "matplotlib 또는 plotly를 사용하고, "
            "한국어 레이블, 적절한 제목, 색상을 포함하세요."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"질문: {question}\n"
                    f"컬럼: {columns}\n"
                    f"데이터 샘플 (처음 3행): {json.dumps(sample, ensure_ascii=False)}\n"
                    f"전체 행 수: {len(data)}\n\n"
                    "적합한 차트 유형을 선택해 완전한 Python 코드를 작성하세요."
                ),
            }
        ],
    )
    return response.content[0].text
```

## 자동 인사이트 요약

분석 결과를 경영진이 바로 이해할 수 있는 언어로 요약한다.

```python
def generate_insight_summary(question: str, data: list[dict], sql: str) -> str:
    stats = {
        "총 행 수": len(data),
        "샘플 데이터": data[:5],
    }
    if data and isinstance(list(data[0].values())[0], (int, float)):
        values = [list(row.values())[0] for row in data if list(row.values())[0] is not None]
        if values:
            stats["최댓값"] = max(values)
            stats["최솟값"] = min(values)
            stats["평균"] = sum(values) / len(values)

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        system=(
            "데이터 분석 결과를 경영진을 위한 3~5문장 인사이트로 요약하세요. "
            "수치를 인용하고, 주목할 트렌드나 이상값을 언급하며, "
            "가능하면 다음 행동 방향을 제안하세요."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"원래 질문: {question}\n"
                    f"분석 결과 통계: {json.dumps(stats, ensure_ascii=False, default=str)}"
                ),
            }
        ],
    )
    return response.content[0].text
```

![AI 데이터 분석 보조 유형](/assets/posts/app-data-analysis-flow.svg)

## 완전한 분석 파이프라인

위 컴포넌트들을 통합한 전체 파이프라인이다.

```python
def analyze(question: str) -> dict:
    # 1단계: 자연어 → SQL
    raw_response = nl_to_sql(question)
    sql = extract_sql(raw_response)

    # 2단계: 검증 및 실행
    try:
        data = execute_query(sql)
    except ValueError as e:
        return {"error": str(e), "sql": sql}

    if not data:
        return {"message": "조건에 맞는 데이터가 없습니다.", "sql": sql}

    # 3단계: 시각화 코드 생성 (데이터가 있을 때만)
    chart_code = generate_chart_code(question, data) if len(data) <= 1000 else None

    # 4단계: 인사이트 요약
    insight = generate_insight_summary(question, data, sql)

    return {
        "sql": sql,
        "row_count": len(data),
        "data": data[:100],  # 최대 100행 반환
        "chart_code": chart_code,
        "insight": insight,
    }
```

## 이상 탐지 자동화

정기적으로 핵심 지표를 모니터링하고 이상값을 자동으로 감지한다.

```python
import statistics

def detect_anomalies(metric_name: str, values: list[float]) -> dict:
    if len(values) < 7:
        return {"anomalies": []}

    mean = statistics.mean(values)
    stdev = statistics.stdev(values)

    anomalies = [
        {"index": i, "value": v, "z_score": (v - mean) / stdev}
        for i, v in enumerate(values)
        if abs((v - mean) / stdev) > 2.5  # Z-score 2.5 초과 = 이상값
    ]

    if not anomalies:
        return {"anomalies": []}

    # AI에게 이상값 원인 해석 요청
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system="데이터 이상값을 분석하고 가능한 원인을 2~3가지 제안하세요.",
        messages=[
            {
                "role": "user",
                "content": f"지표: {metric_name}\n평균: {mean:.2f}\n이상값: {anomalies}",
            }
        ],
    )

    return {
        "anomalies": anomalies,
        "mean": mean,
        "interpretation": response.content[0].text,
    }
```

---

**지난 글:** [AI 콘텐츠 생성 자동화 파이프라인](/posts/app-content-generation/)

**다음 글:** [AI 정보 추출 파이프라인: 비정형 데이터에서 구조화 데이터로](/posts/app-extraction/)

<br>
읽어주셔서 감사합니다. 😊
