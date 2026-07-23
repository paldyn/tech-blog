---
title: "파인튜닝 데이터 준비: 형식·품질·양 완전 가이드"
description: "LLM 파인튜닝에 필요한 데이터 형식(Instruction, Chat, Completion), 데이터 품질 관리, 최소 데이터 양 기준, 데이터 증강 기법을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["파인튜닝", "데이터준비", "InstructionTuning", "ChatTemplate", "LLM", "데이터품질"]
featured: false
draft: false
---

[지난 글](/posts/finetuning-adapter/)에서 Adapter 모듈을 트랜스포머 레이어에 삽입하는 원리와 LoRA와의 차이를 파악했다. 이번에는 실전 파인튜닝의 절반을 차지하는 **데이터 준비** 단계를 완전히 파헤친다. 아무리 정교한 모델 구조와 학습 기법을 갖추더라도 데이터가 잘못되면 모든 것이 무너진다. "Garbage in, garbage out"은 LLM 파인튜닝에서 더욱 직접적으로 작동한다.

## 왜 데이터 형식이 중요한가

LLM은 특정 **텍스트 패턴**을 학습한다. 파인튜닝 데이터가 일관된 형식을 갖지 않으면 모델은 "어떤 패턴으로 응답해야 하는지"를 배우지 못한다. 예를 들어 어떤 샘플에서는 `### 답변:` 접두사를 붙이고, 다른 샘플에서는 붙이지 않으면, 모델은 추론 시 어떤 형식으로 응답해야 할지 혼란스러워한다. 데이터 형식 통일은 선택이 아닌 **필수**다.

## 데이터 형식 3종 완전 해설

![LLM 파인튜닝 데이터 형식 3종](/assets/posts/finetuning-data-prep-formats.svg)

### 1. Completion Format (완성 형식)

가장 단순한 형식이다. 하나의 `text` 필드에 입력과 출력이 자연스럽게 이어지며, 모델은 전체 시퀀스에 대해 다음 토큰 예측 손실(causal language modeling loss)을 계산한다.

```jsonl
{"text": "대한민국의 수도는 서울이며, 인구는 약 950만 명이다."}
{"text": "파이썬에서 리스트를 역순으로 정렬하려면 list.sort(reverse=True)를 사용한다."}
```

이 형식은 **도메인 적응(domain adaptation)**에 가장 적합하다. 의료 문서, 법률 문서, 코드 코퍼스 등 특정 도메인의 텍스트를 대량으로 학습시킬 때 사용한다. 구현이 단순하지만, "지시를 따르는 능력(instruction following)"을 가르치기 어렵다는 단점이 있다.

### 2. Instruction Format (Alpaca 형식)

Stanford Alpaca 논문(2023)이 대중화한 형식이다. `instruction`, `input`, `output` 세 필드로 구성된다. `input`은 생략 가능하며, 생략할 경우 instruction만으로 응답을 생성하는 태스크를 표현한다.

```jsonl
{"instruction": "다음 문장을 영어로 번역하라.", "input": "오늘 날씨가 매우 좋습니다.", "output": "The weather is very nice today."}
{"instruction": "아래 코드의 버그를 찾아 수정하라.", "input": "def add(a, b):\n    return a - b", "output": "def add(a, b):\n    return a + b  # - 를 + 로 수정"}
```

실제 학습 시에는 이 세 필드를 하나의 프롬프트 템플릿으로 연결한다:

```text
### Instruction:
다음 문장을 영어로 번역하라.

### Input:
오늘 날씨가 매우 좋습니다.

### Response:
The weather is very nice today.
```

중요한 점은 **손실 마스킹(loss masking)**이다. `### Response:` 이전의 instruction과 input 부분에 대해서는 손실을 계산하지 않고, 오직 응답 부분에만 손실을 적용한다. 이렇게 해야 모델이 프롬프트를 외우는 것이 아니라 올바른 응답 생성을 학습한다.

### 3. Chat Format / ChatML

현재 가장 널리 사용되는 형식이다. `messages` 배열로 system, user, assistant 역할을 구분하여 멀티턴 대화를 자연스럽게 표현한다.

```json
{
  "messages": [
    {"role": "system", "content": "당신은 친절한 한국어 AI 어시스턴트입니다."},
    {"role": "user", "content": "파이썬의 GIL이 무엇인지 설명해줘."},
    {"role": "assistant", "content": "GIL(Global Interpreter Lock)은 CPython 인터프리터가..."}
  ]
}
```

