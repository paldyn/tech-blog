---
title: "멀티모달 AI 평가: MMBench·MMMU·VQA 벤치마크 완전 해설"
description: "VQA·MMBench·MMMU·MMStar 등 멀티모달 평가 벤치마크 구조, LLM-as-Judge 방식, 멀티모달 환각 평가 POPE·HallusionBench, Python 평가 코드까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["멀티모달평가", "MMBench", "MMMU", "VQA", "벤치마크", "LLM-as-Judge", "환각평가", "POPE"]
featured: false
draft: false
---

[지난 글](/posts/multimodal-vlm/)에서는 CLIP, BLIP-2, LLaVA 같은 비전-언어 모델의 구조와 학습 방식을 살펴봤습니다. 이제 자연스럽게 다음 질문이 떠오릅니다. "이 모델들이 실제로 얼마나 잘하는지 어떻게 알 수 있을까?" 이미지 설명이 그럴듯하게 들린다고 해서 모델이 진짜로 이미지를 '이해'하고 있다는 보장은 없습니다. 텍스트 편향에 기대서 이미지를 보지 않고도 그럴듯한 답을 생성하는 경우도 빈번합니다. 멀티모달 AI 평가는 이러한 함정을 걸러내고, 모델의 실제 시각-언어 이해 능력을 정밀하게 측정하기 위한 체계적인 방법론입니다.

## 멀티모달 평가의 어려움

텍스트 전용 LLM 평가는 비교적 단순합니다. 정답이 있는 문제라면 정확도를 재면 되고, 생성 품질은 BLEU·ROUGE 같은 자동 지표나 인간 평가로 측정할 수 있습니다. 그런데 멀티모달 모델은 두 가지 큰 난관이 추가됩니다.

첫째는 **주관적 생성 vs 객관적 이해 작업의 혼재**입니다. "이 이미지를 설명하세요" 같은 개방형 질문은 정답이 하나가 아닙니다. 반면 "이 그래프에서 2023년 값은?" 같은 질문은 명확한 정답이 있습니다. 좋은 벤치마크는 두 유형을 모두 포함하되, 측정 방식을 달리 설계해야 합니다.

둘째는 **언어 편향(language bias)** 문제입니다. "사과는 무슨 색입니까?"라는 질문은 이미지 없이도 "빨간색"이라고 답할 수 있습니다. 많은 초기 VQA 데이터셋이 이 편향을 충분히 걸러내지 못해, 이미지를 전혀 보지 않고도 높은 점수를 받는 모델이 등장했습니다. 현대 벤치마크들은 이를 방지하기 위해 반례(counter-example) 쌍이나 균형 잡힌 답변 분포를 적극적으로 설계합니다.

## 인식 능력 벤치마크

**VQA v2**는 멀티모달 평가의 표준으로 자리 잡은 데이터셋입니다. COCO 이미지에 기반한 20만 개 이상의 이미지-질문-답변 쌍으로 구성되며, 같은 질문에 대해 서로 다른 이미지를 짝지어 언어 편향을 줄인 것이 핵심 설계 원칙입니다. 평가 지표는 단순 정확도보다 정교한 소프트 정확도를 사용합니다. 10명의 어노테이터가 답변을 제공하고, 모델 답변이 그중 몇 명의 답변과 일치하는지로 점수를 계산합니다.

**GQA**는 VQA v2의 편향 문제를 더 적극적으로 해결하기 위해 설계되었습니다. 이미지 씬 그래프(scene graph)를 바탕으로 질문을 프로그래매틱하게 생성하기 때문에, 답변 분포가 더 균일하고 다단계 추론이 필요한 질문들이 포함됩니다. "빨간 물체 왼쪽에 있는 것은 무엇인가?" 같은 공간적 추론이 대표적입니다.

**TextVQA**는 이미지 안에 있는 텍스트를 읽고 답해야 하는 능력을 측정합니다. 간판, 메뉴판, 상표 등 자연스럽게 텍스트가 포함된 이미지를 대상으로 하며, OCR 능력과 언어 이해를 동시에 요구합니다. GPT-4V 수준의 모델들이 이 벤치마크에서 인간 수준에 도달했습니다.

**OCRBench**는 한 단계 더 나아가 문서 인식 특화 평가입니다. 수식, 표, 손글씨, 다국어 문서 등 OCR의 어려운 사례들을 체계적으로 포함합니다. 실무에서 문서 AI에 VLM을 적용하려 할 때 이 벤치마크 점수가 특히 참고가 됩니다.

## 추론 능력 벤치마크

![멀티모달 벤치마크 분류](/assets/posts/multimodal-evaluation-benchmarks.svg)

