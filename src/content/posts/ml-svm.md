---
title: "서포트 벡터 머신(SVM): 최대 마진 분류기의 원리"
description: "서포트 벡터, 마진, 커널 트릭까지 SVM의 핵심 원리를 시각적으로 이해하고 scikit-learn으로 구현한다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["SVM", "서포트벡터머신", "커널트릭", "마진", "ML기초"]
featured: false
draft: false
---

[지난 글](/posts/ml-naive-bayes/)에서 확률 기반의 나이브 베이즈를 배웠다. 이번에는 완전히 다른 기하학적 접근으로 분류를 수행하는 **서포트 벡터 머신(Support Vector Machine, SVM)**을 다룬다. SVM의 핵심 아이디어는 단순하다. 두 클래스를 나누는 경계선(초평면)은 무수히 많은데, 그 중에서 **두 클래스 사이의 간격(마진)이 가장 넓은** 경계선을 선택하자는 것이다. 마진이 클수록 새로운 데이터에 대한 일반화 성능이 좋아진다.

## 최대 마진 초평면

분류 경계를 **초평면(Hyperplane)**이라고 한다. 2차원에서는 선, 3차원에서는 평면, n차원에서는 (n-1)차원 초평면이다.

```python
import numpy as np
from sklearn.svm import SVC
from sklearn.datasets import make_classification
from sklearn.preprocessing import StandardScaler

# 선형으로 분리 가능한 데이터 생성
X, y = make_classification(
    n_samples=100, n_features=2,
    n_redundant=0, n_informative=2,
    random_state=42, n_clusters_per_class=1
)

# SVM은 스케일에 민감 → 반드시 표준화!
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# 선형 SVM (hard margin: 오분류 허용 안 함)
svm_linear = SVC(kernel='linear', C=1.0)
svm_linear.fit(X_scaled, y)

print(f"지지 벡터 수: {svm_linear.n_support_}")
print(f"지지 벡터 인덱스:\n{svm_linear.support_}")
print(f"결정 경계 가중치 w: {svm_linear.coef_}")
print(f"편향 b: {svm_linear.intercept_}")
```

마진의 너비는 `2 / ||w||`이다. 마진을 최대화하려면 ||w||를 최소화해야 한다. 이것이 SVM의 최적화 문제다.

![SVM 최대 마진 초평면](/assets/posts/ml-svm-margin.svg)

## 서포트 벡터: 경계를 결정하는 핵심 데이터

**서포트 벡터(Support Vector)**는 결정 경계에서 가장 가까이 있는 훈련 데이터 포인트들이다. 이 소수의 점들만이 모델을 정의하며, 나머지 데이터는 제거해도 결과가 바뀌지 않는다. 이 특성이 SVM을 메모리 효율적으로 만든다.

```python
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# 서포트 벡터 시각화
fig, ax = plt.subplots(figsize=(8, 6))

# 전체 데이터
ax.scatter(X_scaled[y==0, 0], X_scaled[y==0, 1],
           c='steelblue', label='Class 0')
ax.scatter(X_scaled[y==1, 0], X_scaled[y==1, 1],
           c='salmon', label='Class 1')

# 서포트 벡터 강조
sv = svm_linear.support_vectors_
ax.scatter(sv[:, 0], sv[:, 1],
           s=200, facecolors='none',
           edgecolors='yellow', linewidth=2,
           label='Support Vectors')

ax.legend()
plt.tight_layout()
plt.savefig('/tmp/svm_sv.png', dpi=100)
print(f"서포트 벡터 {len(sv)}개가 결정 경계를 결정")
```

## 소프트 마진: 오분류를 허용하는 현실적 SVM

실제 데이터는 완전히 선형 분리가 되지 않는 경우가 많다. **소프트 마진(Soft Margin)**은 일부 오분류를 허용하는 대신 더 유연한 경계를 찾는다.

**C 파라미터**: 마진 너비 vs. 오분류 허용 트레이드오프

```python
from sklearn.model_selection import cross_val_score

# C 값에 따른 영향
for C in [0.01, 0.1, 1.0, 10.0, 100.0]:
    svm = SVC(kernel='linear', C=C)
    scores = cross_val_score(svm, X_scaled, y, cv=5)
    print(f"C={C:6.2f}: CV 정확도 {scores.mean():.4f} "
          f"(±{scores.std():.4f})")

# C가 작을수록: 마진 넓음, 더 많은 오분류 허용 → 과소적합 위험
# C가 클수록:  마진 좁음, 오분류 줄임 → 과적합 위험
```

## 커널 트릭: 비선형 분류를 가능하게 하는 마법

XOR 문제처럼 선형으로 분리 불가능한 데이터가 있다. **커널 트릭**은 데이터를 고차원 공간으로 변환하면 선형 분리가 가능해진다는 수학적 원리를 활용한다.

```python
from sklearn.datasets import make_circles, make_moons

# 원형 데이터 (선형 분리 불가)
X_circles, y_circles = make_circles(
    n_samples=200, noise=0.1, factor=0.3, random_state=42
)
X_circles = StandardScaler().fit_transform(X_circles)

# 다양한 커널 비교
kernels = {
    'linear': SVC(kernel='linear', C=1.0),
    'rbf':    SVC(kernel='rbf',    C=1.0, gamma='scale'),
    'poly':   SVC(kernel='poly',   C=1.0, degree=3, gamma='scale'),
    'sigmoid':SVC(kernel='sigmoid', C=1.0, gamma='scale')
}

for name, model in kernels.items():
    scores = cross_val_score(model, X_circles, y_circles, cv=5)
    print(f"{name:8s}: {scores.mean():.4f} ±{scores.std():.4f}")

# 결과:
# linear:   ~0.54 (원형 데이터에 취약)
# rbf:      ~0.99 (원형 데이터에 완벽)
# poly:     ~0.96
```

