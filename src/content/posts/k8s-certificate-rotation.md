---
title: "인증서 로테이션 — 만료가 클러스터를 멈추기 전에"
description: "쿠버네티스 컨트롤 플레인을 지키는 PKI 구조(루트 CA와 리프 인증서)를 이해하고, kubeadm certs check-expiration으로 만료를 점검하고 renew로 갱신하는 절차, 업그레이드 시 자동 갱신과 kubelet 인증서 자동 로테이션, 그리고 만료를 예방하는 운영 습관을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["인증서", "PKI", "kubeadm", "TLS", "클러스터운영", "보안", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-etcd-backup-restore/)에서 etcd가 mTLS 인증서로 보호된다는 사실을 여러 번 마주쳤다. 사실 etcd뿐 아니다. 쿠버네티스의 컨트롤 플레인 컴포넌트들은 거의 모든 통신을 TLS로 암호화하고 서로를 인증서로 신뢰한다. 그런데 이 인증서들에는 만료일이 있다. 그리고 만료된 인증서는 조용히 클러스터를 마비시킨다 — 어느 날 갑자기 `kubectl`이 통하지 않고, API 서버가 etcd와 대화하지 못한다. **인증서 로테이션**은 이 사고를 미리 막는 운영 작업이다.

## 클러스터를 떠받치는 PKI 구조

먼저 무엇이 있는지 알아야 한다. kubeadm으로 만든 클러스터는 자체 PKI(공개 키 기반 구조)를 갖는다. 뿌리에는 클러스터 **CA(인증 기관)**가 있고, 그 CA가 서명한 여러 **리프(leaf) 인증서**들이 가지처럼 뻗어 있다.

![클러스터 PKI — CA가 뿌리, 인증서가 가지](/assets/posts/k8s-certificate-rotation-pki.svg)

핵심 구분은 수명이다. **CA 인증서는 보통 10년**으로 장수하고, 그 CA가 서명한 **리프 인증서들은 기본 1년**이다. 그래서 실무에서 "인증서 갱신"이라고 하면 대개 이 1년짜리 리프 인증서들을 다시 서명받는 것을 뜻한다. CA 자체를 교체하는 일은 훨씬 무겁고 드물며, 별도의 절차가 필요하다.

리프 인증서에는 API 서버의 서버 인증서, etcd의 peer·server·client 인증서, 컨트롤러 매니저와 스케줄러가 API 서버에 접속할 때 쓰는 kubeconfig 내 클라이언트 인증서, 그리고 각 노드 kubelet의 클라이언트 인증서 등이 있다. 이 중 하나라도 만료되면 해당 통신이 끊긴다.

## 만료 확인 — check-expiration

가장 먼저 할 일은 "지금 어디까지 남았는가"를 아는 것이다. kubeadm은 모든 인증서의 만료일을 한눈에 보여주는 명령을 제공한다.

```bash
# 컨트롤 플레인 노드에서
kubeadm certs check-expiration
```

출력은 인증서별로 만료일과 남은 기간(`RESIDUAL TIME`), 그리고 그 인증서를 서명한 CA를 표 형태로 보여준다. 여기서 `admin.conf`, `apiserver`, `etcd-server` 같은 항목들의 남은 날짜를 확인할 수 있다. CA 항목(`ca`, `etcd-ca` 등)은 보통 9년 넘게 남아 있어 안심해도 되지만, 리프 항목들이 몇 개월 이내로 줄어들면 갱신을 계획해야 한다.

![kubeadm 인증서 갱신 절차](/assets/posts/k8s-certificate-rotation-flow.svg)

## 갱신 — certs renew

갱신은 `kubeadm certs renew`로 한다. 개별 인증서를 지정할 수도 있고, `all`로 한꺼번에 갱신할 수도 있다. 갱신은 기존 CA로 리프 인증서를 다시 서명하는 작업이라 CA는 그대로 유지된다 — 그래서 클라이언트들의 신뢰 관계가 깨지지 않는다.

