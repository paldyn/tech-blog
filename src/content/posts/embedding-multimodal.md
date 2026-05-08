---
title: "멀티모달 임베딩: 텍스트와 이미지를 같은 공간에"
description: "CLIP의 대조 학습 원리부터 zero-shot 분류, 이미지-텍스트 검색, 그리고 ImageBind의 6가지 모달리티 통합까지 멀티모달 임베딩의 핵심을 코드와 함께 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["멀티모달", "CLIP", "임베딩", "대조학습", "Zero-Shot", "ImageBind", "Vision Transformer"]
featured: false
draft: false
---

[지난 글](/posts/embedding-sentence/)에서 SBERT가 문장을 고정 크기 벡터로 변환하여 의미 검색을 가능하게 하는 방법을 살펴봤다. 이번에는 그 아이디어를 텍스트의 경계 너머로 확장한다. **멀티모달 임베딩(Multimodal Embedding)**은 이미지, 텍스트, 오디오 등 서로 다른 형태의 데이터를 **하나의 공유 벡터 공간**에 배치하는 기술이다. 가장 대표적인 모델은 OpenAI가 2021년에 발표한 **CLIP(Contrastive Language–Image Pre-training)**으로, 이미지와 텍스트를 동일한 512차원 공간에 정렬함으로써 "고양이 사진"을 검색하면 레이블 없이도 고양이가 있는 이미지를 찾아낼 수 있게 해 준다.

## 왜 멀티모달인가

전통적인 컴퓨터 비전은 이미지 분류를 "분류기(classifier)" 문제로 다뤘다. 모델을 학습할 때 1,000개 클래스를 고정해 두고, 새로운 카테고리가 생기면 전체 모델을 다시 학습해야 했다. 그리고 텍스트와 이미지는 완전히 별개의 모델로 처리됐다.

**멀티모달 임베딩**이 바꾼 것은 단순하지만 강력하다. 이미지 벡터와 텍스트 벡터를 **같은 공간**에 배치하면, 두 모달리티 사이의 유사도를 코사인 유사도 하나로 측정할 수 있다. "a photo of a dog"이라는 텍스트 벡터와 강아지 사진의 이미지 벡터는 가깝고, 고양이 사진의 벡터는 멀어진다. 이 단순한 원리가 zero-shot 분류, 크로스모달 검색, 이미지 캡셔닝 등 수많은 응용의 기반이 된다.

![CLIP 아키텍처 다이어그램](/assets/posts/embedding-multimodal-clip.svg)

## CLIP의 핵심: 대조 학습

CLIP은 인터넷에서 수집한 **4억 개의 이미지-텍스트 쌍**으로 학습됐다. 학습 방식은 지도 학습도, 비지도 학습도 아닌 **대조 학습(Contrastive Learning)**이다.

### 아키텍처 구성

CLIP은 두 개의 인코더로 구성된다.

**이미지 인코더(Image Encoder):** Vision Transformer(ViT) 또는 ResNet이 입력 이미지를 처리한다. ViT는 이미지를 16×16 픽셀 패치로 분할하고, 각 패치를 토큰으로 취급하여 Transformer의 Self-Attention으로 전역적인 패턴을 학습한다. 최종 [CLS] 토큰의 표현이 이미지 전체를 요약하는 벡터가 된다.

**텍스트 인코더(Text Encoder):** GPT 스타일의 Transformer가 텍스트를 처리한다. 토큰화된 텍스트를 받아 [EOS] 토큰의 표현을 텍스트 전체의 요약 벡터로 사용한다.

두 인코더의 출력은 각각 **선형 투영(Linear Projection)** 레이어를 통과한 뒤 L2 정규화되어 512차원 구 위의 단위 벡터가 된다. 이 공간이 이미지와 텍스트가 만나는 곳이다.

### 대조 손실: N×N 유사도 행렬

배치 크기 N일 때 CLIP은 다음을 수행한다.

1. N개의 이미지 벡터 `[I₁, I₂, ..., Iₙ]`와 N개의 텍스트 벡터 `[T₁, T₂, ..., Tₙ]`를 계산한다.
2. 모든 조합의 코사인 유사도를 계산하여 N×N 행렬을 구성한다.
3. 대각선(Iₖ-Tₖ 쌍, 즉 실제 매칭 쌍)의 유사도는 **최대화**, 나머지 N²-N개의 비매칭 쌍은 **최소화**한다.

손실 함수는 이미지→텍스트 방향과 텍스트→이미지 방향의 교차 엔트로피 손실 평균이다.

