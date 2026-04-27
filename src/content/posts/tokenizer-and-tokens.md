---
title: "토크나이저와 토큰: LLM이 텍스트를 읽는 방법"
description: "LLM은 텍스트를 문자가 아닌 '토큰' 단위로 읽습니다. 토크나이저의 작동 원리, BPE 알고리즘, 언어별 토큰 효율 차이, 그리고 실전에서 토큰을 다루는 법까지 핵심을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["AI", "LLM", "토크나이저", "토큰", "BPE", "NLP", "프롬프트 엔지니어링"]
featured: false
draft: false
---

[지난 글](/posts/ai-agents-and-mcp/)에서 이어집니다.

## "AI가 내 글을 읽는다"는 게 정확히 무슨 뜻일까?

ChatGPT에 긴 글을 붙여 넣으면 모델이 내용을 이해하는 것처럼 보입니다. 하지만 컴퓨터는 문자나 단어 자체를 이해하지 못합니다. 내부적으로는 모든 텍스트가 숫자 배열로 변환되어야 합니다. 이 변환을 담당하는 것이 **토크나이저(Tokenizer)**이고, 그 결과물이 **토큰(Token)**입니다.

토큰 개념을 이해하면 세 가지가 명확해집니다.

- API 비용이 왜 "토큰 단위"로 청구되는지
- 한국어 프롬프트가 영어보다 비싼 이유
- 컨텍스트 창(context window) 한계가 왜 중요한지

---

## 토큰이란 무엇인가?

토큰은 **모델이 처리하는 최소 텍스트 단위**입니다. 단어와 비슷하지만 같지 않습니다. 영어에서 `"unhappiness"`는 하나의 단어지만 토큰으로는 `["un", "happ", "i", "ness"]` 네 조각으로 나뉠 수 있습니다. 반면 `"the"`, `"is"`, `"a"` 같은 빈출 단어는 통째로 하나의 토큰이 됩니다.

OpenAI의 기준에서 영어 기준 토큰 하나는 대략 4글자, 또는 0.75개 단어에 해당합니다.

```python
# tiktoken으로 토큰 수 확인 (OpenAI 공식 라이브러리)
import tiktoken

enc = tiktoken.encoding_for_model("gpt-4o")

texts = [
    "Hello, world!",
    "안녕하세요, 세상!",
    "The quick brown fox jumps over the lazy dog.",
    "빠른 갈색 여우가 게으른 개를 뛰어넘습니다.",
]

for text in texts:
    tokens = enc.encode(text)
    print(f"[{len(tokens):2d} tokens] {text}")
    print(f"         IDs: {tokens[:8]}{'...' if len(tokens) > 8 else ''}")
```

실행 결과는 대략 이렇습니다.

```text
[ 4 tokens] Hello, world!
[10 tokens] 안녕하세요, 세상!
[10 tokens] The quick brown fox jumps over the lazy dog.
[19 tokens] 빠른 갈색 여우가 게으른 개를 뛰어넘습니다.
```

같은 의미의 문장인데 한국어가 약 두 배 많은 토큰을 소비합니다. 이 차이가 어디서 오는지 이해하려면 토크나이저의 내부를 들여다봐야 합니다.

---

## 토크나이저의 작동 원리

![토크나이저 동작 원리](/assets/posts/tokenizer-process.svg)

토크나이저는 크게 세 단계로 동작합니다.

**1단계: 정규화(Normalization)**  
입력 텍스트의 유니코드 정규화, 소문자 변환, 공백 처리 등을 수행합니다. 모델마다 이 규칙이 다릅니다.

**2단계: 분리(Tokenization)**  
텍스트를 토큰 조각으로 쪼갭니다. 어떤 알고리즘을 쓰느냐에 따라 결과가 달라집니다.

**3단계: 인코딩(Encoding)**  
각 토큰을 어휘 사전(vocabulary)에서 찾아 정수 ID로 변환합니다. 이 숫자 배열이 모델에 실제로 입력됩니다.

