---
title: "matplotlib 기초: 첫 그래프 그리기"
description: "matplotlib의 Figure와 Axes 구조를 이해하고, 객체지향 방식으로 첫 그래프를 그리는 흐름을 정리합니다. plt.subplots부터 축 라벨·범례·저장까지 기본기를 한 번에 잡습니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["matplotlib", "시각화", "그래프", "데이터분석", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-pandas-merge/)에서 흩어진 데이터를 하나로 모았다면, 다음 본능은 그것을 눈으로 보는 것이다. 숫자 표를 백 줄 들여다보는 것보다 그래프 하나가 추세를 훨씬 빨리 알려 준다. 파이썬 시각화의 사실상 표준은 matplotlib이고, pandas의 `.plot()`이나 seaborn도 그 위에서 돈다. 그래서 matplotlib의 기본 구조를 한 번 잡아 두면 이후 모든 시각화가 수월해진다.

## Figure와 Axes: 도화지와 그래프

matplotlib를 처음 쓰면 가장 헷갈리는 것이 용어다. 핵심 두 가지만 구분하면 된다. **Figure는 전체 도화지**이고, **Axes는 그 위에 놓이는 하나의 그래프 영역**이다. 도화지 하나에 그래프 여러 개(여러 Axes)를 배치할 수도 있다.

![Figure 안에 Axes가 들어 있다](/assets/posts/python-matplotlib-basics-figure-axes.svg)

여기서 주의할 점은 Axes가 "축(axis)"이 아니라 **그래프 영역 전체**를 뜻한다는 것이다. x축과 y축, 그 위의 선, 제목, 라벨이 모두 한 Axes 안에 들어 있다. 우리가 코드에서 가장 자주 다루는 객체가 바로 이 `ax`다.

## 객체지향 방식으로 첫 그래프

matplotlib에는 `plt.plot(...)`처럼 바로 그리는 간편한 방식도 있지만, 권장되는 것은 **Figure와 Axes를 명시적으로 잡는 객체지향 방식**이다. `plt.subplots()`가 둘을 한 번에 만들어 돌려준다.

![기본 흐름: 만들고 → 그리고 → 꾸미고 → 보여 준다](/assets/posts/python-matplotlib-basics-workflow.svg)

```python
import matplotlib.pyplot as plt

x = [1, 2, 3, 4, 5]
y = [1, 4, 9, 16, 25]

fig, ax = plt.subplots()        # 도화지와 그래프 영역 생성
ax.plot(x, y, marker="o")       # 선 그래프 그리기
ax.set_xlabel("x")
ax.set_ylabel("y = x^2")
ax.set_title("첫 그래프")
plt.show()                      # 화면에 표시
```

흐름은 늘 같다. `subplots()`로 `fig`, `ax`를 만들고, `ax`에 데이터를 그리고, `ax`의 메서드로 축과 제목을 꾸미고, 마지막에 `show()`로 보여 준다. 복잡한 그래프일수록 이 명시적 방식이 "지금 어느 그래프를 건드리는가"를 헷갈리지 않게 해 준다.

## 여러 그래프를 한 화면에

`subplots`에 행·열 개수를 주면 격자 형태로 여러 Axes를 한 번에 만든다. 반환된 `ax`는 배열이라 인덱스로 각각 접근한다.

```python
fig, axes = plt.subplots(1, 2, figsize=(10, 4))

axes[0].plot(x, y)
axes[0].set_title("선")

axes[1].bar(x, y)
axes[1].set_title("막대")

fig.tight_layout()    # 겹침 방지
```

`figsize`로 도화지 크기를(인치 단위), `tight_layout()`으로 라벨이 서로 겹치지 않게 간격을 자동 조정한다.

## 자주 쓰는 그래프 종류

Axes에는 그래프 종류별 메서드가 준비돼 있다. 데이터의 성격에 맞춰 고른다.

```python
ax.plot(x, y)        # 선 — 추세, 시계열
ax.scatter(x, y)     # 산점도 — 두 변수 관계
ax.bar(labels, h)    # 막대 — 범주별 비교
ax.hist(data)        # 히스토그램 — 분포
```

## 화면 대신 파일로 저장

스크립트로 그래프를 만들 때는 화면에 띄우는 대신 파일로 저장하는 일이 많다. `savefig`를 쓰고, 해상도는 `dpi`로 조절한다.

```python
fig.savefig("plot.png", dpi=150, bbox_inches="tight")
```

`bbox_inches="tight"`는 그래프 주변의 불필요한 여백을 잘라 준다. 보고서나 슬라이드에 넣을 그림을 만들 때 유용하다.

matplotlib의 첫 관문은 결국 "Figure는 도화지, Axes는 그래프"라는 구분과, `subplots → plot → 꾸미기 → show/savefig`라는 흐름이다. 이 골격만 익히면 나머지는 메서드 이름을 찾아 채워 넣는 일이다. 다음 글에서는 이런 탐색과 시각화를 셀 단위로 즉시 확인하게 해 주는 Jupyter Notebook을 다룬다.

---

**지난 글:** [pandas merge: 표를 키로 이어 붙이기](/posts/python-pandas-merge/)

**다음 글:** [Jupyter Notebook: 셀 단위로 탐색하기](/posts/python-jupyter-notebook/)

<br>
읽어주셔서 감사합니다. 😊
