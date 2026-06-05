---
title: "쿠버네티스 DNS와 CoreDNS 완전 정복"
description: "CoreDNS 동작 원리, 서비스·Pod FQDN 형식, search 도메인과 ndots 설정, 커스텀 DNS, 실전 트러블슈팅까지 쿠버네티스 DNS를 깊이 있게 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 8
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "CoreDNS", "DNS", "FQDN", "ndots", "서비스 디스커버리", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/k8s-headless-service/)에서 헤드리스 서비스(Headless Service)가 개별 Pod IP를 DNS로 노출하는 방식을 살펴봤습니다. 이번 글에서는 그 DNS 질의를 실제로 처리하는 **CoreDNS**의 동작 원리와 쿠버네티스 DNS 네이밍 규칙 전반을 정리합니다.

## CoreDNS란?

쿠버네티스 1.13부터 기본 DNS 서버로 채택된 **CoreDNS**는 Go로 작성된 플러그인 기반 DNS 서버입니다. `kube-system` 네임스페이스에 Deployment로 실행되며, `kube-dns`라는 이름의 Service(ClusterIP: 보통 `10.96.0.10`)를 통해 클러스터 내 모든 Pod의 DNS 서버 역할을 합니다.

![CoreDNS DNS 질의 흐름](/assets/posts/k8s-dns-coredns-flow.svg)

kubelet은 Pod를 생성할 때 `/etc/resolv.conf`에 CoreDNS의 ClusterIP를 `nameserver`로 자동으로 주입합니다. 이를 통해 Pod는 별도 설정 없이 `my-svc` 같은 단축 이름으로 다른 서비스에 접근할 수 있습니다.

---

## 쿠버네티스 DNS 네이밍 규칙

![K8s DNS 네이밍 규칙](/assets/posts/k8s-dns-coredns-names.svg)

### Service FQDN

쿠버네티스 Service의 완전 정규화 도메인 이름(FQDN)은 다음 형식을 따릅니다.

```
<service-name>.<namespace>.svc.cluster.local
```

예를 들어 `prod` 네임스페이스의 `my-app` 서비스에 접근하려면:

```bash
# 완전한 FQDN (어느 네임스페이스에서든 사용 가능)
curl http://my-app.prod.svc.cluster.local

# 같은 네임스페이스 내에서는 단축명 사용 가능
curl http://my-app

# 다른 네임스페이스에서 접근 시 최소한 네임스페이스까지 지정
curl http://my-app.prod
```

### Pod DNS 형식

일반 Pod의 DNS 이름은 IP 주소의 점(`.`)을 하이픈(`-`)으로 바꾼 형태입니다.

```
<pod-ip-with-dashes>.<namespace>.pod.cluster.local
# 예: 10-244-1-5.prod.pod.cluster.local
```

StatefulSet Pod는 헤드리스 서비스와 결합하여 안정적인 이름을 가집니다.

```
<pod-name>.<headless-svc>.<namespace>.svc.cluster.local
# 예: web-0.web-svc.prod.svc.cluster.local
```

---

## search 도메인과 ndots

Pod 내부의 `/etc/resolv.conf`를 확인하면 `search` 항목과 `options ndots:5`가 설정되어 있습니다.

```bash
# Pod 내부에서 확인
cat /etc/resolv.conf
# nameserver 10.96.0.10
# search prod.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5
```

`ndots:5`는 질의 이름에 점(`.`)이 5개 미만이면 `search` 도메인 목록을 순서대로 붙여서 먼저 시도하는 규칙입니다. `my-app`은 점이 없으므로 `my-app.prod.svc.cluster.local` → `my-app.svc.cluster.local` → `my-app.cluster.local` 순으로 시도합니다.

반면 외부 도메인 `api.example.com`은 점이 2개라 여전히 search 도메인을 먼저 시도합니다. 이 오버헤드를 피하려면 **FQDN 끝에 점을 붙여** 명시적으로 절대 이름임을 표시합니다.

```bash
# 불필요한 search 도메인 순회 방지: 끝에 점 추가
nslookup api.example.com.
curl http://api.example.com./path
```

---

## CoreDNS Corefile 설정

CoreDNS는 `kube-system` 네임스페이스의 ConfigMap `coredns`에서 Corefile을 읽습니다.

```bash
# CoreDNS 설정 확인
kubectl -n kube-system get configmap coredns -o yaml
```

기본 Corefile 구조:

```
.:53 {
    errors
    health {
       lameduck 5s
    }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
       ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf {
       max_concurrent 1000
    }
    cache 30
    loop
    reload
    loadbalance
}
```

### 커스텀 도메인 추가

사내 도메인(`internal.company.com`)을 별도 DNS 서버로 포워딩하려면 ConfigMap을 수정합니다.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        kubernetes cluster.local in-addr.arpa ip6.arpa {
           pods insecure
           fallthrough in-addr.arpa ip6.arpa
        }
        forward . /etc/resolv.conf
        cache 30
        reload
        loadbalance
    }
    internal.company.com:53 {
        forward . 192.168.1.53
        cache 30
    }
```

---

## Pod dnsConfig 커스터마이징

개별 Pod 수준에서 DNS 동작을 조정할 수 있습니다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: custom-dns-pod
spec:
  dnsPolicy: ClusterFirst      # 기본값
  dnsConfig:
    options:
      - name: ndots
        value: "2"             # ndots를 2로 낮춰 외부 DNS 조회 최적화
      - name: single-request-reopen
  containers:
    - name: app
      image: nginx
```

`dnsPolicy` 값:
- `ClusterFirst` (기본): 클러스터 DNS 우선, 미매칭 시 업스트림 포워딩
- `ClusterFirstWithHostNet`: hostNetwork Pod에서 클러스터 DNS 사용 시
- `Default`: 노드의 `/etc/resolv.conf` 그대로 사용
- `None`: `dnsConfig`에서 완전히 수동 설정

---

## DNS 트러블슈팅

### CoreDNS 상태 확인

```bash
# CoreDNS Pod 상태
kubectl get pods -n kube-system -l k8s-app=kube-dns

# CoreDNS 로그 확인
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50

# CoreDNS Service 확인
kubectl get svc -n kube-system kube-dns
```

### DNS 질의 테스트

```bash
# 임시 디버그 Pod 생성 후 nslookup 테스트
kubectl run dns-test --image=busybox:1.28 --restart=Never \
  --rm -it -- nslookup kubernetes.default

# dig으로 상세 질의
kubectl run dns-test --image=tutum/dnsutils --restart=Never \
  --rm -it -- dig my-svc.prod.svc.cluster.local

# Pod 내부에서 직접 확인
kubectl exec -it my-pod -- cat /etc/resolv.conf
kubectl exec -it my-pod -- nslookup my-svc
```

### 자주 발생하는 문제

| 증상 | 원인 | 해결 방법 |
|---|---|---|
| 서비스 이름으로 접근 불가 | 잘못된 네임스페이스 | FQDN 전체 사용 |
| 외부 도메인 느린 응답 | ndots:5 + search 순회 | ndots:2로 낮추거나 FQDN에 `.` 추가 |
| CoreDNS CrashLoop | 메모리 부족 | resource limits 증가 |
| DNS 간헐적 타임아웃 | conntrack 테이블 포화 | `single-request-reopen` 옵션 추가 |

---

**지난 글:** [헤드리스 서비스(Headless Service)](/posts/k8s-headless-service/)
**다음 글:** [쿠버네티스 Ingress 컨트롤러](/posts/k8s-ingress-controllers/)
<br>
읽어주셔서 감사합니다. 😊