#### apply_chat_template() 사용법

HuggingFace의 `tokenizer.apply_chat_template()`을 사용하면 각 모델에 맞는 특수 토큰 처리가 자동으로 이루어진다. Llama-3의 경우 `<|begin_of_text|>`, `<|start_header_id|>`, `<|eot_id|>` 등의 토큰이 삽입된다.

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B-Instruct")

messages = [
    {"role": "system", "content": "당신은 친절한 AI 어시스턴트입니다."},
    {"role": "user", "content": "안녕하세요!"},
    {"role": "assistant", "content": "안녕하세요! 무엇을 도와드릴까요?"}
]

# tokenize=False: 토큰화 없이 문자열만 반환
formatted = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True  # 추론 시에만 True
)
print(formatted)
```

`add_generation_prompt=True`는 추론 시 마지막에 어시스턴트 응답 시작 토큰을 추가한다. **학습 시에는 `False`**, **추론 시에는 `True`**로 설정해야 한다.

## 품질이 양보다 중요하다

![데이터 품질 vs 양: 파인튜닝 성공 공식](/assets/posts/finetuning-data-prep-quality.svg)

Stanford Alpaca는 단 **52,000개**의 instruction 데이터로 GPT-3.5에 버금가는 instruction following 능력을 달성했다. 반면 수백만 개의 저품질 데이터로 학습한 모델은 단순 패턴 반복이나 할루시네이션을 일으키는 경우가 많다.

### 태스크별 최소 데이터 양 기준

| 태스크 유형 | 최소 권장 | 적정 범위 | 비고 |
|------------|---------|---------|------|
| 분류·레이블링 | 100개 | 100~500 | 클래스당 균등 분포 필수 |
| 텍스트 생성·요약 | 500개 | 500~2,000 | 다양성이 중요 |
| 복잡 추론·코드 | 2,000개 | 2,000~10,000 | 고품질 검증 필수 |
| 도메인 적응 | 10,000개+ | 제한 없음 | Completion 형식 사용 |

데이터가 부족할수록 **더 많은 에폭**을 훈련하고, **더 낮은 학습률**을 사용해야 과적합을 방지할 수 있다.

## 데이터 품질 관리: 5단계 파이프라인

### 1단계: 중복 제거 (Deduplication)

중복 샘플은 모델이 해당 패턴을 과도하게 외우게 만들어 일반화 성능을 저하시킨다. 완전 일치(exact match)뿐 아니라 MinHash나 SimHash를 사용한 **퍼지 중복 제거(fuzzy deduplication)**도 적용한다.

```python
from datasketch import MinHash, MinHashLSH

def get_minhash(text, num_perm=128):
    m = MinHash(num_perm=num_perm)
    for word in text.lower().split():
        m.update(word.encode('utf8'))
    return m

lsh = MinHashLSH(threshold=0.85, num_perm=128)
unique_samples = []

for i, sample in enumerate(dataset):
    mh = get_minhash(sample['text'])
    if not lsh.query(mh):  # 유사한 샘플이 없으면
        lsh.insert(f"sample_{i}", mh)
        unique_samples.append(sample)

print(f"중복 제거: {len(dataset)} → {len(unique_samples)}개")
```

### 2단계: 길이 필터링

너무 짧은 샘플(의미 없는 단답)과 너무 긴 샘플(모델 최대 컨텍스트 초과)을 제거한다.

```python
def filter_by_length(sample, min_tokens=20, max_tokens=2048):
    tokens = tokenizer.encode(sample['text'])
    return min_tokens <= len(tokens) <= max_tokens

filtered = [s for s in dataset if filter_by_length(s)]
```

### 3단계: 언어 일관성 확인

다국어 데이터셋에서 잘못 섞인 언어를 제거한다. `langdetect` 또는 `fasttext`의 언어 감지 모델을 사용한다.

### 4단계: 독성 콘텐츠 필터링

혐오 발언, 개인정보, 저작권 침해 콘텐츠를 제거한다. 완전 자동화는 어려우므로 샘플링 후 인간 검토를 병행한다.

### 5단계: 품질 점수 기반 필터링

Perplexity를 사용해 학습 가능한 품질인지 평가한다. 너무 낮은 perplexity(모델이 이미 완벽히 아는 내용)나 너무 높은 perplexity(노이즈)를 제거한다.

## 데이터 증강: 합성 데이터 생성

실제 고품질 데이터가 부족할 때 **GPT-4나 Claude를 사용한 합성 데이터 생성**이 매우 효과적이다. Self-Instruct 방식이 대표적이다.

```python
import anthropic

