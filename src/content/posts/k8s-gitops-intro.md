---
title: "GitOps 입문 — Git을 단일 진실 공급원으로"
description: "GitOps의 정의와 OpenGitOps 4원칙, push 배포와 pull 배포의 구조적 차이, 조정 루프를 통한 드리프트 자동 복구, 앱 저장소와 설정 저장소 분리, 이미지 태그 업데이트 흐름 등 Argo CD·Flux를 배우기 전에 잡아야 할 개념을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 8
type: "knowledge"
category: "Kubernetes"
tags: ["GitOps", "CI/CD", "배포", "ArgoCD", "Flux", "DevOps", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-audit-logs/)까지 클러스터를 관측하는 눈을 갖췄다. 이제 시리즈의 새 장, **배포 자동화**로 넘어간다. 그 출발점이 GitOps다. 한 문장으로 정의하면 이렇다. **"클러스터의 원하는 상태를 전부 Git에 선언해 두고, 클러스터 안의 에이전트가 Git과 실제 상태를 끊임없이 일치시키게 하는 운영 모델."** Argo CD나 Flux 같은 도구 이름을 듣기 전에, 이 모델이 기존 CI/CD와 무엇이 어떻게 다른지부터 정확히 잡고 가자.

## Push에서 Pull로 — 방향이 뒤집힌다

전통적인 CI/CD 파이프라인은 **push 방식**이다. CI가 이미지를 빌드한 뒤, 파이프라인 마지막 단계에서 `kubectl apply`나 `helm upgrade`로 클러스터에 변경을 밀어 넣는다.

![Push 배포 vs Pull 배포 (GitOps)](/assets/posts/k8s-gitops-intro-pushpull.svg)

이 구조에는 구조적인 약점이 있다.

- **자격증명 노출**: 클러스터를 변경할 수 있는 admin급 토큰이 CI 시스템(GitHub Actions, Jenkins...)에 저장된다. CI가 뚫리면 클러스터가 뚫린다
- **배포 후 무관심**: 파이프라인은 apply가 성공하면 끝이다. 그 뒤 누가 `kubectl edit`으로 값을 바꿔도(드리프트) 아무도 모른다
- **재현 불가**: "지금 prod에 떠 있는 게 정확히 뭐지?"라는 질문에 Git도 CI도 답하지 못한다. 답은 클러스터 안에만 있다

GitOps는 방향을 뒤집는다. 클러스터 **안에** 오퍼레이터(Argo CD, Flux)를 두고, 오퍼레이터가 Git 저장소를 **당겨와서(pull)** 적용한다. 사람도 CI도 클러스터에 직접 손대지 않는다 — 손대는 곳은 오직 Git이다.

- 배포 자격증명이 클러스터 밖으로 나가지 않는다
- 배포 = Git 머지. 코드 리뷰, 승인, 히스토리가 배포 프로세스에 공짜로 따라온다
- "prod에 뭐가 떠 있나?" = "main 브랜치에 뭐가 있나?" 질문이 같아진다

## 조정 루프 — GitOps의 심장

pull 방식이 단순한 "주기적 apply"와 다른 점은 **조정 루프(reconciliation loop)** 에 있다.

![조정 루프 (Reconciliation Loop)](/assets/posts/k8s-gitops-intro-loop.svg)

오퍼레이터는 세 가지 일을 무한 반복한다.

1. Git의 원하는 상태(desired)를 읽는다
2. 클러스터의 실제 상태(actual)를 조회한다
3. 둘을 비교(diff)해서 다르면 actual을 desired로 수렴시킨다

이 루프가 주는 가장 큰 선물이 **드리프트 자동 복구(self-healing)** 다. 누군가 급한 마음에 `kubectl edit deploy`로 replicas를 바꿔도, 다음 조정 주기(보통 수 분 이내)에 Git 상태로 되돌아간다. 처음엔 답답하게 느껴질 수 있지만, 이것이 바로 "클러스터 상태를 아무도 모르게 바꿀 수 없다"는 강력한 보증이다. 긴급 변경도 Git을 거치게 강제되므로, 새벽의 임시 조치가 기록 없이 증발하는 일이 사라진다.

이 개념은 사실 Kubernetes 자체의 작동 원리와 같다. Deployment 컨트롤러가 "선언된 replicas"와 "실제 파드 수"를 수렴시키듯, GitOps 오퍼레이터는 "Git"과 "클러스터"를 수렴시킨다. GitOps는 Kubernetes의 선언적 모델을 Git까지 확장한 것이다.

참고로 이 분야의 공식 정의로 CNCF의 **OpenGitOps 4원칙**이 있다: ① 선언적(Declarative) ② 버전 관리되고 불변인 저장(Versioned and Immutable) ③ 자동으로 당겨감(Pulled Automatically) ④ 지속적으로 조정(Continuously Reconciled). 위에서 설명한 내용이 그대로 원칙화된 것이다.

## 저장소 구조 — 앱 repo와 설정 repo의 분리

