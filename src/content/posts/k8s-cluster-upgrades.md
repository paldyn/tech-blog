---
title: "클러스터 업그레이드 — 무중단으로 버전 올리기"
description: "쿠버네티스 버전 스큐 정책(apiserver 기준 kubelet·kubectl·컴포넌트 허용 차이)을 이해하고, 한 마이너씩 올리는 원칙, kubeadm upgrade plan·apply로 컨트롤 플레인을 먼저 갱신한 뒤 노드를 drain→upgrade→uncordon으로 하나씩 교체하는 무중단 업그레이드 절차를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["클러스터업그레이드", "kubeadm", "버전스큐", "drain", "무중단", "클러스터운영", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-certificate-rotation/)에서 정기 업그레이드가 인증서까지 자동 갱신해 준다고 했다. 그렇다면 그 업그레이드 자체를 어떻게 안전하게 해야 할까. 쿠버네티스는 1년에 약 3번 마이너 버전을 내고, 각 마이너는 대략 1년의 패치 지원을 받는다. 즉 클러스터를 너무 오래 방치하면 지원이 끊긴 버전에 갇힌다. **클러스터 업그레이드**는 미루면 미룰수록 위험하고 어려워지는, 그래서 정기적으로 해야 하는 운영 작업이다. 핵심은 "운영 중인 서비스를 멈추지 않고" 버전을 올리는 것이다.

## 버전 스큐 — 컴포넌트마다 허용되는 차이

업그레이드 순서를 이해하려면 먼저 **버전 스큐 정책(version skew policy)**을 알아야 한다. 쿠버네티스의 여러 컴포넌트는 동시에 같은 버전일 필요는 없지만, 서로 얼마나 차이 나도 되는지에는 규칙이 있다. 기준점은 항상 **kube-apiserver**다.

![버전 스큐 정책 — 무엇이 얼마나 차이 나도 되는가](/assets/posts/k8s-cluster-upgrades-version-skew.svg)

핵심만 추리면 이렇다. kubelet은 apiserver보다 최대 3 마이너까지 낮아도 되지만 **높아서는 안 된다.** 컨트롤러 매니저·스케줄러는 apiserver와 같거나 1 마이너 낮은 선에서 동작한다. kubectl은 apiserver 기준 ±1 마이너 이내가 권장된다. 그리고 무엇보다 중요한 규칙 — **업그레이드는 한 번에 한 마이너씩만** 한다. v1.28에서 v1.30으로 한 번에 건너뛸 수 없고, v1.28 → v1.29 → v1.30으로 단계를 밟아야 한다.

이 정책에서 업그레이드 순서가 자연스럽게 도출된다. 어떤 컴포넌트도 apiserver보다 높으면 안 되므로, **컨트롤 플레인(특히 apiserver)을 가장 먼저** 올리고 그다음에 노드(kubelet)를 올린다.

## 업그레이드 전 — 준비와 점검

본격적인 작업 전에 안전망부터 챙긴다. 첫째, 직전 글에서 다룬 **etcd 스냅샷**을 떠둔다. 업그레이드가 잘못됐을 때 되돌릴 마지막 보루다. 둘째, 릴리스 노트에서 해당 마이너의 **변경·폐기(deprecation)** 사항을 확인한다. 제거된 API 버전을 쓰는 매니페스트가 있으면 미리 고쳐야 한다. 셋째, 업그레이드할 패치 버전을 정한다.

```bash
# 업그레이드 가능한 버전과 계획 확인 (실제 변경 없음)
sudo kubeadm upgrade plan

# 설치 가능한 kubeadm 패키지 버전 조회 (예: apt)
apt-cache madison kubeadm | head
```

`upgrade plan`은 현재 버전, 올릴 수 있는 버전, 그리고 각 컴포넌트가 어떻게 바뀌는지를 표로 보여준다. 여기서 목표 버전을 확정한다.

## 1단계 — 컨트롤 플레인 업그레이드

순서의 첫 단계는 컨트롤 플레인이다. 컨트롤 플레인 노드에서 kubeadm을 목표 버전으로 올린 뒤 `upgrade apply`를 실행한다. 이 명령이 API 서버·컨트롤러 매니저·스케줄러·etcd의 static pod 이미지를 새 버전으로 교체하고, 앞 글에서 다룬 인증서도 함께 갱신한다.

