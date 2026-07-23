---
title: "파인튜닝 평가: 내 모델이 얼마나 좋아졌는지 측정하기"
description: "파인튜닝된 LLM을 평가하는 방법(perplexity, ROUGE, BLEU, task-specific metrics, LLM-as-Judge)과 평가 데이터셋 구성, 베이스라인 비교 전략을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["파인튜닝평가", "ROUGE", "Perplexity", "LLMasJudge", "모델평가", "LLM"]
featured: false
draft: false
---

[지난 글](/posts/finetuning-hyperparameters/)에서 학습률, 배치 크기, epoch 수 등 하이퍼파라미터를 어떻게 설정해야 좋은 파인튜닝 결과를 얻을 수 있는지 살펴봤다. 그런데 "좋은 결과"라는 말이 정확히 무엇을 의미하는지 아직 이야기하지 않았다. 손실(loss)이 줄어드는 것이 곧 모델이 좋아지는 것을 의미할까? 반드시 그렇지는 않다. 훈련 손실은 줄었지만 실제 태스크 성능이 그대로이거나 심지어 떨어지는 경우도 흔하다. 이번 글에서는 파인튜닝된 LLM을 어떻게 올바르게 평가하는지, 어떤 지표를 어떤 상황에 써야 하는지, 그리고 신뢰할 수 있는 평가 파이프라인을 어떻게 구성하는지를 처음부터 끝까지 설명한다.

## 왜 평가가 어려운가

언어 모델 평가가 어려운 근본적인 이유는 "정답"이 하나가 아니기 때문이다. "서울의 날씨를 알려줘"라는 질문에 대해 "오늘 서울은 맑고 기온은 23도입니다"라는 답과 "현재 서울의 날씨는 맑음, 기온 23°C입니다"라는 답은 표현은 다르지만 둘 다 올바른 답이다. 전통적인 분류 태스크처럼 단순히 정답/오답으로 나눌 수 없다는 것이 언어 생성 평가의 핵심 난제다.

이 때문에 LLM 평가에는 태스크 유형에 맞는 다양한 지표가 발전해왔다. 어떤 지표도 완벽하지 않으므로, 여러 지표를 조합해서 해석하는 것이 바람직하다.

![파인튜닝 평가 지표 선택 가이드](/assets/posts/finetuning-evaluation-metrics.svg)

## Perplexity: 언어 모델의 기본 체력 측정

**Perplexity(퍼플렉시티)**는 언어 모델이 텍스트를 얼마나 "놀랍지 않게" 예측하는지를 측정하는 지표다. 수식으로 표현하면 다음과 같다.

```text
PPL = exp(-1/N * Σ log P(wᵢ | w₁,...,wᵢ₋₁))
```

쉽게 말해, 모델이 각 단어를 예측할 때 평균적으로 몇 개의 후보 중에서 선택하는지를 나타낸다. Perplexity가 낮을수록 모델이 해당 텍스트를 더 잘 예측한다는 의미다.

Perplexity의 특징과 한계를 정리하면 다음과 같다.

- **장점**: 태스크에 무관하게 적용 가능, 계산이 빠르고 재현 가능
- **단점**: 사실 정확성을 측정하지 않는다 (유창하지만 틀린 문장도 낮은 PPL을 가질 수 있음)
- **용도**: 훈련 진행 모니터링, 도메인 적응 여부 확인

Perplexity는 훈련 loss와 직접 연관된다. `loss = log(PPL)`이므로 훈련 중 loss 그래프를 보는 것으로 Perplexity 추이를 간접 확인할 수 있다.

## ROUGE: 요약 모델의 표준 평가

**ROUGE(Recall-Oriented Understudy for Gisting Evaluation)**는 생성된 텍스트와 참조 텍스트 사이의 n-gram 겹침을 측정한다. 요약 태스크에서 가장 많이 사용된다.

### ROUGE의 세 가지 변종

| 지표 | 측정 방식 | 특징 |
|------|-----------|------|
| ROUGE-1 | 단어(unigram) 겹침 | 어휘 수준 유사도 |
| ROUGE-2 | 2-gram 겹침 | 구문 수준 유사도 |
| ROUGE-L | 최장 공통 부분열(LCS) | 문장 순서 고려 |

ROUGE 점수는 0~1 사이 값으로, 높을수록 좋다. 실제로는 ROUGE-1 F1이 0.4 이상이면 요약 모델로서 양호한 수준으로 본다.

