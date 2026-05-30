---
title: "etcd: 클러스터의 두뇌 저장소"
description: "쿠버네티스 클러스터의 유일한 영속 저장소인 etcd의 역할, Raft 합의 알고리즘, 데이터 구조, 백업/복구 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["kubernetes", "k8s", "etcd", "raft", "distributed-system", "backup"]
featured: false
draft: false
---

[지난 글](/posts/k8s-control-plane/)에서 컨트롤 플레인의 전체 구조를 살펴봤다. 이번에는 컨트롤 플레인의 핵심 저장소인 **etcd**를 집중적으로 살펴본다. etcd는 K8s 클러스터에서 가장 중요한 컴포넌트 중 하나다. etcd 데이터가 손실되면 클러스터 상태 전체가 사라진다.

## etcd란?

etcd는 CoreOS(현 Red Hat)가 개발한 **분산 키-값(Key-Value) 저장소**다. "etc"는 Unix의 `/etc` 디렉터리(설정 파일 모음)에서, "d"는 "distributed"에서 따왔다.

K8s에서 etcd의 역할:
- 파드, 서비스, 컨피그맵, 시크릿 등 **모든 K8s 오브젝트의 상태 저장**
- 클러스터에서 **유일한 영속(persistent) 저장소**
- API Server만 etcd에 직접 읽기/쓰기를 수행 (다른 컴포넌트는 API Server 경유)

```bash
# etcd 파드 확인 (kubeadm 클러스터)
kubectl -n kube-system get pod -l component=etcd -o wide

# etcd 내부 K8s 데이터 조회 (디버깅용)
ETCDCTL_API=3 etcdctl get /registry/pods/default \
  --prefix --keys-only \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

## etcd 데이터 구조

![etcd 데이터 구조](/assets/posts/k8s-etcd-structure.svg)

K8s 오브젝트는 `/registry/{리소스타입}/{네임스페이스}/{이름}` 형식의 키로 저장된다. 값은 protobuf 형식으로 직렬화되어 있어 etcdctl로 조회하면 바이너리로 보이지만, API Server를 통해 조회하면 JSON으로 디코딩된다.

중요한 점은 **spec(원하는 상태)**과 **status(실제 상태)**가 같은 오브젝트 안에 함께 저장된다는 것이다. Deployment Controller가 파드를 시작하면 파드의 status 필드를 업데이트하고, 이 변경이 etcd에 기록된다.

## Raft 합의 알고리즘

![etcd Raft 합의 알고리즘](/assets/posts/k8s-etcd-raft.svg)

etcd는 **Raft 합의 알고리즘**으로 분산 일관성을 보장한다. 핵심 원칙은 단순하다: **과반수 이상의 노드가 동의해야 쓰기가 커밋된다.**

클러스터는 항상 하나의 **Leader**와 나머지 **Follower**로 구성된다.

```
쓰기 과정:
1. 클라이언트(API Server)가 Leader에 쓰기 요청
2. Leader가 AppendEntries 메시지로 Follower에 Log 전파
3. Follower들이 ACK 응답
4. 과반수 ACK 수신 → Leader가 Commit
5. 클라이언트에 응답 반환
```

**리더 선출**: Leader가 일정 시간 안에 Heartbeat를 보내지 않으면 Follower들이 선거(Election)를 시작하고 새 Leader를 선출한다. 이 과정은 보통 수백 밀리초 이내에 완료된다.

**Quorum 계산**:
- 3대 클러스터: Quorum=2, 1대 장애 허용
- 5대 클러스터: Quorum=3, 2대 장애 허용
- 짝수(4대)는 비권장 — 동률 상황에서 합의 불가

```bash
# etcd 클러스터 멤버 확인
ETCDCTL_API=3 etcdctl member list \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# 출력 예시:
# abc123, started, etcd-node1, https://10.0.0.1:2380, https://10.0.0.1:2379, false
# def456, started, etcd-node2, https://10.0.0.2:2380, https://10.0.0.2:2379, false
# ghi789, started, etcd-node3, https://10.0.0.3:2380, https://10.0.0.3:2379, false
```

## etcd 백업 및 복구

etcd가 가장 중요한 컴포넌트인 만큼, **정기 백업은 프로덕션 필수 작업**이다. CKA 시험에서도 etcd 백업/복구가 출제된다.

```bash
# 백업 생성 (스냅샷)
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-snapshot-$(date +%Y%m%d).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# 백업 파일 검증
ETCDCTL_API=3 etcdctl snapshot status /backup/etcd-snapshot-20260531.db --write-out=table

# 복구 (클러스터 재구성 필요)
ETCDCTL_API=3 etcdctl snapshot restore /backup/etcd-snapshot-20260531.db \
  --data-dir=/var/lib/etcd-restored

# 복구 후 etcd 데이터 디렉터리 교체
# /etc/kubernetes/manifests/etcd.yaml의 --data-dir 경로를 위 경로로 수정
```

## 성능 튜닝 및 모니터링

etcd의 성능은 디스크 I/O에 크게 의존한다. **SSD**를 사용하고 etcd 데이터 디렉터리를 다른 디스크로 분리하는 것이 권장된다.

```bash
# etcd 성능 체크
ETCDCTL_API=3 etcdctl check perf \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# etcd 데이터 압축 (오래된 버전 정리)
ETCDCTL_API=3 etcdctl compact $(ETCDCTL_API=3 etcdctl endpoint status \
  --write-out="json" | python3 -c \
  "import sys,json; print(json.load(sys.stdin)[0]['Status']['header']['revision'])")

# etcd 조각모음 (디스크 공간 반환)
ETCDCTL_API=3 etcdctl defrag --endpoints=https://127.0.0.1:2379
```

etcd의 `db size`가 계속 증가하면 조각모음과 압축이 필요하다. K8s는 기본적으로 주기적으로 etcd 컴팩션을 수행하지만, 장기 운영 시 직접 관리가 필요할 수 있다.

## Managed K8s에서의 etcd

EKS, GKE, AKS 같은 매니지드 K8s 서비스를 사용하면 etcd 관리는 클라우드 벤더가 담당한다. 자동 백업, 자동 업그레이드, HA 구성이 모두 포함된다. 직접 클러스터를 운영한다면 etcd 백업·모니터링·업그레이드를 반드시 별도로 계획해야 한다.

---

**지난 글:** [컨트롤 플레인(Control Plane) 이해](/posts/k8s-control-plane/)

**다음 글:** [Kubernetes API Server 완전 이해](/posts/k8s-api-server/)

<br>
읽어주셔서 감사합니다. 😊
