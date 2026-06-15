---
title: "프로덕션 준비 체크리스트 — 운영에 올리기 전 점검 목록"
description: "쿠버네티스 워크로드를 운영에 올리기 전 점검할 항목을 신뢰성·리소스·보안·관측성·네트워킹·운영 6개 영역으로 정리한 마무리 체크리스트입니다. 레플리카와 PDB, requests/limits와 QoS, securityContext와 RBAC, 메트릭/로깅/추적, NetworkPolicy, GitOps와 백업/DR까지 시리즈 전체를 운영 관점에서 한 장으로 묶습니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["프로덕션", "체크리스트", "운영", "신뢰성", "보안", "관측성", "베스트프랙티스", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-dns-troubleshooting/)까지 트러블슈팅 시리즈를 통해 장애를 진단하고 푸는 법을 다뤘다. 그리고 이 글은 쿠버네티스 완전 정복 시리즈 전체의 마지막이다. 그동안 다룬 수많은 개념 — Pod와 Deployment, 리소스와 오토스케일, 스토리지와 네트워킹, 보안과 관측성, GitOps와 운영 — 을 하나하나 따로 익혔다면, 이제 그것들을 **운영에 올리기 직전**의 관점에서 한데 모을 차례다. "잘 도는 것 같다"와 "운영에 올려도 된다"는 전혀 다른 기준이다. 이 글은 그 간극을 메우는 체크리스트다.

## 운영 준비는 여섯 영역으로 본다

워크로드 하나를 운영에 올린다는 것은 단순히 Pod가 뜨는 것을 넘어, 장애를 견디고, 자원을 통제하며, 안전하고, 관측 가능하고, 올바르게 연결되고, 지속적으로 운영될 수 있다는 뜻이다. 이 여섯 가지 — 신뢰성·리소스·보안·관측성·네트워킹·운영 — 을 빠짐없이 점검하는 것이 핵심이다.

![프로덕션 준비 6개 영역 점검](/assets/posts/k8s-production-readiness-categories.svg)

## 1) 신뢰성 — 하나가 죽어도 서비스는 산다

운영의 첫째 원칙은 단일 장애점을 없애는 것이다. 레플리카는 최소 2개 이상이어야 노드 하나가 빠져도 서비스가 유지된다. 거기에 더해 다음을 확인한다.

- **probe 3종**: `readinessProbe`로 준비되지 않은 Pod에 트래픽이 가지 않게 하고, `livenessProbe`로 죽은 컨테이너를 자가 회복시키고, `startupProbe`로 느린 부팅을 보호한다.
- **PodDisruptionBudget**: 노드 드레인·업그레이드 같은 자발적 중단 중에도 최소 가용 Pod 수를 보장한다.
- **anti-affinity / topologySpreadConstraints**: 레플리카가 한 노드·한 가용 영역에 몰리지 않게 분산한다.
- **graceful shutdown**: `preStop` 훅과 `terminationGracePeriodSeconds`로 진행 중인 요청을 마치고 떠나게 한다.

![프로덕션 워크로드 최소 스펙](/assets/posts/k8s-production-readiness-deployment.svg)

## 2) 리소스 — 통제되지 않은 자원은 사고가 된다

[OOMKilled](/posts/k8s-oomkilled/)와 [Pending](/posts/k8s-pending-pods/)에서 봤듯, 리소스 설정은 안정성과 직결된다.

- 모든 컨테이너에 `requests`와 `limits`를 설정했는가. request 없는 Pod는 스케줄링이 부정확해지고, limit 없는 Pod는 노드를 잠식한다.
- QoS 클래스가 의도대로인가. 중요한 워크로드는 Guaranteed에 가깝게.
- 부하 변동이 있다면 HPA(또는 KEDA)로 오토스케일을 걸었는가.
- 네임스페이스 단위로 `ResourceQuota`·`LimitRange`를 두어 폭주를 막았는가.

