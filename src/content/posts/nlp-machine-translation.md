---
title: "기계 번역: 언어의 장벽을 넘는 기술"
description: "규칙 기반·통계 기반·신경망 기반 MT의 발전사부터 Transformer 인코더-디코더 구조, NLLB-200 활용, BLEU/COMET 평가, 한국어 번역 특수성까지 기계 번역의 전체 기술 스택을 실전 코드로 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["기계번역", "NMT", "Transformer", "NLLB", "BLEU", "COMET", "다국어", "한국어번역"]
featured: false
draft: false
---

[지난 글](/posts/nlp-question-answering/)에서 문서에서 정답을 찾는 질의응답 기술을 다뤘다. 이번에는 언어 자체를 다른 언어로 변환하는 **기계 번역(Machine Translation, MT)**을 살펴본다. "Hello"를 "안녕하세요"로 번역하는 단순한 작업처럼 보이지만, 언어 간 어순 차이, 경어법, 문화적 뉘앙스, 중의성 해소 등 수많은 언어적 도전이 숨어 있다. 기계 번역은 NLP 역사상 가장 오랫동안 연구된 분야 중 하나이며, Transformer 아키텍처가 탄생하게 된 직접적인 계기이기도 하다.

## 기계 번역의 발전사

### 1세대: 규칙 기반 (1950s~1980s)

언어학자들이 직접 작성한 문법 규칙과 이중언어 사전을 사용했다. 정밀하지만 규칙 유지 비용이 천문학적이었다. 유럽연합 같은 규칙이 명확한 도메인에서는 지금도 활용된다.

### 2세대: 통계 기반 SMT (1990s~2010s)

IBM 모델부터 구절 기반 SMT(Phrase-Based SMT)까지, 대규모 병렬 코퍼스에서 번역 확률을 학습했다. 구글 번역이 2006년까지 사용한 방식이다. 언어 모델 확률과 번역 확률을 결합해 최적 번역을 찾지만, 장거리 의존성 처리가 약점이었다.

### 3세대: 신경망 기반 NMT (2014~현재)

RNN seq2seq → Attention 메커니즘 → Transformer로 빠르게 발전했다. 구글이 2016년 Transformer 기반 NMT로 전환하며 품질이 급격히 향상됐다. 현재 상용 서비스(구글 번역, DeepL, 파파고)는 모두 Transformer 기반이다.

## Transformer 번역 아키텍처

![Transformer 기반 기계 번역 아키텍처](/assets/posts/nlp-machine-translation-architecture.svg)

번역은 **인코더-디코더** 구조의 대표적인 응용이다.

**인코더:** 소스 문장의 모든 토큰을 동시에 처리해 양방향 문맥을 이해한다. 각 토큰이 서로를 어텐션할 수 있는 Self-Attention이 핵심이다.

**디코더:** 타겟 언어로 토큰을 하나씩 자동회귀적으로 생성한다. Masked Self-Attention으로 이미 생성된 토큰만 참조하고, **Cross-Attention**으로 인코더의 소스 표현을 참조한다. Cross-Attention이 "번역의 심장"이다. 어떤 소스 단어에 집중해서 타겟 단어를 생성할지를 동적으로 결정한다.

## NLLB-200: 200개 언어 동시 지원

Meta의 NLLB-200(No Language Left Behind)은 200개 언어 간 번역을 지원하는 다국어 모델이다. 특히 저자원 언어(low-resource language)에서 탁월한 성능을 보인다.

![NLLB-200 한국어 번역 코드](/assets/posts/nlp-machine-translation-code.svg)

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

model_name = "facebook/nllb-200-distilled-600M"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSeq2SeqLM.from_pretrained(model_name)

def translate(text: str, src_lang: str, tgt_lang: str) -> str:
    tokenizer.src_lang = src_lang
    inputs = tokenizer(
        text,
        return_tensors="pt",
        max_length=512,
        truncation=True,
    )
    tgt_lang_id = tokenizer.lang_code_to_id[tgt_lang]
    generated = model.generate(
        **inputs,
        forced_bos_token_id=tgt_lang_id,
        num_beams=5,
        max_length=512,
        length_penalty=1.0,
        no_repeat_ngram_size=3,
    )
    return tokenizer.decode(generated[0], skip_special_tokens=True)

