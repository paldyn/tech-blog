---
title: "t-SNE와 UMAP: 고차원 데이터를 눈으로 보다"
description: "t-SNE의 확률 분포 기반 원리와 UMAP의 위상수학적 접근을 비교하고, 임베딩 시각화 실전 코드와 하이퍼파라미터 튜닝 가이드를 제공한다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["tSNE", "UMAP", "차원축소", "시각화", "고차원데이터"]
featured: false
draft: false
---

[지난 글](/posts/ml-pca/)에서 PCA로 선형 차원 축소를 배웠다. PCA는 빠르고 재현 가능하지만, 비선형 구조(곡면, 군집)는 잘 포착하지 못한다는 한계가 있다. 784차원 MNIST 손글씨 데이터나 수천 차원의 LLM 임베딩을 2D로 펼쳐봤을 때, 숫자별 군집이 선명하게 보이면 데이터 구조가 건강하다는 신호다. 이 역할을 하는 것이 **t-SNE**와 **UMAP**이다. 둘 다 비선형 차원 축소 알고리즘으로, 고차원의 지역 구조(Local Structure)를 저차원에 충실히 재현하는 데 특화되어 있다.

## PCA만으로 부족한 이유

PCA는 **전역 분산**을 최대화하는 선형 투영을 찾는다. 따라서 비선형 매니폴드(Swiss Roll, 동심원 등)에는 한계가 있다.

```python
import numpy as np
from sklearn.datasets import load_digits
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

# MNIST 손글씨 데이터 (8x8 = 64차원)
digits = load_digits()
X = digits.data        # (1797, 64)
y = digits.target

# PCA로 2차원 축소
pca = PCA(n_components=2, random_state=42)
X_pca = pca.fit_transform(X)

# 클래스 분리 품질 확인
from sklearn.metrics import silhouette_score
sil_pca = silhouette_score(X_pca, y)
print(f"PCA 2D 실루엣 계수: {sil_pca:.4f}")
# 보통 0.1~0.2 수준 — 군집이 많이 겹침
```

## t-SNE: 확률 분포로 이웃 구조 보존

**t-SNE (t-Distributed Stochastic Neighbor Embedding)**는 2008년 Laurens van der Maaten과 Geoffrey Hinton이 발표했다. 핵심 아이디어는 다음과 같다.

**고차원 공간**: 각 점의 이웃 확률을 **가우시안 분포**로 모델링
```
p(j|i) = exp(-||xᵢ-xⱼ||² / 2σᵢ²) / Σₖ≠ᵢ exp(-||xᵢ-xₖ||² / 2σᵢ²)
```

**저차원 공간**: 이웃 확률을 **t-분포**로 모델링 (꼬리가 두꺼워 먼 점을 더 멀리 밀어냄)
```
q(j|i) = (1 + ||yᵢ-yⱼ||²)⁻¹ / Σₖ≠ᵢ (1 + ||yᵢ-yₖ||²)⁻¹
```

두 분포의 KL-Divergence를 최소화해 저차원 좌표를 최적화한다.

```python
from sklearn.manifold import TSNE
import time

# t-SNE 기본 사용
start = time.time()
tsne = TSNE(
    n_components=2,
    perplexity=30,       # 유효 이웃 수 (5~50 권장)
    learning_rate='auto',
    n_iter=1000,
    random_state=42,
    n_jobs=-1
)
X_tsne = tsne.fit_transform(X)
print(f"t-SNE 완료: {time.time()-start:.1f}초")

sil_tsne = silhouette_score(X_tsne, y)
print(f"t-SNE 2D 실루엣 계수: {sil_tsne:.4f}")
# 보통 0.4~0.6 수준 — PCA보다 훨씬 선명한 군집
```

![t-SNE vs UMAP vs PCA 비교](/assets/posts/ml-tsne-umap-comparison.svg)

## perplexity: t-SNE의 핵심 하이퍼파라미터

**perplexity**는 각 점의 "유효 이웃 수"를 제어한다. 직관적으로는 각 가우시안의 너비 σᵢ를 결정한다.