```python
import evaluate

rouge = evaluate.load("rouge")

predictions = [
    "파인튜닝은 사전 학습된 모델을 특정 태스크에 맞게 추가 학습하는 기법이다."
]
references = [
    "파인튜닝은 이미 학습된 언어 모델을 특정 도메인이나 태스크에 맞게 재학습하는 방법이다."
]

results = rouge.compute(
    predictions=predictions,
    references=references,
    use_stemmer=False  # 한국어의 경우 False 권장
)

print(f"ROUGE-1: {results['rouge1']:.4f}")  # ex) 0.6154
print(f"ROUGE-2: {results['rouge2']:.4f}")  # ex) 0.4000
print(f"ROUGE-L: {results['rougeL']:.4f}")  # ex) 0.5385
```

ROUGE의 한계는 의미적 유사성을 무시한다는 점이다. "자동차"와 "승용차"는 의미가 같지만 다른 단어이므로 ROUGE 점수에 기여하지 않는다.

## BLEU: 기계 번역의 전통적 기준

**BLEU(Bilingual Evaluation Understudy)**는 생성된 텍스트의 n-gram이 참조 텍스트에 얼마나 포함되어 있는지를 측정한다. ROUGE가 재현율(recall) 중심이라면, BLEU는 정밀도(precision) 중심이다. 기계 번역 분야에서 오랫동안 표준으로 사용되어 왔다.

BLEU의 몇 가지 특성을 알아두면 좋다.

- 1-gram부터 4-gram까지의 정밀도를 기하 평균으로 결합한다
- 너무 짧은 출력에 페널티(brevity penalty)를 부과한다
- 사람의 판단과 0.6~0.7 수준의 상관관계를 보인다고 보고된다

단, BLEU도 ROUGE처럼 표면적 일치만 측정하므로, 의미적으로 올바른 번역이 낮은 BLEU를 받을 수 있다.

## BERTScore: 의미적 유사도 측정

**BERTScore**는 ROUGE와 BLEU의 가장 큰 약점인 "의미를 무시한다"는 문제를 해결하기 위해 등장했다. BERT 계열 모델의 임베딩을 활용해 생성 텍스트와 참조 텍스트 사이의 코사인 유사도를 계산한다.

```python
bertscore = evaluate.load("bertscore")

results = bertscore.compute(
    predictions=predictions,
    references=references,
    lang="ko",           # 한국어 지정
    model_type="klue/bert-base"  # 한국어 BERT 모델 사용 권장
)

print(f"BERTScore F1: {sum(results['f1'])/len(results['f1']):.4f}")
```

BERTScore는 특히 다음과 같은 상황에서 유용하다.

- **한국어 평가**: 형태소 다양성이 높은 한국어는 n-gram 겹침이 낮게 나오는 경향이 있어 ROUGE/BLEU가 과소평가하는 경향이 있다
- **패러프레이즈 평가**: 같은 의미의 다른 표현을 정확히 인식한다
- **창의적 생성 태스크**: 정답이 하나로 고정되지 않은 경우에 적합

## Task-Specific 평가: 태스크별 맞춤 지표

태스크가 구체적일수록 그에 맞는 전용 지표를 사용해야 한다.

### 분류 태스크: Accuracy와 F1

텍스트 분류(감성 분석, 의도 분류 등)는 가장 단순한 평가 구조를 가진다.

```python
from sklearn.metrics import classification_report, f1_score

y_true = ["긍정", "부정", "중립", "긍정", "부정"]
y_pred = ["긍정", "부정", "긍정", "긍정", "부정"]

print(classification_report(y_true, y_pred))
# precision  recall  f1-score  support 형태로 클래스별 성능 출력

# 불균형 데이터셋: macro F1 사용 (각 클래스를 동등하게 취급)
macro_f1 = f1_score(y_true, y_pred, average="macro")

# 균형 데이터셋: weighted F1 사용
weighted_f1 = f1_score(y_true, y_pred, average="weighted")
```

클래스 불균형이 심한 경우 Accuracy는 기만적일 수 있다. 99%가 "정상"인 데이터셋에서 항상 "정상"을 예측하면 Accuracy 99%지만 실제로 쓸모없는 모델이다. 이런 경우 Macro F1을 사용하라.

### QA 태스크: Exact Match와 F1

