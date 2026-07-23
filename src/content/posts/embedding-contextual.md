---
title: "문맥적 임베딩: ELMo부터 BERT까지"
description: "정적 임베딩의 다의어 문제를 해결하는 문맥적 임베딩의 원리, ELMo의 양방향 LSTM 레이어 표현, BERT의 트랜스포머 기반 서브워드 임베딩 추출법을 수식과 코드로 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["문맥적 임베딩", "ELMo", "BERT", "트랜스포머", "NLP", "KLUE", "transformers"]
featured: false
draft: false
---

[지난 글](/posts/embedding-fasttext/)에서 FastText가 부분 단어 n-gram으로 OOV 문제를 해결하는 방법을 살펴봤다. 그러나 Word2Vec, GloVe, FastText가 모두 해결하지 못한 근본 문제가 남아 있다. 바로 **다의어(polysemy)** 문제다. "나는 오늘 은행에 갔다"와 "강 옆 은행에 고기가 있다" — 두 문장에서 "은행"은 전혀 다른 의미다. 정적 임베딩은 "은행"에 하나의 고정 벡터를 할당하므로, 이 두 의미의 평균 어딘가에 위치한 벡터가 된다. 2018년, 이 문제를 해결하는 두 개의 혁명적 논문이 등장했다. **ELMo**와 **BERT**가 가져온 문맥적 임베딩의 시대다.

## 정적 임베딩의 근본적 한계

![정적 vs 문맥적 임베딩 비교](/assets/posts/embedding-contextual-compare.svg)

위 시각화가 보여주듯, 정적 임베딩에서 "bank"는 강변이든 금융 기관이든 항상 같은 벡터를 가진다. 문맥을 무시하는 것이다.

이 문제를 수학적으로 표현하면: 단어 w의 정적 임베딩 e(w)는 w에만 의존한다.

```text
e_static(w) = f(w)
```

반면 문맥적 임베딩은 단어 w와 그 주변 문맥 C 모두에 의존한다:

```text
e_contextual(w, C) = f(w, C)
```

같은 단어 "은행"이라도 "은행 대출"이라는 문맥과 "강변 은행"이라는 문맥에서 다른 벡터가 생성된다. 이것이 핵심이다.

## ELMo: 양방향 LSTM으로 만드는 깊은 문맥 표현

**ELMo(Embeddings from Language Models)**는 2018년 AllenNLP가 발표한 모델로, 문맥적 임베딩의 첫 번째 대성공 사례다.

### ELMo 아키텍처

ELMo는 대형 언어 모델을 사전 학습한 뒤, 그 중간 표현을 임베딩으로 활용한다.

**1단계: 문자 기반 CNN**
단어를 문자 단위로 분해해 CNN으로 초기 표현을 생성한다. FastText처럼 OOV에도 강하다.

**2단계: 양방향 LSTM 스택**

```text
→ LSTM: h_t^f = LSTM_f(h_{t-1}^f, x_t)   (왼쪽→오른쪽)
← LSTM: h_t^b = LSTM_b(h_{t+1}^b, x_t)   (오른쪽→왼쪽)
```

L개의 양방향 LSTM 레이어를 쌓는다. ELMo 논문에서는 L=2 레이어를 사용했다.

**3단계: 레이어 가중 합산**

ELMo의 핵심 아이디어는 **모든 레이어의 표현을 활용**한다는 것이다:

```python
import numpy as np

# k번째 토큰의 ELMo 표현
# h_0: 문자 CNN 표현
# h_1, h_2: 양방향 LSTM 레이어 표현들
def elmo_representation(h_layers, task_weights, gamma):
    # 태스크별 학습 가능한 가중치
    softmax_w = np.exp(task_weights) / np.sum(np.exp(task_weights))
    # 가중 합산
    elmo = gamma * sum(w * h for w, h in zip(softmax_w, h_layers))
    return elmo
```

태스크에 따라 각 레이어의 가중치(task_weights)가 다르게 학습된다는 것이 실험적으로 밝혀졌다:

- **하위 레이어**: 품사(POS), 구문 정보에 특화
- **상위 레이어**: 의미, 다의어 해소에 특화

즉, ELMo는 하나의 숫자가 아닌 **레이어별로 다른 언어 지식을 인코딩**한다.

### ELMo 학습 목표

ELMo의 사전 학습은 언어 모델링이다. 양방향으로 다음 단어를 예측한다:

```text
J = Σ_{k=1}^{N} (log p(t_k | t_1, ..., t_{k-1}) + log p(t_k | t_{k+1}, ..., t_N))
```

10억 토큰 규모의 1 Billion Word Benchmark로 학습된 ELMo는 당시 SQuAD, NER, 감성 분류 등 6개 NLP 태스크 모두에서 SOTA를 경신했다.

## BERT: 트랜스포머로 만드는 양방향 문맥

ELMo가 LSTM 기반이었다면, 같은 해 구글이 발표한 **BERT(Bidirectional Encoder Representations from Transformers)**는 트랜스포머 아키텍처를 사용해 한 단계 도약했다.

### BERT의 설계 철학

BERT는 세 가지 핵심 설계 선택을 했다:

**1. 서브워드 토크나이저 (WordPiece)**
단어를 더 작은 단위로 분해해 OOV를 처리한다. "학습하다" → ["학", "##습", "##하", "##다"] 형태로 분해될 수 있다.

**2. 양방향 어텐션**
LSTM과 달리, 트랜스포머의 셀프 어텐션은 왼쪽과 오른쪽 문맥을 **동시에** 봄으로써 진정한 양방향 표현을 만든다.

**3. 두 가지 사전 학습 태스크**

- **MLM (Masked Language Modeling)**: 입력 토큰의 15%를 [MASK]로 교체하고, 이를 예측하도록 학습. "나는 오늘 [MASK]을 먹었다" → "밥" 예측.
- **NSP (Next Sentence Prediction)**: 두 문장이 연속적인 문장인지 아닌지를 분류. 문장 간 관계 이해를 학습.

### BERT 임베딩 레이어

BERT의 입력 임베딩은 세 가지 임베딩의 합이다:

```text
E_input = E_token + E_position + E_segment
```

- **E_token**: 토큰 ID에 대한 임베딩 (30,000~50,000 차원 어휘)
- **E_position**: 각 토큰의 위치 정보 (최대 512 위치)
- **E_segment**: 첫 번째/두 번째 문장 구분

### BERT로 문맥적 임베딩 추출하기

BERT를 임베딩 추출기로 사용하는 방법을 보자. 한국어 KLUE BERT를 예시로 든다.

```python
from transformers import (
    AutoTokenizer,
    AutoModel,
)
import torch

# KLUE BERT 로드
model_id = "klue/bert-base"
tok = AutoTokenizer.from_pretrained(model_id)
model = AutoModel.from_pretrained(model_id)
model.eval()

# 다의어 예시: "은행"
texts = [
    "은행에서 대출을 받았다",   # 금융 기관
    "강변 은행에 벚꽃이 피었다", # 강변/자연
]

for text in texts:
    inputs = tok(text, return_tensors="pt")
    with torch.no_grad():
        out = model(**inputs)
    # last_hidden_state: [1, seq_len, 768]
    hidden = out.last_hidden_state[0]

    # "은행"에 해당하는 토큰 인덱스 찾기
    token_ids = inputs["input_ids"][0]
    tokens = tok.convert_ids_to_tokens(token_ids)
    print(tokens)
    # → ['[CLS]', '은행', '##에서', '대출', '##을', '받았다', '[SEP]']
```

![BERT 문맥 임베딩 추출 코드](/assets/posts/embedding-contextual-code.svg)

"은행"에 해당하는 토큰의 `last_hidden_state` 벡터를 두 문장에서 추출하면, 코사인 유사도가 정적 임베딩보다 낮게 나타난다 — 문맥에 따라 실제로 다른 벡터가 생성되기 때문이다.

### 어느 레이어를 쓸까

BERT는 12개(base) 또는 24개(large) 트랜스포머 레이어를 가진다. 어떤 레이어의 표현을 임베딩으로 사용할지는 태스크에 따라 다르다.

```python
# 여러 레이어의 hidden state 추출
out = model(**inputs, output_hidden_states=True)
# out.hidden_states: tuple of (13,) tensors of shape [1, seq_len, 768]
# hidden_states[0]: 임베딩 레이어
# hidden_states[1..12]: 각 트랜스포머 레이어

# 마지막 4개 레이어 평균 (분류 태스크에서 자주 사용)
last_4 = torch.stack(out.hidden_states[-4:], dim=0)
pooled = last_4.mean(dim=0)  # [1, seq_len, 768]

# 또는 단순히 마지막 레이어 [CLS] 토큰
cls_embedding = out.last_hidden_state[:, 0, :]  # [1, 768]
```

