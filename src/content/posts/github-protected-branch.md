---
title: "Protected Branch: 브랜치 보호 규칙 설정"
description: "GitHub의 브랜치 보호 규칙으로 main에 대한 직접 push를 막고 PR·리뷰·상태 검사를 강제하는 법. force-push·삭제 금지, 선형 히스토리, 관리자 우회 차단 등 핵심 옵션과 실무 적용 전략을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "브랜치보호", "협업", "코드리뷰", "CI"]
featured: false
draft: false
---

[지난 글](/posts/github-pages-deploy/)에서 저장소를 정적 사이트로 배포하는 법을 다뤘다. 자동 배포 파이프라인이 `main`에 연결되어 있다면, 누군가 검증되지 않은 코드를 `main`에 직접 push하는 순간 곧바로 프로덕션에 반영된다는 뜻이기도 하다. 이를 막는 안전장치가 **브랜치 보호 규칙(Branch Protection Rule)**이다. 보호된 브랜치는 정해진 조건을 통과한 변경만 받아들이며, 직접 push나 강제 덮어쓰기를 거부한다.

핵심 발상은 단순하다. `main` 같은 중요한 브랜치를 "잠그고", 모든 변경이 반드시 **Pull Request**를 거쳐 들어오도록 강제한다. 그 PR이 리뷰 승인과 CI 검사를 통과해야만 머지 버튼이 열린다. 혼자 하는 토이 프로젝트가 아니라면 거의 모든 협업 저장소가 이 규칙을 적용한다.

![보호된 브랜치는 직접 push를 막는다](/assets/posts/github-protected-branch-rules.svg)

## 규칙 만들기

규칙은 저장소 **Settings → Branches → Add branch ruleset**(또는 클래식 Branch protection rules)에서 만든다. 보호할 브랜치 패턴(예: `main`, `release/*`)을 지정하고 원하는 조건을 켜면 된다. 대표적인 옵션은 다음과 같다.

- **Require a pull request before merging**: 직접 push를 막고 PR을 통해서만 머지하게 한다.
- **Require approvals**: 머지 전 최소 N명의 리뷰 승인을 요구한다.
- **Require status checks to pass**: 지정한 CI 검사(테스트, 린트, 빌드)가 통과해야 머지를 허용한다.
- **Require branches to be up to date**: 머지 전에 base 브랜치 최신 상태로 갱신을 요구한다.
- **Require linear history**: 머지 커밋 없이 squash/rebase로만 선형 히스토리를 유지한다.
- **Do not allow force pushes / deletions**: 강제 push와 브랜치 삭제를 금지한다.

## 머지 게이트가 동작하는 방식

규칙을 켜면 PR 화면에 각 조건의 통과 여부가 표시되고, 모든 조건이 충족될 때까지 Merge 버튼이 비활성화된다. 리뷰 승인과 상태 검사가 AND 조건으로 평가되어, 하나라도 빨간불이면 머지할 수 없다.

![모든 조건이 통과해야 머지가 열린다](/assets/posts/github-protected-branch-checks.svg)

상태 검사를 필수로 지정하려면, 해당 검사가 한 번 이상 실행되어 GitHub가 그 이름을 인식해야 한다. 예를 들어 아래 워크플로우의 잡 이름(`test`)을 보호 규칙의 required status checks 목록에 추가하면, 이 검사가 통과하기 전에는 머지가 막힌다.

```yaml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
```

## 직접 push가 거부되는 경험

보호 규칙이 적용된 브랜치에 곧장 push를 시도하면 서버가 거부한다. 메시지는 대략 이런 형태다.

```text
$ git push origin main
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: error: Required status check "test" is expected.
 ! [remote rejected] main -> main (protected branch hook declined)
error: failed to push some refs
```

해결은 규칙을 우회하는 것이 아니라 정해진 흐름을 따르는 것이다. 기능 브랜치를 만들어 push하고 PR을 연다.

```bash
git switch -c feature/new-login
git push -u origin feature/new-login
# 이후 PR을 생성해 리뷰와 검사를 거쳐 머지
```

## 실무 적용 팁

규칙은 강할수록 안전하지만, 팀 규모에 맞게 조정해야 마찰이 줄어든다. 작은 팀은 "PR 필수 + 상태 검사 통과 + 1인 승인" 정도가 균형점이다. 큰 팀이나 민감한 저장소는 **CODEOWNERS** 기반 리뷰, 두 명 이상 승인, 선형 히스토리까지 더한다.

주의할 점은 관리자 우회다. 기본적으로 관리자는 규칙을 무시하고 머지할 수 있는데, 규칙을 일관되게 적용하려면 "Do not allow bypassing the above settings"(클래식에서는 "Include administrators")를 켜서 관리자도 동일한 게이트를 거치게 만든다. 그래야 "급해서 한 번만"이라는 예외가 쌓여 보호가 무력화되는 일을 막을 수 있다.

브랜치를 잠갔으니, 이제 그 안에서 CI가 다루는 API 키·토큰 같은 민감 정보를 안전하게 보관하는 법이 필요하다. 다음 글에서는 **GitHub Secrets**를 다룬다.

---

**지난 글:** [GitHub Pages: 정적 사이트 배포하기](/posts/github-pages-deploy/)

**다음 글:** [GitHub Secrets: 민감 정보 안전하게 관리](/posts/github-secrets/)

<br>
읽어주셔서 감사합니다. 😊
