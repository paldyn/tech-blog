---
title: "etcd 백업과 복구 — 클러스터 상태를 지키는 마지막 보루"
description: "etcd가 왜 단일 진실의 원천인지, etcdctl snapshot save로 시점 일관성 있는 백업을 만드는 방법, snapshot restore로 새 data-dir을 재구성해 복구하는 절차, CronJob 자동화와 오프-클러스터 보관·보존 정책, 그리고 복구 리허설의 중요성을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 3
type: "knowledge"
category: "Kubernetes"
tags: ["etcd", "백업", "복구", "snapshot", "재해복구", "etcdctl", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-argo-rollouts/)까지 애플리케이션을 안전하게 배포하는 이야기를 마쳤다. 이제 클러스터 자체의 운영으로 시선을 옮긴다. 그 첫걸음은 가장 무거운 주제, **etcd 백업**이다. 쿠버네티스의 모든 객체 — Deployment, Service, Secret, ConfigMap, 심지어 RBAC 규칙까지 — 는 etcd라는 분산 키-값 저장소에 들어 있다. API 서버는 etcd 앞단의 인터페이스일 뿐, 진짜 상태는 etcd에 있다. 그래서 etcd를 잃으면 클러스터의 전부를 잃는다.

## 왜 etcd 백업이 곧 클러스터 백업인가

매니페스트를 Git으로 관리(GitOps)한다면 워크로드는 다시 적용하면 된다. 하지만 etcd에는 Git에 없는 것들이 살아 있다. 동적으로 발급된 Secret과 토큰, 컨트롤러가 만든 객체의 상태, 수동으로 패치한 리소스, 외부 시스템이 생성한 CRD 인스턴스 등이다. 또한 클러스터를 통째로 빠르게 되살려야 하는 재해 상황에서는 매니페스트를 하나씩 재적용하는 것보다 etcd 스냅샷 복구가 압도적으로 빠르고 확실하다.

매니지드 쿠버네티스(EKS, GKE 등)를 쓴다면 컨트롤 플레인과 etcd는 클라우드 사업자가 관리하므로 이 글의 직접 백업은 보통 불필요하다. 반대로 kubeadm 등으로 **직접 운영하는 클러스터라면 etcd 백업은 선택이 아니라 필수**다.

## snapshot save — 시점 일관성 있는 백업

etcd 백업의 핵심 도구는 `etcdctl`이다. `snapshot save`는 etcd의 전체 상태를 시점 일관성(point-in-time consistency) 있는 단일 파일로 떠낸다. 이 한 파일이 곧 그 순간의 클러스터 전체다.

![etcd 스냅샷 — 저장과 복구의 흐름](/assets/posts/k8s-etcd-backup-restore-flow.svg)

```bash
# 컨트롤 플레인 노드에서 (API v3 명시)
ETCDCTL_API=3 etcdctl snapshot save /backup/snapshot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# 스냅샷 무결성·메타데이터 확인
ETCDCTL_API=3 etcdctl snapshot status /backup/snapshot.db -w table
```

세 개의 인증서 옵션이 핵심이다. etcd는 mTLS로 보호되므로 CA·클라이언트 인증서·키를 함께 줘야 접근할 수 있다. kubeadm 클러스터라면 경로는 보통 `/etc/kubernetes/pki/etcd/` 아래에 있다. `snapshot status`로 떠낸 파일의 키 개수와 리비전을 확인해 두면 나중에 무결성 판단에 도움이 된다.

## snapshot restore — 새 data-dir로 되살리기

복구는 백업의 역순이지만 중요한 차이가 있다. `snapshot restore`는 기존 etcd를 덮어쓰는 게 아니라, **새로운 data 디렉터리를 만든다.** 그런 다음 etcd가 그 새 디렉터리를 바라보도록 재기동한다.

