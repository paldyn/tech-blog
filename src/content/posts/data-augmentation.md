---
title: "데이터 증강: 적은 데이터로 더 강한 모델 만들기"
description: "역번역·EDA·CutMix·SMOTE·SpecAugment 등 텍스트·이미지·오디오 도메인별 증강 기법을 정리하고, Albumentations를 이용한 학습 파이프라인 구축을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["데이터증강", "Albumentations", "역번역", "CutMix", "SMOTE", "SpecAugment", "과적합방지"]
featured: false
draft: false
---

[지난 글](/posts/data-labeling/)에서 AI 학습을 위한 레이블링 과정을 살펴봤다. 충분한 데이터를 확보했더라도, 더 많은 데이터는 항상 도움이 된다. **데이터 증강(Data Augmentation)**은 기존 데이터를 변형·확장해 모델이 더 다양한 패턴을 학습하도록 한다.

## 왜 증강이 필요한가

데이터 증강의 핵심 목적은 두 가지다. 첫째, **과적합 방지**: 모델이 학습 데이터를 암기하지 않고 일반적인 패턴을 학습하도록 한다. 둘째, **데이터 부족 해결**: 의료 이미지처럼 레이블링 비용이 높은 도메인에서 적은 데이터로도 좋은 성능을 낼 수 있다.

실험적으로, 이미지 분류에서 기본적인 증강(플립·회전·크롭)만 추가해도 정확도가 5~10% 향상되는 경우가 많다.

## 텍스트 증강 기법

```python
# EDA (Easy Data Augmentation) 구현
import random
import nltk
from nltk.corpus import wordnet

def synonym_replacement(sentence: str, n: int = 1) -> str:
    """n개 단어를 동의어로 치환"""
    words = sentence.split()
    augmented = words.copy()

    replaced = 0
    indices = random.sample(range(len(words)), min(n, len(words)))
    for idx in indices:
        synonyms = []
        for syn in wordnet.synsets(words[idx], lang='kor'):
            for lemma in syn.lemmas(lang='kor'):
                if lemma.name() != words[idx]:
                    synonyms.append(lemma.name())
        if synonyms:
            augmented[idx] = random.choice(synonyms)
            replaced += 1

    return " ".join(augmented)

def random_deletion(sentence: str, p: float = 0.1) -> str:
    """각 단어를 확률 p로 삭제"""
    words = sentence.split()
    if len(words) == 1:
        return sentence
    remaining = [w for w in words if random.random() > p]
    return " ".join(remaining) if remaining else random.choice(words)

def random_swap(sentence: str, n: int = 1) -> str:
    """n쌍의 단어 위치를 무작위 교환"""
    words = sentence.split()
    for _ in range(n):
        if len(words) >= 2:
            i, j = random.sample(range(len(words)), 2)
            words[i], words[j] = words[j], words[i]
    return " ".join(words)

# 원문: "이 제품은 정말 훌륭합니다"
text = "이 제품은 정말 훌륭합니다"
print(synonym_replacement(text, n=1))   # "이 물건은 정말 훌륭합니다"
print(random_deletion(text, p=0.1))     # "이 제품은 정말합니다"
print(random_swap(text, n=1))           # "이 제품은 훌륭합니다 정말"
```

**역번역(Back-Translation)**은 높은 품질의 변형을 만든다.

```python
from deep_translator import GoogleTranslator

def back_translate(text: str, pivot_lang: str = "en") -> str:
    """한국어 → 영어 → 한국어 역번역"""
    # 영어로 번역
    en_text = GoogleTranslator(source="ko", target=pivot_lang).translate(text)
    # 다시 한국어로
    ko_text = GoogleTranslator(source=pivot_lang, target="ko").translate(en_text)
    return ko_text

original = "이 카페의 커피는 정말 향기롭고 맛있어요"
augmented = back_translate(original)
# → "이 카페의 커피는 매우 향기롭고 맛있습니다" (표현이 달라짐)
```

## 이미지 증강 기법

![데이터 증강 기법 분류](/assets/posts/data-augmentation-techniques.svg)

**CutMix**는 두 이미지를 잘라 붙이고 레이블도 비율에 맞게 섞는다.

