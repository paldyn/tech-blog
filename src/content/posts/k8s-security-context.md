---
title: "쿠버네티스 Security Context — 파드 보안 설정"
description: "Pod/Container Security Context의 주요 필드(runAsUser, capabilities, readOnlyRootFilesystem 등), Linux Capabilities 최소화, 프로덕션 보안 하드닝 예제를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 9
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "security-context", "capabilities", "seccomp", "pod-security", "hardening"]
featured: false
draft: false
---

[지난 글](/posts/k8s-rbac/)에서 RBAC로 API Server 접근 권한을 제어하는 방법을 알아봤다. 이번에는 파드 **내부**에서 컨테이너 프로세스가 어떤 권한으로 실행되는지 제어하는 **Security Context**를 다룬다. Security Context는 컨테이너 런타임에 전달되는 Linux 보안 설정이다. 이를 올바르게 설정하면 취약점이 있는 컨테이너가 공격받더라도 호스트나 다른 컨테이너로의 피해를 최소화할 수 있다.

## Security Context의 두 레벨

Security Context는 Pod 레벨과 Container 레벨 두 곳에 설정할 수 있다. Pod 레벨은 모든 컨테이너에 공통 적용되고, Container 레벨은 특정 컨테이너에만 적용되며 Pod 설정을 오버라이드한다.

![Security Context — Pod vs Container 레벨](/assets/posts/k8s-security-context-layers.svg)

## 기본 보안 설정 예제

프로덕션에서 권장하는 최소 보안 설정이다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsNonRoot: true        # root(UID=0) 실행 거부
    runAsUser: 1000           # UID 1000으로 실행
    runAsGroup: 3000          # GID 3000
    fsGroup: 2000             # 마운트된 볼륨의 GID
    seccompProfile:
      type: RuntimeDefault    # 런타임 기본 seccomp 프로파일

  containers:
    - name: app
      image: my-app:latest
      securityContext:
        allowPrivilegeEscalation: false   # sudo/setuid 비트 실행 방지
        readOnlyRootFilesystem: true      # 루트 파일시스템 읽기 전용
        privileged: false                 # privileged 모드 금지
        capabilities:
          drop:
            - ALL                         # 모든 Linux Capabilities 제거
          add:
            - NET_BIND_SERVICE            # 필요한 것만 추가 (포트 1024 미만)
      volumeMounts:
        - name: tmp                       # readOnlyRootFilesystem 시 /tmp는 별도 마운트
          mountPath: /tmp
  volumes:
    - name: tmp
      emptyDir: {}
```

## runAsNonRoot와 runAsUser

```bash
# 컨테이너 내 프로세스 UID 확인
kubectl exec secure-pod -- id
# uid=1000 gid=3000 groups=3000,2000

# Dockerfile에 USER 설정이 없으면 root(UID=0)로 실행됨
# FROM ubuntu:22.04
# USER 1000  ← 이 설정이 있어야 runAsUser와 일치

# 이미지가 root만 지원하고 runAsNonRoot: true 이면 파드 시작 실패
kubectl describe pod secure-pod | grep -A3 "State:"
# State: Waiting
#   Reason: CreateContainerConfigError
```

## readOnlyRootFilesystem

파일시스템을 읽기 전용으로 설정하면 런타임에 악성 코드가 파일을 생성하거나 바이너리를 수정하는 공격을 차단한다.

```bash
# 읽기 전용 파일시스템 시 파일 생성 시도 → 실패
kubectl exec secure-pod -- touch /etc/hacked
# touch: /etc/hacked: Read-only file system

# 앱이 임시 파일이 필요하면 emptyDir 볼륨을 /tmp에 마운트
kubectl exec secure-pod -- touch /tmp/ok
# 성공
```

## Linux Capabilities

Linux Capabilities는 root 권한을 세분화한 것이다. 컨테이너는 기본적으로 약 14개의 Capabilities를 갖는다. `drop: ALL`로 모두 제거하고 필요한 것만 추가하는 것이 보안 원칙이다.

![Linux Capabilities 관리](/assets/posts/k8s-security-context-capabilities.svg)

```bash
# 컨테이너 내 현재 Capabilities 확인
kubectl exec secure-pod -- cat /proc/1/status | grep -E "^Cap"
# CapBnd: 0000000000000400  (NET_BIND_SERVICE만 남음)

# capsh로 해석 (capsh 설치 필요)
capsh --decode=0000000000000400
# 0x0000000000000400=cap_net_bind_service
```

## privileged 모드 — 절대 금지

```yaml
# 절대 사용하지 말아야 할 설정
securityContext:
  privileged: true   # 컨테이너가 호스트 노드와 거의 동등한 권한 획득
                     # Docker socket 마운트 없이도 노드 탈출 가능
```

DaemonSet이나 CNI 플러그인처럼 정말 필요한 경우에만 제한적으로 사용해야 하며, 일반 앱 파드에는 절대 사용하지 않는다.

## fsGroup과 볼륨 권한

```yaml
# fsGroup: 볼륨의 파일 소유 그룹을 지정
spec:
  securityContext:
    fsGroup: 2000   # 마운트된 볼륨이 GID 2000 소유로 chown됨
  containers:
    - name: app
      volumeMounts:
        - name: data
          mountPath: /data    # /data 내 파일이 GID 2000 소유로 접근 가능
```

```bash
# 파드 내에서 마운트된 볼륨 소유권 확인
kubectl exec secure-pod -- ls -la /data
# drwxrwsr-x  root  2000  ...
```

## seccompProfile

Seccomp(Secure Computing Mode)은 컨테이너가 호출할 수 있는 시스템 콜을 제한한다.

```yaml
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault     # 런타임(Docker/containerd) 기본 프로파일
      # type: Localhost         # 노드의 커스텀 프로파일 사용
      # localhostProfile: profiles/my-profile.json
      # type: Unconfined       # 제한 없음 (기본값, 비권장)
```

## 보안 설정 검증

```bash
# kube-score로 보안 설정 검사
kube-score score deployment.yaml

# Trivy로 보안 미스컨피그 스캔
trivy config deployment.yaml

# 현재 파드 보안 설정 확인
kubectl get pod secure-pod -o jsonpath=\
  '{.spec.securityContext}{"\n"}{.spec.containers[0].securityContext}' | python3 -m json.tool
```

---

**지난 글:** [쿠버네티스 RBAC — 역할 기반 접근 제어](/posts/k8s-rbac/)

**다음 글:** [Seccomp와 AppArmor — 커널 레벨 보안 프로파일](/posts/k8s-seccomp-apparmor/)

<br>
읽어주셔서 감사합니다. 😊
