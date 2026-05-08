---
title: "Encoder-Decoder 구조: 번역에서 요약까지"
description: "트랜스포머의 완전한 Encoder-Decoder 아키텍처가 어떻게 소스 시퀀스를 타깃 시퀀스로 변환하는지, Cross-Attention의 역할과 대표 모델(T5, BART)을 중심으로 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["트랜스포머", "Encoder-Decoder", "Seq2Seq", "T5", "BART", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/transformer-decoder/)에서 디코더 블록의 세 서브레이어와 자기 회귀 생성 방식을 살펴봤다. 이제 인코더와 디코더가 어떻게 하나의 완성된 시스템을 이루는지, 그리고 어떤 태스크에 이 구조가 적합한지 큰 그림을 그려 보자.

## Seq2Seq 문제

*시퀀스-투-시퀀스(Seq2Seq)* 는 가변 길이의 입력을 가변 길이의 출력으로 변환하는 문제다. 기계 번역, 문서 요약, 코드 생성, 대화 생성 등이 모두 이 범주에 속한다. 과거에는 RNN 기반 Seq2Seq가 표준이었지만, 트랜스포머가 RNN의 순차 처리 병목과 장거리 의존성 문제를 동시에 해결하며 새로운 기준이 됐다.

## Encoder-Decoder 전체 구조

![Encoder-Decoder 전체 구조](/assets/posts/transformer-encoder-decoder-arch.svg)

전체 흐름은 다음과 같다.

1. **Encoder** — 소스 시퀀스를 받아 `(src_len × d_model)` 크기의 문맥 표현을 생성.  
2. **Cross-Attention** — 인코더 출력을 K, V로 디코더에 공급. 디코더가 소스의 어느 부분에 집중할지 학습.  
3. **Decoder** — 이미 생성한 타깃 토큰을 조건으로 다음 토큰의 확률 분포를 출력.  
4. **Linear + Softmax** — 디코더 출력을 어휘 크기의 확률 벡터로 변환.

## Cross-Attention이 핵심 연결 고리

인코더-디코더를 단순히 이어 붙인 것과 트랜스포머가 다른 점은 **Cross-Attention**의 존재다. 각 디코더 레이어가 인코더 출력 전체를 매 스텝마다 참조할 수 있어, 소스의 관련 부분에 동적으로 집중한다.

```python
# PyTorch: 완전한 Encoder-Decoder
import torch.nn as nn

class Seq2SeqTransformer(nn.Module):
    def __init__(self, src_vocab, tgt_vocab, d_model=512,
                 n_heads=8, n_enc=6, n_dec=6, d_ff=2048):
        super().__init__()
        self.src_emb = nn.Embedding(src_vocab, d_model)
        self.tgt_emb = nn.Embedding(tgt_vocab, d_model)
        self.transformer = nn.Transformer(
            d_model=d_model, nhead=n_heads,
            num_encoder_layers=n_enc,
            num_decoder_layers=n_dec,
            dim_feedforward=d_ff,
            batch_first=True,
        )
        self.out_proj = nn.Linear(d_model, tgt_vocab)

    def forward(self, src, tgt, tgt_mask, src_padding_mask, tgt_padding_mask):
        src = self.src_emb(src)   # + PE 생략 (별도 적용)
        tgt = self.tgt_emb(tgt)
        out = self.transformer(
            src, tgt,
            tgt_mask=tgt_mask,
            src_key_padding_mask=src_padding_mask,
            tgt_key_padding_mask=tgt_padding_mask,
        )
        return self.out_proj(out)  # (batch, tgt_len, vocab)
```

## 학습: Teacher Forcing + Cross-Entropy

학습 시 정답 타깃 시퀀스를 한 칸 오른쪽으로 밀어 디코더에 입력하고(`<BOS> w1 w2 ... wN`), 예측 결과와 `w1 w2 ... wN <EOS>`를 비교해 Cross-Entropy 손실을 계산한다. Causal Mask 덕분에 전체 타깃 시퀀스를 한 번에 병렬로 처리할 수 있다.

## 대표 모델

| 모델 | 공개 | 특징 |
|------|------|------|
| **T5** | 2019 (Google) | 모든 NLP 태스크를 텍스트→텍스트로 통일 |
| **BART** | 2019 (Meta) | 노이즈 추가 후 복원 방식 사전학습 |
| **mBART** | 2020 (Meta) | 다국어 BART |
| **PEGASUS** | 2020 (Google) | 문장 추출 기반 사전학습, 요약 특화 |

## Encoder-Decoder vs 다른 아키텍처

![Encoder-Decoder 적용 태스크](/assets/posts/transformer-encoder-decoder-tasks.svg)

| 아키텍처 | 대표 모델 | 적합 태스크 |
|----------|-----------|-----------|
| Encoder-only | BERT | 분류, NER, 감성 분석 |
| Decoder-only | GPT | 텍스트 생성, 챗봇 |
| Encoder-Decoder | T5, BART | 번역, 요약, 조건부 생성 |

최근 Decoder-only LLM이 프롬프트만으로 번역·요약까지 수행하면서 Encoder-Decoder의 독점적 지위가 약해졌다. 하지만 **동일 파라미터 대비 조건부 생성 효율**은 Encoder-Decoder가 여전히 우위에 있다.

## 정리

- Encoder-Decoder = 소스 이해(인코더) + 타깃 생성(디코더), Cross-Attention으로 연결  
- Cross-Attention이 소스의 어디를 볼지 동적으로 결정 — 자동 정렬(alignment) 역할  
- Teacher Forcing으로 학습 병렬화, 추론은 자기 회귀  
- T5·BART 등 Seq2Seq 태스크의 핵심 아키텍처

---

**지난 글:** [Transformer Decoder: 문장을 생성하는 블록](/posts/transformer-decoder/)

**다음 글:** [Masking: 트랜스포머의 정보 차단 전략](/posts/transformer-masking/)

<br>
읽어주셔서 감사합니다. 😊
