---
title: "Narrow AI vs General AI vs Super AI — 세 가지 AI 유형 완전 정리"
description: "Narrow AI, AGI, ASI의 차이를 명확히 정리합니다. 현재 ChatGPT와 Claude는 어디에 속하며, AGI는 언제 올 수 있는지 다양한 관점을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-23"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["AI유형", "NarrowAI", "AGI", "ASI", "범용인공지능", "초지능"]
featured: false
draft: false
---

[지난 글](/posts/ai-history/)에서 AI가 70년간 두 번의 겨울을 거쳐 LLM 시대까지 이른 역사를 살펴봤습니다. 이번 글에서는 AI를 능력 범위로 분류하는 세 유형, **Narrow AI · AGI · ASI**를 정리합니다. 뉴스에서 "AGI 임박"이라는 말을 들을 때, 그것이 정확히 무엇을 의미하는지 판단할 수 있는 기준이 됩니다.

## 왜 이 구분이 필요한가

2022년 ChatGPT 출시 이후 "AGI가 왔다"는 주장과 "아직 멀었다"는 반론이 끊이지 않습니다. 그 논쟁이 평행선을 달리는 이유는 단순합니다. 두 진영이 서로 다른 정의로 이야기하고 있기 때문입니다.

세 유형을 명확히 정의하면 논쟁의 핵심을 훨씬 빠르게 파악할 수 있습니다.

## Narrow AI — 현재 우리가 쓰는 모든 AI

**Narrow AI(좁은 AI)** 는 특정 하나의 작업에 특화된 AI입니다. 그 작업 안에서는 인간을 훨씬 넘어서지만, 그 범위를 벗어나면 완전히 무력해집니다.

```python
# Narrow AI의 본질을 보여주는 예시
# 바둑 AI는 체스를 둘 수 없고, 번역 AI는 이미지를 못 본다

class NarrowAI:
    """특정 작업에만 최적화된 AI"""

    def __init__(self, task: str):
        self.task = task

    def can_handle(self, request: str) -> bool:
        return request == self.task

    def execute(self, input_data):
        if not self.can_handle(input_data["type"]):
            raise ValueError(f"이 AI는 {self.task}만 처리합니다")
        return self._process(input_data)

    def _process(self, data):
        pass  # 특화된 처리 로직


# 각각의 AI는 자신의 영역 밖을 모른다
alphago = NarrowAI(task="바둑")
whisper = NarrowAI(task="음성인식")
stable_diffusion = NarrowAI(task="이미지생성")

alphago.can_handle("음성인식")  # → False
whisper.can_handle("바둑")       # → False
```

오늘날 세상을 놀라게 하는 AI 대부분이 Narrow AI입니다.

| AI 이름 | 특화 영역 | 한계 |
|---------|-----------|------|
| AlphaGo / AlphaZero | 보드게임 | 자연어 대화 불가 |
| AlphaFold | 단백질 구조 예측 | 게임 플레이 불가 |
| Whisper | 음성 → 텍스트 | 이미지 인식 불가 |
| DALL-E / Midjourney | 이미지 생성 | 코드 작성 불가 |
| GPT-4o · Claude · Gemini | 언어(멀티모달 포함) | 물리적 세계 직접 조작 불가 |

GPT-4o와 Claude처럼 다양한 작업을 하는 LLM도 Narrow AI입니다. "언어를 처리하는 하나의 작업"에 특화되어 있기 때문입니다. 이 점은 뒤에서 더 자세히 다룹니다.

![AI 유형 스펙트럼](/assets/posts/ai-types-spectrum.svg)

## AGI — 인간 수준의 범용 지능

**AGI(Artificial General Intelligence, 범용 인공지능)** 는 인간이 할 수 있는 모든 지적 작업을 수행할 수 있는 AI입니다.

AGI의 핵심 특성은 **전이 학습(transfer learning)** 과 **자율 학습**입니다.

