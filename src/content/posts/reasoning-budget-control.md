---
title: "사고 예산 제어: 얼마나 생각하게 할 것인가"
description: "사고 예산과 출력 상한의 관계, 난도에 따른 적응형 예산 배분, 예산 소진으로 답변이 잘리는 실패 모드와 그 방어책을 실무 코드와 운영 지표 중심으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-07-29"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["사고예산", "budget-tokens", "추론모델", "지연최적화", "비용관리", "적응형라우팅"]
featured: false
draft: false
---

[지난 글](/posts/reasoning-verifier-models/)까지 후보를 만들고 고르는 쪽을 다뤘다면, 이번에는 그 이전 단계인 "한 번의 호출에 얼마나 생각하게 할 것인가"를 정리한다. 추론 모델을 실제 서비스에 넣었을 때 가장 먼저 부딪히는 문제가 이것이다. 예산을 안 주면 모델이 알아서 정하는데 그 값이 요청마다 널뛰고, 넉넉히 주면 쉬운 요청까지 비싸진다. 그리고 잘못 설정하면 응답이 문장 중간에서 끊기는 황당한 형태로 실패한다.

## 예산과 출력 상한은 같은 통이다

가장 먼저 알아야 할 것은 사고 토큰이 별도 통에 담기지 않는다는 사실이다. `max_tokens`가 정한 출력 한도 안에서 사고와 답변이 자리를 나눠 쓴다.

![사고 예산과 출력 상한의 관계](/assets/posts/reasoning-budget-control-truncation.svg)

`max_tokens=4096`에 `budget_tokens=4000`을 준 설정이 대표적인 사고다. 어려운 문제가 들어와 사고가 예산을 다 쓰면 답변에 96토큰만 남는다. 결과는 문장 중간에서 끊긴 응답이다. 더 나쁜 것은 이 실패가 조용하다는 점이다. HTTP 200이 오고, 응답 객체도 정상이며, 다만 `stop_reason`이 `max_tokens`일 뿐이다. 이걸 확인하지 않는 코드는 잘린 텍스트를 그대로 사용자에게 보낸다.

실무 경험칙은 단순하다.

$$\text{max\_tokens} \geq \text{budget\_tokens} + 2 \times \text{예상 답변 길이}$$

답변 길이에 2를 곱하는 이유는 모델이 예상보다 길게 쓰는 경우가 짧게 쓰는 경우보다 흔하기 때문이다. 그리고 `budget_tokens`는 목표치가 아니라 상한이다. 쉬운 문제에서는 모델이 알아서 적게 쓰므로, 상한을 넉넉히 잡는다고 매 요청이 그만큼 비싸지지는 않는다. 잘림을 막는 쪽으로 여유를 두는 편이 이득이다.

```python
import anthropic

client = anthropic.Anthropic()


def call_with_thinking(prompt: str, budget: int, expected_answer_tokens: int):
    max_tokens = budget + 2 * expected_answer_tokens

    resp = client.messages.create(
        model="claude-sonnet-5",
        max_tokens=max_tokens,
        thinking={"type": "enabled", "budget_tokens": budget},
        messages=[{"role": "user", "content": prompt}],
    )

    # 잘림은 조용히 성공한 것처럼 보인다 — 반드시 확인한다
    if resp.stop_reason == "max_tokens":
        raise TruncatedResponse(
            f"출력 상한 도달: budget={budget} max_tokens={max_tokens} "
            f"used={resp.usage.output_tokens}"
        )

    thinking_tokens = sum(
        len(b.thinking) // 3 for b in resp.content if b.type == "thinking"
    )
    answer = "".join(b.text for b in resp.content if b.type == "text")

    return answer, {
        "output_tokens": resp.usage.output_tokens,
        "thinking_share": thinking_tokens / max(resp.usage.output_tokens, 1),
    }
```

`stop_reason` 체크가 없으면 나중에 "가끔 답변이 이상하게 끊겨요"라는 제보를 받고 원인을 못 찾아 며칠을 쓴다. 처음부터 예외로 올려 두는 편이 낫다.

## 모든 요청에 같은 예산을 줄 이유가 없다

전체 트래픽을 한 가지 설정으로 처리하는 것이 운영은 편하지만 낭비가 크다. 실제 요청의 난도 분포는 극단적으로 치우쳐 있다. 대부분은 사고가 전혀 필요 없고, 소수만 깊은 사고가 필요하다.

![난도에 따른 사고 예산 등급 배분](/assets/posts/reasoning-budget-control-routing.svg)

