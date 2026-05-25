---
title: "설명 가능한 AI(XAI): 블랙박스를 열다"
description: "LIME·SHAP·Grad-CAM·Attention 등 주요 XAI 기법을 모델 의존성과 설명 범위로 분류하고, SHAP 값을 통한 대출 AI 결정 설명 예시를 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["XAI", "설명가능AI", "SHAP", "LIME", "GradCAM", "AI해석가능성", "블랙박스AI"]
featured: false
draft: false
---

[지난 글](/posts/ai-bias-fairness/)에서 AI 편향의 문제를 다뤘다. 편향을 발견하고 수정하려면 AI가 왜 그 결정을 내렸는지 이해해야 한다. 이것이 **설명 가능한 AI(Explainable AI, XAI)**가 필요한 이유다.

## 블랙박스 문제

딥러닝 모델은 수억 개의 파라미터를 통해 패턴을 학습한다. 성능은 뛰어나지만 왜 그 결정을 내렸는지 설명하기 어렵다. 이 불투명성은 실제 문제를 만든다.

의료 AI가 암을 진단했을 때 의사는 "왜"가 필요하다. 대출 심사 AI가 거절했을 때 법적으로 이유를 설명해야 한다. EU GDPR은 자동화된 결정에 설명 요구권을 부여하고 있다. XAI는 선택이 아닌 규제 요건이 되고 있다.

## XAI 기법 분류

XAI 기법은 두 축으로 분류할 수 있다.

**설명 범위**: 전역(Global) vs 지역(Local)
- 전역: 모델 전체의 동작 패턴을 설명. "어떤 특성이 전반적으로 중요한가?"
- 지역: 특정 예측 하나를 설명. "이 사람의 대출이 왜 거절됐는가?"

**모델 의존성**: 모델 불문(Model-agnostic) vs 모델 특화(Model-specific)
- 모델 불문: 어떤 모델에도 적용 가능
- 모델 특화: 특정 아키텍처 구조를 활용

![XAI 기법 분류](/assets/posts/ai-explainability-xai-methods.svg)

## SHAP: 게임이론 기반의 설명

**SHAP(SHapley Additive exPlanations)**은 협력 게임이론의 샤플리 값을 머신러닝에 적용한다. 각 특성이 예측에 기여한 정도를 공정하게 분배한다.

```python
import shap

# 트리 기반 모델 (XGBoost, LightGBM)
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)

# 특정 예측 설명 (waterfall plot)
shap.plots.waterfall(
    shap.Explanation(
        values=shap_values[0],
        base_values=explainer.expected_value,
        data=X_test.iloc[0],
        feature_names=feature_names
    )
)

# 전체 특성 중요도 (summary plot)
shap.summary_plot(shap_values, X_test, feature_names=feature_names)

# 두 특성 간 상호작용 분석
shap.dependence_plot("부채비율", shap_values, X_test)
```

SHAP 값의 핵심 성질: 모든 특성의 SHAP 값 합 + 기대값 = 실제 예측값. 즉, 설명이 예측을 완전히 재구성한다.

![SHAP 값 시각화 예시](/assets/posts/ai-explainability-xai-shap.svg)

## LIME: 지역 선형 근사

**LIME(Local Interpretable Model-agnostic Explanations)**은 설명하고자 하는 예측 주변에서 간단한 선형 모델로 근사한다.

```python
from lime.lime_tabular import LimeTabularExplainer

explainer = LimeTabularExplainer(
    X_train.values,
    feature_names=feature_names,
    class_names=["거절", "승인"],
    mode="classification"
)

# 특정 예측 설명
explanation = explainer.explain_instance(
    X_test.iloc[0].values,
    model.predict_proba,
    num_features=6          # 상위 6개 특성
)

# 시각화
explanation.show_in_notebook()
# 또는 feature_importance를 dict로 추출
print(dict(explanation.as_list()))
```

LIME의 한계: 근사 영역 크기(kernel_width) 선택에 따라 설명이 달라질 수 있고, 같은 예측도 실행할 때마다 설명이 약간 다를 수 있다.

## Grad-CAM: CNN의 시각적 설명

이미지 분류 모델에서 "어떤 영역이 이 결정에 영향을 줬는가"를 시각화한다.

```python
import torch
import torch.nn.functional as F

def grad_cam(model, image_tensor, target_layer, class_idx):
    # 특정 레이어의 활성화와 그래디언트를 캡처
    activations = []
    gradients = []

    def forward_hook(module, input, output):
        activations.append(output)

    def backward_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0])

    handle_f = target_layer.register_forward_hook(forward_hook)
    handle_b = target_layer.register_backward_hook(backward_hook)

    output = model(image_tensor)
    model.zero_grad()
    output[0, class_idx].backward()

    # 클래스 활성화 맵 계산
    weights = gradients[0].mean(dim=[2, 3], keepdim=True)
    cam = (weights * activations[0]).sum(dim=1).relu()
    cam = F.interpolate(cam.unsqueeze(1), image_tensor.shape[2:], mode="bilinear")
    return cam.squeeze().detach().numpy()

    handle_f.remove()
    handle_b.remove()
```

## 어텐션 맵: Transformer의 자체 설명

Transformer 모델은 어텐션 가중치를 자연스러운 설명으로 활용할 수 있다.

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tokenizer = AutoTokenizer.from_pretrained("klue/bert-base")
model = AutoModelForSequenceClassification.from_pretrained(
    "klue/bert-base", output_attentions=True
)

inputs = tokenizer("이 제품은 정말 훌륭합니다.", return_tensors="pt")
outputs = model(**inputs)

# 12개 레이어, 12개 헤드의 어텐션
attentions = outputs.attentions  # (layer, batch, head, seq, seq)
# 마지막 레이어 평균 어텐션
avg_attention = attentions[-1].mean(dim=1).squeeze()
```

단, 어텐션이 설명을 대표한다는 가정은 논쟁 중이다(Jain & Wallace 2019). 높은 어텐션 = 중요한 토큰이라는 직관이 항상 성립하지 않는다.

## XAI 적용 시 주의사항

**설명 충실성(Faithfulness)**: 설명이 실제 모델 동작을 정확히 반영하는가? 단순화 과정에서 왜곡이 생길 수 있다.

**설명 안정성(Stability)**: 유사한 입력에 유사한 설명을 제공하는가? LIME은 실행마다 결과가 다를 수 있다.

**악용 가능성**: XAI 설명을 이용해 모델을 우회하는 사례가 존재한다. 신용 심사 AI의 설명에서 어떤 특성을 바꾸면 승인되는지 파악한 뒤 실제 행동을 바꾸지 않고 특성만 조작하는 경우다.

XAI는 도구다. 설명이 나왔다고 문제가 끝나는 게 아니라, 그 설명을 해석하고 행동으로 연결하는 사람의 역할이 여전히 중요하다.

---

**지난 글:** [AI 편향과 공정성: 알고리즘 차별을 막는 방법](/posts/ai-bias-fairness/)

**다음 글:** [AI와 프라이버시: 개인정보를 지키는 기술](/posts/ai-privacy/)

<br>
읽어주셔서 감사합니다. 😊