질의응답(QA) 태스크에서는 **Exact Match(EM)**과 **Token-level F1**을 함께 사용한다.

- **EM**: 예측 답변이 정답과 완전히 일치하는 비율
- **F1**: 공유 토큰 비율 (부분 점수 부여)

KorQuAD 같은 한국어 QA 벤치마크는 이 두 지표를 함께 보고한다.

### 코드 생성: Pass@k

코드 생성 모델은 **Pass@k**를 사용한다. 모델이 k개의 코드를 생성했을 때 그 중 하나라도 테스트를 통과하면 성공으로 간주한다. HumanEval, MBPP 같은 벤치마크에서 사용한다.

## LLM-as-Judge: AI가 AI를 평가한다

최근 가장 주목받는 평가 방식은 **LLM-as-Judge**다. GPT-4, Claude 같은 강력한 모델을 "평가자"로 활용하는 방식으로, MT-Bench에서 처음 제안되어 널리 채택됐다.

### MT-Bench 방식

MT-Bench는 GPT-4에게 두 모델의 답변 중 어느 것이 더 좋은지 판단하게 하거나 1~10점 척도로 점수를 매기게 한다.

```text
[시스템 프롬프트]
당신은 AI 어시스턴트의 응답을 평가하는 전문 평가자입니다.
다음 기준으로 1~10점을 부여하세요:
- 정확성 (사실 기반 여부)
- 유용성 (사용자 요구 충족 여부)
- 명확성 (이해하기 쉬운 표현 여부)

[사용자 질문]
{question}

[평가 대상 응답]
{response}

[지시사항]
1~10점과 이유를 JSON 형식으로 답하세요.
{"score": 8, "reason": "..."}
```

LLM-as-Judge의 장점과 주의점은 다음과 같다.

**장점**
- 자동화 가능하여 대규모 평가에 효율적
- 미묘한 품질 차이를 감지 가능
- 다양한 측면(정확성, 안전성, 유용성)을 동시에 평가

**주의점**
- 평가 모델 자체의 편향이 결과에 영향
- "자기 선호(self-preference)" 현상: GPT-4는 GPT-4 스타일 답변을 선호하는 경향
- 비용이 발생함 (API 호출)
- 재현성이 낮을 수 있음 (temperature > 0)

## 인간 평가: 언제 꼭 필요한가

자동 지표가 아무리 정교해도 인간 평가를 대체할 수 없는 상황이 있다.

- **신뢰·안전 관련 서비스**: 의료, 법률, 금융 도메인에서 잘못된 정보의 위험이 큰 경우
- **브랜드 톤앤매너**: 기업의 특정 말투나 스타일 적합성
- **창의적 콘텐츠**: 유머, 감성, 스토리텔링 품질
- **도메인 전문성 검증**: 전문가만이 판단 가능한 기술적 정확성

인간 평가를 수행할 때는 평가자 간 일치도(Inter-Annotator Agreement, IAA)를 반드시 측정해야 한다. Cohen's Kappa가 0.6 이상이면 신뢰할 수 있는 수준이다.

## 평가 파이프라인 구성

![파인튜닝 평가 파이프라인](/assets/posts/finetuning-evaluation-pipeline.svg)

### 1단계: 평가 데이터셋 구성

평가 데이터셋 설계는 평가 신뢰도의 기반이다. 다음 원칙을 따르라.

- **최소 200~500개**: 통계적 유의성을 위한 최소 크기
- **훈련 데이터 미포함**: 데이터 유출(data leakage)은 평가를 무효화한다
- **실제 사용 분포 반영**: 쉬운 예제만 있으면 과도하게 높은 점수가 나온다
- **엣지 케이스 포함**: 모델이 실패할 가능성이 있는 어려운 예제를 의도적으로 포함

### 2단계: 베이스라인 측정

파인튜닝 전 모델(베이스 모델)과 가능하면 상용 모델(GPT-4, Claude)의 성능도 함께 측정해두어야 한다. 베이스라인 없이는 파인튜닝이 얼마나 효과적이었는지 알 수 없다.

### 3단계: 훈련 곡선 분석

훈련 loss와 검증 loss를 함께 시각화하면 과적합(overfitting)을 조기에 감지할 수 있다.

- **훈련 loss만 감소, 검증 loss는 증가**: 과적합
- **두 loss 모두 정체**: 학습률이 너무 낮거나 모델 용량 부족
- **두 loss 모두 감소**: 이상적인 훈련 진행

