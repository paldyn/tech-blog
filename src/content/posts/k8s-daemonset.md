---
title: "쿠버네티스 DaemonSet 완전 이해"
description: "Kubernetes에서 모든 노드에 Pod를 하나씩 배포하는 DaemonSet의 동작 원리, YAML 구조, 노드 필터링, 업데이트 전략을 자세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "DaemonSet", "Pod", "로그 수집", "모니터링", "노드 에이전트"]
featured: false
draft: false
---

[지난 글](/posts/k8s-deployment-strategies/)에서 Rolling Update, Blue-Green, Canary 등 Deployment 배포 전략을 살펴봤습니다. 이번에는 배포 전략과는 다른 목적을 가진 **DaemonSet**을 다룹니다. DaemonSet은 클러스터의 **모든 노드에 Pod를 하나씩 배포**하는 오브젝트입니다. 노드가 추가되면 자동으로 새 Pod를 생성하고, 노드가 삭제되면 해당 Pod도 함께 사라집니다.

## DaemonSet이 필요한 이유

Deployment로 replicas를 늘리면 스케줄러가 적절한 노드를 선택해 Pod를 배치합니다. 이 방식은 일반 애플리케이션에는 적합하지만, **노드마다 반드시 하나씩 실행되어야 하는 인프라 에이전트**에는 맞지 않습니다.

로그 수집 에이전트(Fluentd)를 생각해보세요. 각 노드의 로그를 수집하려면 모든 노드에 에이전트가 있어야 합니다. replicas 기반 Deployment로는 "이 노드에 꼭 하나" 를 보장할 수 없습니다. 노드가 10개인데 replicas를 5로 설정하면 절반의 노드는 에이전트가 없게 됩니다.

DaemonSet은 이 문제를 해결합니다. replicas 필드가 없고, 클러스터의 모든 노드(또는 nodeSelector로 선택된 노드)에 자동으로 Pod 1개씩을 배포합니다.

![DaemonSet 아키텍처](/assets/posts/k8s-daemonset-architecture.svg)

## DaemonSet 대표 사용 사례

- **로그 수집**: Fluentd, Filebeat, Logstash
- **모니터링 에이전트**: Prometheus node-exporter, Datadog Agent, New Relic
- **네트워킹**: kube-proxy, CNI 플러그인(Calico, Flannel)
- **스토리지**: Rook-Ceph, CSI 드라이버
- **보안**: Falco, Tetragon

특히 쿠버네티스 자체 컴포넌트인 kube-proxy도 DaemonSet으로 배포됩니다.

```bash
# 시스템 DaemonSet 확인
kubectl get daemonset -n kube-system

# 출력 예시
# NAME          DESIRED  CURRENT  READY  UP-TO-DATE  AVAILABLE
# kube-proxy    3        3        3      3           3
# calico-node   3        3        3      3           3
```

## DaemonSet YAML 구조

DaemonSet YAML의 핵심은 `spec.replicas`가 없다는 점입니다. 나머지 구조는 Deployment의 `spec.template`과 동일합니다.

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd-ds
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: fluentd
  template:
    metadata:
      labels:
        app: fluentd
    spec:
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      containers:
      - name: fluentd
        image: fluentd:v1.16
        resources:
          requests:
            cpu: 100m
            memory: 200Mi
          limits:
            memory: 500Mi
        volumeMounts:
        - name: varlog
          mountPath: /var/log
          readOnly: true
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
```

`tolerations`에 `node-role.kubernetes.io/control-plane`을 추가하면 컨트롤 플레인 노드에도 Pod가 배포됩니다. 일반 Pod는 컨트롤 플레인 노드의 taint로 인해 스케줄링되지 않지만, toleration을 추가하면 DaemonSet Pod는 모든 노드에 배포됩니다.

`hostPath` 볼륨으로 노드의 `/var/log`를 마운트해 호스트 로그에 접근합니다.

![DaemonSet YAML 구조와 tolerations](/assets/posts/k8s-daemonset-yaml.svg)

## 노드 필터링 — nodeSelector와 nodeAffinity

모든 노드가 아닌 **특정 노드 그룹**에만 DaemonSet Pod를 배포하려면 `nodeSelector` 또는 `nodeAffinity`를 사용합니다.

```yaml
spec:
  template:
    spec:
      # 방법 1: nodeSelector (단순)
      nodeSelector:
        disk: ssd

      # 방법 2: nodeAffinity (정교)
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: kubernetes.io/os
                operator: In
                values:
                - linux
