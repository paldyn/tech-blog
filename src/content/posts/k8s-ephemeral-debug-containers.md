---
title: "Ephemeral Debug Container로 실행 중인 Pod 디버깅하기"
description: "distroless 이미지나 CrashLoopBackOff 상태의 Pod에 임시 디버그 컨테이너를 삽입해 네트워크·프로세스 네임스페이스를 공유하며 진단하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "디버깅", "Ephemeral Container", "kubectl debug", "distroless"]
featured: false
draft: false
---

[지난 글](/posts/k8s-multi-container-pod/)에서 멀티 컨테이너 파드 패턴을 다뤘습니다. 실제 운영 환경에서는 컨테이너가 distroless 이미지로 빌드되거나 CrashLoopBackOff 상태에 빠져 `kubectl exec`조차 불가능한 상황이 종종 생깁니다. 이때 **Ephemeral Container(임시 컨테이너)**를 사용하면 실행 중인 Pod에 shell이나 진단 도구를 갖춘 컨테이너를 삽입해 문제를 분석할 수 있습니다. Kubernetes 1.23에서 GA(정식 기능)로 승격됐으며, 현재 대부분의 클러스터에서 기본 활성화돼 있습니다.

## Ephemeral Container란

일반 컨테이너와 달리 임시 컨테이너는 Pod spec에 영구적으로 기록되지 않습니다. 삽입 후 프로세스가 종료되면 컨테이너는 사라지고 재시작도 되지 않습니다. 핵심 특징은 다음과 같습니다.

- **공유 네임스페이스**: `--target` 옵션으로 특정 컨테이너의 Network·IPC 네임스페이스를 공유합니다. `shareProcessNamespace: true`가 설정된 Pod라면 PID 네임스페이스도 공유되어 `ps` 명령으로 대상 컨테이너 프로세스를 볼 수 있습니다.
- **임시성**: exit 시 자동 제거. `resources`, `livenessProbe`, `readinessProbe` 미지원.
- **distroless 우회**: 디버그 이미지에서 `tcpdump`, `curl`, `strace` 등을 자유롭게 실행할 수 있습니다.

![Ephemeral Debug Container 구조](/assets/posts/k8s-ephemeral-debug-containers-architecture.svg)

## kubectl debug 기본 사용법

가장 일반적인 패턴은 실행 중인 Pod에 직접 임시 컨테이너를 삽입하는 것입니다.

```bash
# distroless Pod에 busybox 삽입, app-container 네임스페이스 공유
kubectl debug -it my-app-pod \
  --image=busybox \
  --target=app-container

# 네트워크 진단 도구가 풍부한 이미지 사용
kubectl debug -it my-app-pod \
  --image=nicolaka/netshoot \
  --target=app-container
```

세션에 진입하면 같은 네트워크 네임스페이스를 공유하므로 `curl localhost:8080`처럼 대상 컨테이너의 포트를 직접 테스트할 수 있습니다.

### /proc를 통한 파일시스템 접근

PID 네임스페이스를 공유하는 경우, 대상 컨테이너의 파일시스템에 `/proc/{PID}/root` 경로로 접근할 수 있습니다.

```bash
# 대상 컨테이너의 PID 1 환경변수 확인
cat /proc/1/environ | tr '\0' '\n'

# 대상 컨테이너 루트 파일시스템 탐색
ls /proc/1/root/app/
```

## Pod 복사본으로 디버그

원본 Pod를 건드리지 않고 복사본을 만들어 디버깅할 수 있습니다. 특히 이미지 자체를 교체해 실행해야 할 때 유용합니다.

```bash
# Pod 복사본 생성, 모든 컨테이너 이미지를 ubuntu로 교체
kubectl debug my-app-pod \
  --copy-to=debug-pod \
  --set-image=*=ubuntu \
  -it -- bash

# 특정 컨테이너만 이미지 교체
kubectl debug my-app-pod \
  --copy-to=debug-pod \
  --set-image=app=ubuntu \
  -it -- bash
```

복사본 Pod가 남아 있으면 나중에 직접 삭제해야 합니다.

```bash
kubectl delete pod debug-pod
```

## 노드 디버그

Node 수준의 문제를 진단할 때는 `node` 서브커맨드를 사용합니다. 자동으로 `hostNetwork`, `hostPID`가 활성화되고 노드 파일시스템이 `/host`에 마운트됩니다.

```bash
kubectl debug node/worker-node-1 \
  -it --image=ubuntu

# 노드 진입 후 chroot로 노드 파일시스템 탐색
chroot /host bash
```

![kubectl debug 주요 사용 패턴](/assets/posts/k8s-ephemeral-debug-containers-commands.svg)

## 실전 진단 흐름 예시

```bash
# 1. CrashLoopBackOff 확인
kubectl get pod my-app -o wide

# 2. 임시 컨테이너 삽입 (--target 으로 충돌 컨테이너 지정)
kubectl debug -it my-app \
  --image=nicolaka/netshoot \
  --target=app

# 3. 네임스페이스 공유 확인 후 진단
# 컨테이너 내부에서:
ps aux          # PID 공유 시 대상 프로세스 보임
ss -tlnp        # 포트 리스닝 확인
curl -v localhost:8080   # 헬스 엔드포인트 확인
tcpdump -i eth0 -n port 8080  # 패킷 덤프

# 4. 세션 종료 → 임시 컨테이너 자동 제거
exit
```

## 주의사항

Ephemeral Container는 PodSecurityAdmission 정책의 영향을 받습니다. `restricted` 정책이 적용된 네임스페이스에서는 privileged 이미지 삽입이 거부될 수 있습니다. 또한 `Completed` 또는 `Succeeded` 상태의 Pod에는 임시 컨테이너를 추가할 수 없으며, `kubectl exec`와 달리 이미 종료된 컨테이너에도 접근이 불가합니다.

```yaml
# ephemeralContainers 직접 YAML 작성 예시 (참고용)
# kubectl debug 가 자동으로 처리하므로 보통 직접 작성 불필요
spec:
  ephemeralContainers:
  - name: debugger
    image: busybox
    stdin: true
    tty: true
    targetContainerName: app
```

---

**지난 글:** [멀티 컨테이너 파드 패턴: Sidecar, Ambassador, Adapter](/posts/k8s-multi-container-pod/)

**다음 글:** [쿠버네티스 Labels와 Selectors 완전 이해](/posts/k8s-labels-selectors/)

<br>
읽어주셔서 감사합니다. 😊