```python
import torch
import numpy as np

def cutmix(images, labels, alpha=1.0):
    batch_size = images.size(0)
    lam = np.random.beta(alpha, alpha)

    rand_idx = torch.randperm(batch_size)
    shuffled_images = images[rand_idx]
    shuffled_labels = labels[rand_idx]

    # 잘라낼 영역 좌표 계산
    H, W = images.size()[2:]
    cut_ratio = np.sqrt(1 - lam)
    cut_h = int(H * cut_ratio)
    cut_w = int(W * cut_ratio)

    cx = np.random.randint(W)
    cy = np.random.randint(H)
    x1 = max(0, cx - cut_w // 2)
    x2 = min(W, cx + cut_w // 2)
    y1 = max(0, cy - cut_h // 2)
    y2 = min(H, cy + cut_h // 2)

    images[:, :, y1:y2, x1:x2] = shuffled_images[:, :, y1:y2, x1:x2]
    lam = 1 - (x2 - x1) * (y2 - y1) / (H * W)  # 실제 혼합 비율

    # 레이블 혼합 (One-hot이면 보간, 정수면 두 레이블 반환)
    return images, labels, shuffled_labels, lam

# 학습 루프에서 사용
images, labels_a, labels_b, lam = cutmix(images, labels)
loss = lam * criterion(outputs, labels_a) + (1 - lam) * criterion(outputs, labels_b)
```

![Albumentations 이미지 증강 파이프라인](/assets/posts/data-augmentation-pipeline.svg)

## 테이블 데이터: SMOTE

```python
from imblearn.over_sampling import SMOTE
from collections import Counter

# 불균형 데이터: 클래스 A 1000개, 클래스 B 100개
print(f"증강 전: {Counter(y_train)}")

smote = SMOTE(
    sampling_strategy=0.5,  # 소수 클래스를 다수의 50%까지 증가
    k_neighbors=5,          # 가장 가까운 5개 이웃으로 합성
    random_state=42
)
X_resampled, y_resampled = smote.fit_resample(X_train, y_train)
print(f"증강 후: {Counter(y_resampled)}")

# SMOTE는 소수 클래스 두 샘플 사이를 선형 보간해 새 샘플 생성
# 실제 데이터 분포에 더 가까운 합성 데이터 생성
```

## 오디오: SpecAugment

구글의 SpecAugment는 음성 인식 모델 학습에서 과적합을 효과적으로 방지한다.

```python
import torchaudio
import torch

def spec_augment(
    mel_spectrogram: torch.Tensor,
    freq_mask_param: int = 30,
    time_mask_param: int = 100,
    n_freq_masks: int = 2,
    n_time_masks: int = 2
) -> torch.Tensor:
    """멜 스펙트로그램에 주파수·시간 마스킹 적용"""
    augmented = mel_spectrogram.clone()
    n_freq, n_frames = augmented.shape[-2], augmented.shape[-1]

    # 주파수 마스킹: 특정 주파수 대역을 0으로
    for _ in range(n_freq_masks):
        f = torch.randint(0, freq_mask_param, (1,)).item()
        f0 = torch.randint(0, n_freq - f, (1,)).item()
        augmented[..., f0:f0 + f, :] = 0

    # 시간 마스킹: 특정 시간 구간을 0으로
    for _ in range(n_time_masks):
        t = torch.randint(0, time_mask_param, (1,)).item()
        t0 = torch.randint(0, n_frames - t, (1,)).item()
        augmented[..., t0:t0 + t] = 0

    return augmented
```

## 증강의 주의사항

**레이블 보존**: 증강 후에도 레이블이 유효한지 확인해야 한다. 예를 들어 OCR 태스크에서 텍스트 이미지를 뒤집으면 레이블이 무효가 된다.

**검증/테스트셋 적용 금지**: 증강은 오직 학습셋에만 적용한다. 검증셋에 증강을 적용하면 평가 지표가 왜곡된다.

**도메인 지식 반영**: 의료 이미지에서 색상 반전은 의미 없는 증강이다. 도메인 특성에 맞는 증강을 선택해야 한다.

**과도한 증강 피하기**: 너무 공격적인 증강은 오히려 학습을 방해한다. 증강 강도를 검증셋 성능으로 튜닝해야 한다.

데이터 증강은 데이터 효율을 높이는 가장 실용적인 방법이다. 새 모델 아키텍처를 고민하기 전에, 증강 파이프라인을 먼저 강화하는 것이 대부분의 경우 더 효과적이다.

---

**지난 글:** [데이터 레이블링: AI가 학습할 정답을 만드는 과정](/posts/data-labeling/)

**다음 글:** [합성 데이터: AI가 AI를 위한 데이터를 만들다](/posts/data-synthetic/)

<br>
읽어주셔서 감사합니다. 😊
