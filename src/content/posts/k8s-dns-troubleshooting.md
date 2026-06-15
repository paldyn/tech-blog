---
title: "DNS 트러블슈팅 — 서비스 이름이 풀리지 않을 때"
description: "쿠버네티스 클러스터 안에서 서비스 이름이 해석되지 않는 DNS 장애를 다룹니다. resolv.conf와 CoreDNS를 거치는 질의 흐름, FQDN과 search 도메인 규칙, nslookup으로 DNS 자체인지 특정 이름만인지 가르는 법, 그리고 CoreDNS 다운·잘못된 네임스페이스·NetworkPolicy 차단·ndots 지연이라는 단골 원인별 진단과 해결을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["DNS", "CoreDNS", "트러블슈팅", "네트워크", "FQDN", "NetworkPolicy", "디버깅", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-pending-pods/)에서 Pod가 노드에 배정되는 단계까지 봤다. Pod가 잘 떠서 돌기 시작해도, 정작 "다른 서비스에 연결이 안 돼요"라는 신고는 끊이지 않는다. 그리고 그 원인의 상당수는 네트워크 경로가 아니라 **이름 해석(DNS)**에 있다. `api`라는 서비스 이름을 IP로 바꾸지 못하면 그 뒤의 연결은 시작도 못 한다. DNS 장애는 증상이 "연결 실패"로 뭉뚱그려 나타나기 때문에 엉뚱한 곳을 파다 시간을 버리기 쉽다. 그래서 가장 먼저 "이게 DNS 문제인가?"를 빠르게 가르는 법부터 익혀야 한다.

## 클러스터 DNS는 어떻게 동작하는가

Pod 안에서 `api`나 `api.default.svc.cluster.local` 같은 이름으로 연결을 시도하면, 그 질의는 Pod의 `/etc/resolv.conf`에 적힌 네임서버로 간다. 그 네임서버는 보통 `kube-dns`라는 Service의 ClusterIP이고, 그 뒤에 실제 DNS 서버인 **CoreDNS** Pod들이 있다. CoreDNS는 질의를 받아, 클러스터 내부 서비스 이름이면 해당 ClusterIP를 돌려주고, 외부 도메인이면 업스트림 DNS로 전달(forward)한다.

![클러스터 DNS 질의 흐름](/assets/posts/k8s-dns-troubleshooting-flow.svg)

이름 규칙도 알아둬야 한다. 서비스의 완전한 이름(FQDN)은 `<service>.<namespace>.svc.cluster.local`이다. 같은 네임스페이스 안에서는 그냥 `api`만 써도 `resolv.conf`의 `search` 도메인 덕분에 자동으로 보완돼 해석된다. 하지만 **다른 네임스페이스**의 서비스를 부를 때는 `api.other-ns`처럼 네임스페이스를 명시해야 한다 — 이것을 빼먹는 것이 가장 흔한 실수다.

## 첫 걸음 — DNS 문제인지부터 가른다

연결 실패 신고를 받으면, IP로는 되는데 이름으로만 안 되는지부터 확인한다. 그러면 DNS 문제인지 네트워크 문제인지 즉시 갈린다. [앞서 본](/posts/k8s-kubectl-debugging/) `kubectl debug`로 도구가 든 컨테이너를 띄워 확인하는 것이 편하다.

```bash
# netshoot 임시 컨테이너로 들어가 직접 질의
kubectl debug -it web-7d9f-abcde --image=nicolaka/netshoot

# (컨테이너 안에서) 이름 해석이 되는가?
nslookup api.default.svc.cluster.local
nslookup kubernetes.default

# resolv.conf 가 올바른가?
cat /etc/resolv.conf
```

`nslookup`이 정상 IP를 돌려주면 DNS는 멀쩡하고 문제는 다른 데 있다(NetworkPolicy, 잘못된 포트, 앱 설정 등). 반대로 이름 해석 자체가 실패하면 이제 DNS 트러블슈팅 모드로 들어간다.