```bash
# 1) 스냅샷에서 새 data-dir 재구성
ETCDCTL_API=3 etcdctl snapshot restore /backup/snapshot.db \
  --data-dir=/var/lib/etcd-restore

# 2) etcd static pod 매니페스트의 hostPath(data-dir)를
#    /var/lib/etcd-restore 로 변경 → kubelet이 etcd 재기동
#    (kubeadm: /etc/kubernetes/manifests/etcd.yaml)
```

복구 절차에서 흔히 빠뜨리는 부분이 있다. 멀티 마스터(다중 컨트롤 플레인) 환경이라면 한 노드에서만 복구한 뒤 나머지를 멤버로 다시 합류시켜야 하고, API 서버 등 다른 컨트롤 플레인 컴포넌트를 잠시 멈췄다가 etcd 복구가 끝난 뒤 올려야 일관성이 깨지지 않는다. 무엇보다 복구는 **스냅샷을 떠낸 시점으로 되돌리는 것**이므로, 그 이후의 변경분은 사라진다. 마지막 스냅샷 이후 경과 시간이 곧 데이터 손실 범위(RPO)다.

## 자동화 — 사람 손에 의존하지 않기

"필요할 때 백업하자"는 거의 항상 실패한다. 백업은 자동화돼야 하고, 자동화의 가장 단순한 형태는 정기 실행이다. 컨트롤 플레인 노드의 cron이나, etcd 인증서에 접근 가능한 Pod를 띄우는 CronJob으로 구성한다.

```bash
# crontab 예시 — 6시간마다 스냅샷, 타임스탬프 파일명
0 */6 * * * ETCDCTL_API=3 etcdctl snapshot save \
  /backup/etcd-$(date +\%Y\%m\%d-\%H\%M).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

여기서 끝나면 안 된다. 떠낸 파일은 반드시 클러스터 밖으로 — S3 같은 원격 저장소로 — 옮겨야 한다. 노드 디스크에만 둔 백업은 그 노드가 죽으면 함께 사라진다.

![백업 전략 — 무엇을 지켜야 하는가](/assets/posts/k8s-etcd-backup-strategy.svg)

정기성, 격리 보관, 보존 정책 — 이 셋을 갖추면 백업 체계의 형태는 완성된다. 하지만 정말 중요한 건 따로 있다.

## 복구 리허설 — 백업의 진짜 가치

**한 번도 복구해보지 않은 백업은 백업이 아니다.** 파일이 손상됐거나, 인증서 경로가 바뀌었거나, 복구 절차의 한 단계를 빠뜨렸거나 하는 문제는 실제로 복구를 시도하기 전까지 드러나지 않는다. 그리고 그 시도가 진짜 장애 상황이라면 너무 늦다.

주기적으로 별도 환경에 실제로 `snapshot restore`를 수행해, 스냅샷이 정상 복구되고 클러스터가 기대대로 살아나는지 확인해야 한다. 이 리허설이 백업 파일의 무결성과 복구 절차(런북)를 동시에 검증한다.

## 정리 — 그리고 다음

etcd는 클러스터의 단일 진실의 원천이고, `etcdctl snapshot save`로 떠낸 한 파일이 그 순간의 클러스터 전체다. 복구는 새 data-dir을 만들어 etcd를 재기동하는 방식이며, 마지막 스냅샷 이후 변경분은 손실된다는 점을 기억해야 한다. 백업은 자동화·격리 보관·보존 정책으로 체계화하되, 복구 리허설로 그 가치를 정기적으로 증명해야 한다.

etcd가 mTLS 인증서로 보호된다는 점을 이 글에서 여러 번 마주쳤다. 클러스터 곳곳을 지키는 이 인증서들은 영원하지 않고 만료된다. 다음 글에서는 만료된 인증서가 클러스터를 마비시키기 전에 갱신하는 **인증서 로테이션**을 다룬다.

---

**지난 글:** [Argo Rollouts — 카나리·블루그린 배포 자동화](/posts/k8s-argo-rollouts/)

**다음 글:** [인증서 로테이션 — 만료가 클러스터를 멈추기 전에](/posts/k8s-certificate-rotation/)

<br>
읽어주셔서 감사합니다. 😊
