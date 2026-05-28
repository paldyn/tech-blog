---
title: "Trunk-Based Development: 브랜치 없이 빠르게"
description: "Trunk-Based Development의 핵심 규칙(짧은 수명의 브랜치, 하루 수회 통합), Feature Flag를 이용한 미완성 코드 관리, CI 필수성, Gitflow·GitHub Flow와의 비교를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "TBD", "TrunkBasedDevelopment", "브랜치전략", "FeatureFlag", "CI"]
featured: false
draft: false
---

[지난 글](/posts/gitlab-flow-overview/)에서 GitLab Flow를 다뤘다. Gitflow, GitHub Flow, GitLab Flow는 모두 feature 브랜치를 수일~수주 동안 유지한다. **Trunk-Based Development(TBD)**는 그 반대 극단에 있다. 브랜치를 아예 없애거나, 있어도 2일 이내에 trunk(main)에 통합한다.

## TBD란 무엇인가

TBD는 모든 개발자가 **단 하나의 브랜치(trunk 또는 main)** 에 하루에도 여러 번 커밋을 통합하는 전략이다. 구글, 메타, 마이크로소프트의 대형 모노레포가 이 방식으로 운영된다.

핵심 규칙은 다음과 같다.

- feature 브랜치 수명 **≤ 2일**
- **하루 1회 이상** trunk에 통합
- trunk는 항상 빌드 가능·테스트 통과 상태
- 미완성 코드는 **Feature Flag**로 감싸서 커밋

![TBD 흐름과 Feature Flag](/assets/posts/trunk-based-development-flow.svg)

## 왜 짧은 브랜치인가

브랜치가 오래 살면 세 가지 문제가 생긴다.

1. **머지 충돌 누적**: trunk와 오래 분기할수록 충돌이 커진다
2. **통합 리스크**: 두 팀이 각자 2주짜리 브랜치를 동시에 개발하다 머지하면 대규모 충돌 발생
3. **피드백 지연**: 다른 팀의 변경이 내 코드에 미치는 영향을 늦게 발견한다

TBD는 "자주, 작게" 통합함으로써 이 문제를 원천 차단한다.

## Feature Flag

미완성 기능은 trunk에 머지하되 Flag로 비활성화한다.

```python
# LaunchDarkly, Unleash, 또는 커스텀 플래그 시스템
if feature_flags.enabled('new-payment-flow', user):
    return new_payment_flow(order)
else:
    return legacy_payment_flow(order)
```

플래그 덕분에:
- 미완성 상태로도 trunk에 올릴 수 있다
- QA/스테이징에서 먼저 활성화해 검증한다
- 문제 시 코드 롤백 없이 플래그만 끄면 된다

플래그는 기능 완성 후 **제거**해야 한다. 오래된 플래그가 누적되면 코드 복잡도가 증가한다.

## CI 자동화 — TBD의 전제 조건

TBD는 **강력한 CI 없이는 불가능**하다. trunk에 커밋할 때마다 전체 테스트가 자동 실행되어야 한다.

```yaml
# .github/workflows/ci.yml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test -- --coverage
      - run: npm run lint
```

커밋 전 **로컬에서도 CI 통과**를 확인하는 습관이 중요하다.

```bash
# pre-push hook으로 로컬 검증 강제
npm test && git push
```

## Branch by Abstraction

대규모 리팩토링처럼 며칠이 걸리는 작업은 Feature Flag 대신 **Branch by Abstraction** 패턴을 쓴다.

```python
# 1단계: 추상 레이어 도입
class PaymentProcessor(ABC):
    @abstractmethod
    def process(self, order): ...

class LegacyProcessor(PaymentProcessor): ...

# 2단계: trunk에 커밋하면서 점진적 교체
class NewStripeProcessor(PaymentProcessor): ...

# 3단계: 교체 완료 후 추상 레이어 제거
```

오래된 구현과 새 구현을 동시에 trunk에 공존시키면서 단계적으로 교체한다.

## 브랜치 전략 비교

![브랜치 전략 복잡도 비교](/assets/posts/trunk-based-development-compare.svg)

## TBD가 적합한 경우

- CI/CD 자동화가 성숙한 팀
- 대형 모노레포 또는 마이크로서비스 환경
- 하루 수십~수백 번 배포하는 팀
- 고도로 숙련된 팀원들 (TBD는 낮은 품질의 코드를 그대로 trunk에 올리는 게 아니다)

작은 팀이 테스트 커버리지 없이 TBD를 시도하면 trunk가 계속 깨지는 상황이 생긴다. 먼저 GitHub Flow로 CI 문화를 구축한 뒤 TBD로 이행하는 경로가 현실적이다.

---

**지난 글:** [GitLab Flow: 환경 브랜치로 안전하게 배포하기](/posts/gitlab-flow-overview/)

**다음 글:** [Monorepo vs Polyrepo: 어떤 저장소 구조를 선택할까](/posts/monorepo-vs-polyrepo/)

<br>
읽어주셔서 감사합니다. 😊
