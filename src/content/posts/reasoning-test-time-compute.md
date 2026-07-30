---
title: "테스트 타임 컴퓨트: 추론 시점에 계산을 더 쓴다는 것"
description: "병렬 샘플링, 순차 수정, 트리 탐색으로 추론 시점 컴퓨트를 늘리는 방법과 각각의 비용·지연 특성, 그리고 수확 체감이 시작되는 지점을 실전 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-07-29"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["테스트타임컴퓨트", "best-of-n", "self-consistency", "추론모델", "샘플링", "LLM최적화"]
featured: false
draft: false
---

[지난 글](/posts/reasoning-models-overview/)에서 추론 모델이 답변 전에 사고 토큰을 소비한다고 정리했는데, 사실 그건 추론 시점에 계산을 더 쓰는 여러 방법 중 하나일 뿐이다. 모델 가중치를 그대로 두고 추론할 때 컴퓨트를 늘려 정확도를 사는 기법 전체를 테스트 타임 컴퓨트(test-time compute)라고 부른다. 훈련을 다시 하지 않고도 성능을 올릴 수 있다는 점에서 실무 가치가 크지만, 어떤 형태로 늘리느냐에 따라 지연과 필요한 부품이 완전히 달라진다.

## 세 가지 늘리는 방향

컴퓨트를 늘리는 방향은 크게 세 가지다. 가로로 늘리거나, 세로로 늘리거나, 가지를 치거나.

![추론 시점 컴퓨트를 늘리는 세 가지 방식](/assets/posts/reasoning-test-time-compute-methods.svg)

**병렬 샘플링**은 같은 질문을 온도를 높여 N번 독립적으로 생성한 뒤 그중 하나를 고른다. 각 호출이 서로를 모르기 때문에 동시에 던질 수 있고, 따라서 지연은 1회 호출과 거의 같다. 비용만 N배다. 고르는 방법은 다수결(self-consistency)이거나 별도의 점수 모델이다.

**순차 수정**은 답을 하나 쓰고, 그 답을 다시 입력으로 넣어 비판하고, 비판을 반영해 고쳐 쓴다. 각 단계가 이전 결과에 의존하므로 병렬화가 안 되고 지연도 N배로 늘어난다. 대신 이전 시도의 정보를 활용하므로 같은 컴퓨트로 더 나아질 여지가 있다. 단점은 첫 방향이 틀렸을 때 그 틀린 전제 위에서 계속 다듬기만 하는 함정이다.

**트리 탐색**은 부분 해를 만들 때마다 점수를 매겨 유망한 가지만 확장한다. 이론적으로 가장 효율적이지만 부분 해를 점수화할 수 있어야 하고, 구현이 앞의 둘보다 한참 복잡하다. 실무에서는 코드 생성처럼 중간 상태를 실행해 볼 수 있는 영역에서만 채택할 만하다.

## 셋의 공통 전제

세 방식 모두 하나의 전제 위에 서 있다. **좋은 후보를 알아볼 수 있어야 한다.** 병렬 샘플링에서 16개를 뽑아 놓고도 정답을 못 고르면 컴퓨트만 16배 쓴 것이다. 순차 수정에서 "이 답이 틀렸다"를 판별하지 못하면 멀쩡한 답을 망칠 수도 있다.

다수결의 효과를 식으로 보면 명확하다. 각 시도가 확률 $p$로 정답을 내고 오답은 서로 다르게 흩어진다고 가정할 때, $N$번 중 정답이 최빈값이 될 확률은 $p$가 0.5를 넘는 순간부터 $N$이 커질수록 1에 수렴한다.

$$P_{\text{vote}}(N) = \sum_{k=\lceil N/2 \rceil}^{N} \binom{N}{k} p^k (1-p)^{N-k}$$

문제는 "오답이 서로 다르게 흩어진다"는 가정이다. 실제 모델은 같은 오해를 반복하는 경향이 있어서 오답끼리 뭉친다. $p$가 0.5보다 낮으면 다수결은 오히려 오답을 강화한다. 그래서 다수결은 모델이 이미 절반 이상 맞히는 문제에서만 쓸 수 있다.

## 같은 예산, 다른 배분

실무에서 진짜 결정해야 하는 것은 "컴퓨트를 늘릴 것인가"가 아니라 "정해진 예산을 어떻게 쪼갤 것인가"다.

![동일 예산의 세 가지 배분 전략](/assets/posts/reasoning-test-time-compute-budget.svg)

