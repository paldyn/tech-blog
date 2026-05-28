---
title: "HuggingFace Datasets로 데이터 관리하기"
description: "load_dataset()으로 허브 데이터 로딩, Dataset.map()으로 전처리 파이프라인 구성, 스트리밍 모드와 캐싱 전략, push_to_hub()로 데이터셋 공유까지 — HuggingFace Datasets의 핵심 패턴을 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["HuggingFace", "Datasets", "load_dataset", "DatasetDict", "IterableDataset", "KLUE", "NSMC", "KorQuAD", "데이터 전처리"]
featured: false
draft: false
---

[지난 글](/posts/huggingface-transformers/)에서 HuggingFace Transformers로 파인튜닝하는 방법을 살펴봤다. 실제 학습 파이프라인을 완성하려면 모델만큼 중요한 것이 **데이터 관리**다. 이번 글에서는 Transformers와 찰떡궁합인 **HuggingFace Datasets** 라이브러리를 집중적으로 다룬다. 허브에서 데이터를 내려받고, 전처리하고, 허브에 다시 올리는 전 과정을 코드 중심으로 정리했다.

## HuggingFace Datasets란?

`datasets` 라이브러리는 Apache Arrow 포맷을 기반으로 데이터를 메모리 맵(mmap) 방식으로 다룬다. 덕분에 수십 GB짜리 데이터셋도 RAM에 올리지 않고 빠르게 슬라이싱할 수 있다. 또한 모든 변환(map, filter, sort 등)의 결과를 캐시에 저장하기 때문에, 동일한 전처리를 반복 실행할 때 두 번째부터는 즉시 결과를 반환한다.

```bash
pip install datasets
```

## load_dataset(): 데이터 로딩의 모든 것

![HuggingFace Datasets — load_dataset() 흐름](/assets/posts/huggingface-datasets-api.svg)

`load_dataset()`은 허브 데이터셋 이름, 로컬 경로, 또는 직접 작성한 로딩 스크립트를 받아 `Dataset` 또는 `DatasetDict` 객체를 반환한다.

```python
from datasets import load_dataset

# 1) 허브에서 로드 — DatasetDict 반환
ds = load_dataset("klue", "ynat")
# DatasetDict({'train': Dataset(...), 'validation': Dataset(...)})

# 2) split 지정 — Dataset 반환
train_ds = load_dataset("klue", "ynat", split="train")
# Dataset(features={'title': Value('string'), 'label': ClassLabel(...)}, num_rows=45678)

# 3) 일부만 로드
small = load_dataset("klue", "ynat", split="train[:1000]")

# 4) 로컬 CSV / JSON
local_ds = load_dataset("csv", data_files="data.csv")
local_json = load_dataset("json", data_files={"train": "train.jsonl"})
```

### DatasetDict 다루기

```python
# 모든 split 이름 확인
print(ds.keys())         # dict_keys(['train', 'validation'])

# 각 split 접근
train = ds["train"]
val   = ds["validation"]

# 로우 접근
print(train[0])          # {'title': '..', 'label': 3, 'url': '..'}
print(train[:5])         # 컬럼별 리스트

# 컬럼 이름
print(train.column_names)
# ['title', 'label', 'url', 'date']

# 기본 통계
print(train.features)
print(len(train))
```

## 한국어 데이터셋 활용

HuggingFace Hub에는 주요 한국어 벤치마크가 올라와 있다.

### KLUE (Korean Language Understanding Evaluation)

```python
from datasets import load_dataset

# KLUE-TC: 뉴스 주제 분류 (7개 클래스)
klue_tc  = load_dataset("klue", "ynat")

# KLUE-NLI: 자연어 추론
klue_nli = load_dataset("klue", "nli")

# KLUE-NER: 개체명 인식
klue_ner = load_dataset("klue", "ner")

# KLUE-RE: 관계 추출
klue_re  = load_dataset("klue", "re")
```

### NSMC (Naver Sentiment Movie Corpus)

감성 분석 태스크의 기본 벤치마크다. 긍정(1)/부정(0) 레이블이 붙은 영화 리뷰 15만 건으로 구성된다.

```python
nsmc = load_dataset("nsmc")
# DatasetDict({'train': Dataset(150000 rows), 'test': Dataset(50000 rows)})

# 샘플 확인
print(nsmc["train"][0])
# {'id': '9976970', 'document': '아 더빙.. 진짜 짜증나네요 목소리', 'label': 0}
```

### KorQuAD (Korean Question Answering Dataset)

MRC(기계 독해) 태스크 데이터셋이다. SQuAD 형식으로 질문-지문-정답 span이 포함된다.

```python
korquad = load_dataset("squad_kor_v1")
# features: {'id', 'title', 'context', 'question', 'answers'}
```

## Dataset.map(): 전처리 파이프라인

![Dataset.map() — 데이터 변환 파이프라인](/assets/posts/huggingface-datasets-map.svg)

`map()`은 데이터셋의 각 로우(또는 배치)에 함수를 적용해 새 데이터셋을 반환한다. `batched=True`로 설정하면 배치 단위로 처리되어 토크나이저 실행 속도가 최대 10배 빨라진다.

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("klue/bert-base")

def preprocess(batch):
    return tokenizer(
        batch["document"],          # NSMC의 텍스트 컬럼
        truncation=True,
        max_length=128,
        padding="max_length"
    )

