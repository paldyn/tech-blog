---
title: "kubelet: 노드의 핵심 에이전트"
description: "쿠버네티스 각 노드에서 실행되는 kubelet의 역할, 파드 실행 과정, livenessProbe/readinessProbe/startupProbe 동작 방식, Static Pod를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 9
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "kubelet", "probe", "liveness", "readiness", "static-pod", "cri"]
featured: false
draft: false
---

[지난 글](/posts/k8s-controller-manager/)에서 컨트롤러 매니저와 Reconcile Loop를 살펴봤다. 이번에는 Control Plane의 명령을 받아 실제로 파드를 실행하는 **kubelet**을 집중적으로 살펴본다.

## kubelet의 위치

kubelet은 워커 노드(그리고 컨트롤 플레인 노드)마다 실행되는 **노드 에이전트**다. K8s 클러스터 내 컴포넌트 중 유일하게 **컨테이너로 실행되지 않고 노드의 시스템 서비스로 직접 실행**된다. 그 이유는 kubelet이 없으면 파드를 시작하는 것 자체가 불가능하기 때문이다.

```bash
# kubelet 서비스 상태 확인
systemctl status kubelet

# kubelet 로그 실시간 확인
journalctl -u kubelet -f

# kubelet 설정 확인 (kubeadm 기준)
cat /var/lib/kubelet/config.yaml
```

## kubelet의 핵심 역할

![kubelet 아키텍처](/assets/posts/k8s-kubelet-architecture.svg)

kubelet이 수행하는 주요 작업은 다음과 같다.

**파드 스펙 수신**: API Server의 Watch API를 통해 자신이 실행해야 할 파드 스펙을 지속적으로 감시한다. 새 파드가 자신의 노드로 스케줄되면 즉시 감지한다.

**컨테이너 런타임 통신**: CRI(Container Runtime Interface) gRPC를 통해 containerd나 CRI-O에 컨테이너 생성/시작을 지시한다.

**볼륨 마운트**: CSI(Container Storage Interface)를 통해 PVC에 연결된 볼륨을 마운트한다.

**상태 보고**: 파드와 노드의 상태를 API Server에 주기적으로 보고한다. 이 보고가 멈추면 Node Controller가 `NotReady` 처리를 시작한다.

**Probe 실행**: livenessProbe, readinessProbe, startupProbe를 주기적으로 실행해 파드 건강 상태를 관리한다.

## 파드 실행 과정

Scheduler가 파드의 `nodeName`을 설정하면 kubelet이 이를 감지하고 다음 단계를 수행한다.

```
① PodSpec 검증 및 준비
   - 볼륨 마운트 준비
   - ConfigMap / Secret 주입 준비

② Init Container 실행 (있는 경우)
   - 순서대로 하나씩 실행
   - 모두 성공해야 다음 단계 진행

③ 메인 컨테이너 실행
   - containerd에 이미지 풀(pull) 요청
   - 네트워크 네임스페이스 생성 (CNI 플러그인 호출)
   - 컨테이너 시작

④ Probe 시작
   - startupProbe → 성공 시 livenessProbe/readinessProbe 활성화
```

```bash
# 파드 실행 이벤트 확인 (각 단계 타임스탬프 포함)
kubectl describe pod <pod-name>
# Events:
#   Normal  Scheduled  10s   default-scheduler  Successfully assigned
#   Normal  Pulling    9s    kubelet            Pulling image "myapp:1.0"
#   Normal  Pulled     6s    kubelet            Successfully pulled image
#   Normal  Created    6s    kubelet            Created container app
#   Normal  Started    5s    kubelet            Started container app
```

## Probe 심층 이해

![kubelet 헬스 체크 Probe](/assets/posts/k8s-kubelet-probes.svg)

세 가지 Probe의 용도와 동작 차이를 명확히 이해하는 것이 중요하다.

### livenessProbe: "살아있는가?"

실패하면 kubelet이 컨테이너를 **재시작**한다. 데드락처럼 프로세스는 살아있지만 응답 불가한 상황에 사용한다.

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 15   # 시작 후 첫 체크까지 대기
  periodSeconds: 10          # 체크 주기
  failureThreshold: 3        # 3회 연속 실패 시 재시작
  successThreshold: 1        # 1회 성공으로 복구 인정
```

### readinessProbe: "트래픽 받을 준비가 됐는가?"

실패해도 컨테이너를 재시작하지 않는다. 대신 Service의 Endpoints에서 이 파드를 **제거**해 트래픽을 보내지 않는다. 준비가 완료되면 다시 Endpoints에 추가된다.

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3
```

### startupProbe: "시작이 완료됐는가?"

시작이 오래 걸리는 앱(JVM, 대용량 모델 로딩 등)을 위해 초기 유예 기간을 제공한다. startupProbe가 성공할 때까지 livenessProbe와 readinessProbe는 실행되지 않는다.

```yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30    # 최대 30 * periodSeconds(10) = 300초 대기
  periodSeconds: 10
```

### Probe 방식

세 Probe 모두 다음 세 가지 방식으로 구현할 수 있다.

```yaml
# HTTP GET
httpGet:
  path: /healthz
  port: 8080
  scheme: HTTPS  # 기본은 HTTP

# TCP 소켓 연결 시도
tcpSocket:
  port: 3306

# 컨테이너 내부 명령 실행 (exit 0이면 성공)
exec:
  command:
  - sh
  - -c
  - "redis-cli ping | grep PONG"
```

## Static Pod

kubelet은 API Server와 완전히 독립적으로 **Static Pod**를 관리할 수 있다. 특정 디렉터리(`/etc/kubernetes/manifests/`)에 YAML 파일을 넣으면, kubelet이 감시하다가 자동으로 파드를 생성·관리한다.

kubeadm 방식으로 구성된 클러스터에서는 API Server, etcd, Scheduler, Controller Manager가 모두 Static Pod로 실행된다.

```bash
# Static Pod 매니페스트 위치 확인
ls /etc/kubernetes/manifests/
# etcd.yaml  kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml

# Static Pod 수정 (컨트롤 플레인 컴포넌트 설정 변경 예시)
sudo vim /etc/kubernetes/manifests/kube-apiserver.yaml
# 저장하면 kubelet이 자동으로 파드를 재시작
```

Static Pod는 API Server 없이도 kubelet이 직접 실행하므로, 컨트롤 플레인 자체를 부트스트랩할 때 사용한다.

---

**지난 글:** [컨트롤러 매니저(Controller Manager) 이해](/posts/k8s-controller-manager/)

**다음 글:** [kube-proxy: 쿠버네티스 네트워크 프록시](/posts/k8s-kube-proxy/)

<br>
읽어주셔서 감사합니다. 😊