```python
import torch
import torch.nn.functional as F

def clip_loss(image_embeddings, text_embeddings, temperature=0.07):
    """
    image_embeddings: (N, D) - L2 정규화된 이미지 벡터
    text_embeddings:  (N, D) - L2 정규화된 텍스트 벡터
    """
    # N×N 유사도 행렬 (온도 스케일링 적용)
    logits = (image_embeddings @ text_embeddings.T) / temperature
    
    # 레이블: 대각선 인덱스 (0, 1, 2, ..., N-1)
    labels = torch.arange(len(logits), device=logits.device)
    
    # 이미지→텍스트, 텍스트→이미지 양방향 손실
    loss_i2t = F.cross_entropy(logits, labels)
    loss_t2i = F.cross_entropy(logits.T, labels)
    
    return (loss_i2t + loss_t2i) / 2
```

온도 파라미터(temperature)는 학습 가능한 파라미터로, 유사도 분포의 날카로움을 조절한다. CLIP은 이 온도를 `log(1/τ)`로 파라미터화하여 학습한다.

## Zero-Shot 이미지 분류

CLIP의 가장 놀라운 능력은 **학습하지 않은 클래스도 분류**할 수 있다는 것이다. 방법은 간단하다.

1. 분류할 클래스 목록을 `"a photo of a {class}"` 형태의 텍스트 프롬프트로 변환한다.
2. 각 프롬프트를 텍스트 인코더로 임베딩한다.
3. 분류할 이미지를 이미지 인코더로 임베딩한다.
4. 이미지 벡터와 가장 유사한 텍스트 벡터의 클래스를 예측한다.

```python
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import torch

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

# 분류할 클래스 정의
classes = ["고양이", "강아지", "새", "물고기"]
texts = [f"a photo of a {c}" for c in classes]

# 이미지 로드 (예시)
image = Image.open("animal.jpg")

# 입력 처리
inputs = processor(
    text=texts,
    images=image,
    return_tensors="pt",
    padding=True
)

# 유사도 계산
with torch.no_grad():
    outputs = model(**inputs)
    logits_per_image = outputs.logits_per_image  # shape: (1, 4)
    probs = logits_per_image.softmax(dim=1)

# 결과 출력
for cls, prob in zip(classes, probs[0]):
    print(f"{cls}: {prob:.3f}")
# 예시 출력: 고양이: 0.812, 강아지: 0.106, 새: 0.052, 물고기: 0.030
```

ImageNet에서 CLIP은 ResNet-50 수준의 zero-shot 성능을 달성했다. 이는 ImageNet 레이블 하나도 학습하지 않고 달성한 성능이다.

![CLIP 코드 예제](/assets/posts/embedding-multimodal-code.svg)

## 이미지-텍스트 검색

멀티모달 임베딩의 또 다른 핵심 응용은 **크로스모달 검색(Cross-modal Retrieval)**이다.

**텍스트→이미지 검색:** 텍스트 쿼리를 임베딩하고, 이미지 데이터베이스에서 가장 가까운 벡터를 찾는다. "붉은 드레스를 입은 여성" 같은 복잡한 설명으로도 검색할 수 있다.

**이미지→텍스트 검색:** 이미지를 쿼리로 사용하여 관련 캡션이나 문서를 찾는다. 사진을 찍으면 관련 Wikipedia 문서를 찾아주는 기능이 이에 해당한다.

```python
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

def build_image_index(image_paths, model, processor):
    """이미지 데이터베이스의 임베딩 인덱스 구축"""
    embeddings = []
    for path in image_paths:
        img = Image.open(path)
        inputs = processor(images=img, return_tensors="pt")
        with torch.no_grad():
            feat = model.get_image_features(**inputs)
            feat = feat / feat.norm(dim=-1, keepdim=True)  # L2 정규화
        embeddings.append(feat.numpy())
    return np.vstack(embeddings)

def text_to_image_search(query_text, image_index, model, processor, top_k=5):
    """텍스트 쿼리로 이미지 검색"""
    inputs = processor(text=[query_text], return_tensors="pt", padding=True)
    with torch.no_grad():
        text_feat = model.get_text_features(**inputs)
        text_feat = text_feat / text_feat.norm(dim=-1, keepdim=True)
    
    similarities = cosine_similarity(text_feat.numpy(), image_index)[0]
    top_indices = np.argsort(similarities)[::-1][:top_k]
    return top_indices, similarities[top_indices]
```

## 텍스트 프롬프트 엔지니어링

CLIP에서 텍스트 프롬프트의 형식은 성능에 큰 영향을 미친다. OpenAI의 실험 결과:

- `"dog"` 대신 `"a photo of a dog"` → 성능 향상
- `"a photo of a big dog"`, `"a photo of a small dog"` 처럼 세부 묘사 추가 → 추가 향상
- **앙상블 프롬프트:** 여러 프롬프트 텍스트 임베딩의 평균 → 가장 높은 성능

