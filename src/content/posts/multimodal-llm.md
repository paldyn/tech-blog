---
title: "멀티모달 LLM: 텍스트·이미지·오디오를 함께 이해하는 AI 완전 해설"
description: "멀티모달 LLM의 입력 인코더·프로젝션·LLM 디코더 구조, GPT-4o·Claude·Gemini 멀티모달 아키텍처 비교, Python API 실전 코드까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["멀티모달LLM", "GPT-4o", "Gemini", "Claude", "이미지이해", "멀티모달AI", "비전언어모델"]
featured: false
draft: false
---

[지난 글](/posts/audio-music-generation/)에서 MusicGen·AudioCraft·Suno AI 같은 AI 음악 생성 기술을 다뤘다. 이번 글부터는 시리즈의 큰 전환점으로, 텍스트뿐 아니라 이미지·오디오·비디오 등 여러 종류의 정보를 **동시에 이해하고 생성**하는 멀티모달 AI 영역을 파고든다. GPT-4o가 처음 등장했을 때 이미지를 보고 코드를 짜거나, 수식이 담긴 사진을 풀어내는 모습에 많은 이들이 놀랐다. 그 이면에는 어떤 구조가 숨어 있을까?

## 멀티모달 LLM이란?

기존 LLM은 텍스트만을 다루는 **단일 모달(unimodal)** 모델이었다. GPT-3, LLaMA, Mistral 등은 뛰어난 언어 능력을 갖췄지만, 이미지나 소리 같은 비텍스트 입력은 처리하지 못했다. 반면 **멀티모달 LLM(Multimodal LLM)**은 서로 다른 형태의 데이터를 하나의 모델에서 통합 처리한다.

"모든 것을 하나의 모델로"라는 비전은 사실 인간의 인지 방식과 닮았다. 우리는 음식 사진을 보면서 이름을 떠올리고, 음악을 들으며 감정을 느끼고, 도표를 읽으며 수치를 해석한다. 멀티모달 LLM은 이 모든 과정을 하나의 통합 표현 공간(unified representation space)에서 처리함으로써 "진정한 AI 비서"에 한 걸음 가까워졌다.

단일 모달과 멀티모달의 핵심 차이는 **입력 파이프라인**에 있다. 텍스트 전용 LLM은 토크나이저 하나로 모든 입력을 처리하지만, 멀티모달 LLM은 모달리티별 인코더가 각자 특징을 추출하고, 이를 하나의 임베딩 공간으로 통합하는 과정이 필요하다.

## 멀티모달 LLM 아키텍처

![멀티모달 LLM 아키텍처](/assets/posts/multimodal-llm-architecture.svg)

멀티모달 LLM의 아키텍처는 크게 세 단계로 나뉜다.

### 비전 인코더 (CLIP / SigLIP / ViT)

이미지를 LLM이 이해할 수 있는 벡터로 변환하는 첫 번째 관문이다. 가장 널리 쓰이는 방식은 **CLIP(Contrastive Language-Image Pre-training)** 기반의 ViT(Vision Transformer)다. 이미지를 16×16 또는 14×14 픽셀 단위의 패치로 분할하고, 각 패치를 토큰처럼 처리해 시퀀스로 변환한다.

Google이 제안한 **SigLIP**은 CLIP의 소프트맥스 기반 대조 손실 대신 시그모이드 손실을 사용해 학습 안정성을 높인다. Gemini 시리즈는 SigLIP을 기반으로 한 비전 인코더를 채택한다. 최신 모델들은 고해상도 이미지 처리를 위해 이미지를 여러 타일로 분할해 각각 인코딩하는 **타일링(tiling)** 전략도 활용한다.

### 프로젝션 / 어댑터 레이어

비전 인코더와 LLM 디코더는 서로 다른 임베딩 차원을 사용한다. 이 간극을 메우는 것이 **프로젝션 레이어**다. 가장 단순한 형태는 선형 변환(Linear Projection)이고, LLaVA가 이 방식을 채택했다. 더 복잡한 방법으로는 BLIP2의 **Q-Former(Querying Transformer)**가 있다. Q-Former는 학습 가능한 32개의 쿼리 토큰을 통해 이미지의 핵심 정보를 선택적으로 추출한다.

```python
# 비전 인코더 → 프로젝션 → LLM 개념 구조 (의사 코드)
image_features = vision_encoder(image)  # (B, num_patches, d_vision)
projected = projection_layer(image_features)  # (B, num_tokens, d_llm)
text_tokens = tokenizer(text_prompt)
combined = concat([projected, text_tokens], dim=1)
output = llm_decoder(combined)
```

### LLM 디코더

