---
title: "AI 번역 시스템 구축: 도메인 특화 고품질 번역"
description: "법률, 의료, 기술 문서 등 도메인 특화 용어집과 스타일 가이드를 활용해 일관성 있는 고품질 AI 번역 시스템을 구축하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["AI번역", "NMT", "용어집", "도메인번역", "번역품질", "BLEU", "현지화"]
featured: false
draft: false
---

[지난 글](/posts/app-extraction/)에서 비정형 문서에서 정보를 추출하는 파이프라인을 만들었다. 이번에는 **AI 번역 시스템**을 구축한다. 단순히 DeepL이나 Google Translate API를 래핑하는 것이 아니라, 도메인 전문 용어집, 스타일 가이드, 품질 검증을 갖춘 프로덕션 번역 시스템을 만든다. 법률 계약서의 "warranty"를 "보증"으로 통일하거나, 의료 문서의 "adverse event"를 "이상반응"으로 일관되게 처리하는 수준의 시스템이다.

## 왜 범용 번역 API로는 부족한가

범용 번역 서비스의 한계는 세 가지다.

**전문 용어 불일치**: "cache"가 어떤 문서에선 "캐시", 다른 문서에선 "캐쉬"로 번역된다. 용어 일관성 없이는 법적·기술적 문서에서 심각한 문제가 된다.

**브랜드 고유 어휘 무시**: 제품명, 서비스명, 내부 코드명은 번역하면 안 된다. 범용 서비스는 이를 알 수 없다.

**도메인 스타일 부재**: 의료 문서는 격식체, IT 튜토리얼은 친근체가 적합하다. 도메인에 맞는 문체를 자동으로 선택하지 못한다.

![도메인 특화 AI 번역 시스템](/assets/posts/app-translation-architecture.svg)

## 용어집 기반 번역 구현

용어집을 시스템 프롬프트에 주입해 LLM이 정해진 번역어를 사용하도록 강제한다.

```python
import anthropic
from typing import Optional

client = anthropic.Anthropic()

# 도메인별 용어집
GLOSSARIES = {
    "legal": {
        "warranty": "보증",
        "indemnification": "면책",
        "force majeure": "불가항력",
        "governing law": "준거법",
        "arbitration": "중재",
        "intellectual property": "지식재산권",
    },
    "medical": {
        "adverse event": "이상반응",
        "clinical trial": "임상시험",
        "efficacy": "유효성",
        "contraindication": "금기사항",
        "placebo": "위약",
    },
    "it": {
        "cache": "캐시",
        "endpoint": "엔드포인트",
        "latency": "지연 시간",
        "throughput": "처리량",
        "deployment": "배포",
    },
}

def translate_with_glossary(
    text: str,
    target_lang: str = "ko",
    domain: str = "general",
    style: str = "formal",
) -> str:
    glossary = GLOSSARIES.get(domain, {})
    glossary_lines = "\n".join(f"  {src} → {tgt}" for src, tgt in glossary.items())

    system_prompt = f"""당신은 전문 번역가입니다.
목표 언어: {target_lang}
도메인: {domain}
스타일: {style}

반드시 준수할 전문 용어집:
{glossary_lines if glossary_lines else "  (해당 없음)"}

번역 원칙:
1. 용어집의 번역어를 반드시 사용하세요
2. 고유명사, 제품명, 코드명은 번역하지 마세요
3. 원문의 문단 구조와 서식을 보존하세요
4. 번역문만 출력하고 설명은 하지 마세요"""

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": text}],
    )
    return response.content[0].text
```

## 긴 문서의 청크 번역

긴 문서를 컨텍스트 윈도우 내에서 처리하려면 청크로 나눠 번역하되, 청크 간 일관성을 유지해야 한다.

```python
def translate_long_document(
    text: str,
    max_chunk_chars: int = 2000,
    domain: str = "general",
) -> str:
    # 문단 경계에서 청크 분할
    paragraphs = text.split("\n\n")
    chunks, current, current_len = [], [], 0

    for para in paragraphs:
        if current_len + len(para) > max_chunk_chars and current:
            chunks.append("\n\n".join(current))
            current, current_len = [], 0
        current.append(para)
        current_len += len(para)

    if current:
        chunks.append("\n\n".join(current))

    translated_parts = []
    prev_context = ""  # 이전 청크 번역 일부를 맥락으로 제공

    for i, chunk in enumerate(chunks):
        context_note = ""
        if prev_context:
            context_note = f"\n[이전 부분 마지막 2문장: {prev_context}]\n"

        translated = translate_with_glossary(
            context_note + chunk, domain=domain
        )
        translated_parts.append(translated)

        # 다음 청크를 위한 맥락 저장 (마지막 2문장)
        sentences = translated.split("。")
        prev_context = "。".join(sentences[-2:]) if len(sentences) >= 2 else translated[-200:]

    return "\n\n".join(translated_parts)
```

