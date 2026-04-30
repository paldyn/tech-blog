---
title: "베이즈 정리: AI 학습과 추론의 철학적 기반"
description: "베이즈 정리의 핵심을 이해하고, 나이브 베이즈 분류기, 베이즈 최적화, LLM과의 연관성까지 직접 코드로 확인한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["베이즈", "확률론", "나이브베이즈", "수학", "AI수학"]
featured: false
draft: false
---

[지난 글](/posts/ai-probability-basics/)에서 조건부 확률, 엔트로피, 교차 엔트로피 손실의 관계를 살펴봤다. 이번에는 AI의 핵심 수학 기초 시리즈의 마지막 주제인 **베이즈 정리(Bayes' Theorem)**를 다룬다. 베이즈 정리는 18세기 영국 목사 토머스 베이즈(Thomas Bayes)가 고안한 공식이지만, 현대 AI·머신러닝의 철학적 기반이 된다. "새로운 증거를 보고 기존 믿음을 얼마나 바꿔야 하는가?"라는 질문에 수학적으로 답한다.

## 베이즈 정리: 믿음의 업데이트 공식

베이즈 정리는 한 줄로 표현된다.

```
P(H|E) = P(E|H) · P(H) / P(E)
```

각 항의 의미를 스팸 필터 예시로 이해해보자.

- **P(H)** (사전 확률, Prior): 증거를 보기 전, 이메일이 스팸일 확률. 전체 이메일 중 30%가 스팸이라면 P(스팸) = 0.30
- **P(E|H)** (우도, Likelihood): 스팸이라고 가정했을 때 "무료"라는 단어가 포함될 확률. P("무료"|스팸) = 0.80
- **P(E)** (증거, Evidence): 전체 이메일에서 "무료" 단어가 나올 확률 (정규화 상수)
- **P(H|E)** (사후 확률, Posterior): "무료"를 봤을 때 스팸일 확률 → 우리가 알고 싶은 값

```python
# 베이즈 정리 계산 예시
# 스팸 필터: "무료" 단어가 있을 때 스팸일 확률

p_spam = 0.30             # 사전 확률: 30% 이메일이 스팸
p_free_given_spam = 0.80  # 우도: 스팸에서 "무료" 포함 확률
p_free_given_ham = 0.10   # 우도: 정상에서 "무료" 포함 확률

# P("무료") = P("무료"|스팸)·P(스팸) + P("무료"|정상)·P(정상)
p_free = (p_free_given_spam * p_spam +
          p_free_given_ham * (1 - p_spam))
print(f"P('무료') = {p_free:.3f}")  # 0.310

# 베이즈 정리 적용
p_spam_given_free = (p_free_given_spam * p_spam) / p_free
print(f"P(스팸|'무료') = {p_spam_given_free:.3f}")  # ≈ 0.774
# "무료" 단어 하나로 스팸 확률이 30% → 77.4%로 업데이트!
```

![베이즈 정리 완전 해부](/assets/posts/ai-bayes-theorem-formula.svg)

## 의료 진단에서의 기저율 오류

베이즈 정리의 가장 유명한 응용이자 가장 많은 사람이 직관적으로 틀리는 문제가 **기저율 무시(Base Rate Neglect)**다.

```python
# 99% 정확도 검사인데, 양성이면 정말 병에 걸렸을까?
p_disease = 0.001       # 유병률 0.1%
p_pos_given_disease = 0.99  # 민감도: 환자의 99%가 양성
p_pos_given_healthy = 0.05  # 위양성률: 건강인의 5%가 양성

# 전체 양성 확률
p_positive = (p_pos_given_disease * p_disease +
              p_pos_given_healthy * (1 - p_disease))

# 양성일 때 실제 병에 걸렸을 확률
p_disease_given_pos = (p_pos_given_disease * p_disease) / p_positive
print(f"양성 → 실제 병: {p_disease_given_pos:.3f}")  # ≈ 0.019 (1.9%!)
```

99%의 민감도에도 불구하고 양성 결과의 실제 의미는 불과 1.9%의 확률로 병에 걸렸다는 것이다. 왜? 유병률(0.1%)이 너무 낮기 때문이다. 대부분의 양성 판정은 건강한 사람에서 나온 위양성이다. 이것이 바로 베이즈 정리의 실용적 힘이다.

## 나이브 베이즈: 베이즈 정리를 ML로

**나이브 베이즈(Naive Bayes)**는 베이즈 정리를 직접 분류기로 구현한 알고리즘이다. "나이브(Naive, 단순한)"라는 이름은 특징들이 서로 **조건부 독립**이라는 강한 가정에서 온다.

```python
from sklearn.naive_bayes import MultinomialNB
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.pipeline import Pipeline

# 한국어 스팸 필터
emails = [
    "무료 쿠폰 지금 클릭하세요",
    "내일 회의 시간을 알려주세요",
    "당신이 선택되었습니다 혜택 받기",
    "프로젝트 검토 부탁드립니다",
    "무료 이벤트 참여하고 혜택을",
    "오늘 보고서 제출 기한입니다",
]
labels = [1, 0, 1, 0, 1, 0]  # 1=스팸, 0=정상

# 파이프라인: 벡터화 + 나이브 베이즈
pipeline = Pipeline([
    ('vectorizer', CountVectorizer()),
    ('classifier', MultinomialNB())
])

pipeline.fit(emails, labels)

# 새 이메일 분류
new_emails = ["무료 혜택을 받아가세요", "팀 미팅 일정 조율"]
predictions = pipeline.predict(new_emails)
probabilities = pipeline.predict_proba(new_emails)

for email, pred, prob in zip(new_emails, predictions, probabilities):
    label = "스팸" if pred == 1 else "정상"
    print(f"'{email}' → {label} (확률: {prob[pred]:.2f})")
```

![나이브 베이즈 분류기 구현](/assets/posts/ai-bayes-theorem-naive-bayes.svg)

나이브 베이즈의 독립성 가정은 현실적이지 않다. "무료"와 "클릭"은 스팸에서 함께 나타나는 경향이 있으므로 독립이 아니다. 그러나 실제로는 놀랍도록 잘 작동한다. 구글의 초기 스팸 필터도 나이브 베이즈를 기반으로 했다.

## 베이즈 최적화: 하이퍼파라미터 탐색

머신러닝의 실무에서 베이즈 정리가 가장 직접적으로 쓰이는 또 다른 곳은 **베이즈 최적화(Bayesian Optimization)**다. 학습률, 배치 크기, 층 수 같은 하이퍼파라미터를 자동으로 찾을 때 쓰인다.

```python
# Optuna로 구현한 베이즈 최적화 예시
import optuna

def objective(trial):
    # 탐색할 하이퍼파라미터 정의
    lr = trial.suggest_float("lr", 1e-5, 1e-1, log=True)
    dropout = trial.suggest_float("dropout", 0.0, 0.5)
    hidden_dim = trial.suggest_categorical("hidden", [64, 128, 256])

    # 모델 학습 및 검증 손실 반환
    val_loss = train_and_evaluate(lr, dropout, hidden_dim)
    return val_loss

# 베이즈 최적화 실행 (랜덤 탐색보다 훨씬 효율적)
study = optuna.create_study(direction="minimize")
study.optimize(objective, n_trials=50)

print(f"최적 파라미터: {study.best_params}")
```

그리드 탐색은 모든 조합을 시도하고, 랜덤 탐색은 무작위로 탐색한다. 베이즈 최적화는 이전 평가 결과를 기반으로 다음에 탐색할 지점을 선택한다. "이 방향이 좋을 것 같다"는 믿음을 업데이트하면서 탐색한다. 바로 베이즈 정리의 사전→사후 확률 업데이트 원리다.

## LLM과 베이즈적 관점

LLM의 동작을 베이즈 관점에서 해석하면 흥미로운 통찰이 나온다.

사전 학습(Pre-training)은 수조 개의 토큰으로부터 "언어와 세계에 대한 일반 지식"을 학습한다. 이것이 **사전 분포(Prior)**다. 모델이 학습 데이터에서 본 패턴, 사실, 추론 방식의 집약이다.

프롬프트(Prompt)는 **증거(Evidence)**다. "당신은 한국어 교사입니다. 학생에게 설명해주세요"라는 프롬프트는 모델이 어떤 스타일로 응답해야 하는지에 대한 증거다.

모델의 응답은 **사후 분포(Posterior)**다. 사전 학습된 지식과 프롬프트 맥락을 결합해 가장 적절한 응답을 생성한다.

RAG(Retrieval-Augmented Generation)는 이 관점에서 더 풍부한 증거를 제공하는 방법이다. 검색된 문서들이 추가적인 증거가 되어 모델의 사후 분포를 더 정확하게 만든다.

## 수학 기초의 마무리

이번 편으로 AI의 수학 기초 파트(선형대수, 행렬 연산, 확률론, 베이즈 정리)가 마무리된다. 이 수학들은 AI를 처음 배울 때 어렵게 느껴지지만, 결국 모두 같은 목표를 향한다. "어떻게 데이터에서 의미 있는 패턴을 발견하고, 불확실한 세계에서 최선의 예측을 할 것인가?" 다음 파트에서는 이 수학적 토대 위에 머신러닝 알고리즘이 어떻게 구축되는지 살펴볼 것이다.

---

**지난 글:** [AI를 위한 확률론 기초: 불확실성을 다루는 언어](/posts/ai-probability-basics/)

<br>
읽어주셔서 감사합니다. 😊