```python
# 토크나이저의 encode / decode 왕복 확인
import tiktoken

enc = tiktoken.encoding_for_model("gpt-4o")

text = "ChatGPT는 OpenAI가 만든 언어 모델입니다."
token_ids = enc.encode(text)
decoded = enc.decode(token_ids)

print("원본  :", text)
print("토큰 ID:", token_ids)
print("복원  :", decoded)

# 개별 토큰 확인
for tid in token_ids:
    piece = enc.decode([tid])
    print(f"  {tid:6d} → {repr(piece)}")
```

---

## 서브워드 분리 알고리즘: BPE

현대 LLM의 토크나이저 대부분은 **BPE(Byte Pair Encoding)** 또는 그 변형을 사용합니다. BPE는 원래 데이터 압축 알고리즘이었는데, 2016년 NLP 분야에 도입되어 주류가 되었습니다.

### BPE 학습 과정

BPE는 대규모 텍스트 코퍼스에서 다음 과정을 반복합니다.

```text
초기 상태: u n h a p p i n e s s
(모든 문자를 개별 토큰으로 시작)

반복 1: 가장 빈번한 쌍 'p p' 병합 → u n h a pp i n e s s
반복 2: 가장 빈번한 쌍 'pp' + 후보 선택 → un h a pp i n e ss
반복 3: → un happ i ness
...
최종:   un ## happ ## i ## ness  (4 tokens)
```

자주 함께 등장하는 문자 쌍을 하나의 새 토큰으로 합쳐나가면서, 자주 쓰이는 단어는 하나의 토큰으로, 드문 단어는 여러 서브워드로 표현됩니다.

### 왜 서브워드인가?

두 극단을 생각해 봅시다.

| 방식 | 장점 | 단점 |
|------|------|------|
| 문자 단위 | OOV(미등록어) 없음 | 시퀀스가 너무 길어짐 |
| 단어 단위 | 시퀀스 짧음 | 어휘 사전이 수백만 개, OOV 문제 심각 |
| **서브워드** | **균형** | **적당한 어휘 크기, OOV 최소화** |

GPT-4의 어휘 사전 크기는 약 100,000개, BERT는 약 30,000개입니다. 문자 단위라면 수십만 스텝이 필요한 문장도 서브워드로는 수십 토큰으로 처리할 수 있습니다.

---

## 언어별 토큰 효율 차이

![토큰 효율과 언어별 불균형](/assets/posts/tokenizer-vocab.svg)

이것이 실무에서 가장 중요한 포인트 중 하나입니다.

대부분의 주요 LLM은 **영어 중심 코퍼스**로 학습되었습니다. 결과적으로 어휘 사전의 대부분이 영어 단어/서브워드로 채워져 있습니다. 한국어, 아랍어, 힌디어 등은 훨씬 세밀하게 쪼개집니다.

```python
# 언어별 토큰 효율 비교 스크립트
import tiktoken

enc = tiktoken.encoding_for_model("gpt-4o")

sentences = {
    "English":  "Artificial intelligence is transforming the world.",
    "Korean":   "인공지능이 세상을 변화시키고 있습니다.",
    "Japanese": "人工知能が世界を変えています。",
    "Chinese":  "人工智能正在改变世界。",
    "Arabic":   "الذكاء الاصطناعي يغير العالم.",
}

print(f"{'언어':<12} {'토큰 수':>6}  {'토큰 목록'}")
print("-" * 60)
for lang, sentence in sentences.items():
    tokens = enc.encode(sentence)
    pieces = [enc.decode([t]) for t in tokens]
    print(f"{lang:<12} {len(tokens):>6}  {pieces}")
```

실제 결과를 보면 영어 문장이 약 8~9토큰인 데 비해 한국어 동등 문장은 13~16토큰이 나오는 경우가 많습니다. **비용도 1.5~2배**, **컨텍스트 창 소모도 1.5~2배**가 됩니다.

### 개선 추세

최근 출시되는 모델들은 이 문제를 인식하고 다국어 학습 데이터를 늘리는 방향으로 개선하고 있습니다. GPT-4o는 GPT-3.5 대비 한국어 토큰 효율이 크게 향상되었으며, Meta의 LLaMA 3나 Google의 Gemini도 다국어 효율을 명시적으로 개선했다고 밝혔습니다.

