---
title: "쿠버네티스 Ephemeral Volumes — Pod 수명과 함께하는 임시 볼륨"
description: "emptyDir·configMap·projected·Generic Ephemeral Volume의 종류와 생명주기, Memory 미디어, 컨테이너 재시작 vs Pod 삭제 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Volume", "emptyDir", "Ephemeral", "projected", "Generic Ephemeral Volume", "스토리지"]
featured: false
draft: false
---

[지난 글](/posts/k8s-volumes/)에서 쿠버네티스 볼륨의 전체 타입을 살펴봤습니다. 이번 글에서는 그 중 **Ephemeral Volume(임시 볼륨)** — Pod 수명과 함께 생성되고 삭제되는 볼륨들을 집중적으로 파헤칩니다. 지속성이 필요 없는 캐시, 설정 파일 주입, 다중 소스 통합 마운트 등 실무에서 가장 자주 쓰이는 볼륨 패턴들입니다.

## Ephemeral Volume이란?

**Ephemeral Volume**은 Pod의 수명과 같은 볼륨입니다. Pod가 스케줄링되면 생성되고, Pod가 삭제되면 함께 사라집니다. 반대 개념인 PersistentVolume(PV)은 Pod가 사라져도 데이터가 남습니다.

중요한 구분은 **컨테이너 재시작 vs Pod 삭제**입니다. `emptyDir`에 저장된 데이터는 컨테이너가 OOM 등으로 재시작되어도 유지됩니다. 같은 Pod 내 컨테이너들이 공유하는 공간이기 때문입니다. 그러나 Pod 자체가 노드에서 제거되면(삭제·퇴출·노드 장애) 볼륨도 함께 사라집니다.

![Ephemeral Volume 종류와 특성](/assets/posts/k8s-ephemeral-volumes-types.svg)

## 타입별 상세

### emptyDir — 컨테이너 간 공유 공간

`emptyDir`는 가장 기본적인 임시 볼륨입니다. Pod가 노드에 배치될 때 빈 디렉토리로 생성됩니다. 주로 **사이드카 패턴**에서 두 컨테이너가 파일을 주고받을 때 사용합니다.

```yaml
volumes:
- name: shared-cache
  emptyDir:
    medium: Memory    # tmpfs 사용 (노드 디스크 대신 RAM)
    sizeLimit: "256Mi"
```

`medium: Memory`를 지정하면 tmpfs(메모리 기반 파일시스템)를 사용합니다. I/O가 빠르지만 노드의 메모리를 소비합니다. `sizeLimit`을 설정하지 않으면 노드 디스크 전체를 사용할 수 있으므로 항상 명시하는 것이 좋습니다.

### configMap / secret — API 오브젝트를 파일로

`configMap`과 `secret` 볼륨은 쿠버네티스 API 오브젝트를 파일로 마운트합니다. 환경 변수로 주입하는 방식과 달리, 파일 마운트 방식은 kubelet이 주기적으로 갱신하므로 **핫 리로드**가 가능합니다(단, `subPath`를 사용하면 업데이트가 반영되지 않습니다).

```yaml
volumes:
- name: app-config
  configMap:
    name: my-config
    items:
    - key: app.yaml
      path: config/app.yaml  # 볼륨 내 경로 지정
      mode: 0644
```

`items`를 생략하면 ConfigMap의 모든 키가 파일명으로 마운트됩니다. `mode`로 파일 권한을 지정할 수 있습니다.

### projected — 여러 소스를 하나의 경로로

`projected` 볼륨은 configMap, secret, downwardAPI, serviceAccountToken 등 여러 소스를 **단일 마운트 경로**에 통합합니다.

```yaml
volumes:
- name: all-in-one
  projected:
    sources:
    - serviceAccountToken:
        path: token
        expirationSeconds: 3600
        audience: "vault"
    - configMap:
        name: app-config
    - secret:
        name: tls-cert
```