```bash
# 모든 리프 인증서를 한 번에 갱신
kubeadm certs renew all

# 또는 개별 갱신 (예: API 서버 인증서만)
kubeadm certs renew apiserver
```

여기서 흔히 놓치는 함정이 있다. `renew`는 디스크의 인증서 파일을 새것으로 교체할 뿐, **이미 실행 중인 컴포넌트는 옛 인증서를 메모리에 들고 있다.** 따라서 갱신 후에는 컨트롤 플레인 컴포넌트(API 서버, 컨트롤러 매니저, 스케줄러, etcd)를 재기동해야 새 인증서가 적용된다. 이들은 static pod이므로, 매니페스트 디렉터리(`/etc/kubernetes/manifests/`)의 파일을 잠깐 옮겼다 되돌리거나 kubelet을 재시작하면 재생성된다.

```bash
# static pod 재기동(가장 단순한 방법)
sudo systemctl restart kubelet
# 또는 manifests 디렉터리에서 파일을 잠시 이동했다 복귀

# admin kubeconfig도 갱신됐다면 다시 복사
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config
```

마지막으로 다시 `check-expiration`을 실행해 만료일이 1년 뒤로 밀렸는지 검증하면 한 사이클이 끝난다.

## 가장 좋은 갱신은 잊지 않는 것

수동 갱신 절차를 알았으니, 역설적으로 그 절차를 자주 쓰지 않게 만드는 습관이 더 중요하다. 두 가지 자동화가 부담을 크게 덜어준다.

첫째, **kubeadm은 컨트롤 플레인을 업그레이드할 때 인증서를 자동으로 갱신한다.** 즉 1년에 최소 한 번 클러스터를 업그레이드(다음 글의 주제)하는 습관만 들여도, 리프 인증서가 만료에 도달하기 전에 자연스럽게 새로 발급된다. 정기 업그레이드가 곧 인증서 관리이기도 한 셈이다.

둘째, **kubelet 인증서는 자체 자동 로테이션 기능**이 있다. `rotateCertificates: true`(기본 활성)면 kubelet이 만료가 가까워질 때 스스로 CSR을 올려 갱신한다. 노드가 많을수록 이 자동 갱신의 가치가 크다.

그럼에도 안전망이 필요하다. 만료 모니터링을 두어 — 예를 들어 만료 30일 전 알림 — 자동화가 어떤 이유로 동작하지 않았을 때를 대비하는 것이 좋다. 인증서 만료는 예고된 사고이므로, 예고를 놓치지 않는 것이 핵심이다.

## 정리 — 그리고 다음

쿠버네티스 컨트롤 플레인은 CA를 뿌리로 한 PKI로 서로를 인증한다. 리프 인증서는 기본 1년이라 정기 갱신이 필요하고, 절차는 `check-expiration`으로 확인 → `renew`로 갱신 → 컴포넌트 재기동 → 재검증으로 이어진다. 가장 좋은 전략은 정기 업그레이드와 kubelet 자동 로테이션으로 만료 위험 자체를 줄이고, 모니터링으로 안전망을 두는 것이다.

방금 "정기 업그레이드가 인증서까지 갱신해 준다"고 했다. 그렇다면 그 업그레이드 자체는 어떻게 안전하게 — 무중단으로 — 해야 할까? 다음 글에서는 버전 스큐 정책과 컨트롤 플레인·노드 업그레이드 순서를 다루는 **클러스터 업그레이드**로 이어진다.

---

**지난 글:** [etcd 백업과 복구 — 클러스터 상태를 지키는 마지막 보루](/posts/k8s-etcd-backup-restore/)

**다음 글:** [클러스터 업그레이드 — 무중단으로 버전 올리기](/posts/k8s-cluster-upgrades/)

<br>
읽어주셔서 감사합니다. 😊