client = anthropic.Anthropic()

def generate_synthetic_sample(seed_instruction: str) -> dict:
    """시드 지시문을 기반으로 새로운 instruction-output 쌍 생성"""
    prompt = f"""다음 지시문과 유사하지만 다른 새로운 instruction-output 쌍을 JSON 형식으로 생성하라.
시드: {seed_instruction}

조건:
1. 완전히 새로운 주제나 상황을 사용할 것
2. 응답은 정확하고 상세해야 함
3. 한국어로 작성할 것

JSON 형식: {{"instruction": "...", "output": "..."}}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text

# 100개의 시드 데이터로 1000개 생성
synthetic_data = []
for seed in seed_instructions:
    for _ in range(10):
        sample = generate_synthetic_sample(seed)
        synthetic_data.append(sample)
```

합성 데이터는 반드시 **인간 검토(human review)**를 거쳐야 한다. LLM이 생성한 데이터에도 할루시네이션이 포함될 수 있기 때문이다.

## 데이터 분리: Train/Validation 분할

파인튜닝 데이터도 기계학습의 기본 원칙을 따른다. **80:20** 비율로 train/validation을 분리하되, 분포가 균일하도록 stratified split을 사용한다.

```python
from sklearn.model_selection import train_test_split

train_data, val_data = train_test_split(
    dataset,
    test_size=0.2,
    random_state=42,
    shuffle=True
)

# JSONL 형식으로 저장
import json

with open('train.jsonl', 'w', encoding='utf-8') as f:
    for sample in train_data:
        f.write(json.dumps(sample, ensure_ascii=False) + '\n')

with open('val.jsonl', 'w', encoding='utf-8') as f:
    for sample in val_data:
        f.write(json.dumps(sample, ensure_ascii=False) + '\n')
```

Validation 데이터는 학습 중 **과적합 감지**와 **조기 종료(early stopping)** 판단에 사용된다. 절대 학습 데이터와 섞이면 안 된다.

## 한국어 파인튜닝 데이터셋

한국어 모델 파인튜닝을 위한 공개 데이터셋을 소개한다.

| 데이터셋 | 규모 | 형식 | 특징 |
|---------|-----|------|------|
| **KoAlpaca** | 52K | Instruction | Alpaca 번역 + 한국어 추가 |
| **KULLM** | 150K+ | Chat | 고려대 LLM 프로젝트 |
| **OpenOrca-Ko** | 가변 | Instruction | OpenOrca 한국어 번역 |
| **한국어 나무위키** | 수GB | Completion | 도메인 적응용 |
| **AI-Hub 한국어 말뭉치** | 수억 어절 | Completion | 정부 공개 데이터 |

KoAlpaca와 KULLM은 HuggingFace Hub에서 바로 로드할 수 있다:

```python
from datasets import load_dataset

# KoAlpaca 로드
koalpaca = load_dataset("beomi/KoAlpaca-v1.1a")

# KULLM 로드
kullm = load_dataset("nlpai-lab/kullm-v2")

# 샘플 확인
print(koalpaca['train'][0])
# {'instruction': '...', 'output': '...'}
```

## 실전 데이터 준비 체크리스트

파인튜닝을 시작하기 전에 다음을 반드시 점검한다:

1. **형식 일관성**: 모든 샘플이 동일한 구조를 가지는가?
2. **특수 토큰**: 사용하는 모델의 chat template에 맞게 처리했는가?
3. **인코딩**: UTF-8로 저장되었는가? (한국어 필수)
4. **JSONL 유효성**: 각 줄이 유효한 JSON인가?
5. **손실 마스킹**: Instruction 부분에 손실이 적용되지 않도록 설정했는가?
6. **데이터 분포**: 태스크 유형별로 균등하게 분포되어 있는가?
7. **최소 수량**: 태스크 복잡도에 맞는 최소 데이터 수를 확보했는가?

데이터 준비에 투자하는 시간은 반드시 보상받는다. 품질 높은 500개 샘플이 노이즈 섞인 10,000개보다 훨씬 나은 모델을 만든다.

---

**지난 글:** [Adapter: 트랜스포머 레이어에 소형 모듈을 삽입하는 파인튜닝](/posts/finetuning-adapter/)

**다음 글:** [파인튜닝 하이퍼파라미터: 최적 설정 완전 가이드](/posts/finetuning-hyperparameters/)

<br>
읽어주셔서 감사합니다. 😊