여기서 핵심은 난도 판정을 **싸게** 해야 한다는 점이다. 난도를 알아내려고 큰 모델을 부르면 배보다 배꼽이 커진다. 실무에서 통하는 신호는 대부분 규칙이나 아주 작은 분류기로 얻을 수 있다.

```python
from dataclasses import dataclass
from enum import IntEnum


class Budget(IntEnum):
    OFF = 0
    MEDIUM = 2000
    HIGH = 16000


@dataclass
class Signals:
    task_type: str
    input_tokens: int
    has_numbers: bool          # 계산이 섞여 있는가
    constraint_count: int      # "반드시", "제외", "이내" 등의 개수
    latency_budget_ms: int
    retry_of: str | None       # 이전 시도의 실패 사유


NO_THINKING_TASKS = {"classify", "extract", "reformat", "route", "translate"}


def pick_budget(s: Signals) -> Budget:
    # 지연 예산이 짧으면 논의 여지가 없다
    if s.latency_budget_ms < 3000:
        return Budget.OFF

    # 사고가 도움이 안 되는 작업 유형은 즉시 차단
    if s.task_type in NO_THINKING_TASKS:
        return Budget.OFF

    # 재시도라면 한 등급 올린다
    if s.retry_of == "low_confidence":
        return Budget.HIGH

    score = 0
    score += 2 if s.has_numbers else 0
    score += min(s.constraint_count, 3)
    score += 2 if s.input_tokens > 4000 else 0

    if score >= 5:
        return Budget.HIGH
    if score >= 2:
        return Budget.MEDIUM
    return Budget.OFF
```

규칙이 조잡해 보이지만 실제로 잘 동작한다. 정교한 난도 예측 모델을 붙였을 때와 비교해도 총비용 차이가 크지 않은 경우가 많다. 어차피 대부분의 요청은 명백하게 쉽거나 명백하게 어렵고, 애매한 중간 구간은 비중이 작기 때문이다.

## 낮은 등급에서 시작해 승급하기

위 코드의 `retry_of` 처리가 실무에서 가장 효과가 큰 부분이다. 처음부터 큰 예산을 주는 대신, 작은 예산으로 시도하고 결과가 미덥지 않을 때만 다시 부른다.

계산해 보면 이득이 분명하다. 요청의 80%가 작은 예산으로 해결되고 20%가 승급한다고 할 때, 총비용은 이렇게 된다.

$$C_{\text{escalate}} = 1.0 \times C_{\text{small}} + 0.2 \times C_{\text{large}}$$

작은 예산이 큰 예산의 1/8이라면 전체 비용은 큰 예산으로 전부 처리할 때의 약 32%다. 대신 승급된 20%는 지연이 두 배가 된다. 배치나 비동기 처리에서는 거의 공짜에 가까운 최적화이고, 사용자가 기다리는 경로에서는 승급 비율을 낮게 유지해야 한다.

```python
async def solve_with_escalation(prompt: str, task: dict) -> str | None:
    ladder = [Budget.OFF, Budget.MEDIUM, Budget.HIGH]
    start = pick_budget(build_signals(prompt, task))
    start_idx = ladder.index(start)

    for budget in ladder[start_idx:]:
        answer, meta = call_with_thinking(
            prompt, budget=int(budget), expected_answer_tokens=task["answer_len"]
        )

        if verify(answer, task):        # 규칙 검증기가 있으면 최우선
            return answer

        # 사고를 예산 끝까지 쓴 것은 "더 필요했다"는 신호다
        exhausted = meta["thinking_share"] > 0.9 and budget != Budget.OFF
        if not exhausted and budget != Budget.OFF:
            # 예산이 남았는데도 틀렸다면 더 줘도 소용없다
            return None

    return None
```

`exhausted` 판정이 요점이다. 예산을 다 쓰지 않았는데 틀렸다면, 그것은 예산이 부족해서가 아니라 모델이 이 문제를 잘못 이해한 것이다. 예산을 늘려도 같은 오답이 더 길게 나온다. 반대로 예산을 끝까지 쓰고 답을 냈다면 더 주면 풀릴 여지가 있다. 이 구분을 안 하면 승급 사다리가 그냥 돈만 태우는 장치가 된다.

## 스트리밍과 지연 체감

추론 모델의 지연 문제는 절대 시간보다 체감이 크다. 일반 모델은 첫 토큰이 빨리 나오고 계속 흐르지만, 추론 모델은 사고하는 동안 아무것도 안 나온다. 사용자 입장에서는 멈춘 것처럼 보인다.

대응은 세 가지다.

**사고 요약을 스트리밍한다.** 모델에 따라 사고 구간의 요약을 실시간으로 받을 수 있다. 전체 사고를 그대로 노출하는 것은 권장되지 않지만, 진행 중임을 알리는 신호로는 충분하다.