프로젝션된 멀티모달 토큰과 텍스트 토큰이 합쳐진 시퀀스를 처리하는 핵심 모듈이다. Self-Attention은 모든 토큰 간의 관계를 모델링하고, Cross-Attention은 필요한 경우 이미지 특징을 참조한다. Transformer 블록을 N개 쌓은 구조로, GPT 계열, LLaMA, Gemini 등 다양한 베이스 LLM이 사용된다.

## 주요 모델 비교

### GPT-4o: 진정한 end-to-end 멀티모달

OpenAI의 GPT-4o("o"는 omni의 약자)는 텍스트·이미지·오디오를 하나의 모델에서 네이티브로 처리하는 **진정한 end-to-end 멀티모달 모델**이다. 이전 GPT-4V가 별도의 비전 모듈을 결합한 방식이었다면, GPT-4o는 처음부터 멀티모달 데이터로 함께 훈련된다. 특히 실시간 음성 대화, 표정 인식, 이미지 내 OCR에서 뛰어난 성능을 보인다.

### Gemini 1.5 Pro: 네이티브 멀티모달

Google DeepMind의 Gemini 시리즈는 출시 초기부터 멀티모달 네이티브를 표방했다. Gemini 1.5 Pro는 **100만 토큰의 컨텍스트 윈도우**를 지원해 긴 비디오나 방대한 문서를 통째로 처리할 수 있다. 1시간짜리 영상에서 특정 장면을 찾거나, 수백 페이지 PDF를 요약하는 작업에서 두각을 나타낸다. 비전 인코더로는 SigLIP 기반 ViT를 사용한다.

### Claude 3.5+: 이미지·문서 분석

Anthropic의 Claude 시리즈는 3.0부터 이미지 입력을 지원하기 시작했으며, Claude 3.5 Sonnet과 Claude 3.5 Haiku는 빠른 이미지 분석과 문서 이해에서 강점을 보인다. 특히 **차트·그래프·다이어그램** 해석과 **손으로 쓴 텍스트(OCR)** 인식에서 높은 정확도를 보이며, 긴 맥락에서의 일관성이 뛰어나다는 평가를 받는다.

| 모델 | 이미지 | 오디오 | 비디오 | 컨텍스트 |
|---|---|---|---|---|
| GPT-4o | ✓ | ✓ (네이티브) | ✓ | 128K |
| Gemini 1.5 Pro | ✓ | ✓ | ✓ | 1M |
| Claude 3.5+ | ✓ | — | — | 200K |

## 멀티모달 능력

### 이미지 캡셔닝·VQA·OCR

**이미지 캡셔닝(Image Captioning)**은 이미지를 입력받아 자연어 설명을 생성하는 가장 기본적인 멀티모달 능력이다. **VQA(Visual Question Answering)**는 이미지와 질문을 함께 입력받아 답변을 생성한다. "이 이미지에서 사람이 몇 명인가요?"처럼 단순 카운팅부터 "이 그림의 화가는 누구일 것 같나요?"처럼 추론이 필요한 질문까지 처리한다.

**OCR(Optical Character Recognition)**은 이미지 속 텍스트를 인식하는 능력이다. 멀티모달 LLM의 OCR은 단순 텍스트 추출을 넘어, 인식된 텍스트의 **맥락**까지 이해한다. 영수증 사진에서 총액을 추출하거나, 표지판 사진에서 국가·언어를 판단하는 식이다.

### 차트·다이어그램 해석

멀티모달 LLM은 막대그래프·꺾은선 그래프·파이 차트 등의 데이터 시각화를 읽고 데이터를 추출하거나 트렌드를 해석한다. 건축 도면이나 UML 다이어그램, 회로도 같은 복잡한 다이어그램도 구조를 파악해 설명할 수 있다. 이 능력은 데이터 분석 워크플로우 자동화에서 특히 유용하다.

### 문서 이해 (PDF 등)

PDF·Word 문서·슬라이드에 포함된 텍스트와 이미지를 함께 이해하는 능력이다. 텍스트 파싱만으로는 레이아웃·표·그림 정보가 손실되는 경우가 많지만, 멀티모달 LLM은 문서를 이미지로 렌더링해 시각적 구조 전체를 파악한다.

## 실전 API 사용

![Anthropic Claude API 이미지 분석](/assets/posts/multimodal-llm-code.svg)

### Anthropic Claude API 이미지 분석

위 SVG에 표시된 코드처럼, Anthropic의 Python SDK를 사용하면 Base64 인코딩된 이미지를 메시지에 포함해 Claude에게 분석을 요청할 수 있다.

```python
import anthropic
import base64

client = anthropic.Anthropic()

with open("image.jpg", "rb") as f:
    img_data = base64.b64encode(f.read()).decode()

msg = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": img_data
                }
            },
            {
                "type": "text",
                "text": "이 이미지를 설명해 주세요."
            }
        ]
    }]
)
print(msg.content[0].text)
```