GitOps를 시작할 때 가장 먼저 만나는 설계 질문은 "매니페스트를 어디에 둘 것인가"다. 정석은 **애플리케이션 저장소와 설정(배포) 저장소의 분리**다.

```text
# app repo (개발자 영역)
my-api/
├── src/
├── Dockerfile
└── .github/workflows/ci.yaml   # 빌드 + 이미지 push까지만

# config repo (배포 상태의 진실 공급원)
k8s-config/
├── apps/
│   └── my-api/
│       ├── base/
│       │   ├── deployment.yaml
│       │   ├── service.yaml
│       │   └── kustomization.yaml
│       └── overlays/
│           ├── staging/
│           │   └── kustomization.yaml   # 이미지 태그: v1.4.2
│           └── prod/
│               └── kustomization.yaml   # 이미지 태그: v1.4.1
└── infra/
    ├── monitoring/    # kube-prometheus-stack values
    └── logging/       # Loki, Fluent Bit
```

분리하는 이유는 명확하다. 앱 코드 커밋(기능 개발)과 배포 커밋(상태 변경)은 라이프사이클이 다르다. 섞어 두면 "코드 수정 없이 prod 레플리카만 바꾸는 커밋"이 앱 히스토리를 오염시키고, CI 트리거가 꼬인다. 또 설정 repo는 시리즈에서 다룬 [Kustomize 오버레이](/posts/k8s-kustomize-overlays/) 구조와 자연스럽게 결합해 staging/prod 환경 차이를 표현한다.

## 그러면 CI는 뭘 하나 — 이미지 업데이트 흐름

GitOps에서 CI의 역할은 "빌드와 검증"으로 줄어든다. 전체 흐름은 이렇다.

```text
1. 개발자가 app repo에 머지
2. CI: 테스트 → 이미지 빌드 → 레지스트리 push (my-api:v1.4.2)
3. CI 마지막 단계: config repo에 "이미지 태그 v1.4.2로 변경" PR 생성
4. 리뷰·승인 후 머지 (staging은 자동 머지로 두기도 한다)
5. 클러스터의 GitOps 오퍼레이터가 변경을 감지하고 배포
```

3번 단계는 CI 스크립트로 직접 해도 되고, 도구의 이미지 자동 업데이트 기능(Flux Image Automation, Argo CD Image Updater)에 맡길 수도 있다.

```bash
# CI에서 config repo의 태그를 갱신하는 전형적인 한 토막
cd k8s-config/apps/my-api/overlays/staging
kustomize edit set image my-api=registry.example.com/my-api:v1.4.2
git commit -am "chore: my-api staging -> v1.4.2"
git push origin main
```

중요한 것은 **CI가 클러스터 자격증명을 갖지 않는다**는 점이다. CI가 가진 것은 config repo에 PR을 만들 Git 권한뿐이고, 클러스터 변경 권한은 클러스터 내부의 오퍼레이터에게만 있다.

## GitOps가 공짜로 주지 않는 것

장점만 나열하면 공정하지 않으니, 도입 전에 알아야 할 비용도 짚는다.

- **Secret 문제**: 시크릿을 Git에 평문으로 둘 수 없으므로 Sealed Secrets, External Secrets Operator 같은 별도 해법이 필수다 — 시리즈 앞부분에서 다룬 주제가 여기서 다시 등장한다
- **긴급 상황의 마찰**: 장애 중 빠른 롤백도 Git 커밋을 거쳐야 한다. 도구들이 UI 롤백을 제공하지만, 원칙과 절차를 미리 정해두지 않으면 혼란이 생긴다
- **조정 루프와 싸우는 도구들**: HPA가 바꾸는 replicas, 컨트롤러가 주입하는 필드처럼 "클러스터가 정당하게 바꾸는 값"을 드리프트로 오인하지 않게 무시 규칙을 설정해야 한다
- **저장소 구조 설계 비용**: 멀티 클러스터·멀티 팀 규모가 되면 repo 구조와 권한 설계가 그 자체로 아키텍처 작업이 된다

그럼에도 결론은 분명하다. 선언적 인프라를 쓰는 팀에게 GitOps는 "하면 좋은 것"을 넘어 사실상의 표준 운영 모델이 됐다.

## 마무리

GitOps의 본질은 도구가 아니라 모델이다 — 진실은 Git에 있고, 클러스터는 그 진실을 따라가는 그림자다. push에서 pull로 방향을 뒤집으면 자격증명 문제, 드리프트 문제, "지금 뭐가 떠 있지?" 문제가 한꺼번에 풀린다. 이제 이 모델을 구현한 도구를 만날 차례다. 다음 글에서는 가장 널리 쓰이는 GitOps 도구, **Argo CD**를 설치하고 첫 Application을 배포해 본다.

---

**지난 글:** [Kubernetes 감사 로그(Audit Log) — 누가 무엇을 했는가](/posts/k8s-audit-logs/)

**다음 글:** [Argo CD — 선언적 GitOps 지속 배포](/posts/k8s-argocd/)

<br>
읽어주셔서 감사합니다. 😊