**MMMU(Massive Multidisciplinary Multimodal Understanding)**는 2023년 말 등장한 이후 가장 어려운 멀티모달 벤치마크로 꼽힙니다. 대학원 수준의 시험 문제를 실제 교재와 논문에서 수집했으며, 예술, 생물학, 화학, 법학, 경제학 등 30개 이상의 학문 분야를 포함합니다. 단순히 이미지를 인식하는 것을 넘어, 이미지와 관련된 도메인 지식을 결합한 추론이 필요합니다. GPT-4V 출시 당시 56% 정도의 점수를 기록했고, 이후 Claude·Gemini 등이 경쟁하며 점수가 계속 올라가고 있습니다.

```python
# MMMU 평가 결과 예시 구조
{
    "overall": 0.618,
    "per_discipline": {
        "Art & Design": 0.71,
        "Science": 0.58,
        "Health & Medicine": 0.65,
        "Humanities & Social Science": 0.62,
        "Tech & Engineering": 0.55,
        "Business": 0.60
    }
}
```

**MathVista**는 수학적 시각 추론에 특화된 벤치마크입니다. 함수 그래프 해석, 기하학적 추론, 통계 차트 분석 등 수식이나 도형이 포함된 이미지에서 수학적 결론을 도출하는 능력을 측정합니다. 텍스트만으로는 풀 수 없고 이미지를 반드시 분석해야 하는 문제들로 구성되어 있어, 진정한 시각-수리 통합 능력을 요구합니다.

**ScienceQA**는 초등학교부터 고등학교까지의 과학 교과서 문제를 기반으로 합니다. 이미지, 텍스트, 답변 선택지, 그리고 해설(rationale)까지 포함되어 있어, 모델의 추론 과정을 단계적으로 평가할 수 있는 구조입니다. Chain-of-Thought 프롬프팅 연구에도 자주 활용됩니다.

**MMStar**는 2024년 제안된 벤치마크로, 기존 벤치마크들의 데이터 오염(data contamination) 문제를 해결하기 위해 설계되었습니다. 이미지 없이 텍스트만으로도 풀 수 있는 문제들을 엄격하게 걸러내어, 진짜 시각 추론이 필요한 1,500개의 문항만으로 구성됩니다.

## 종합 평가 벤치마크

**MMBench**는 OpenCompass 팀에서 개발한 대규모 종합 평가 도구입니다. 단순한 VQA를 넘어 18가지 세부 능력 항목을 측정합니다. 물체 위치 파악, 속성 인식, 관계 추론, 세는 능력, 텍스트 인식, 코드 분석 등이 포함됩니다. 선택형 문항(multiple choice)으로 구성되어 있어 자동 평가가 용이하며, 영어와 중국어 버전이 별도로 제공됩니다.

**MM-Vet**은 통합적인 능력을 평가하는 데 초점을 맞춥니다. 단순히 하나의 능력만 측정하는 것이 아니라, 여러 능력의 조합이 필요한 문제들을 수집했습니다. 예를 들어 "이 레시피 이미지를 보고 필요한 재료를 나열하고 총 칼로리를 추정하세요"는 OCR, 지식, 계산 능력을 동시에 요구합니다. 평가는 GPT-4를 심판(judge)으로 사용하는 LLM-as-Judge 방식을 채택합니다.

**SEED-Bench**는 1만 9,000개 이상의 선택형 문항으로 구성된 대규모 벤치마크입니다. 이미지뿐 아니라 비디오도 포함하며, 장면 이해, 인스턴스 속성, 공간 관계, 시간적 이해 등 다양한 시각 작업을 체계적으로 포괄합니다.

**LLaVA-Bench**는 In-the-Wild와 COCO 두 가지 버전으로 나뉩니다. 특히 In-the-Wild 버전은 실제 인터넷에서 수집한 다양한 이미지로 구성되어 있어, 모델의 실용적 능력을 평가하기에 적합합니다. GPT-4V를 기준 심판으로 사용하여 생성 품질을 1~10점으로 평가합니다.

## 멀티모달 환각 평가

VLM의 가장 큰 문제 중 하나는 환각(hallucination)입니다. 이미지에 없는 물체를 있다고 하거나, 실제로는 다른 색인데 엉뚱한 색을 말하는 경우가 대표적입니다.

**POPE(Polling-based Object Probing Evaluation)**는 물체 환각을 측정하는 가장 널리 쓰이는 벤치마크입니다. 이미지를 보여주고 "이 이미지에 [물체]가 있습니까?"라는 예/아니오 질문을 던집니다. 세 가지 샘플링 전략을 사용합니다. 무작위 샘플링, 인기 있는 물체(자주 등장하는 것) 샘플링, 그리고 해당 이미지에 인접하게 등장하는 물체 샘플링입니다. 마지막 전략이 가장 어렵고 환각이 많이 발생합니다.