특히 `serviceAccountToken`은 OIDC 기반 인증이나 Vault 연동 시 유용합니다. 토큰 만료 시간을 지정할 수 있어 보안성이 높습니다.

### downwardAPI — Pod 메타데이터를 파일로

Pod의 이름, 네임스페이스, 레이블, CPU/메모리 요청량 등을 파일로 노출합니다.

```yaml
volumes:
- name: pod-info
  downwardAPI:
    items:
    - path: pod-name
      fieldRef:
        fieldPath: metadata.name
    - path: cpu-request
      resourceFieldRef:
        resource: requests.cpu
        containerName: app
```

애플리케이션이 자신의 파드 이름이나 리소스 할당량을 알아야 할 때 환경 변수보다 파일 방식을 선호하는 경우가 있습니다(런타임에 값이 변할 수 있어서).

## Generic Ephemeral Volume

쿠버네티스 1.23부터 정식 기능으로 승격된 **Generic Ephemeral Volume**은 PVC 템플릿을 Pod 스펙 내에 인라인으로 정의합니다. Pod 이름을 접두사로 한 PVC가 자동 생성되고, Pod 삭제 시 PVC도 함께 삭제됩니다.

```yaml
volumes:
- name: scratch
  ephemeral:
    volumeClaimTemplate:
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 10Gi
```

StatefulSet의 `volumeClaimTemplates`와 달리, 이 방식은 일반 Pod·Deployment에서도 StorageClass 기반 스토리지를 임시로 사용할 수 있게 해줍니다. 대규모 배치 처리 중 빠른 임시 디스크가 필요할 때 적합합니다.

![Ephemeral Volume 생명주기](/assets/posts/k8s-ephemeral-volumes-lifecycle.svg)

## CSI Ephemeral Volume

CSI 드라이버를 직접 인라인으로 참조하는 방식입니다. `csi` 볼륨 타입을 사용하되 PVC 없이 정의합니다.

```yaml
volumes:
- name: secret-store-vol
  csi:
    driver: secrets-store.csi.k8s.io
    readOnly: true
    volumeAttributes:
      secretProviderClass: "my-provider"
```

Secrets Store CSI Driver(AWS Secrets Manager, Azure Key Vault, HashiCorp Vault 연동)가 대표적인 사용 사례입니다. 이 드라이버가 Pod 마운트 시점에 외부 시크릿을 파일로 주입합니다.

## emptyDir sizeLimit과 리소스 관리

`emptyDir`에 `sizeLimit`을 설정하면 kubelet이 주기적으로 디스크 사용량을 확인합니다. 제한을 초과하면 Pod가 퇴출(Eviction)됩니다. `medium: Memory`의 경우 tmpfs 크기가 노드 메모리를 사용하므로, 컨테이너의 `memory` limit에도 영향을 줍니다.

```yaml
# sizeLimit이 없으면 노드 디스크 전체를 소비할 수 있음
volumes:
- name: temp-work
  emptyDir:
    sizeLimit: "1Gi"  # 필수 설정 권장
```

## 언제 무엇을 선택할까?

| 상황 | 권장 타입 |
|------|----------|
| 컨테이너 간 파일 공유 | `emptyDir` |
| 애플리케이션 설정 파일 | `configMap` |
| 비밀값(TLS 인증서, API 키) | `secret` |
| SA 토큰 + 설정 통합 | `projected` |
| StorageClass 기반 임시 디스크 | Generic Ephemeral |
| 외부 시크릿 스토어 | CSI Ephemeral |

---

**지난 글:** [쿠버네티스 Volume — 컨테이너 스토리지의 기초](/posts/k8s-volumes/)

**다음 글:** [쿠버네티스 PersistentVolume과 PVC — 지속형 스토리지의 핵심](/posts/k8s-persistent-volume-pvc/)

<br>
읽어주셔서 감사합니다. 😊
