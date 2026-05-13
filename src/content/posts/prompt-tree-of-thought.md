---
title: "Tree-of-Thought: 여러 추론 경로를 탐색하다"
description: "Yao et al. 2023의 Tree-of-Thought 프레임워크 원리, 세 모듈(생성·평가·탐색), BFS/DFS 구현, Game of 24 예시, CoT와의 비교, 실전 비용 관리까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["TreeOfThought", "ToT", "프롬프트엔지니어링", "LLM추론", "BFS", "DFS", "프롬프팅", "AI계획"]
featured: false
draft: false
---

[지난 글](/posts/prompt-chain-of-thought/)에서 LLM이 단계별 추론을 생성하는 Chain-of-Thought 기법을 살펴봤다. CoT는 하나의 추론 경로를 직선으로 뻗어나가는 방식이다. 하지만 복잡한 문제는 여러 경로를 탐색하고 비교해야 한다. 이번 글에서는 2023년 Yao et al.이 제안한 **Tree-of-Thought(ToT)**를 다룬다. 추론을 트리 구조로 확장해 막힌 경로는 가지치기하고, 유망한 경로를 선택적으로 심화 탐색하는 아이디어다.

## CoT의 한계에서 출발하다

CoT는 추론을 선형(linear)으로 펼친다. 한 번 쓴 추론 단계는 되돌릴 수 없다. 만약 초반 단계에서 잘못된 방향으로 갔다면 결론도 틀린다. 이 문제는 **탐색(search)**과 **역추적(backtracking)**이 필요한 문제에서 두드러진다.

ToT는 이를 해결하기 위해 추론을 **트리**로 모델링한다. 각 노드는 하나의 '생각(thought)', 즉 중간 추론 상태다. 각 단계에서 여러 후보 생각을 생성하고, LLM이 스스로 평가해 유망한 것만 남기고 나머지는 가지치기(prune)한다. 이는 고전적인 탐색 알고리즘(BFS, DFS, Beam Search)의 아이디어를 LLM 추론에 접목한 것이다.

![Tree-of-Thought 탐색 구조](/assets/posts/prompt-tree-of-thought-structure.svg)

## 세 가지 핵심 모듈

![ToT 구현 아키텍처](/assets/posts/prompt-tree-of-thought-impl.svg)

ToT는 세 모듈로 구성된다.

### 1. 생각 생성 (Generate Thoughts)

현재 상태에서 다음 단계 후보 `k`개를 생성한다. 두 가지 방식이 있다.

- **독립 샘플링(Independent)**: 같은 프롬프트로 여러 번 호출해 다양한 후보 생성. 구현이 단순하고 병렬 처리 용이.
- **순차 제안(Sequential)**: "위에서 제안한 것과 다른 아이디어를 생성하라" 방식으로 다양성 강제.

```python
import anthropic

client = anthropic.Anthropic()

def generate_thoughts(state: str, problem: str, k: int = 3) -> list[str]:
    prompt = f"""문제: {problem}

현재까지의 풀이:
{state}

다음 단계로 가능한 접근법을 {k}개 제안하세요.
각 접근법을 '---'로 구분해서 작성하세요."""

    thoughts = []
    for _ in range(k):
        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=256,
            temperature=0.8,
            messages=[{"role": "user", "content": prompt}]
        )
        thoughts.append(response.content[0].text.strip())
    return thoughts
```

### 2. 상태 평가 (Evaluate States)

생성된 후보 중 어느 것이 유망한지 평가한다. 두 방식이 있다.

- **값 매기기(Value)**: 각 후보에 점수(1~10) 또는 "유망/불가/확실" 등 레이블 부여
- **투표(Vote)**: 여러 후보를 나란히 보여주고 "가장 유망한 것"을 고르게 함

```python
def evaluate_state(state: str, problem: str) -> float:
    eval_prompt = f"""문제: {problem}

현재 풀이 상태:
{state}

이 풀이 경로가 최종 정답에 도달할 가능성을 평가하세요.
- "확실(sure)": 이미 답이 명확하다
- "유망(likely)": 계속 진행할 만하다
- "불가(impossible)": 이 경로로는 답이 나오지 않는다

평가:"""

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=64,
        temperature=0,
        messages=[{"role": "user", "content": eval_prompt}]
    )
    text = response.content[0].text.lower()
    if "확실" in text or "sure" in text:
        return 1.0
    elif "유망" in text or "likely" in text:
        return 0.6
    else:
        return 0.0
```

### 3. 탐색 알고리즘 (Search)

