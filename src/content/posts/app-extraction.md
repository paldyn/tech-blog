---
title: "AI 정보 추출 파이프라인: 비정형 데이터에서 구조화 데이터로"
description: "계약서, 청구서, 이메일, 이미지 등 비정형 문서에서 원하는 정보를 자동으로 추출해 구조화된 데이터로 변환하는 AI 파이프라인을 구현합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["정보추출", "Pydantic", "구조화출력", "DocumentAI", "OCR", "VisionLLM", "데이터파이프라인"]
featured: false
draft: false
---

[지난 글](/posts/app-data-analysis/)에서 AI로 데이터를 분석하는 방법을 살펴봤다. 이번에는 그 전 단계인 **비정형 데이터에서 구조화 데이터를 추출**하는 파이프라인을 다룬다. 회사에 쌓이는 계약서, 청구서, 이력서, 설문 응답, 이메일 등 대부분의 비즈니스 데이터는 비정형이다. 이를 수동으로 입력하는 대신 AI가 자동으로 추출하면 수십 배의 효율성을 얻을 수 있다.

## 정보 추출의 두 가지 접근법

**전통적 방법**: 정규식, 규칙 기반 파서. 패턴이 고정된 경우(주민등록번호, 사업자번호) 정확하지만, 양식이 조금만 달라져도 실패한다.

**LLM 기반 방법**: 자연어 이해로 다양한 양식에서 동일한 필드를 추출. 유연하지만 비용이 든다.

실무에서는 두 방법을 조합한다. 먼저 정규식으로 명확한 패턴을 빠르게 처리하고, 나머지를 LLM으로 처리한다.

![AI 정보 추출 파이프라인](/assets/posts/app-extraction-pipeline.svg)

## Pydantic으로 스키마 정의

추출할 데이터 구조를 Pydantic 모델로 정의하는 것이 핵심이다. 모델 정의가 곧 추출 스키마이자 유효성 검사 로직이다.

```python
from pydantic import BaseModel, Field
from typing import Optional

class LineItem(BaseModel):
    description: str = Field(description="품목 설명")
    quantity: float = Field(description="수량", default=1)
    unit_price: float = Field(description="단가 (원)")
    amount: float = Field(description="금액 = 수량 × 단가")

class Invoice(BaseModel):
    vendor_name: str = Field(description="공급업체명")
    vendor_business_number: Optional[str] = Field(
        description="사업자등록번호 (없으면 null)", default=None
    )
    invoice_date: str = Field(description="청구일 (YYYY-MM-DD 형식)")
    due_date: Optional[str] = Field(description="납부기한", default=None)
    line_items: list[LineItem] = Field(description="품목 목록")
    subtotal: float = Field(description="공급가액 합계")
    tax_amount: float = Field(description="부가세")
    total_amount: float = Field(description="총 청구금액")
    bank_account: Optional[str] = Field(description="입금 계좌번호", default=None)
```

필드에 `description`을 붙이면 LLM이 각 필드의 의미를 정확히 이해해 추출 정확도가 높아진다. `Optional` 필드로 없을 수 있는 정보를 처리한다.

## LLM 기반 추출 구현

```python
import anthropic
import json

client = anthropic.Anthropic()

def extract_invoice(text: str) -> Invoice:
    schema_json = Invoice.model_json_schema()

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=(
            "청구서 텍스트에서 정보를 추출해 JSON으로 반환하세요. "
            "다음 JSON 스키마를 따르세요:\n"
            f"{json.dumps(schema_json, ensure_ascii=False)}\n\n"
            "JSON만 출력하고 다른 텍스트는 없어야 합니다."
        ),
        messages=[{"role": "user", "content": f"청구서:\n{text}"}],
    )

    raw = response.content[0].text.strip()
    # ```json ... ``` 블록 제거
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    return Invoice.model_validate_json(raw)
```

`model_validate_json`은 JSON 파싱 + Pydantic 유효성 검사를 한 번에 수행한다. 타입 불일치, 필수 필드 누락 등을 자동으로 잡아준다.

