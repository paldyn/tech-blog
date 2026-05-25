---
title: "AI 워터마킹: AI 생성 콘텐츠를 추적하는 기술"
description: "토큰 편향·의미론적·주파수 도메인 등 AI 워터마킹 기법을 분류하고, Kirchenbauer의 LLM 워터마크 원리와 Google SynthID를 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["AI워터마킹", "SynthID", "LLM워터마크", "AI생성탐지", "딥페이크탐지", "C2PA", "콘텐츠출처"]
featured: false
draft: false
---

[지난 글](/posts/ai-jailbreak/)에서 LLM 탈옥 공격과 방어를 다뤘다. AI가 생성한 콘텐츠가 폭발적으로 늘면서 새로운 문제가 생겼다. "이게 인간이 쓴 글인가, AI가 만든 이미지인가?" **AI 워터마킹**은 생성 단계에서 보이지 않는 신호를 심어 나중에 AI 생성 여부를 검출하는 기술이다.

## 왜 AI 워터마킹이 필요한가

딥페이크 이미지가 선거 여론을 조작하고, LLM이 쓴 논문이 학술 저널에 제출되며, AI 생성 뉴스가 사실인 척 유포된다. 단순히 "AI 탐지기"로 사후 판별하는 것보다, 생성 단계에서 검출 가능한 신호를 심으면 더 신뢰할 수 있다. EU AI Act는 AI 생성 콘텐츠에 표시 의무를 부과하고 있다.

## 텍스트 워터마킹: 토큰 편향 방법

2023년 John Kirchenbauer 등이 제안한 방법이 현재 가장 많이 연구된다.

**작동 원리**: 텍스트를 생성할 때마다 이전 토큰을 시드로 어휘를 Green(선호)/Red(비선호) 두 그룹으로 나눈다. 생성 시 Green 토큰의 logit을 δ만큼 높여 선택 확률을 높인다. 비밀 키를 모르면 이 패턴을 탐지할 수 없다.

```python
# 토큰 편향 워터마크 개념 구현
import hashlib
import torch

def get_green_list(prev_token_id, secret_key, vocab_size, gamma=0.5):
    """이전 토큰으로 Green 목록 결정"""
    seed = int(hashlib.sha256(
        f"{secret_key}{prev_token_id}".encode()
    ).hexdigest(), 16) % (2**32)
    rng = torch.Generator()
    rng.manual_seed(seed)
    # 어휘의 gamma 비율을 Green으로 지정
    perm = torch.randperm(vocab_size, generator=rng)
    green_count = int(vocab_size * gamma)
    return set(perm[:green_count].tolist())

def watermarked_generate(logits, prev_token_id, secret_key, delta=2.0):
    """Green 토큰 logit을 delta만큼 증가"""
    green_list = get_green_list(prev_token_id, secret_key, len(logits))
    logits_copy = logits.clone()
    for idx in green_list:
        logits_copy[idx] += delta
    return logits_copy

def detect_watermark(text_tokens, secret_key, vocab_size, gamma=0.5):
    """Green 토큰 비율로 워터마크 검출"""
    green_count = 0
    for i in range(1, len(text_tokens)):
        green_list = get_green_list(
            text_tokens[i-1], secret_key, vocab_size, gamma
        )
        if text_tokens[i] in green_list:
            green_count += 1

    green_ratio = green_count / (len(text_tokens) - 1)
    # 인간 작성: ~0.5, 워터마크: ~0.5 + delta 효과
    return green_ratio, green_ratio > 0.6  # 임계값
```

![AI 워터마킹 기법](/assets/posts/ai-watermarking-methods.svg)

![토큰 편향 워터마크 작동 원리](/assets/posts/ai-watermarking-detection.svg)

## Google SynthID: 실제 배포된 워터마킹

Google은 Gemini 모델의 텍스트·이미지·오디오·비디오 출력에 SynthID 워터마킹을 적용한다.

```python
# SynthID 텍스트 워터마크 (Google 공개 라이브러리)
from synthid_text import logits_processing, hashing

# 워터마크 설정
config = {
    "ngram_len": 5,      # n-gram 컨텍스트 길이
    "keys": [654, 400],  # 여러 레이어의 비밀 키
    "sampling_table_size": 2**16,
    "sampling_table_seed": 0,
    "context_history_size": 1024,
}

# 생성 시 자동 적용 (Hugging Face transformers 통합)
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("google/gemma-2b")
# SynthID LogitsProcessor를 추가해 워터마크 삽입
```

SynthID 이미지 워터마크는 픽셀 도메인이 아닌 latent space에서 작동해 압축, 크롭, 색상 조정 등에 강인하다.

## C2PA: 콘텐츠 출처 표준

**C2PA(Coalition for Content Provenance and Authenticity)**는 Adobe, Microsoft, Google 등이 주도하는 미디어 출처 표준이다.

```json
{
  "c2pa": {
    "assertions": [{
      "label": "c2pa.ai.generative",
      "data": {
        "prompt": "a photorealistic cat in space",
        "model": "stable-diffusion-xl-1.0",
        "generator": "Adobe Firefly",
        "timestamp": "2026-05-25T10:30:00Z"
      }
    }],
    "signature": {
      "algorithm": "ES256",
      "cert": "...(Adobe 인증서)..."
    }
  }
}
```

이미지·비디오 파일에 디지털 서명된 메타데이터를 첨부해 생성 도구, 모델, 편집 이력을 추적한다. Photoshop, Premiere Pro, Bing Image Creator 등에서 이미 적용 중이다.

## AI 생성 탐지의 한계

**의역 공격(Paraphrase Attack)**: 워터마크 텍스트를 다른 모델로 의역하면 Green 토큰 패턴이 깨진다.

**탐지기의 오류율**: 워터마크 없이 AI 생성 탐지를 하면 오탐(인간 글을 AI로 판정)이 문제다. OpenAI가 자사 AI 탐지기를 서비스 종료한 이유 중 하나다.

**멀티모달 공격**: 이미지를 스크린샷으로 찍거나 재인코딩하면 일부 워터마크가 손실된다.

이런 한계에도 불구하고, 워터마킹은 "AI 생성 추정"의 증거로서 법적·사회적 맥락에서 유용하다. 완벽한 탐지보다 책임 추적(Attribution)의 도구로 이해하는 것이 현실적이다.

---

**지난 글:** [AI 탈옥(Jailbreak): 공격 유형과 방어 전략](/posts/ai-jailbreak/)

**다음 글:** [AI 규제: 전 세계 AI 법안과 거버넌스 현황](/posts/ai-regulation/)

<br>
읽어주셔서 감사합니다. 😊