평가 결과를 바탕으로 탐색 방향을 결정한다.

- **BFS**: 각 단계에서 상위 `b`개 노드만 유지하며 레벨을 확장. 최적해 보장성이 높지만 메모리 사용이 크다.
- **DFS**: 한 경로를 끝까지 탐색 후 되돌아가기. 메모리 효율적이지만 초반 오류에 취약.
- **Beam Search**: BFS의 변형으로 `b`(beam width)개 경로를 동시에 유지. 실전에서 많이 사용.

```python
def tot_bfs(
    problem: str,
    n_steps: int = 3,
    k: int = 3,   # 생각 생성 수
    b: int = 2,   # Beam 폭
) -> list[str]:
    frontier = [""]  # 초기 상태

    for step in range(n_steps):
        all_thoughts = []
        for state in frontier:
            new_thoughts = generate_thoughts(state, problem, k)
            for t in new_thoughts:
                new_state = f"{state}\n단계 {step+1}: {t}"
                all_thoughts.append(new_state)

        # 평가 후 상위 b개만 유지
        scored = [(s, evaluate_state(s, problem)) for s in all_thoughts]
        scored.sort(key=lambda x: x[1], reverse=True)
        frontier = [s for s, score in scored[:b] if score > 0]

        if not frontier:
            break  # 모든 경로 가지치기됨

    return frontier
```

## Game of 24: ToT의 기준 벤치마크

Yao et al.이 ToT를 평가한 대표 태스크는 **Game of 24**다. 4개의 숫자(예: 4 8 8 2)로 사칙연산을 조합해 정확히 24를 만드는 퍼즐이다. CoT(단순 Few-shot)의 성공률이 4%인 반면, ToT BFS는 74%를 달성했다.

왜 이렇게 큰 차이가 나는가? Game of 24는 탐색 공간이 매우 넓고(4개 숫자, 3번의 연산 선택), 하나의 추론 체인만으로는 모든 가능성을 커버하기 어렵다. ToT는 여러 경로를 병렬로 탐색하고, 막힌 경로를 조기에 차단하기 때문이다.

```python
# Game of 24 예시
numbers = [4, 8, 8, 2]
problem = f"숫자 {numbers}를 사칙연산으로 조합해 24를 만드세요. 각 숫자는 한 번씩만 사용."

result_paths = tot_bfs(problem, n_steps=4, k=3, b=3)

for i, path in enumerate(result_paths, 1):
    print(f"\n경로 {i}:\n{path}")
```

## ToT를 적용할 때와 아닐 때

ToT는 강력하지만 비용이 크다. 각 단계에서 여러 번의 LLM 호출이 필요하므로, 단순한 태스크에 적용하면 낭비다.

**ToT가 효과적인 경우:**
- 여러 가능성을 탐색해야 하는 창의적 글쓰기
- 역추적이 필요한 퍼즐·게임
- 복잡한 다단계 계획 수립
- 코드 디버깅 (여러 가설을 시도)

**CoT로 충분한 경우:**
- 단계가 명확하고 선형적인 수학 문제
- 단순 QA 또는 요약
- 레이턴시와 비용이 중요한 프로덕션 환경

## 실전 비용 절감 전략

```python
def tot_with_cache(problem: str, n_steps: int = 3) -> str:
    """캐싱과 조기 종료를 적용한 ToT"""
    import anthropic

    client = anthropic.Anthropic()

    # System prompt는 캐시로 재사용
    system = """당신은 문제 해결 전문가입니다.
단계별로 가능한 해결 방법을 탐색하고 평가합니다."""

    frontier = [""]
    for step in range(n_steps):
        candidates = []
        for state in frontier:
            resp = client.messages.create(
                model="claude-opus-4-7",
                max_tokens=512,
                system=[{"type": "text", "text": system,
                          "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content":
                            f"문제: {problem}\n현재: {state}\n다음 단계 3가지 제안:"}]
            )
            text = resp.content[0].text
            # "확실" 포함시 즉시 반환
            if "확실" in text or "정답" in text:
                return f"{state}\n{text}"
            candidates.append((state + "\n" + text, 0.5))

        frontier = [c for c, _ in sorted(candidates)[:2]]

    return frontier[0] if frontier else "해결 실패"
```

---

**지난 글:** [Chain-of-Thought 프롬프팅: LLM이 생각하게 만드는 기술](/posts/prompt-chain-of-thought/)

**다음 글:** [ReAct: 추론과 행동을 결합한 에이전트 프롬프팅](/posts/prompt-react/)

<br>
읽어주셔서 감사합니다. 😊