---

## 특수 토큰(Special Tokens)

토크나이저는 일반 텍스트 외에 특수 목적의 토큰도 관리합니다. 모델이 대화의 구조, 역할, 경계를 인식하는 데 사용됩니다.

```python
# Hugging Face transformers에서 특수 토큰 확인
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")

print("BOS 토큰:", tokenizer.bos_token, "→ ID:", tokenizer.bos_token_id)
print("EOS 토큰:", tokenizer.eos_token, "→ ID:", tokenizer.eos_token_id)
print("PAD 토큰:", tokenizer.pad_token)
print("UNK 토큰:", tokenizer.unk_token)
print("\n전체 특수 토큰:", tokenizer.all_special_tokens[:10])
```

주요 특수 토큰들의 역할입니다.

| 토큰 | 역할 |
|------|------|
| `<BOS>` / `<s>` | 시퀀스 시작을 알림 |
| `<EOS>` / `</s>` | 시퀀스 종료 신호, 모델이 여기서 생성을 멈춤 |
| `<PAD>` | 배치 처리 시 길이를 맞추는 패딩 |
| `<UNK>` | 어휘 사전에 없는 토큰 대체 (BPE에선 거의 안 씀) |
| `[MASK]` | BERT류 모델의 마스킹 학습용 |
| `<|im_start|>` | ChatML 형식의 턴 시작 |

---

## 컨텍스트 창과 토큰의 관계

모델에는 한 번에 처리할 수 있는 최대 토큰 수인 **컨텍스트 창(context window)**이 있습니다. 이 한계를 넘으면 초반 내용이 잘리거나 오류가 발생합니다.

```python
# 토큰 수를 미리 확인하고 안전하게 자르는 유틸리티
import tiktoken

def count_tokens(text: str, model: str = "gpt-4o") -> int:
    enc = tiktoken.encoding_for_model(model)
    return len(enc.encode(text))

def truncate_to_token_limit(text: str, max_tokens: int, model: str = "gpt-4o") -> str:
    enc = tiktoken.encoding_for_model(model)
    tokens = enc.encode(text)
    if len(tokens) <= max_tokens:
        return text
    return enc.decode(tokens[:max_tokens])

# 사용 예시
long_text = "매우 긴 문서 내용..." * 1000
token_count = count_tokens(long_text)
print(f"원본 토큰 수: {token_count:,}")

# GPT-4o 128k 컨텍스트에서 시스템 프롬프트 등을 위해 여유 확보
safe_limit = 120_000
truncated = truncate_to_token_limit(long_text, safe_limit)
print(f"자른 후 토큰 수: {count_tokens(truncated):,}")
```

주요 모델의 컨텍스트 창 크기(2025년 기준)입니다.

| 모델 | 컨텍스트 창 |
|------|------------|
| GPT-4o | 128K 토큰 |
| Claude 3.7 Sonnet | 200K 토큰 |
| Gemini 1.5 Pro | 1M 토큰 |
| LLaMA 3.1 405B | 128K 토큰 |

128K 토큰은 영어 기준 약 300페이지 분량의 텍스트입니다. 한국어라면 절반인 150페이지 정도로 봐야 합니다.

---

## 실전: 토큰 비용 최적화

API를 비용 효율적으로 사용하려면 토큰 수를 의식해야 합니다.

### 1. 프롬프트 압축

```python
# 불필요한 공백, 반복 표현 제거
def compress_prompt(text: str) -> str:
    import re
    # 연속 공백 제거
    text = re.sub(r'\s+', ' ', text)
    # 반복 줄바꿈 제거
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

original = """
안녕하세요.

저는 오늘    날씨에 대해서    물어보고 싶습니다.

오늘 서울    날씨가 어떤가요?
"""
compressed = compress_prompt(original)
print(f"원본: {count_tokens(original)} 토큰")
print(f"압축: {count_tokens(compressed)} 토큰")
```

### 2. 청킹(Chunking) 전략

긴 문서를 다룰 때는 의미 단위로 자르고 필요한 부분만 컨텍스트에 넣는 것이 핵심입니다. 이것이 RAG(검색 증강 생성)의 핵심 아이디어이기도 합니다.