이전 청크의 마지막 문장을 다음 청크의 맥락으로 제공하면 청크 경계에서 문체와 번역어가 자연스럽게 이어진다.

## 용어 일관성 검증

번역 후 용어집의 소스 단어가 올바르게 번역됐는지 검증한다.

```python
import re

def verify_glossary_compliance(
    original: str,
    translated: str,
    glossary: dict[str, str],
) -> dict:
    violations = []

    for src_term, expected_tgt in glossary.items():
        # 원문에 해당 용어가 있는지 확인
        if re.search(rf"\b{re.escape(src_term)}\b", original, re.IGNORECASE):
            # 번역문에 올바른 번역어가 있는지 확인
            if expected_tgt not in translated:
                # 혹시 다른 번역어가 쓰였는지 LLM에게 확인
                violations.append({
                    "source_term": src_term,
                    "expected": expected_tgt,
                    "note": "기대하는 번역어 미발견",
                })

    return {
        "compliant": len(violations) == 0,
        "violations": violations,
        "compliance_rate": 1 - len(violations) / max(len(glossary), 1),
    }
```

## 번역 품질 자동 평가

BLEU 점수만으로는 품질을 정확히 측정하기 어렵다. AI 자체 평가를 추가한다.

```python
def ai_quality_check(original: str, translated: str, target_lang: str) -> dict:
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system="번역 품질을 평가하고 JSON으로 응답하세요.",
        messages=[
            {
                "role": "user",
                "content": (
                    f"원문: {original[:500]}\n"
                    f"번역({target_lang}): {translated[:500]}\n\n"
                    '{"fluency": 1-5, "accuracy": 1-5, "style": 1-5, "issues": ["..."]}'
                ),
            }
        ],
    )
    return json.loads(response.content[0].text)
```

![번역 품질 결정 요소](/assets/posts/app-translation-pipeline.svg)

## 캐싱으로 비용 최적화

동일하거나 매우 유사한 텍스트를 반복 번역하는 경우가 많다. 번역 결과를 캐싱하면 비용을 크게 줄일 수 있다.

```python
import hashlib
from redis import Redis

cache = Redis()

def cached_translate(text: str, domain: str, lang: str) -> str:
    cache_key = hashlib.sha256(f"{text}|{domain}|{lang}".encode()).hexdigest()
    cached = cache.get(f"translate:{cache_key}")

    if cached:
        return cached.decode("utf-8")

    result = translate_with_glossary(text, target_lang=lang, domain=domain)
    cache.setex(f"translate:{cache_key}", 86400 * 7, result)  # 7일 캐싱
    return result
```

완전 일치 캐싱 외에도 의미론적으로 유사한 문장을 찾아 재사용하는 시맨틱 캐싱을 추가하면 캐시 히트율이 더 높아진다.

## 다국어 확장

같은 파이프라인으로 여러 언어를 지원한다.

```python
SUPPORTED_LANGUAGES = {
    "ko": "Korean",
    "en": "English",
    "ja": "Japanese",
    "zh-cn": "Simplified Chinese",
    "de": "German",
    "fr": "French",
}

def translate_to_multiple(text: str, target_langs: list[str], domain: str = "general") -> dict:
    import asyncio
    import anthropic

    async_client = anthropic.AsyncAnthropic()

    async def translate_one(lang: str) -> tuple[str, str]:
        # 비동기 번역
        result = await asyncio.to_thread(translate_with_glossary, text, lang, domain)
        return lang, result

    async def translate_all():
        tasks = [translate_one(lang) for lang in target_langs]
        results = await asyncio.gather(*tasks)
        return dict(results)

    return asyncio.run(translate_all())
```

---

**지난 글:** [AI 정보 추출 파이프라인: 비정형 데이터에서 구조화 데이터로](/posts/app-extraction/)

**다음 글:** [AI 폼·서류 자동화: OCR부터 자동 입력까지](/posts/app-form-automation/)

<br>
읽어주셔서 감사합니다. 😊
