---
title: "쿠버네티스 Volume — 컨테이너 스토리지의 기초"
description: "Kubernetes Volume의 타입 분류(emptyDir·configMap·PVC·hostPath·CSI), volumeMounts 설정, subPath 활용, Access Modes를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 10
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Volume", "emptyDir", "PVC", "hostPath", "CSI", "volumeMounts", "스토리지"]
featured: false
draft: false
---

[지난 글](/posts/k8s-karpenter/)에서 노드 프로비저닝을 다뤘습니다. 이제 스토리지 섹션으로 넘어와, 쿠버네티스에서 컨테이너가 데이터를 저장하고 공유하는 핵심 개념인 **Volume**을 살펴봅니다.

## 왜 Volume이 필요한가?

컨테이너 파일시스템은 컨테이너 수명과 함께합니다. 컨테이너가 재시작되면 내부 변경 사항이 모두 사라집니다. Volume은 이 임시성을 극복하는 메커니즘입니다. Pod의 `spec.volumes`에 선언하고 컨테이너의 `volumeMounts`에서 참조합니다.

## Volume 타입 분류

![Kubernetes Volume 타입 분류](/assets/posts/k8s-volumes-overview.svg)

### emptyDir

가장 기본적인 임시 볼륨입니다. Pod가 노드에 배치될 때 빈 디렉토리로 생성됩니다. **Pod 내 컨테이너 간 파일 공유**가 주된 용도입니다. 컨테이너가 재시작해도 데이터가 유지되지만, Pod가 삭제되거나 다른 노드로 이동하면 사라집니다.

```yaml
volumes:
- name: shared-tmp
  emptyDir: {}                    # 기본: 노드 디스크 사용
  # emptyDir:
  #   medium: Memory              # tmpfs로 메모리 사용 (더 빠름)
  #   sizeLimit: "500Mi"          # 크기 제한
```

사이드카 패턴에서 메인 컨테이너와 로그 수집 컨테이너가 같은 emptyDir를 공유하는 사례가 많습니다.

### configMap과 secret

`configMap`과 `secret` 볼륨은 키-값을 파일로 마운트합니다. 환경 변수 대신 파일로 주입하면 핫 리로드가 가능합니다(단, `subPath` 사용 시 핫 리로드 불가).

```yaml
volumes:
- name: app-config
  configMap:
    name: app-settings
    items:
    - key: application.yaml
      path: application.yaml    # 볼륨 내 파일명 지정
```

### hostPath

노드의 파일시스템 경로를 컨테이너에 직접 마운트합니다. DaemonSet이 로그를 수집하거나 노드 디바이스에 접근해야 할 때 사용합니다. **프로덕션 워크로드에서는 보안 위험이 크므로 사용을 자제하세요.** 컨테이너가 노드 파일시스템을 조작할 수 있게 됩니다.

### PersistentVolumeClaim (PVC)

Pod 수명보다 오래 지속되어야 하는 스토리지에 사용합니다. StorageClass와 CSI 드라이버를 통해 AWS EBS, GCE PD, Azure Disk 같은 클라우드 디스크를 동적으로 프로비저닝합니다.

```yaml
volumes:
- name: database-storage
  persistentVolumeClaim:
    claimName: mysql-pvc
```

## volumeMounts와 subPath

![Volume 마운트 생명주기와 subPath](/assets/posts/k8s-volumes-mount-lifecycle.svg)

`volumeMounts`의 `mountPath`는 컨테이너 내부 경로, `name`은 `volumes`의 이름과 일치해야 합니다.

```yaml
containers:
- name: app
  image: myapp:latest
  volumeMounts:
  - name: data-volume
    mountPath: /app/data
  - name: app-config
    mountPath: /app/config/application.yaml
    subPath: application.yaml    # 파일 하나만 마운트
  - name: log-volume
    mountPath: /var/log/app
    readOnly: false
```

`subPath`는 볼륨 내 특정 파일이나 디렉토리만 마운트합니다. 하나의 볼륨을 여러 컨테이너가 다른 서브디렉토리로 분리해 사용할 때도 유용합니다.

## Access Modes

PVC 설정 시 `accessModes`로 어떤 방식으로 마운트할지 지정합니다.

| Access Mode | 약어 | 의미 |
|---|---|---|
| ReadWriteOnce | RWO | 한 노드에서만 R/W |
| ReadWriteMany | RWX | 여러 노드에서 R/W |
| ReadOnlyMany | ROX | 여러 노드에서 R/O |
| ReadWriteOncePod | RWOP | 단일 Pod에서만 R/W (k8s 1.22+) |

AWS EBS는 RWO만 지원합니다. NFS나 EFS는 RWX를 지원합니다. 사용하는 CSI 드라이버의 지원 여부를 먼저 확인하세요.

```bash
# 현재 PVC 상태 확인
kubectl get pvc -n production
# NAME          STATUS   VOLUME        CAPACITY   ACCESS MODES   STORAGECLASS
# mysql-pvc     Bound    pv-xxx        20Gi       RWO            gp3

# 볼륨 마운트 상태 확인
kubectl describe pod mysql-0 | grep -A 5 "Mounts:"
```

다음 글에서는 emptyDir 계열의 임시 볼륨을 더 깊이, 그리고 PVC의 동적 프로비저닝 흐름을 다룹니다.

---

**지난 글:** [쿠버네티스 Karpenter — 차세대 노드 자동 프로비저닝](/posts/k8s-karpenter/)

<br>
읽어주셔서 감사합니다. 😊