```yaml
resources:
  requests:
    cpu: "250m"
    memory: "256Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"
```

## 3) 보안 — 기본값은 안전하지 않다

쿠버네티스의 기본값은 편의를 위해 느슨한 편이라, 운영에서는 조여야 한다.

- 컨테이너를 `runAsNonRoot`로 띄우고, `readOnlyRootFilesystem`·`allowPrivilegeEscalation: false`를 적용했는가.
- ServiceAccount와 RBAC을 최소 권한으로 설계했는가. 기본 SA에 과한 권한이 붙어 있지 않은가.
- 시크릿을 평문 매니페스트가 아니라 Sealed Secrets나 External Secrets로 관리하는가.
- 이미지 스캔과 서명(cosign)을 CI에 넣었는가.
- NetworkPolicy로 네임스페이스·워크로드 간 통신을 격리하고, Pod Security Admission으로 위험한 스펙을 막는가.

## 4) 관측성 — 안 보이면 못 고친다

이 시리즈의 트러블슈팅 편들이 가능했던 것은 보이는 게 있었기 때문이다. 운영 전에 관측 기반을 깔아둔다.

- 메트릭 수집(Prometheus)과 대시보드(Grafana)가 있는가.
- 로그가 중앙(Loki/EFK)에 모이고, 핵심 에러에 알림이 걸려 있는가.
- 요청 흐름을 추적할 수 있는가(OpenTelemetry).
- SLO와 핵심 지표(에러율·지연·포화도)를 정의했는가.

## 5) 네트워킹 — 연결이 의도대로 되는가

- Service·Ingress가 올바르게 노출되고 TLS가 적용됐는가.
- [DNS](/posts/k8s-dns-troubleshooting/) 정책이 NetworkPolicy와 충돌하지 않는가.
- 외부에서의 도달성과, 내부 서비스 간 통신을 실제로 검증했는가.

```bash
# 실제 도달성 검증 — 임시 컨테이너에서
kubectl debug -it canary --image=nicolaka/netshoot \
  -- curl -sS https://api.internal/healthz
```

## 6) 운영 — 사람이 떠나도 굴러간다

마지막은 지속 운영의 토대다.

- 배포가 GitOps(Argo CD/Flux)로 선언적·재현 가능한가.
- etcd 백업과 DR 절차가 있고, 복구를 실제로 연습해봤는가.
- 클러스터·노드 업그레이드 절차가 문서화돼 있는가.
- 장애 대응 런북과 온콜 체계가 있는가.

## 정리 — 그리고 시리즈를 마치며

운영 준비란 "잘 도는 것"을 넘어 "장애를 견디고, 통제되고, 안전하고, 보이고, 연결되고, 지속 운영되는" 상태를 만드는 일이다. 신뢰성·리소스·보안·관측성·네트워킹·운영 여섯 영역을 체크리스트로 훑으면, 운영에 올리기 전 빠뜨린 곳을 빠르게 찾을 수 있다. 이 한 장은 그동안 시리즈에서 따로 익힌 모든 개념이 실제 운영에서 어떻게 한데 모이는지를 보여준다.

여기까지가 쿠버네티스 완전 정복 시리즈의 마지막 글이다. "쿠버네티스란 무엇인가"에서 출발해 아키텍처, 워크로드, 스케줄링, 스토리지, 네트워킹, 보안, 확장, 관측성, GitOps, 운영, 그리고 트러블슈팅까지 — 클러스터를 이해하고 운영하는 데 필요한 지도를 함께 그렸다. 이제 이 지도를 들고 직접 클러스터를 만지며, 자신만의 운영 경험을 쌓아갈 차례다. 긴 여정을 함께해 주셔서 감사하다.

---

**지난 글:** [DNS 트러블슈팅 — 서비스 이름이 풀리지 않을 때](/posts/k8s-dns-troubleshooting/)

<br>
읽어주셔서 감사합니다. 😊