```python
def chunk_by_tokens(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
    model: str = "gpt-4o",
) -> list[str]:
    """토큰 수 기준으로 텍스트를 청크로 분할 (overlap 포함)"""
    enc = tiktoken.encoding_for_model(model)
    tokens = enc.encode(text)
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        chunks.append(enc.decode(chunk_tokens))
        start += chunk_size - overlap
    return chunks

# 사용 예시
document = "긴 문서 내용 " * 500
chunks = chunk_by_tokens(document, chunk_size=500, overlap=50)
print(f"총 청크 수: {len(chunks)}")
for i, chunk in enumerate(chunks[:3]):
    print(f"청크 {i+1}: {count_tokens(chunk)} 토큰, {len(chunk)}자")
```

---

## 토크나이저 종류 비교

주요 LLM에서 사용하는 토크나이저를 정리합니다.

| 토크나이저 | 알고리즘 | 사용 모델 | 어휘 크기 |
|-----------|---------|----------|---------|
| tiktoken | BPE | GPT-3.5 / GPT-4 / GPT-4o | ~100K |
| SentencePiece | BPE / Unigram | LLaMA, Gemma, T5 | 32K~64K |
| WordPiece | BPE 변형 | BERT, DistilBERT | 30K |
| Tokenizers (HF) | BPE / Unigram | LLaMA 3, Mistral | 32K~128K |

```bash
# Hugging Face 토크나이저 설치 및 기본 사용
pip install transformers tiktoken sentencepiece

# 모델별 토크나이저 직접 비교
python3 - <<'EOF'
from transformers import AutoTokenizer

models = [
    "bert-base-uncased",
    "meta-llama/Llama-3.2-1B",
]
text = "Tokenization is the foundation of LLMs."

for model_name in models:
    try:
        tok = AutoTokenizer.from_pretrained(model_name)
        tokens = tok.tokenize(text)
        print(f"\n{model_name}")
        print(f"  토큰: {tokens}")
        print(f"  개수: {len(tokens)}")
    except Exception as e:
        print(f"{model_name}: {e}")
EOF
```

---

## 흔히 하는 오해

**"토큰 = 단어"라는 오해**  
`"ChatGPT"` 같은 합성어는 여러 토큰으로 나뉩니다. 반대로 `" the"` (앞에 공백 포함)와 `"the"`는 서로 다른 토큰입니다.

**"한 글자 = 한 토큰"이라는 오해**  
영어는 여러 글자가 하나의 토큰이 되는 경우가 많습니다. 한국어는 자음·모음 조합 때문에 오히려 한 음절이 여러 바이트로 인코딩되어 여러 토큰이 되기도 합니다.

**"컨텍스트 창이 크면 다 해결된다"는 오해**  
컨텍스트 창이 커도 토큰이 많아지면 비용은 선형적으로 증가하고, 모델이 먼 곳의 정보에 덜 집중하는 "lost in the middle" 현상도 발생합니다.

---

## 정리

토크나이저는 LLM과 인간 언어 사이의 번역기입니다. 텍스트를 모델이 처리할 수 있는 숫자 배열로, 다시 숫자를 텍스트로 변환하는 이 과정이 없으면 LLM 자체가 존재할 수 없습니다.

핵심 포인트를 정리합니다.

- 토큰은 서브워드 단위로, 단어도 문자도 아닌 그 중간
- BPE 알고리즘으로 빈출 패턴을 병합해 어휘 사전 구성
- 한국어는 영어 대비 1.5~2배 토큰 소모 → 비용·컨텍스트 효율 하락
- 컨텍스트 창 = 한 번에 처리 가능한 토큰 수의 한계
- API 비용 최적화를 위해 프롬프트 압축과 청킹 전략 필수

---

**지난 글:** [AI 에이전트와 MCP — LLM이 스스로 일한다는 것](/posts/ai-agents-and-mcp/)

**다음 글:** [임베딩(Embedding)이란 무엇인가 — 의미를 숫자로 바꾸는 기술](/posts/embedding-basics/)

<br>
읽어주셔서 감사합니다. 😊