```

예를 들어 GPU 모니터링 에이전트는 GPU 노드에만, 특정 스토리지 드라이버는 해당 스토리지가 있는 노드에만 배포할 수 있습니다.

## DaemonSet 관리 명령어

```bash
# DaemonSet 목록 확인
kubectl get daemonset

# 상세 정보 (이벤트, 조건 포함)
kubectl describe daemonset fluentd-ds -n kube-system

# DaemonSet이 관리하는 Pod 확인
kubectl get pods -l app=fluentd -n kube-system -o wide

# Pod가 배포된 노드 확인
kubectl get pods -l app=fluentd -n kube-system \
  -o custom-columns=NODE:.spec.nodeName,STATUS:.status.phase
```

## 업데이트 전략 (updateStrategy)

DaemonSet은 두 가지 업데이트 전략을 지원합니다.

**RollingUpdate (기본값)**: 노드를 순회하며 Pod를 하나씩 교체합니다. `maxUnavailable`로 동시에 중단될 수 있는 Pod 수를 제어합니다.

**OnDelete**: 사용자가 직접 Pod를 삭제할 때만 새 Pod가 생성됩니다. 수동으로 업데이트 타이밍을 제어하고 싶을 때 사용합니다.

```yaml
spec:
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1  # 동시에 최대 1개 노드 업데이트
```

업데이트 상태 확인:

```bash
# 업데이트 진행 상황
kubectl rollout status daemonset fluentd-ds -n kube-system

# 롤백
kubectl rollout undo daemonset fluentd-ds -n kube-system

# 이력 확인
kubectl rollout history daemonset fluentd-ds -n kube-system
```

## DaemonSet vs Deployment 비교

| 특성 | DaemonSet | Deployment |
|------|-----------|------------|
| replicas | 없음 (노드 수 = Pod 수) | 명시적 설정 |
| 배치 방식 | 모든 노드에 1개씩 | 스케줄러 선택 |
| 스케일링 | 노드 수에 연동 | 수동/HPA |
| 주요 용도 | 인프라 에이전트 | 애플리케이션 |
| hostPath 접근 | 일반적 | 드묾 |

## HostNetwork와 HostPID

모니터링 에이전트나 네트워크 플러그인은 노드의 네트워크나 프로세스 네임스페이스에 직접 접근해야 할 때가 있습니다.

```yaml
spec:
  template:
    spec:
      hostNetwork: true   # 노드의 네트워크 네임스페이스 사용
      hostPID: true       # 노드의 PID 네임스페이스 사용
      hostIPC: true       # 노드의 IPC 네임스페이스 사용
      containers:
      - name: node-exporter
        image: prom/node-exporter:v1.7.0
```

`hostNetwork: true`를 설정하면 Pod가 노드와 동일한 네트워크 인터페이스를 공유합니다. Prometheus node-exporter가 이 방식을 주로 사용합니다. 보안상 반드시 필요한 경우에만 사용해야 합니다.

---

**지난 글:** [쿠버네티스 Deployment 배포 전략 완전 정복](/posts/k8s-deployment-strategies/)

**다음 글:** [쿠버네티스 StatefulSet — 순서와 영속성이 보장되는 Pod](/posts/k8s-statefulset/)

<br>
읽어주셔서 감사합니다. 😊