### 4단계: 파국적 망각 확인

파인튜닝 후 모델이 이전에 잘 수행하던 능력을 잃지 않았는지 확인해야 한다. 이를 **파국적 망각(catastrophic forgetting)**이라 한다. 파인튜닝 도메인 이외의 일반 QA 태스크에서도 성능을 측정해서 비교하라.

## lm-evaluation-harness 활용

Eleuther AI의 **lm-evaluation-harness**는 언어 모델 평가의 표준 도구로 자리 잡았다. MMLU, HellaSwag, ARC 등 수십 개의 벤치마크를 한 번에 실행할 수 있다.

```bash
# lm-evaluation-harness 설치 및 실행
pip install lm-eval

# 파인튜닝된 모델을 MMLU와 ARC로 평가
lm_eval \
  --model hf \
  --model_args pretrained=./my-finetuned-model,dtype=bfloat16 \
  --tasks mmlu,arc_easy,arc_challenge \
  --device cuda:0 \
  --batch_size 8 \
  --output_path ./eval_results/

# 결과는 JSON 파일로 저장됨
# results: {mmlu: {acc: 0.72}, arc_easy: {acc: 0.85}, ...}
```

### 주요 벤치마크 선택 가이드

| 벤치마크 | 측정 내용 | 언어 | 권장 상황 |
|----------|-----------|------|-----------|
| MMLU | 다양한 분야 지식 | 영어 | 일반 지능 측정 |
| KorNLU | 자연어 추론 | 한국어 | 한국어 이해력 |
| HellaSwag | 상식 추론 | 영어 | 일반 상식 |
| HumanEval | 코드 생성 | 영어 | 코드 능력 |
| KoBEST | 종합 한국어 | 한국어 | 한국어 파인튜닝 |

## 베이스라인 비교 전략

올바른 비교를 위해 다음 세 가지 베이스라인을 항상 포함하라.

1. **파인튜닝 전 베이스 모델**: 파인튜닝 자체의 효과 측정
2. **Zero-shot 프롬프팅**: 같은 베이스 모델에 좋은 프롬프트만 사용한 결과
3. **상용 모델 참조점**: 파인튜닝이 상용 모델 대비 어느 수준인지 파악

많은 경우 정교한 프롬프트 엔지니어링만으로도 파인튜닝과 유사한 결과를 낼 수 있다. 만약 파인튜닝이 Zero-shot 프롬프팅보다 나쁘다면 훈련 데이터 품질이나 하이퍼파라미터를 재검토해야 한다.

## 평가 체크리스트

실무에서 파인튜닝 평가를 수행할 때 다음 체크리스트를 활용하라.

- [ ] 평가 데이터셋이 훈련 데이터와 겹치지 않는가?
- [ ] 평가 데이터가 최소 200개 이상인가?
- [ ] 베이스 모델(파인튜닝 전) 점수를 기록했는가?
- [ ] 태스크에 맞는 지표를 선택했는가?
- [ ] 여러 지표를 조합해서 평가하고 있는가?
- [ ] 훈련/검증 loss 곡선에서 과적합 징후를 확인했는가?
- [ ] 파국적 망각 여부를 일반 태스크로 확인했는가?
- [ ] 오류 케이스를 직접 분석하여 패턴을 파악했는가?

## 마무리

파인튜닝 평가는 단순히 숫자를 뽑는 행위가 아니라 모델의 강점과 약점을 체계적으로 이해하는 과정이다. 어떤 단일 지표도 완벽하지 않으므로, 태스크 특성에 맞는 지표 조합을 선택하고 항상 베이스라인과 비교하는 습관을 갖는 것이 핵심이다.

특히 한국어 태스크를 평가할 때는 ROUGE/BLEU의 한계를 인식하고 BERTScore와 LLM-as-Judge를 적극 활용하길 권장한다. 자동 평가와 소규모 인간 평가를 병행하면 더욱 신뢰할 수 있는 결론을 얻을 수 있다.

---

**지난 글:** [파인튜닝 하이퍼파라미터: 최적 설정 완전 가이드](/posts/finetuning-hyperparameters/)

**다음 글:** [클라우드에서 LLM 파인튜닝: AWS·GCP·Azure 완전 가이드](/posts/finetuning-on-cloud/)

<br>
읽어주셔서 감사합니다. 😊