URL 방식으로도 이미지를 전달할 수 있다:

```python
# URL 방식 (공개 이미지)
msg = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "url",
                    "url": "https://example.com/image.jpg"
                }
            },
            {"type": "text", "text": "차트의 최댓값은?"}
        ]
    }]
)
```

### OpenAI GPT-4V API 비교

OpenAI API는 `content` 배열에 이미지 URL 또는 Base64를 직접 포함한다:

```python
from openai import OpenAI

client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "image_url",
                "image_url": {
                    "url": "https://example.com/chart.png",
                    "detail": "high"  # low / high / auto
                }
            },
            {"type": "text", "text": "이 차트를 분석해 주세요."}
        ]
    }],
    max_tokens=1024
)
print(response.choices[0].message.content)
```

`detail` 파라미터로 이미지 해상도 처리 방식을 조절할 수 있다. `high`는 고해상도 분석(타일링 적용)을, `low`는 빠른 저해상도 분석을 수행한다.

## 멀티모달 학습 방법

### 멀티모달 사전학습

멀티모달 모델의 핵심 학습 전략은 대규모 **이미지-텍스트 쌍 데이터**를 활용한 사전학습이다. CLIP은 인터넷에서 수집한 4억 쌍의 이미지-텍스트 데이터로 대조 학습(contrastive learning)을 수행해 이미지와 텍스트를 동일한 임베딩 공간에 정렬한다. Flamingo(DeepMind)는 대규모 이미지-텍스트 인터리빙 데이터로 사전학습해 few-shot 멀티모달 능력을 획득했다.

### 인스트럭션 튜닝 (LLaVA 방식)

사전학습된 멀티모달 모델을 실제 대화에 맞게 미세조정하는 과정이 **비주얼 인스트럭션 튜닝(Visual Instruction Tuning)**이다. LLaVA는 GPT-4에게 이미지 캡션을 제공하고, GPT-4가 해당 이미지에 대한 질문-답변 쌍을 자동 생성하는 방식을 사용한다. 이렇게 생성된 **158K개의 합성 데이터**로 LLaMA를 파인튜닝해 강력한 비주얼 인스트럭션 팔로잉 능력을 달성했다.

```python
# LLaVA 스타일 인스트럭션 데이터 예시 구조
{
    "image": "path/to/image.jpg",
    "conversations": [
        {
            "from": "human",
            "value": "<image>\n이 이미지에서 보이는 동물의 이름은?"
        },
        {
            "from": "gpt",
            "value": "이미지에는 황금 리트리버 강아지가 있습니다..."
        }
    ]
}
```

## 한계와 과제

### 환각 (이미지 설명 오류)

멀티모달 LLM은 텍스트 LLM과 마찬가지로 **환각(hallucination)** 문제에서 자유롭지 않다. 특히 이미지에 없는 객체를 있다고 설명하거나, 텍스트의 세부 내용을 잘못 읽는 오류가 발생한다. 예를 들어 이미지에 있는 간판의 글자를 틀리게 읽거나, 사람 수를 잘못 세는 경우가 있다. POPE(Polling-based Object Probing Evaluation) 같은 벤치마크는 이런 이미지 환각을 체계적으로 평가한다.

### 공간적 추론 한계

"왼쪽 사람의 오른쪽에 있는 물체는?" 같은 **공간적 관계(spatial reasoning)** 질문에서 멀티모달 LLM은 아직 인간 수준에 미치지 못한다. 이미지 내 객체의 위치·크기·거리 관계를 정확히 파악하는 것은 여전히 어려운 문제다. 또한 미세한 시각적 차이를 구별하는 **세밀 분류(fine-grained classification)** 작업에서도 오류율이 높다.

이러한 한계들을 극복하기 위해 **체인-오브-쏘트(Chain-of-Thought) 시각 추론**, 이미지를 여러 영역으로 분할해 처리하는 **Region-based 접근**, 그리고 더 많은 이미지 특징을 활용하는 **고해상도 처리** 기법들이 연구되고 있다. 다음 글에서는 멀티모달 AI의 토대가 된 비전-언어 모델(VLM)의 구체적인 구조를 CLIP·BLIP2·LLaVA를 중심으로 해설한다.

---

**지난 글:** [AI 음악 생성: MusicGen·AudioCraft·Suno AI 완전 해설](/posts/audio-music-generation/)

**다음 글:** [비전-언어 모델(VLM): CLIP·BLIP2·LLaVA 완전 해설](/posts/multimodal-vlm/)

<br>
읽어주셔서 감사합니다. 😊