# 한→영
print(translate("삼성전자가 반도체 분야에서 세계 1위를 기록했다.",
                "kor_Hang", "eng_Latn"))
# → "Samsung Electronics ranked number one in the semiconductor sector."

# 한→일
print(translate("오늘 날씨가 매우 좋습니다.",
                "kor_Hang", "jpn_Jpan"))
# → "今日の天気はとても良いです。"

# 한→중
print(translate("안녕하세요, 만나서 반갑습니다.",
                "kor_Hang", "zho_Hans"))
# → "您好，很高兴认识您。"
```

## 평가 지표

### BLEU (Bilingual Evaluation Understudy)

가장 널리 사용되는 자동 평가 지표로, 생성된 번역과 참조 번역 사이의 n-gram 겹침 비율을 측정한다.

```python
from sacrebleu.metrics import BLEU, CHRF, TER

bleu = BLEU()
chrf = CHRF()

hypotheses = ["The stock market fell sharply today."]
references = [["Today the stock market dropped significantly."]]

print(bleu.corpus_score(hypotheses, references))
# BLEU = 23.22 ...

print(chrf.corpus_score(hypotheses, references))
# chrF2 = 47.64 ...
```

BLEU의 한계: 의미는 같지만 표현이 다른 번역을 낮게 평가한다. 예를 들어 "car"와 "automobile"은 같은 의미지만 겹치지 않는다. 이를 보완하기 위해 **ChrF(문자 n-gram), COMET(신경망 기반 품질 추정)**을 병용한다.

### COMET

```python
# pip install unbabel-comet
from comet import download_model, load_from_checkpoint

model_path = download_model("Unbabel/wmt22-comet-da")
comet_model = load_from_checkpoint(model_path)

data = [
    {
        "src": "나는 학교에 간다",
        "mt":  "I go to school",
        "ref": "I am going to school",
    }
]

output = comet_model.predict(data, batch_size=8)
print(output.scores)  # [0.87] — 0~1 스케일
```

## 한국어 번역의 특수성

**교착어 특성:** 한국어는 어미·조사가 의미를 결정한다. "가다", "가서", "갔다", "갈 것이다"는 모두 다른 시제/문법 정보를 담는다. 번역 모델이 이를 정확히 처리하려면 형태소 수준 정보가 도움이 된다.

**경어법:** 한국어의 존댓말 체계는 영어·중국어에 없는 복잡한 층위를 가진다. "먹다"→"드시다"→"잡수시다"의 계층을 맥락 없이 번역하면 불자연스러운 결과가 나온다.

**어순 차이:** 한국어는 SOV, 영어는 SVO. 특히 긴 관계절이 포함된 복문에서 어순 역전 처리가 번역 품질을 좌우한다. Transformer의 어텐션 메커니즘이 이 장거리 재정렬 문제를 해결하는 데 탁월하다.

**한자어 처리:** 한국어의 60% 이상이 한자어 어원이다. 한자권 언어(중·일)와의 번역에서 한자어 대응이 자연스럽게 이루어지지만, 영어나 유럽어 번역 시에는 한자어를 풀어쓰는 과정이 필요하다.

## 실무 적용 선택 가이드

| 상황 | 추천 솔루션 |
|---|---|
| 범용 번역, 빠른 구현 | Google Translate API / DeepL API |
| 오프라인/로컬 실행 | Helsinki-NLP/opus-mt, NLLB-200 |
| 저자원 언어 포함 | NLLB-200-distilled-1.3B |
| 고품질 도메인 특화 | NLLB 파인튜닝 or GPT-4o |
| 대용량 배치 처리 | CTranslate2 + NLLB |

기계 번역은 LLM 시대에 더욱 발전했다. GPT-4o, Claude 같은 대형 모델은 문맥과 뉘앙스를 고려한 번역에서 전문 번역 모델을 능가하는 경우도 있다. 하지만 대용량·저지연 배포에는 여전히 특화 모델이 유리하다.

---

**지난 글:** [질의응답: 문서에서 답을 찾는 기술](/posts/nlp-question-answering/)

**다음 글:** [텍스트 생성: 언어 모델이 글을 쓰는 방법](/posts/nlp-text-generation/)

<br>
읽어주셔서 감사합니다. 😊