경험적으로 두 축이 갈린다. 문제가 **쉬운데 실수가 잦은** 유형이면 병렬 쪽이 유리하다. 모델이 원래 풀 수 있는데 가끔 삐끗하는 것이므로, 여러 번 던져서 다수결을 하면 삐끗이 걸러진다. 반대로 문제가 **본질적으로 어려운** 유형이면 순차 쪽이 유리하다. 한 번에 못 푸는 문제는 몇 번을 독립적으로 던져도 똑같이 못 푼다. 깊이 파고들 시간이 필요하다.

실무 기본값은 절충안이다. 4회 병렬 × 각 4단위 정도로 시작해서, 정확도 로그를 보고 어느 쪽으로 기울일지 정한다.

## 병렬 샘플링 구현

가장 먼저 시도할 만한 형태다. 검증 함수를 붙일 수 있으면 다수결보다 훨씬 강력하다.

```python
import asyncio
import re
from collections import Counter

import anthropic

client = anthropic.AsyncAnthropic()


async def sample_once(prompt: str, temperature: float) -> str:
    resp = await client.messages.create(
        model="claude-sonnet-5",
        max_tokens=2000,
        temperature=temperature,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text


def extract_answer(text: str) -> str | None:
    m = re.search(r"<answer>(.*?)</answer>", text, re.S)
    return m.group(1).strip() if m else None


async def best_of_n(prompt: str, n: int = 8) -> str | None:
    outputs = await asyncio.gather(
        *[sample_once(prompt, temperature=1.0) for _ in range(n)]
    )
    answers = [a for a in map(extract_answer, outputs) if a is not None]
    if not answers:
        return None

    counts = Counter(answers)
    top, freq = counts.most_common(1)[0]

    # 합의율이 낮으면 다수결을 신뢰하지 않는다
    if freq / len(answers) < 0.4:
        return None
    return top
```

핵심은 마지막 세 줄이다. 합의율이 낮다는 것은 모델이 이 문제에서 헤매고 있다는 신호다. 이럴 때 최빈값을 그냥 반환하면 틀린 답을 자신 있게 내놓는 최악의 형태가 된다. 합의율 임계값 아래에서는 `None`을 반환하고 상위 계층에서 에스컬레이션하는 편이 안전하다.

이 합의율은 그 자체로 쓸모 있는 신뢰도 신호다. 8개 샘플 중 7개가 같은 답이면 거의 확실하고, 3-3-2로 갈리면 사람이 봐야 한다. 별도의 신뢰도 모델 없이 얻을 수 있는 값이라 비용 대비 효율이 좋다.

## 순차 수정 구현

이전 시도를 컨텍스트에 넣고 고쳐 쓰게 하는 형태다. 검증 결과를 함께 넣어 주는 것이 중요하다.

```python
from dataclasses import dataclass


@dataclass
class Attempt:
    code: str
    passed: bool
    error: str | None


def run_tests(code: str) -> Attempt:
    """실제로는 샌드박스에서 테스트를 실행한다."""
    ...


def revise_loop(task: str, max_rounds: int = 4) -> Attempt | None:
    history: list[Attempt] = []

    for round_idx in range(max_rounds):
        prompt = build_prompt(task, history)
        code = generate_code(prompt)
        attempt = run_tests(code)

        if attempt.passed:
            return attempt

        history.append(attempt)

        # 같은 오류가 두 번 연속이면 방향이 막힌 것 — 중단
        if len(history) >= 2 and history[-1].error == history[-2].error:
            break

    return None


def build_prompt(task: str, history: list[Attempt]) -> str:
    if not history:
        return f"{task}\n\n테스트를 통과하는 코드를 작성하라."

    last = history[-1]
    return (
        f"{task}\n\n"
        f"이전 시도:\n```python\n{last.code}\n```\n\n"
        f"실패한 이유:\n{last.error}\n\n"
        f"원인을 먼저 진단한 뒤, 수정된 전체 코드를 작성하라."
    )
```

`history[-1].error == history[-2].error` 체크가 실무에서 예산을 가장 많이 아껴 준다. 순차 수정은 같은 오류를 반복하면서 라운드를 소진하는 실패 모드가 흔하다. 개선이 멈춘 것을 감지하면 더 돌리지 말고 빠져나와야 한다.

또 하나, 히스토리를 전부 넣지 말고 마지막 시도만 넣는 편이 대체로 낫다. 실패한 시도를 여러 개 보여 주면 모델이 그 실패 패턴을 모방하는 경향이 있다.

## 수확 체감은 어디서 오는가

컴퓨트를 두 배 늘렸을 때 정확도가 두 배 오르지 않는 것은 당연하지만, 어느 지점에서 멈춰야 할지는 데이터로 봐야 한다. 대략적인 패턴은 이렇다.