![SVM 커널 트릭과 비선형 분류](/assets/posts/ml-svm-kernel.svg)

### 주요 커널 함수

**RBF (Radial Basis Function, 가우시안) 커널 - 가장 많이 사용**:
```
K(x, x') = exp(-γ||x - x'||²)
```
- `gamma`: 가우시안의 너비. 크면 복잡한 경계, 작으면 단순한 경계

**다항식(Polynomial) 커널**:
```
K(x, x') = (γ·xᵀx' + r)^d
```
- `degree`: 다항식 차수

**선형(Linear) 커널**:
```
K(x, x') = xᵀx'
```
- 텍스트 분류, 고차원 데이터에 효과적

## C와 gamma 하이퍼파라미터 튜닝

RBF 커널 SVM의 두 핵심 파라미터:

```python
from sklearn.model_selection import GridSearchCV

X_moons, y_moons = make_moons(n_samples=300, noise=0.2,
                               random_state=42)
X_moons = StandardScaler().fit_transform(X_moons)

# C와 gamma 격자 탐색
param_grid = {
    'C':     [0.1, 1, 10, 100],
    'gamma': [0.001, 0.01, 0.1, 1, 'scale', 'auto']
}

grid = GridSearchCV(
    SVC(kernel='rbf'),
    param_grid,
    cv=5,
    scoring='accuracy',
    n_jobs=-1
)
grid.fit(X_moons, y_moons)

print(f"최적 파라미터: {grid.best_params_}")
print(f"최적 CV 점수: {grid.best_score_:.4f}")

# 실전 팁:
# C × gamma를 동시에 올리면 과적합
# gamma='scale': 1/(n_features * X.var()) — 좋은 출발점
```

## SVM 회귀 (SVR)

SVM은 분류뿐 아니라 회귀에도 사용된다. **SVR(Support Vector Regression)**은 예측값이 ε-튜브 안에 들어오도록 학습한다.

```python
from sklearn.svm import SVR
from sklearn.metrics import mean_squared_error
import numpy as np

# 비선형 회귀 예시
rng = np.random.RandomState(42)
X_reg = np.sort(5 * rng.rand(100, 1), axis=0)
y_reg = np.sin(X_reg).ravel() + rng.randn(100) * 0.1

X_reg_scaled = StandardScaler().fit_transform(X_reg)

svr = SVR(kernel='rbf', C=100, gamma=0.1, epsilon=0.1)
svr.fit(X_reg_scaled, y_reg)

y_pred = svr.predict(X_reg_scaled)
rmse = mean_squared_error(y_reg, y_pred) ** 0.5
print(f"SVR RMSE: {rmse:.4f}")
# epsilon: 허용 오차 범위 (튜브 너비)
```

## SVM의 강점과 약점

**강점:**
- **고차원 공간에서 효과적**: 특성 수가 샘플 수보다 많아도 잘 동작
- **메모리 효율**: 서포트 벡터만 저장
- **강력한 이론적 기반**: 구조적 위험 최소화(SRM) 이론
- **다양한 커널**: 비선형 패턴 포착 가능
- **이상치 강건**: 서포트 벡터만 경계에 영향

**약점:**
- **대규모 데이터에 느림**: 학습 시간 O(n²~n³) — 수만 샘플이 한계
- **확률 출력 없음**: 기본적으로 결정 값만 출력 (probability=True로 가능하나 느림)
- **특성 스케일링 필수**: 거리 기반이므로 표준화 반드시 필요
- **해석 어려움**: 특히 RBF 커널 사용 시

## 실전 체크리스트

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

# SVM 파이프라인 (스케일링 포함)
svm_pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('svm',    SVC(kernel='rbf', C=1.0, gamma='scale',
                   probability=True))  # 확률 출력 활성화
])

# 데이터 크기별 권장 설정
# < 10,000 샘플: SVC (정확, 느림)
# > 10,000 샘플: LinearSVC 또는 SGDClassifier(SVM)

from sklearn.svm import LinearSVC
linear_svc = LinearSVC(C=1.0, max_iter=2000)
# LinearSVC: liblinear 기반, 대용량에 적합 (kernel 없음)
```

SVM은 데이터가 많지 않고 차원이 높은 문제(텍스트, 이미지 특성 벡터)에서 탁월하다. 딥러닝 이전에는 이미지 분류의 최강자였고, 현재도 중소 규모 데이터셋에서 강력한 베이스라인을 제공한다. 다음 글에서는 질문의 연쇄로 데이터를 나누는 **결정 트리**를 살펴본다.

---

**지난 글:** [나이브 베이즈: 빠르고 강력한 확률적 분류기](/posts/ml-naive-bayes/)

**다음 글:** [결정 트리: 질문의 연쇄로 만드는 분류 모델](/posts/ml-decision-tree/)

<br>
읽어주셔서 감사합니다. 😊