```python
# POPE 평가 예시 - 예/아니오 이진 분류
def evaluate_pope(model, image, question):
    """
    question: "Is there a [object] in the image?"
    returns: "yes" or "no"
    """
    response = model.generate(image, question)
    answer = response.lower().strip()
    return "yes" if "yes" in answer else "no"

# 정밀도, 재현율, F1 계산
from sklearn.metrics import f1_score, precision_score, recall_score

labels = [1 if a == "yes" else 0 for a in ground_truth]
preds  = [1 if a == "yes" else 0 for a in model_answers]

print(f"F1: {f1_score(labels, preds):.4f}")
print(f"Precision: {precision_score(labels, preds):.4f}")
print(f"Recall: {recall_score(labels, preds):.4f}")
```

**HallusionBench**는 시각적 착각(visual illusion)과 지식 충돌을 활용한 환각 평가입니다. 모델이 이미지에서 잘못된 정보를 읽거나, 사전 학습된 지식과 이미지가 충돌할 때 어떻게 반응하는지를 측정합니다. "이 이미지의 선 A와 B 중 어느 것이 더 깁니까?"처럼 뮬러-라이어 착시 같은 시각 착각 이미지를 사용하기도 합니다.

## 평가 자동화

![VQA 평가 자동화 코드](/assets/posts/multimodal-evaluation-code.svg)

**lmms-eval**은 언어 모델 평가 프레임워크인 lm-eval-harness를 멀티모달로 확장한 것입니다. 수십 개의 벤치마크를 단일 인터페이스로 실행할 수 있어, 여러 벤치마크를 동시에 평가하는 표준 도구로 자리 잡았습니다.

```bash
# lmms-eval 설치 및 실행
pip install lmms-eval

python -m lmms_eval \
    --model llava \
    --model_args pretrained=llava-hf/llava-1.5-7b-hf \
    --tasks mmbench_en,vqav2,pope \
    --batch_size 8 \
    --output_path ./results
```

**LLM-as-Judge** 방식은 생성형 평가에서 특히 중요합니다. GPT-4V나 Claude 같은 강력한 모델을 심판으로 활용해, 모델이 생성한 답변의 품질을 자동으로 채점합니다. MM-Vet, LLaVA-Bench-Wild 같은 벤치마크가 이 방식을 채택합니다.

```python
def llm_judge_score(judge_model, question, image, model_answer, reference_answer):
    """GPT-4V를 사용한 자동 채점"""
    prompt = f"""다음 멀티모달 질문에 대한 모델 답변을 평가하세요.

질문: {question}
참조 답변: {reference_answer}
모델 답변: {model_answer}

1~10점으로 채점하고, 이유를 설명하세요."""
    
    response = judge_model.generate(image, prompt)
    score = extract_score(response)  # 점수 파싱
    return score
```

## 주요 모델 리더보드 현황

2024~2025년 기준 주요 멀티모달 벤치마크에서의 상위 모델 성능을 살펴보면 흥미로운 패턴이 보입니다.

| 모델 | MMMU | MMBench | MathVista | POPE |
|------|------|---------|-----------|------|
| GPT-4o | 69.1 | 83.4 | 63.8 | 86.9 |
| Claude 3.5 Sonnet | 68.3 | 82.7 | 61.6 | 87.1 |
| Gemini 1.5 Pro | 65.8 | 80.2 | 63.9 | 85.8 |
| LLaVA-1.6 (34B) | 51.1 | 79.3 | 46.5 | 87.7 |
| InternVL2 (8B) | 51.2 | 81.7 | 58.3 | 88.0 |

오픈소스 진영에서 InternVL2, Qwen-VL 같은 모델들이 빠르게 상용 모델과의 격차를 줄이고 있습니다. 특히 POPE 같은 환각 평가에서는 작은 오픈소스 모델이 대형 상용 모델을 앞서는 경우도 나타납니다. 한편 MMMU처럼 전문 지식이 필요한 벤치마크에서는 여전히 대형 모델이 압도적 우위를 점합니다.

벤치마크 점수가 전부는 아닙니다. 데이터 오염 문제, 특정 도메인 편향, 실제 사용 시나리오와의 괴리 등 한계도 분명히 존재합니다. 그렇기 때문에 단일 벤치마크보다 여러 벤치마크의 조합으로 모델을 평가하고, 실제 사용 사례와 유사한 커스텀 평가를 병행하는 것이 좋은 실천 방법입니다.

---

**지난 글:** [비전-언어 모델(VLM): CLIP·BLIP2·LLaVA 완전 해설](/posts/multimodal-vlm/)

**다음 글:** [협업 필터링: 유사 사용자·아이템 기반 추천 완전 해설](/posts/recsys-collaborative-filtering/)

<br>
읽어주셔서 감사합니다. 😊