```python
# perplexity 값에 따른 결과 차이
for perp in [5, 15, 30, 50, 100]:
    tsne = TSNE(n_components=2, perplexity=perp,
                random_state=42, n_iter=500)
    X_t = tsne.fit_transform(X)
    sil = silhouette_score(X_t, y)
    print(f"perplexity={perp:3d}: 실루엣={sil:.4f}")

# perplexity 가이드:
# 작은 값 (5~10):  지역 구조 강조, 군집 내 세부 구조 보임
# 중간 값 (20~50): 균형 (권장 범위)
# 큰 값 (>100):   전역 구조 강조, 군집 간 간격 의미 있음

# 데이터 크기의 1/10 ~ 1/5 정도가 경험적 출발점
```

## UMAP: 빠르고 전역 구조도 보존

**UMAP (Uniform Manifold Approximation and Projection)**은 2018년 발표된 알고리즘으로, 위상 수학(Algebraic Topology)에 기반한다. t-SNE의 단점인 느린 속도와 전역 구조 소실을 개선했다.

```python
# umap-learn 설치 필요: pip install umap-learn
import umap

start = time.time()
reducer = umap.UMAP(
    n_components=2,
    n_neighbors=15,    # 지역/전역 균형 (5~50 권장)
    min_dist=0.1,      # 군집 내 점 간격 (0.0~0.99)
    metric='euclidean',
    random_state=42
)
X_umap = reducer.fit_transform(X)
print(f"UMAP 완료: {time.time()-start:.1f}초")
# t-SNE보다 5~10배 빠름

sil_umap = silhouette_score(X_umap, y)
print(f"UMAP 2D 실루엣 계수: {sil_umap:.4f}")

# 새 데이터 변환 가능 (t-SNE는 불가)
X_new_umap = reducer.transform(X[:10])
print(f"새 데이터 변환: {X_new_umap.shape}")
```

## n_neighbors와 min_dist: UMAP 핵심 파라미터

```python
# n_neighbors: 지역 vs 전역 구조 균형
# 작은 값 (5~10):  지역 구조 강조, 세밀한 군집
# 큰 값 (50~200): 전역 구조 강조, 큰 그림

# min_dist: 저차원 공간에서 점들의 최소 거리
# 작은 값 (0.0~0.1): 군집 내 점이 빽빽하게 뭉침
# 큰 값 (0.5~0.99): 점들이 더 넓게 퍼짐

for n_nbrs in [5, 15, 30, 50]:
    for min_d in [0.0, 0.1, 0.5]:
        red = umap.UMAP(n_neighbors=n_nbrs, min_dist=min_d,
                        random_state=42)
        Xu = red.fit_transform(X)
        sil = silhouette_score(Xu, y)
        print(f"n_neighbors={n_nbrs:2d}, "
              f"min_dist={min_d}: {sil:.4f}")
```

![t-SNE와 UMAP 구현 코드와 워크플로](/assets/posts/ml-tsne-umap-code.svg)

## 실전 워크플로: PCA → t-SNE/UMAP

고차원 데이터 직접 적용보다 PCA로 먼저 줄이는 것이 표준 패턴이다.

```python
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
import umap

# 단계 1: PCA로 50차원으로 축소 (노이즈 제거 + 속도 향상)
pca50 = PCA(n_components=50, random_state=42)
X_pca50 = pca50.fit_transform(X)
print(f"PCA 누적 분산: "
      f"{pca50.explained_variance_ratio_.sum():.1%}")

# 단계 2a: t-SNE로 2D 시각화
tsne = TSNE(n_components=2, perplexity=30,
            random_state=42, n_jobs=-1)
X_2d_tsne = tsne.fit_transform(X_pca50)

# 단계 2b: UMAP으로 2D 시각화
reducer = umap.UMAP(n_components=2, n_neighbors=15,
                    min_dist=0.1, random_state=42)
X_2d_umap = reducer.fit_transform(X_pca50)

# 단계 3: 시각화 (클래스별 색상)
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

fig, axes = plt.subplots(1, 2, figsize=(14, 6))
for ax, X_2d, title in zip(
    axes,
    [X_2d_tsne, X_2d_umap],
    ['t-SNE', 'UMAP']
):
    scatter = ax.scatter(X_2d[:, 0], X_2d[:, 1],
                         c=y, cmap='tab10', s=5, alpha=0.7)
    ax.set_title(title)
plt.colorbar(scatter, ax=axes[1])
plt.savefig('/tmp/tsne_umap_viz.png', dpi=120, bbox_inches='tight')
```

