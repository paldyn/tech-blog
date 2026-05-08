---
title: "임베딩 기초: 단어를 벡터 공간에 배치하다"
description: "임베딩이 이산적인 토큰을 연속적인 고차원 벡터로 변환하는 원리, 임베딩 행렬의 구조, 코사인 유사도로 의미 관계를 측정하는 방법을 수식과 PyTorch 코드로 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["임베딩", "벡터", "Word2Vec", "코사인 유사도", "NLP", "LLM"]
featured: false
draft: false
---

[지난 글](/posts/tokenizer-tiktoken/)에서 tiktoken으로 텍스트를 정수 ID로 변환하는 방법을 살펴봤다. 이제 그 정수 ID들이 신경망으로 들어가기 전에 거치는 첫 번째 변환, **임베딩(Embedding)**을 다룬다. 임베딩은 이산적인 토큰 ID를 연속적인 고차원 실수 벡터로 바꾸는 과정이다. "개"와 "고양이"는 정수 ID 상으로는 아무 관계가 없지만, 임베딩 공간에서는 두 벡터가 가까이 위치하도록 학습된다. 이 개념이 현대 NLP와 LLM의 가장 근본적인 기반이다.

## 왜 임베딩이 필요한가

신경망은 실수 벡터를 입력으로 받는다. 토큰 ID(예: 9906)는 단순한 정수로, 이 숫자 자체에 의미가 없다. ID 9906과 9907이 의미적으로 비슷하다는 보장이 없다.

**원-핫 인코딩(One-Hot Encoding)**은 가장 단순한 해결책이다. 어휘 크기 V가 128K이면, 각 토큰을 128K 차원 벡터로 표현하고 해당 인덱스만 1, 나머지는 0으로 채운다.

```
"개" (ID=3024): [0, 0, ..., 1, ..., 0]  ← 128K 차원, 3024번 위치만 1
```

그러나 이 방식은 두 가지 문제가 있다. 첫째, 128K 차원의 희소 벡터는 메모리와 연산에서 매우 비효율적이다. 둘째, 모든 토큰 쌍의 내적이 0이므로 유사도를 표현할 수 없다.

**임베딩**은 이 128K 차원의 원-핫 벡터를 dense한 저차원 벡터(예: 4096차원)로 압축한다. 이 압축 과정에서 의미 정보가 학습된다.

## 임베딩 행렬: 가장 단순한 look-up table

구현상 임베딩은 행렬 곱이 아니라 단순한 **행 인덱싱**이다. `vocab_size × d_model` 크기의 행렬에서 토큰 ID에 해당하는 행을 추출한다.

```python
import torch
import torch.nn as nn

# vocab_size=128256, d_model=4096 (LLaMA 3 8B 기준)
embedding_layer = nn.Embedding(128256, 4096)

# 3개 토큰을 벡터로 변환
token_ids = torch.tensor([[9906, 11, 2787]])  # "Hello, world"
vectors = embedding_layer(token_ids)
print(vectors.shape)  # (1, 3, 4096)

# 내부 동작: 행렬에서 행 추출
# embedding_layer.weight: (128256, 4096)
# vectors[0, 0] == embedding_layer.weight[9906]  ← True
```

임베딩 행렬은 학습 파라미터다. 역전파를 통해 "유사한 맥락에서 등장하는 단어는 가까운 벡터를 갖도록" 자동으로 조정된다.

## 의미가 벡터 공간에 인코딩되는 방식

![임베딩 벡터 공간 시각화](/assets/posts/embedding-basics-space.svg)

Word2Vec(2013)이 처음으로 임베딩의 놀라운 성질을 보여줬다. 유사한 의미의 단어들은 클러스터를 형성하고, 의미 관계가 벡터 산술로 표현된다:

```python
# Word2Vec 유추 (의사코드)
vec("king") - vec("man") + vec("woman") ≈ vec("queen")
vec("서울") - vec("한국") + vec("일본") ≈ vec("도쿄")
```

이런 성질이 가능한 이유는 **분포 가설(Distributional Hypothesis)** 때문이다: 유사한 맥락에서 등장하는 단어는 유사한 의미를 갖는다. 대규모 말뭉치에서 학습하면 단어의 맥락 패턴이 벡터에 자연스럽게 인코딩된다.

## 코사인 유사도

벡터 공간에서 두 임베딩의 의미적 유사성을 측정하는 표준 지표는 **코사인 유사도**다:

```
similarity(a, b) = (a · b) / (‖a‖ · ‖b‖)
```

내적을 두 벡터의 크기로 나눠 방향만 비교한다. 결과는 -1(반대 방향)에서 1(같은 방향) 사이다.

![임베딩 레이어 구현과 유사도 계산](/assets/posts/embedding-basics-code.svg)

```python
import torch.nn.functional as F

# 두 단어 벡터의 유사도
vec_dog = embedding_layer(torch.tensor([dog_id]))    # "개"
vec_cat = embedding_layer(torch.tensor([cat_id]))    # "고양이"
vec_car = embedding_layer(torch.tensor([car_id]))    # "자동차"

sim_dog_cat = F.cosine_similarity(vec_dog, vec_cat, dim=-1)
sim_dog_car = F.cosine_similarity(vec_dog, vec_car, dim=-1)

# 잘 학습된 임베딩이라면:
# sim_dog_cat > sim_dog_car  ← 개-고양이가 개-자동차보다 유사
```

## 임베딩의 종류

현대 NLP에서 "임베딩"은 여러 의미로 쓰인다:

| 종류 | 설명 | 예시 |
|-----|------|-----|
| 토큰 임베딩 | LLM 내부의 look-up table | `nn.Embedding` |
| 정적 단어 임베딩 | 맥락 무관 벡터 | Word2Vec, GloVe |
| 문맥 임베딩 | 맥락에 따라 달라지는 벡터 | BERT 출력 |
| 문장 임베딩 | 문장 전체를 하나의 벡터로 | Sentence-BERT |
| 다중모달 임베딩 | 텍스트+이미지 공유 공간 | CLIP |

이 시리즈의 다음 글들에서 각각을 상세히 다룬다.

## 임베딩 행렬의 크기

임베딩 행렬은 큰 메모리를 차지한다:

```
LLaMA 3 8B: 128,256 × 4,096 × 2bytes(bf16) ≈ 1 GB
GPT-3:      50,257 × 12,288 × 2bytes ≈ 1.2 GB
```

LLM 파라미터의 약 5~15%가 임베딩 행렬이다. 이 때문에 LLM에서는 **입력 임베딩과 출력 프로젝션 행렬을 공유(weight tying)**하는 기법이 널리 쓰인다. 입력에서 토큰 ID → 벡터 변환에 쓰는 행렬과, 출력에서 벡터 → 로짓 변환에 쓰는 행렬이 동일하면 파라미터를 절반으로 줄일 수 있다.

```python
# Weight tying 예시
model.lm_head.weight = model.embedding.weight
```

임베딩 기초를 이해했다면 다음 글인 Word2Vec부터 시작해 정적 임베딩의 학습 원리를 단계별로 살펴볼 수 있다.

---

**지난 글:** [tiktoken: OpenAI의 빠른 BPE 토크나이저](/posts/tokenizer-tiktoken/)

<br>
읽어주셔서 감사합니다. 😊