![구조화 추출 스키마 설계 패턴](/assets/posts/app-extraction-schema.svg)

## Vision LLM으로 이미지 직접 처리

스캔된 이미지나 사진 촬영 문서는 OCR 없이 Claude Vision으로 직접 처리할 수 있다.

```python
import base64

def extract_from_image(image_path: str) -> Invoice:
    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    # 이미지 확장자로 미디어 타입 결정
    ext = image_path.rsplit(".", 1)[-1].lower()
    media_type = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                  "png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg")

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "이 청구서 이미지에서 정보를 추출해 JSON으로 반환하세요.\n"
                            f"스키마: {json.dumps(Invoice.model_json_schema())}"
                        ),
                    },
                ],
            }
        ],
    )
    return Invoice.model_validate_json(response.content[0].text)
```

Vision LLM은 기울어진 스캔, 표 구조, 도장이 찍힌 문서 등 OCR이 어려운 케이스에서도 정확하게 추출한다.

## 재시도와 부분 실패 처리

추출이 항상 성공하지는 않는다. 특히 문서 품질이 낮거나 비표준 양식일 때 실패할 수 있다.

```python
from pydantic import ValidationError
import time

def extract_with_retry(text: str, max_attempts: int = 3) -> Invoice | None:
    for attempt in range(max_attempts):
        try:
            return extract_invoice(text)
        except (ValidationError, json.JSONDecodeError, ValueError) as e:
            if attempt < max_attempts - 1:
                # 실패 이유를 LLM에게 알려주고 재시도
                hint = f"이전 시도 실패 이유: {str(e)[:200]}. 더 주의해서 추출하세요."
                text = f"{hint}\n\n원문:\n{text}"
                time.sleep(2 ** attempt)  # 지수 백오프
            else:
                return None  # 모두 실패하면 None 반환 → 수동 검토 큐로
```

실패한 문서는 수동 검토 큐에 넣고, 사람이 처리한 결과를 훈련 데이터로 수집해 나중에 파인튜닝에 활용한다.

## 배치 처리 파이프라인

대량의 문서를 처리하는 배치 파이프라인이다.

```python
import asyncio
from pathlib import Path

async def process_document_async(path: str) -> dict:
    text = load_document(path)
    result = await asyncio.to_thread(extract_with_retry, text)
    return {
        "file": path,
        "status": "success" if result else "failed",
        "data": result.model_dump() if result else None,
    }

async def batch_extract(document_dir: str, concurrency: int = 10) -> list[dict]:
    paths = [str(p) for p in Path(document_dir).glob("**/*") if p.is_file()]
    semaphore = asyncio.Semaphore(concurrency)

    async def process_with_limit(path: str):
        async with semaphore:
            return await process_document_async(path)

    return await asyncio.gather(*[process_with_limit(p) for p in paths])
```

`asyncio.Semaphore`로 동시 처리 수를 제한해 API 레이트 리밋에 걸리지 않도록 한다.

## 추출 정확도 평가

```python
def evaluate_extraction(predicted: dict, ground_truth: dict) -> dict:
    fields = list(ground_truth.keys())
    correct = sum(
        1 for f in fields
        if str(predicted.get(f, "")).strip() == str(ground_truth.get(f, "")).strip()
    )
    return {
        "field_accuracy": correct / len(fields) if fields else 0,
        "correct_fields": correct,
        "total_fields": len(fields),
    }
```

핵심 필드(vendor_name, total_amount, invoice_date)에 대한 정확도를 별도로 추적하고, 전체 정확도가 95% 아래로 내려가면 알림을 발송한다.

---

**지난 글:** [AI 데이터 분석 보조 시스템](/posts/app-data-analysis/)

**다음 글:** [AI 번역 시스템 구축: 도메인 특화 고품질 번역](/posts/app-translation/)

<br>
읽어주셔서 감사합니다. 😊