**단계 진행률을 표시한다.** 사고 자체를 못 보여 준다면 최소한 경과 시간과 예상 시간을 보여 준다. 실측 p50, p90을 근거로 "보통 8~20초 걸립니다"라고 안내하는 것만으로 이탈률이 눈에 띄게 달라진다.

**타임아웃을 p99로 잡는다.** 추론 모델의 응답 시간 분포는 꼬리가 매우 길다. p50이 4초여도 p99가 90초인 상황이 정상이다. 평균의 3배 같은 관례적 타임아웃을 쓰면 정상 요청을 대량으로 죽인다.

## 운영에서 볼 지표

예산 제어를 도입했다면 다음 네 가지를 대시보드에 올려야 한다.

**등급별 트래픽 비중.** 사고 끔 / 중간 / 큰 예산의 비율이다. 큰 예산 비중이 예상보다 높으면 난도 판정 규칙이 헐거운 것이다. 반대로 0%에 가까우면 라우팅이 사실상 동작하지 않는 것이니 규칙을 다시 봐야 한다.

**예산 소진율.** 사고가 `budget_tokens`에 도달한 요청의 비율. 이 값이 높으면 해당 등급의 예산이 부족하다는 뜻이고, 그 등급 응답의 품질이 오히려 나쁠 수 있다. 결론을 못 낸 채 답변을 쓰기 시작하기 때문이다.

**잘림 발생률.** `stop_reason == "max_tokens"`의 비율. 0이어야 정상이다. 0이 아니면 `max_tokens` 계산이 틀린 것이니 즉시 고쳐야 한다.

**승급률과 승급 성공률.** 승급된 요청의 비율, 그리고 승급 후 실제로 검증을 통과한 비율이다. 승급 성공률이 낮다면 승급이 낭비다. 그 경우 `exhausted` 판정 기준을 조이거나, 애초에 승급 대신 사람에게 넘기는 편이 낫다.

| 지표 | 정상 범위 | 벗어났을 때 |
|---|---|---|
| 큰 예산 비중 | 5~20% | 30% 초과 시 난도 규칙 재검토 |
| 예산 소진율 | 10% 미만 | 25% 초과 시 해당 등급 예산 증액 |
| 잘림 발생률 | 0% | 0 초과 시 max_tokens 즉시 수정 |
| 승급 성공률 | 40% 이상 | 20% 미만이면 승급 자체를 재고 |

## 자주 나오는 실수

**예산을 늘려 품질 문제를 덮으려 한다.** 프롬프트가 모호해서 나오는 오답은 예산을 열 배로 늘려도 안 고쳐진다. 모델이 잘못된 전제를 오래 고민할 뿐이다. 정확도가 안 나올 때는 예산부터 늘리지 말고, 예산을 다 쓰고 있는지부터 확인하는 것이 순서다.

**요청 유형별 측정 없이 전역 설정을 바꾼다.** "예산을 8k로 올렸더니 정확도가 3%포인트 올랐다"는 전체 평균은 거의 쓸모가 없다. 특정 유형에서 크게 오르고 나머지는 그대로일 가능성이 높은데, 그렇다면 그 유형만 올리면 된다. 유형별로 쪼개서 보면 대개 예산을 올려야 할 곳은 트래픽의 일부다.

**사고 내용을 로그에 그대로 쌓는다.** 사고 구간은 길고, 중간 가설이나 폐기된 추론이 그대로 들어 있다. 이것을 원문 그대로 장기 저장하면 저장 비용도 문제지만 디버깅할 때 노이즈가 된다. 토큰 수, 소진 여부, 요약 정도만 남기고 원문은 샘플링해서 보관하는 편이 낫다.

## 정리

사고 예산 제어의 실무 요령은 세 줄로 압축된다. `max_tokens`는 예산 위에 답변 자리를 넉넉히 얹어 잡는다. 요청 유형과 몇 가지 싼 신호로 등급을 나눠 대부분의 트래픽에서는 사고를 끈다. 그리고 낮은 등급에서 시작해 예산을 다 썼을 때만 승급한다.

여기까지 하면 추론 모델을 쓰면서도 비용과 지연이 통제 가능한 범위에 들어온다. 그다음 개선은 대개 예산 조정이 아니라 검증기 강화에서 나온다. 잘 만든 검증기 하나가 예산 두 배보다 낫다.

---

**지난 글:** [검증자 모델: 답을 고르는 눈을 따로 기른다](/posts/reasoning-verifier-models/)

<br>
읽어주셔서 감사합니다. 😊