| 샘플 수 | 다수결 정확도 | 정확도 증가폭 | 비용 배수 |
|---|---|---|---|
| 1 | 52% | — | 1× |
| 2 | 52% | +0%p | 2× |
| 4 | 63% | +11%p | 4× |
| 8 | 69% | +6%p | 8× |
| 16 | 72% | +3%p | 16× |
| 32 | 73% | +1%p | 32× |

두 가지가 보인다. 첫째, N=2는 의미가 없다. 다수결이 성립하려면 최소 3개, 실무에서는 4개부터다. 둘째, 8을 넘어서면 증가폭이 급격히 줄어든다. 8에서 32로 가면 비용은 4배인데 정확도는 4%포인트다.

이 곡선의 형태는 문제 난도에 따라 달라진다. 모델이 원래 90% 맞히는 문제에서는 N=4에서 이미 천장에 닿고, 30%밖에 못 맞히는 문제에서는 아무리 늘려도 다수결이 오답으로 수렴한다. **자기 데이터로 이 표를 한 번 그려 보는 것**이 어떤 논문 수치보다 유용하다.

## 예산을 요청 단위로 나누기

모든 요청에 같은 N을 쓰는 것은 낭비다. 쉬운 요청은 1회로 끝내고, 어려운 요청에 예산을 몰아주는 적응형 배분이 효율이 훨씬 좋다.

```python
def adaptive_sampling(prompt: str, max_n: int = 16) -> str | None:
    """합의가 이미 형성됐으면 조기 중단한다."""
    answers: list[str] = []

    for batch_start in range(0, max_n, 4):
        batch = sample_batch(prompt, n=4)
        answers.extend(a for a in map(extract_answer, batch) if a)

        counts = Counter(answers)
        if not counts:
            continue

        top, freq = counts.most_common(1)[0]
        agreement = freq / len(answers)

        # 4개 이상 모였고 합의율이 충분하면 더 뽑지 않는다
        if len(answers) >= 4 and agreement >= 0.75:
            return top

    counts = Counter(answers)
    if not counts:
        return None
    top, freq = counts.most_common(1)[0]
    return top if freq / len(answers) >= 0.4 else None
```

4개씩 뽑아 가며 합의율을 확인하고, 이미 충분히 모였으면 멈춘다. 실제 트래픽에 적용하면 평균 샘플 수가 16이 아니라 6~7 정도로 떨어지는 경우가 많다. 쉬운 요청이 트래픽의 대부분을 차지하기 때문이다.

## 도입 전에 확인할 것

**검증 신호가 있는가.** 이것이 없으면 세 방법 모두 효과가 크게 떨어진다. 테스트 실행, 스키마 검증, 계산 재확인, 하다못해 다수결이라도 있어야 한다. 아무 판별 수단이 없다면 컴퓨트를 늘리기 전에 검증 장치부터 만드는 것이 순서다.

**지연 예산이 얼마인가.** 병렬은 지연을 거의 안 늘리지만 동시 호출 수만큼 레이트 리밋을 소모한다. 순차는 지연이 배수로 늘어난다. 사용자가 기다리는 경로인지 배치인지에 따라 선택이 달라진다.

**기저 정확도가 얼마인가.** 모델이 이미 95% 맞히는 작업이라면 샘플을 늘려도 살 수 있는 것이 5%포인트뿐이다. 반대로 20%밖에 못 맞힌다면 샘플링으로는 안 되고 모델이나 프롬프트를 바꿔야 한다. 테스트 타임 컴퓨트가 가장 잘 듣는 구간은 기저 정확도 40~75% 사이다.

## 정리

테스트 타임 컴퓨트는 훈련 없이 정확도를 사는 가장 실용적인 수단이지만, 세 방식 모두 "좋은 답을 알아보는 능력"이라는 같은 전제에 기대고 있다. 검증기가 없으면 병렬이든 순차든 컴퓨트만 태운다.

시작은 병렬 샘플링 N=4에 합의율 임계값을 붙이는 것이 좋다. 구현이 가장 단순하고 지연도 안 늘어난다. 여기서 얻은 합의율 로그를 보면 어느 요청 유형에 예산을 더 쓸지, 어디서 멈출지가 데이터로 드러난다. 그다음에 순차나 트리로 넘어가도 늦지 않다.

---

**지난 글:** [추론 모델은 무엇이 다른가: 사고 토큰과 그 청구서](/posts/reasoning-models-overview/)

**다음 글:** [추론 능력은 어떻게 훈련되는가: 강화학습과 검증 가능한 보상](/posts/reasoning-rl-training/)

<br>
읽어주셔서 감사합니다. 😊