## t-SNE vs UMAP vs PCA 비교

| 항목 | PCA | t-SNE | UMAP |
|------|-----|-------|------|
| 기반 원리 | 선형 투영 | 확률 분포 (KL) | 위상 수학 |
| 지역 구조 보존 | 보통 | 우수 | 우수 |
| 전역 구조 보존 | 우수 | 취약 | 좋음 |
| 속도 (10만 샘플) | 초 단위 | 수십 분 | 수 분 |
| 재현성 | 완벽 | 낮음 | 중간 |
| 새 데이터 변환 | 가능 | 불가 | 가능 |
| 하이퍼파라미터 | 거의 없음 | perplexity | n_neighbors, min_dist |
| 주 용도 | 전처리, 노이즈 제거 | 탐색적 시각화 | 시각화 + 임베딩 |

## 시각화 해석 시 주의사항

비선형 차원 축소의 결과를 잘못 해석하면 오류를 범할 수 있다.

```python
# ⚠️ 흔한 실수들

# 1. 군집 간 거리 해석 금지
# t-SNE 2D에서 A군집이 B군집보다 C군집에 가깝다고 해서
# 고차원에서도 그렇지는 않다

# 2. 군집 크기 해석 주의
# t-SNE는 밀도를 균일하게 만드는 경향 → 실제 밀도 반영 안 됨

# 3. perplexity/n_neighbors 변경 시 구조 변화
# 여러 하이퍼파라미터로 실행해서 일관된 패턴만 신뢰

# 올바른 사용:
# - "이 두 클래스는 저차원에서도 분리된다" ✓
# - "특성 A와 B가 서로 유사한 군집을 형성한다" ✓
# - "군집 1이 군집 2보다 3배 크다" ✗ (t-SNE에서)
```

## LLM 임베딩 시각화 예시

t-SNE와 UMAP은 LLM 연구에서도 핵심 도구다.

```python
# sentence-transformers로 임베딩 후 UMAP 시각화
from sentence_transformers import SentenceTransformer

sentences = [
    "고양이가 소파 위에 앉아있다",
    "강아지가 공원에서 뛰어논다",
    # ... 수백 개의 문장
]

model = SentenceTransformer('jhgan/ko-sroberta-multitask')
embeddings = model.encode(sentences)  # (N, 768)

# UMAP으로 2D 시각화
reducer = umap.UMAP(n_neighbors=10, min_dist=0.05,
                    random_state=42)
emb_2d = reducer.fit_transform(embeddings)

# 유사한 문장들이 2D에서 가까이 모이는지 확인
print(f"임베딩 차원: {embeddings.shape}")
print(f"2D 축소 완료: {emb_2d.shape}")
```

t-SNE와 UMAP은 데이터 탐색, 모델 디버깅, 임베딩 품질 검증의 필수 도구다. 특히 LLM 시대에 수백~수천 차원의 임베딩을 다루는 일이 많아지면서 그 중요성이 더욱 커졌다. 이번 글로 지도 학습의 분류·회귀 알고리즘과 비지도 학습의 군집화·차원 축소를 모두 다뤘다. 다음 단계로는 신경망과 딥러닝의 세계가 기다린다.

---

**지난 글:** [PCA: 고차원 데이터를 압축하는 차원 축소](/posts/ml-pca/)

<br>
읽어주셔서 감사합니다. 😊
