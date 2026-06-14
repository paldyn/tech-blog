---
title: "노드 관리 — 추가·격리·교체의 운영 기술"
description: "노드를 클러스터에 합류시키는 kubeadm join, cordon으로 스케줄링을 막고 drain으로 Pod를 비우는 격리·퇴거, 노드 컨디션(Ready·MemoryPressure·DiskPressure)으로 건강을 읽는 법, NotReady 노드 처리와 교체 전략, 가축처럼 다루는 불변 인프라 사고방식을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["노드관리", "cordon", "drain", "노드컨디션", "kubeadm", "클러스터운영", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-cluster-upgrades/)의 업그레이드 과정에서 노드를 비우고(drain) 다시 들이는(uncordon) 동작이 핵심으로 등장했다. 이 노드 단위 운영은 업그레이드에만 쓰이는 특수 기술이 아니다. 노드를 새로 추가하고, 점검을 위해 잠시 격리하고, 고장 난 노드를 교체하고, 더 이상 필요 없는 노드를 빼는 일 — 이 모든 일상 운영이 같은 도구들 위에서 이뤄진다. 이번 글은 **노드 관리**를 본격적으로 다룬다.

## 노드 합류 — kubeadm join

클러스터에 워커 노드를 추가하는 출발점은 합류(join)다. kubeadm 클러스터라면 컨트롤 플레인에서 발급한 **토큰**과 CA 해시를 가지고 새 머신에서 `kubeadm join`을 실행한다. 그러면 그 머신의 kubelet이 API 서버에 등록되고, 노드 객체가 생성되며, 곧 `Ready` 상태가 되어 Pod를 받기 시작한다.

```bash
# 컨트롤 플레인에서: join 명령 통째로 출력 (토큰 자동 생성)
kubeadm token create --print-join-command

# 새 노드에서: 위에서 받은 명령 실행
sudo kubeadm join 10.0.0.10:6443 --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash>
```

토큰은 보통 24시간 후 만료되는 단기 자격증명이라, 새 노드를 추가할 때마다 새로 발급하는 것이 안전하다. 클라우드 환경에서 오토스케일링으로 노드가 자동 추가된다면 이 join 과정은 부트스트랩 스크립트가 대신 수행한다.

## 노드의 한살이 — cordon, drain, uncordon

노드가 합류해 `Ready`가 된 뒤의 운영은 세 동작으로 요약된다. 이 셋의 차이를 정확히 아는 것이 노드 관리의 절반이다.

![노드 라이프사이클 — 합류부터 퇴장까지](/assets/posts/k8s-node-management-lifecycle.svg)

**cordon**은 노드를 `SchedulingDisabled` 상태로 만든다. 새 Pod가 이 노드로 스케줄되지 못하게 막을 뿐, **이미 떠 있는 Pod는 그대로 둔다.** "더는 새 일감을 받지 말되 하던 일은 계속하라"는 의미다.

**drain**은 cordon에 더해, 노드에 떠 있는 Pod들을 정중하게 퇴거(evict)시킨다. 컨트롤러가 그 Pod들을 다른 노드에 다시 만들기 때문에, 노드를 비운다는 표현이 정확하다. 점검·업그레이드·교체 전에 쓴다.

**uncordon**은 cordon을 되돌린다. 노드를 다시 스케줄링 가능 상태로 만들어 워크로드를 받게 한다.

```bash
# 새 Pod만 막기 (기존 유지)
kubectl cordon <node>

# 비우기 (DaemonSet 예외, emptyDir 데이터 삭제 허용)
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data

# 작업 끝나면 복귀
kubectl uncordon <node>
```

여기서 두 가지를 기억하자. drain은 **PodDisruptionBudget**을 존중한다 — 한 번에 너무 많은 복제본을 내려 가용성이 깨지지 않게 막는다. 또한 DaemonSet Pod는 노드마다 하나씩 있어야 하므로 `--ignore-daemonsets`로 예외 처리하는 것이 보통이다.

## 노드 컨디션 — 건강을 읽는 법

노드가 건강한지는 어떻게 알까. 각 노드의 kubelet은 주기적으로 자신의 상태를 **컨디션(condition)**으로 API 서버에 보고한다. `kubectl describe node`의 Conditions 섹션에서 이를 볼 수 있다.