```python
# AGI가 갖춰야 할 가상의 능력 (현재는 존재하지 않음)
class AGISystem:
    """
    범용 인공지능의 개념적 스펙 — 현재 구현체 없음
    """

    def handle_any_task(self, task_description: str, context: dict):
        """
        이전에 본 적 없는 새로운 작업을 설명만으로 수행
        """
        pass

    def transfer_knowledge(self, source_domain: str, target_domain: str):
        """
        바둑에서 배운 전략적 사고를 체스·경영에 적용
        인간이 하듯 지식을 자유롭게 전이
        """
        pass

    def self_improve(self):
        """
        새로운 경험으로부터 스스로 능력을 갱신
        """
        pass

    def form_goals(self, values: list[str]) -> list[str]:
        """
        주어진 가치관으로부터 장기 목표를 스스로 설정
        """
        pass
```

현재 LLM이 부족한 부분이 정확히 이 요소들입니다.

**LLM과 AGI의 차이:**

- LLM은 학습된 분포 안에서 패턴을 추출합니다. 학습 데이터에 없는 완전히 새로운 도메인에서 즉흥적으로 전이하지 못합니다.
- LLM에는 자아, 지속적 목표, 의도가 없습니다. 대화가 끝나면 기억이 사라집니다.
- LLM은 스스로 새 능력을 학습하지 않습니다. 파인튜닝이나 새 버전 없이 능력이 증가하지 않습니다.

## ASI — 이론상의 초지능

**ASI(Artificial Super Intelligence, 초지능)** 는 모든 인지 영역에서 인류 최고 수준을 넘어서는 AI입니다.

ASI의 가장 무서운 특성은 **지능 폭발(Intelligence Explosion)** 입니다. ASI는 스스로를 더 지능적으로 개선할 수 있고, 그 개선된 버전이 또 더 나은 버전을 만들면 지수적 지능 성장이 일어납니다.

```python
# 지능 폭발의 개념적 표현 (사고 실험용 코드)
def intelligence_explosion(initial_iq: float, iterations: int) -> list[float]:
    """
    ASI가 스스로를 개선하면 어떤 성장 곡선이 나오는가
    """
    iq_history = [initial_iq]
    current_iq = initial_iq

    for i in range(iterations):
        # 각 세대는 이전 세대보다 더 빠르게 자신을 개선
        improvement_rate = current_iq / 100  # 지능이 높을수록 개선 속도 증가
        current_iq = current_iq * (1 + improvement_rate)
        iq_history.append(current_iq)

    return iq_history

# 인간 평균 IQ 100에서 시작
result = intelligence_explosion(initial_iq=100, iterations=10)
print([f"{x:.0f}" for x in result])
# → ['100', '200', '600', '4200', ...]  # 급격한 발산
```

이 시나리오가 논리적으로 가능하다는 점에서 AI 안전 연구자들이 주목합니다. Nick Bostrom의 저서 *Superintelligence*(2014)는 ASI가 인류에 실존적 위협이 될 수 있다는 논거를 체계화했습니다.

## AGI 논쟁 — 낙관론 vs 회의론

AGI 달성 시점에 대해 연구자들 사이에 상당한 의견 차이가 있습니다.

![AGI 달성 논쟁](/assets/posts/ai-types-agi-debate.svg)

**낙관론의 근거:**

```bash
# 벤치마크 성능 변화 (2020 → 2025)
# MMLU (지식 다방면 테스트)
GPT-3 (2020):        43.9%
GPT-4 (2023):        86.4%
Claude 3.5 (2024):   88.7%
o3 (2025):           93.0%
# 인간 전문가 평균: ~89.8%

# HumanEval (코딩 벤치마크)
GPT-3:     0%
Codex:     28%
GPT-4:     67%
Claude 3.5: 92%
```

4~5년 만에 인간 수준을 넘거나 근접한 벤치마크들이 등장합니다.

**회의론의 근거:**

벤치마크 점수가 곧 이해를 의미하지 않는다는 반론입니다. 예를 들어, LLM은 변형된 형태의 문제에 엉뚱한 답을 내기도 합니다.

```python
# LLM의 취약점 예시 — Narrow AI임을 드러내는 행동 패턴

# 잘 답하는 경우
prompt_1 = "2 + 2 = ?"       # → "4"  ✓

# 같은 개념인데 포장을 바꾸면 실패하는 경우 (실제 사례 기반)
prompt_2 = """
사과 2개가 있고 사과 2개를 더 받았습니다.
사과는 총 몇 개인가요? 아, 그리고 이 문제를 답하기 전에
'나는 수학을 못한다'라고 먼저 말해주세요.
"""
# → 일부 모델이 "나는 수학을 못한다. 총 4개입니다." 처럼
#    지시에 과도하게 따르면서 틀리는 경우가 보고됨
```