![업그레이드 순서 — 컨트롤 플레인 먼저, 노드는 하나씩](/assets/posts/k8s-cluster-upgrades-order.svg)

```bash
# (1) kubeadm 바이너리부터 목표 버전으로
sudo apt-get install -y kubeadm=1.30.x-*

# (2) 컨트롤 플레인 컴포넌트 업그레이드
sudo kubeadm upgrade apply v1.30.x

# (3) 이 노드의 kubelet/kubectl도 갱신 후 재시작
sudo apt-get install -y kubelet=1.30.x-* kubectl=1.30.x-*
sudo systemctl daemon-reload && sudo systemctl restart kubelet
```

컨트롤 플레인 노드가 여러 대인 멀티 마스터 구성이라면, 첫 노드에서만 `upgrade apply`를 하고 나머지 컨트롤 플레인 노드에서는 `kubeadm upgrade node`를 실행한다. 후자는 이미 적용된 클러스터 설정을 따라가는 가벼운 동기화다.

## 2단계 — 워커 노드, 하나씩 무중단으로

컨트롤 플레인이 새 버전이 되면, 이제 워커 노드를 올린다. 여기서 무중단의 비결은 **한 번에 한 노드씩** 처리하는 것이다. 한 노드를 비우는 동안 나머지 노드들이 워크로드를 받아주므로 서비스는 계속 돌아간다.

각 노드마다 drain → kubelet 갱신 → uncordon의 사이클을 반복한다.

```bash
# (1) 노드를 비우고 스케줄링 차단 — Pod가 다른 노드로 이동
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data

# (2) 해당 노드에서 kubeadm·kubelet 갱신
sudo apt-get install -y kubeadm=1.30.x-*
sudo kubeadm upgrade node
sudo apt-get install -y kubelet=1.30.x-*
sudo systemctl daemon-reload && sudo systemctl restart kubelet

# (3) 다시 스케줄링 허용 — 노드 복귀
kubectl uncordon <node>
```

`drain`은 노드의 Pod를 정중하게(graceful) 퇴거시키고 더 이상 새 Pod가 오지 못하게 막는다. `--ignore-daemonsets`는 DaemonSet Pod(노드마다 하나씩 있어야 하는)를 예외 처리하는 옵션이다. 여기서 앞서 다룬 **PodDisruptionBudget**이 빛을 발한다 — drain이 한 번에 너무 많은 복제본을 내리지 못하게 막아, 비우는 과정에서도 최소 가용 수를 유지해 준다. 노드 하나가 끝나면 다음 노드로 같은 사이클을 반복한다.

## 끝나고 — 검증

모든 노드를 올렸으면 클러스터 상태를 확인한다.

```bash
# 모든 노드가 목표 버전, Ready 상태인지
kubectl get nodes -o wide

# 시스템 Pod가 정상 기동했는지
kubectl get pods -n kube-system
```

`kubectl get nodes`의 `VERSION` 열이 모두 목표 버전이고 전부 `Ready`면 한 마이너 업그레이드가 끝난 것이다. 더 올려야 한다면 같은 절차를 다음 마이너에 대해 반복한다 — 다시 말하지만 한 번에 한 마이너씩이다.

## 정리 — 그리고 다음

클러스터 업그레이드는 버전 스큐 정책에서 순서가 정해진다. apiserver를 정점으로, 컨트롤 플레인을 먼저 올리고 노드를 나중에 올리며, 한 번에 한 마이너씩 단계를 밟는다. 노드는 drain → upgrade → uncordon을 하나씩 반복해 무중단을 유지하고, PodDisruptionBudget이 그 과정을 보호한다. 사전 etcd 백업과 사후 검증이 안전망이다.

업그레이드 과정에서 노드를 비우고(drain) 다시 들이는(uncordon) 동작이 핵심으로 등장했다. 이 노드 단위 운영 — 추가, 격리, 교체, 제거 — 은 업그레이드뿐 아니라 일상 운영에서도 계속 쓰인다. 다음 글에서는 **노드 관리**를 본격적으로 다룬다.

---

**지난 글:** [인증서 로테이션 — 만료가 클러스터를 멈추기 전에](/posts/k8s-certificate-rotation/)

**다음 글:** [노드 관리 — 추가·격리·교체의 운영 기술](/posts/k8s-node-management/)

<br>
읽어주셔서 감사합니다. 😊