# batched=True + num_proc=4 → 멀티코어 병렬 처리
tokenized = nsmc["train"].map(
    preprocess,
    batched=True,
    num_proc=4,
    remove_columns=["id", "document"]   # 불필요한 컬럼 제거
)
tokenized.set_format("torch", columns=["input_ids", "attention_mask", "label"])
```

### 컬럼 조작 API

```python
# 필터링
pos_only = ds.filter(lambda x: x["label"] == 1)

# 컬럼 이름 변경
ds = ds.rename_column("document", "text")

# 컬럼 제거
ds = ds.remove_columns(["id"])

# 정렬 / 셔플
ds = ds.sort("label")
ds = ds.shuffle(seed=42)

# 훈련/검증 분리
split = ds.train_test_split(test_size=0.1, seed=42)
train_ds = split["train"]
eval_ds  = split["test"]
```

## 스트리밍 모드 (IterableDataset)

수백 GB 이상의 대용량 데이터셋은 로컬에 다운로드하지 않고 스트리밍으로 처리할 수 있다. `streaming=True`를 전달하면 `IterableDataset`이 반환된다.

```python
# 스트리밍 — 다운로드 없이 즉시 사용
stream_ds = load_dataset(
    "oscar",
    "unshuffled_deduplicated_ko",
    streaming=True,
    split="train"
)

# for 루프로 로우 단위 소비
for row in stream_ds.take(5):
    print(row["text"][:80])

# map/filter도 동일하게 동작
filtered = stream_ds.filter(lambda x: len(x["text"]) > 200)
```

`IterableDataset`은 인덱스 접근(`ds[0]`)이 불가능하고, 셔플 버퍼 크기가 RAM을 결정한다는 점에 주의해야 한다.

```python
# 셔플 버퍼 크기 지정 (메모리 제한에 맞춰 조정)
shuffled = stream_ds.shuffle(seed=42, buffer_size=10_000)
```

## 캐싱 전략

`datasets`는 `~/.cache/huggingface/datasets/`에 Arrow 파일로 결과를 캐시한다. `map()` 결과도 함수 소스 코드 해시 기반으로 캐시되어, 동일한 전처리는 재실행 없이 바로 로드된다.

```python
import datasets

# 캐시 디렉터리 변경
datasets.config.HF_DATASETS_CACHE = "/data/hf_cache"

# 특정 작업의 캐시 무효화
tokenized = ds.map(preprocess, batched=True, load_from_cache_file=False)

# 캐시 완전 삭제
ds.cleanup_cache_files()
```

캐시 덕분에 Colab처럼 런타임이 재시작되어도 전처리 결과가 그대로 남아 있다. 다만 함수 내용이 바뀌었는데 캐시가 남아 있으면 **오래된 결과**가 반환될 수 있으니, 전처리 로직을 수정한 경우 `load_from_cache_file=False`를 명시하는 것이 안전하다.

## push_to_hub(): 데이터셋 허브에 업로드

학습 데이터나 평가 데이터를 팀과 공유하거나 논문 재현을 위해 허브에 올릴 수 있다.

```python
from huggingface_hub import notebook_login
notebook_login()   # 토큰 입력

# Dataset 업로드
tokenized.push_to_hub("my-username/klue-ynat-tokenized")

# DatasetDict 통째로 업로드
full_ds = DatasetDict({"train": train_ds, "test": eval_ds})
full_ds.push_to_hub("my-username/nsmc-processed")

# private 리포지터리
full_ds.push_to_hub("my-username/private-dataset", private=True)
```

업로드가 완료되면 `load_dataset("my-username/klue-ynat-tokenized")`로 어디서든 재사용할 수 있다.

## DatasetDict 직접 생성

로컬 데이터를 `Dataset`으로 변환한 뒤 `DatasetDict`로 묶는 패턴도 자주 쓴다.

```python
from datasets import Dataset, DatasetDict

# pandas DataFrame에서 변환
import pandas as pd
df_train = pd.read_csv("train.csv")
df_test  = pd.read_csv("test.csv")

ds_dict = DatasetDict({
    "train": Dataset.from_pandas(df_train),
    "test":  Dataset.from_pandas(df_test),
})

# dict / list에서 직접 생성
records = [{"text": "안녕", "label": 1}, {"text": "싫어", "label": 0}]
tiny_ds = Dataset.from_list(records)
```

## 정리

| 기능 | 메서드 |
|------|--------|
| 허브 로드 | `load_dataset("name", split="train")` |
| 전처리 | `ds.map(fn, batched=True, num_proc=N)` |
| 컬럼 제거 | `ds.remove_columns([...])` |
| 필터링 | `ds.filter(lambda x: ...)` |
| 분리 | `ds.train_test_split(test_size=0.2)` |
| 스트리밍 | `load_dataset(..., streaming=True)` |
| 업로드 | `ds.push_to_hub("user/name")` |

HuggingFace Datasets는 Transformers의 Trainer API와 자연스럽게 통합된다. 다음 글에서는 이 데이터셋과 모델을 **허브에 올리고 공유**하는 방법인 HuggingFace Hub를 다룬다.

---

**지난 글:** [HuggingFace Transformers 실전 가이드](/posts/huggingface-transformers/)

**다음 글:** [HuggingFace Hub: 모델 공유와 배포](/posts/huggingface-hub/)

<br>
읽어주셔서 감사합니다. 😊