## 단골 원인 네 갈래

![DNS 실패 단골 원인](/assets/posts/k8s-dns-troubleshooting-causes.svg)

### 1) CoreDNS가 다운되거나 과부하 (모든 질의 실패)

모든 Pod에서, 모든 이름 해석이 한꺼번에 실패한다면 DNS 서버 자체를 의심한다. `kube-system` 네임스페이스의 CoreDNS Pod 상태와 로그를 본다.

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50
```

CoreDNS가 CrashLoop이거나, 노드 압박으로 evict됐거나, 질의량이 폭증해 throttling 걸린 경우다. 리소스를 늘리거나 레플리카를 키운다. 규모가 큰 클러스터라면 NodeLocal DNSCache로 각 노드에 캐시를 두어 CoreDNS 부담을 줄이는 것도 방법이다.

### 2) 잘못된 FQDN·네임스페이스 (특정 이름만 실패)

다른 이름은 다 되는데 특정 서비스 하나만 안 풀린다면, 이름을 잘못 쓴 경우가 대부분이다. 다른 네임스페이스의 서비스를 네임스페이스 없이 불렀거나, 서비스 이름에 오타가 있다. 서비스가 실제로 존재하는지부터 확인한다.

```bash
# 그 이름의 서비스가 정말 있는가, 어느 NS에 있는가
kubectl get svc -A | grep api
```

### 3) NetworkPolicy가 DNS를 막음 (DNS만 막힘)

`default-deny` egress NetworkPolicy를 걸어두면 의도치 않게 CoreDNS로 가는 53번 포트(UDP/TCP)까지 막혀서, 그 네임스페이스의 모든 Pod가 갑자기 이름 해석에 실패한다. 정책을 도입한 직후 DNS가 죽었다면 이 경우를 강하게 의심한다. kube-system의 DNS를 향한 egress를 명시적으로 허용해야 한다.

```yaml
egress:
  - to:
      - namespaceSelector:
          matchLabels:
            kubernetes.io/metadata.name: kube-system
    ports:
      - protocol: UDP
        port: 53
      - protocol: TCP
        port: 53
```

### 4) ndots 지연 (해석은 되는데 느림)

쿠버네티스 Pod의 `resolv.conf`는 기본적으로 `options ndots:5`를 갖는다. 점이 5개 미만인 이름은 먼저 search 도메인들을 차례로 붙여 질의해보는데, 이 때문에 `github.com` 같은 외부 도메인을 부를 때 불필요한 질의가 여러 번 나가 응답이 느려질 수 있다. 외부 도메인을 자주 부른다면 이름 끝에 점을 붙여 FQDN(`github.com.`)으로 만들거나, Pod의 `dnsConfig`로 ndots를 조정한다.

## 정리 — 그리고 다음

DNS 장애는 "연결 실패"로 위장하기 때문에, 가장 먼저 `nslookup`으로 이게 정말 DNS 문제인지부터 갈라야 한다. 모든 이름이 한꺼번에 안 되면 CoreDNS 자체를, 특정 이름만 안 되면 FQDN·네임스페이스를, 정책 도입 직후 죽었다면 NetworkPolicy의 53번 포트를 본다. FQDN 규칙(`<svc>.<ns>.svc.cluster.local`)과 다른 네임스페이스 호출 시 네임스페이스 명시를 기억하면 흔한 실수의 대부분을 피할 수 있다. 다음 글은 이 시리즈의 마지막 — 지금까지 다룬 모든 주제를 운영 관점에서 한 장으로 묶는 `프로덕션 준비 체크리스트`다.

---

**지난 글:** [Pending Pod — 스케줄링되지 못하는 Pod 진단하기](/posts/k8s-pending-pods/)

**다음 글:** [프로덕션 준비 체크리스트 — 운영에 올리기 전 점검 목록](/posts/k8s-production-readiness-checklist/)

<br>
읽어주셔서 감사합니다. 😊