![노드 컨디션 — kubelet이 보고하는 건강 신호](/assets/posts/k8s-node-management-conditions.svg)

가장 중요한 것은 `Ready`다. `True`면 정상, `False`나 `Unknown`이면 문제가 있다는 뜻이다. 그 외에 `MemoryPressure`, `DiskPressure`, `PIDPressure`는 자원 압박을 알린다. 예를 들어 `DiskPressure=True`가 되면 kubelet은 이미지를 정리(GC)하고, 심하면 Pod를 퇴거시키기 시작한다. 이 압박 신호들은 노드를 미리 손보라는 조기 경보다.

```bash
# 노드 목록과 상태 한눈에
kubectl get nodes -o wide

# 특정 노드의 컨디션·자원·이벤트 상세
kubectl describe node <node>
```

## NotReady 노드 처리

노드가 `NotReady`(또는 `Unknown`)가 되면 클러스터는 자동으로 대응한다. node-controller가 해당 노드에 `node.kubernetes.io/not-ready` 같은 taint를 붙이고, 일정 유예 시간이 지나도 회복되지 않으면 그 노드의 Pod들을 다른 노드로 재배치한다. 운영자가 할 일은 원인 진단이다 — kubelet이 죽었는지, 네트워크(CNI)가 끊겼는지, 컨테이너 런타임이 멈췄는지, 디스크가 찼는지를 점검한다.

진단 후의 갈림길은 환경에 따라 다르다. **클라우드의 불변 인프라** 철학에서는 고장 난 노드를 고치려 들지 않고 그냥 버리고 새 노드로 교체한다. 노드를 "이름 붙여 아끼는 애완동물"이 아니라 "언제든 교체 가능한 가축"으로 다루는 사고방식이다. 반면 **온프레미스**에서는 노드를 cordon·drain으로 비운 뒤 실제로 점검·수리하고 uncordon으로 복귀시키는 경우가 많다. 어느 쪽이든, 워크로드가 특정 노드에 묶이지 않도록 설계해 두면 노드 교체가 두렵지 않다.

## 노드 제거 — 깔끔하게 빼기

노드를 영구히 빼려면 순서가 있다. 먼저 drain으로 비우고, 클러스터에서 노드 객체를 삭제한 뒤, 그 머신에서 kubeadm 상태를 정리한다.

```bash
# 1) 비우기
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
# 2) 클러스터에서 노드 객체 제거
kubectl delete node <node>
# 3) 해당 머신에서 kubeadm 구성 초기화
sudo kubeadm reset
```

순서를 지키지 않고 노드를 그냥 꺼버리면, 그 위에 있던 Pod가 한동안 `Terminating`이나 `Unknown`에 머물며 깔끔하지 못한 상태가 남는다. drain → delete → reset의 순서가 안전하다.

## 정리 — 그리고 다음

노드 관리는 join으로 들이고, cordon/drain으로 격리·퇴거하고, uncordon으로 복귀시키고, delete/reset으로 빼는 일이다. 노드 컨디션으로 건강을 읽고, NotReady에는 자동 재배치가 일어나며, 운영자는 진단 후 교체 또는 복구를 선택한다. 워크로드를 특정 노드에 묶지 않고 가축처럼 다루는 설계가 모든 노드 작업을 안전하게 만든다.

지금까지는 하나의 클러스터를 한 팀(또는 한 목적)이 쓰는 전제였다. 하지만 현실에서는 여러 팀, 여러 프로젝트가 하나의 클러스터를 공유해야 할 때가 많다. 노드와 네임스페이스를 어떻게 나눠 안전하게 함께 쓸 수 있을까? 다음 글에서는 **멀티 테넌시**를 다룬다.

---

**지난 글:** [클러스터 업그레이드 — 무중단으로 버전 올리기](/posts/k8s-cluster-upgrades/)

**다음 글:** [멀티 테넌시 — 하나의 클러스터를 안전하게 나눠 쓰기](/posts/k8s-multi-tenancy/)

<br>
읽어주셔서 감사합니다. 😊