경험칙:
- **NER, 품사 태깅**: 중간 레이어 (6~8번)가 유리
- **의미 유사도**: 마지막 레이어 또는 마지막 4개 레이어 평균
- **미세조정**: 마지막 레이어 + 분류 헤드 추가

## ELMo vs BERT 비교

| | ELMo | BERT |
|---|---|---|
| 기반 아키텍처 | 양방향 LSTM | 트랜스포머 |
| 토크나이저 | 문자 CNN | 서브워드 (WordPiece) |
| 문맥 방향 | 양방향 (두 LSTM) | 완전 양방향 (어텐션) |
| 레이어 수 | 2~3 | 12~24 |
| 파라미터 수 | ~93M | 110M~340M |
| 최대 시퀀스 길이 | 제한 없음 | 512 토큰 |
| 사용 방식 | 특징 추출 (고정) | 미세조정 또는 추출 |

BERT가 ELMo를 대부분의 태스크에서 압도했지만, ELMo의 가장 큰 기여는 **"모든 레이어가 다른 언어 지식을 담는다"**는 통찰이다. 이 개념은 BERT와 이후 대형 언어 모델 해석성 연구에 큰 영향을 미쳤다.

## 한국어 BERT 모델들

한국어를 위한 BERT 기반 모델들이 다양하게 공개되어 있다:

```python
# 대표적인 한국어 BERT 모델들
models = {
    "klue/bert-base": "KLUE 벤치마크 학습, 가장 표준적",
    "snunlp/KR-ELECTRA-discriminator": "ELECTRA 방식, 효율적",
    "monologg/koelectra-base-v3-discriminator": "KoELECTRA",
    "klue/roberta-base": "RoBERTa 방식 한국어",
    "beomi/kcbert-base": "카카오 댓글 데이터 학습",
}
```

각 모델은 학습 데이터와 방법론이 달라, 다운스트림 태스크에 따라 성능 차이가 있다. 한국어 NLP 프로젝트에서는 KLUE 벤치마크 결과를 참고해 모델을 선택하는 것이 좋다.

## 실용적 임베딩 추출 패턴

프로덕션에서 BERT 임베딩을 추출할 때의 일반적인 패턴:

```python
from transformers import AutoTokenizer, AutoModel
import torch

class BERTEmbedder:
    def __init__(self, model_id="klue/bert-base"):
        self.tok = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModel.from_pretrained(model_id)
        self.model.eval()

    @torch.no_grad()
    def encode(self, texts, batch_size=32):
        all_embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i+batch_size]
            inputs = self.tok(
                batch,
                padding=True,
                truncation=True,
                max_length=128,
                return_tensors="pt",
            )
            out = self.model(**inputs)
            # [CLS] 토큰 임베딩 사용
            emb = out.last_hidden_state[:, 0, :]
            all_embeddings.append(emb)
        return torch.cat(all_embeddings, dim=0)

embedder = BERTEmbedder()
vecs = embedder.encode(["안녕하세요", "반갑습니다"])
print(vecs.shape)  # [2, 768]
```

## 마무리

ELMo와 BERT는 "단어에 고정 벡터를 부여한다"는 패러다임을 "문맥에 따라 벡터를 동적으로 생성한다"로 바꿨다. 이는 NLP의 가장 근본적인 전환 중 하나였다. ELMo는 LSTM과 레이어 가중 합산으로 첫 문을 열었고, BERT는 트랜스포머의 힘으로 거의 모든 NLP 태스크를 새로 쓰다시피 했다.

그러나 한 가지 남은 문제가 있다. **문장 수준의 표현**이다. 문서 검색, 의미 유사도 측정, RAG 등에서는 단어 수준이 아닌 **문장 전체의 의미를 하나의 벡터로** 표현해야 한다. 다음 글에서 이 문제를 해결하는 SBERT와 문장 임베딩을 다룬다.

---

**지난 글:** [FastText: 부분 단어로 OOV를 정복하다](/posts/embedding-fasttext/)

**다음 글:** [문장 임베딩: SBERT와 의미 검색](/posts/embedding-sentence/)

<br>
읽어주셔서 감사합니다. 😊