```python
# 앙상블 프롬프트 생성
templates = [
    "a photo of a {}.",
    "a blurry photo of a {}.",
    "a cropped photo of a {}.",
    "a good photo of a {}.",
    "a {} in the wild.",
]

def ensemble_text_embedding(classname, templates, model, processor):
    texts = [t.format(classname) for t in templates]
    inputs = processor(text=texts, return_tensors="pt", padding=True)
    with torch.no_grad():
        feats = model.get_text_features(**inputs)
        feats = feats / feats.norm(dim=-1, keepdim=True)
    # 평균 벡터를 다시 정규화
    mean_feat = feats.mean(dim=0)
    return mean_feat / mean_feat.norm()
```

## ImageBind: 6가지 모달리티의 통합

Meta AI가 2023년에 발표한 **ImageBind**는 CLIP의 아이디어를 극단적으로 확장했다. 이미지, 텍스트뿐 아니라 **오디오, 깊이 맵(Depth Map), 열화상(Thermal), IMU(관성 측정 장치)** 데이터까지 6가지 모달리티를 단일 임베딩 공간에 정렬한다.

핵심 아이디어는 **이미지를 중심 모달리티로 활용**하는 것이다. 이미지-텍스트 쌍(CLIP), 이미지-오디오 쌍(비디오의 소리), 이미지-깊이 쌍(RGB-D 카메라) 등을 각각 대조 학습으로 정렬하면, 이미지를 매개로 모든 모달리티가 간접적으로 연결된다.

결과적으로 오디오 클립을 쿼리로 이미지를 검색하거나, 텍스트로 음악을 검색하는 것이 가능해진다. 심지어 학습에 사용하지 않은 오디오-텍스트 쌍도 이미지를 다리로 삼아 유사도를 계산할 수 있다.

## CLIP의 한계

CLIP도 명확한 한계가 있다.

**카운팅 및 공간 관계:** "두 마리의 개" 또는 "개가 고양이 왼쪽에 있다" 같은 카운팅이나 공간 관계 표현에 취약하다. 텍스트 인코더가 이런 정밀한 개념을 충분히 캡처하지 못한다.

**세밀한 분류:** 조류의 종류, 자동차 모델명 등 전문적인 세밀 분류(fine-grained classification)에서는 전용 모델보다 성능이 낮다.

**분포 편향:** 인터넷 데이터로 학습됐기 때문에 편향이 심각하다. 특히 직업명과 인물 사진을 연결할 때 사회적 편향이 나타난다.

**한국어 지원:** 기본 CLIP은 영어 중심으로 학습됐다. 한국어 지원을 위해서는 `koclip` 또는 다국어 CLIP 변형 모델을 사용해야 한다.

```python
# 한국어 지원 CLIP (LAION 기반 multilingual CLIP)
from transformers import CLIPModel, CLIPProcessor

# 다국어 CLIP 모델 (한국어 포함)
model = CLIPModel.from_pretrained("laion/CLIP-ViT-B-32-laion2B-s34B-b79K")
processor = CLIPProcessor.from_pretrained("laion/CLIP-ViT-B-32-laion2B-s34B-b79K")

# 한국어 텍스트로 직접 이미지 검색 가능
texts = ["고양이 사진", "강아지 사진", "새 사진"]
```

## 실전 활용 사례

멀티모달 임베딩은 이미 다양한 제품에 적용됐다.

**전자상거래:** 상품 이미지를 업로드하면 유사한 상품을 검색하는 "비슷한 상품 찾기" 기능에 CLIP 임베딩이 활용된다.

**콘텐츠 모더레이션:** 부적절한 이미지를 텍스트 설명 없이도 탐지할 수 있다. "explicit content" 같은 텍스트 임베딩과의 유사도로 필터링한다.

**의료 영상:** 방사선 사진과 의학 보고서를 같은 공간에 정렬하여, 텍스트 쿼리로 유사한 환자 케이스를 검색하는 시스템을 구축할 수 있다.

**자율주행:** 카메라, LiDAR, 레이더 등 다양한 센서 데이터를 통합된 임베딩 공간에서 처리하여 더 강건한 환경 인식 시스템을 구현한다.

멀티모달 임베딩은 현재 AI 발전의 최전선에 있다. GPT-4o, Gemini 같은 최신 멀티모달 LLM들도 결국 이미지와 텍스트를 같은 공간에서 처리하는 이 원리를 발전시킨 것이다. 다음 글에서는 임베딩에서 잠시 벗어나 NLP의 근본으로 돌아가, 모델이 텍스트를 처리하기 전에 반드시 거쳐야 하는 **전처리(Preprocessing)** 단계를 깊이 다룬다.

---

**지난 글:** [문장 임베딩: SBERT와 의미 검색](/posts/embedding-sentence/)

**다음 글:** [NLP 텍스트 전처리: 데이터를 모델에 맞게 다듬다](/posts/nlp-text-preprocessing/)

<br>
읽어주셔서 감사합니다. 😊