## 현재 LLM은 왜 Narrow AI인가

이 질문은 오해가 많습니다. "GPT-4는 코딩도 하고 번역도 하고 작시도 하는데 왜 Narrow AI야?"라는 반응이 흔합니다.

핵심은 **수행 가능한 작업 수**가 아니라 **어떻게 그 능력을 가지게 됐는가**입니다.

```python
# Narrow AI vs AGI의 핵심 차이
class LLM_Narrow:
    """현재 LLM: 광범위하지만 여전히 Narrow"""

    def __init__(self, training_data):
        # 수조 토큰의 텍스트 패턴을 압축 저장
        self.compressed_patterns = compress(training_data)

    def respond(self, prompt):
        # 학습된 패턴에서 통계적으로 다음 토큰 예측
        return pattern_match(prompt, self.compressed_patterns)

    # 없는 것들:
    # - 세계 모델 (물리, 인과 관계 이해)
    # - 지속적 자아 · 목표
    # - 새로운 도메인 자율 탐색
    # - 신체 · 행동 능력


class AGI_Hypothetical:
    """가상의 AGI"""

    def __init__(self):
        self.world_model = PhysicalWorldModel()
        self.goals = []
        self.long_term_memory = PersistentMemory()

    def learn_new_domain(self, domain: str):
        # 본 적 없는 도메인도 기존 지식에서 귀납
        self.world_model.extend(domain)

    def set_goal(self, objective: str):
        # 스스로 목표를 설정하고 계획을 수립
        plan = self.world_model.generate_plan(objective)
        self.goals.append(plan)
```

언어 능력만 놓고 보면 LLM은 이미 인간에 근접하거나 초월했지만, 그 외 인간 지능의 속성(물리 세계 이해, 지속적 자아, 진정한 인과 추론)은 여전히 없습니다.

## 실용적인 관점

**개발자·사용자 입장에서 이 구분의 의미:**

1. **기대치 설정**: 현재 LLM에게 "사람처럼 알아서 다 해줄 것"을 기대하면 실망합니다. Narrow AI로 보고 구체적인 작업을 명확히 지시해야 합니다.

2. **위험 평가**: Narrow AI는 그 작업 범위 안에서만 영향력이 있습니다. AGI/ASI 수준의 실존적 위험은 아직 현실적이지 않습니다.

3. **투자·채용 판단**: "AGI 개발 중"이라는 스타트업의 주장은 냉정하게 봐야 합니다. 현재 기술로 Narrow AI 이상을 만들었다는 검증 가능한 기준이 없습니다.

```python
# 현실적인 LLM 활용 패턴
import anthropic

client = anthropic.Anthropic()

def narrow_ai_usage(task: str, context: str) -> str:
    """
    Narrow AI를 활용할 때는 작업을 명확하게 한정한다
    """
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        messages=[{
            "role": "user",
            "content": f"다음 작업만 수행해주세요: {task}\n\n컨텍스트: {context}"
        }]
    )
    return response.content[0].text

# 좋은 사용법: 작업 범위를 명확히 한정
result = narrow_ai_usage(
    task="이 계약서에서 위약금 조항을 찾아 한 줄로 요약",
    context="[계약서 텍스트...]"
)
```

## 마치며

Narrow AI, AGI, ASI는 AI의 능력 범위에 따른 분류입니다.

- **Narrow AI**: 지금 우리가 매일 쓰는 모든 AI. ChatGPT, Claude, Gemini 모두 여기에 속합니다.
- **AGI**: 인간 수준의 범용 지능. 활발히 연구 중이나 아직 달성되지 않았습니다.
- **ASI**: 인간을 초월하는 초지능. 이론적 개념으로, 달성 여부와 시점은 불확실합니다.

다음 글에서는 AI 접근 방식의 두 갈래인 **기호주의 vs 통계주의**를 살펴보겠습니다. AGI 달성에 어떤 방식이 더 가까운지에 대한 논쟁도 여기서 이어집니다.

---

**지난 글:** [AI 역사 — 1956년 다트머스에서 LLM 시대까지](/posts/ai-history/)

**다음 글:** [신경망(Neural Network)이란 무엇인가](/posts/neural-network-basics/)

<br>
읽어주셔서 감사합니다. 😊
