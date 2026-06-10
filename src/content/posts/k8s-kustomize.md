---
title: "Kustomize 기초 — 순수 YAML로 Kubernetes 설정 관리"
description: "Kustomize의 핵심 개념과 kustomization.yaml 구조, namePrefix/commonLabels/images 변환기, configMapGenerator와 secretGenerator, kubectl apply -k 사용법을 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 3
type: "knowledge"
category: "Kubernetes"
tags: ["Kustomize", "Kubernetes", "YAML관리", "설정관리", "kubectl", "GitOps"]
featured: false
draft: false
---

[지난 글](/posts/k8s-helm-values-strategy/)에서 Helm Values 전략으로 환경별 배포를 관리하는 방법을 살펴봤다. 이번 글에서는 Helm과 다른 접근법인 Kustomize를 소개한다. Kustomize는 템플릿 언어 없이 순수 YAML을 그대로 사용하면서도 환경별 설정 변환을 가능하게 해준다. `kubectl`에 내장되어 있어 별도 도구 설치도 필요 없다.

## Kustomize가 Helm과 다른 점

Helm은 `{{ .Values.image.tag }}`와 같은 Go 템플릿 문법을 사용해 설정을 주입한다. Kustomize는 원본 YAML을 그대로 두고, 변환(Transform)과 패치(Patch)를 통해 최종 YAML을 만들어낸다.

```
helm install             kustomize build
└── templates/*.yaml     └── base YAML (변환하지 않음)
    ({{ }} 문법 포함)         패치/변환 따로 정의
```

원본 YAML이 유효한 Kubernetes 매니페스트 그대로이므로, `kustomize build` 없이도 `kubectl apply`로 직접 적용하거나 Git에서 검토하기 쉽다는 장점이 있다.

## kustomization.yaml 구조

Kustomize의 핵심은 `kustomization.yaml` 파일이다.

![Kustomize 순수 YAML 기반 설정 오버레이](/assets/posts/k8s-kustomize-overview.svg)

```yaml
# kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# 포함할 리소스 파일 목록
resources:
  - deployment.yaml
  - service.yaml
  - ingress.yaml

# 모든 리소스 이름에 prefix 추가
namePrefix: prod-

# 모든 리소스에 공통 레이블 추가
commonLabels:
  app.kubernetes.io/managed-by: kustomize
  environment: production

# 이미지 태그 변환 (deployment.yaml의 이미지 변경 없이)
images:
  - name: my-registry/my-app
    newTag: "2.1.0"
  - name: nginx
    newName: my-registry/nginx  # 이미지 이름도 변경 가능
    newTag: "1.25.4"

# 네임스페이스 지정
namespace: production
```

`kustomize build ./`를 실행하면 `resources`에 나열된 YAML 파일들에 위 변환이 적용된 최종 YAML이 stdout으로 출력된다.

## kubectl apply -k 로 바로 적용

```bash
# 빌드 결과 미리 확인
kustomize build ./

# 또는 kubectl에 내장된 kustomize 사용
kubectl apply -k ./

# dry-run으로 적용 결과 미리 보기
kubectl apply -k ./ --dry-run=client

# 특정 디렉토리의 kustomization.yaml 적용
kubectl apply -k ./overlays/production/

# 삭제
kubectl delete -k ./overlays/production/
```

`kubectl apply -k`는 `kubectl`에 내장된 Kustomize를 사용하므로 버전 차이에 주의해야 한다. 최신 Kustomize 기능이 필요하면 `kustomize` CLI를 직접 설치해 사용한다.

## ConfigMap과 Secret Generator

Kustomize의 Generator 기능은 파일이나 리터럴로부터 ConfigMap과 Secret을 자동 생성한다.

![ConfigMap Generator와 Secret Generator](/assets/posts/k8s-kustomize-generators.svg)

Generator의 핵심 기능은 **콘텐츠 해시 접미사**다. `disableNameSuffixHash: false`(기본값)면 `app-config-k8f2m4h`처럼 콘텐츠 해시가 이름에 붙는다. ConfigMap 내용이 변경되면 해시도 변경되고, Deployment는 새 이름의 ConfigMap을 참조하게 되어 자동으로 롤링 업데이트가 트리거된다.

```bash
# nginx.conf 파일에서 ConfigMap 생성 예시
# kustomization.yaml
configMapGenerator:
  - name: nginx-config
    files:
      - nginx.conf     # 같은 디렉토리의 파일
    options:
      labels:
        tier: frontend
```

```bash
# 환경 파일(.env) 형식도 지원
configMapGenerator:
  - name: app-env
    envs:
      - app.env        # KEY=VALUE 형식 파일
```

## 변환기(Transformer) 상세

`namePrefix`/`nameSuffix`는 리소스 이름 외에 관련 참조도 함께 변경한다.

```yaml
# deployment.yaml
spec:
  template:
    spec:
      volumes:
        - name: config
          configMap:
            name: app-config   # kustomize가 "prod-app-config"로 변경해줌

---
# kustomization.yaml
namePrefix: prod-
# deployment.yaml의 configMap.name 참조도 자동으로 "prod-app-config"로 변경됨
```

`images` 변환기는 Deployment 외에 StatefulSet, DaemonSet, Job, CronJob의 컨테이너 이미지도 모두 변환해준다.

```bash
# 이미지 태그를 런타임에 동적으로 지정할 수도 있음
kustomize build ./ | sed "s|myapp:.*|myapp:$(git rev-parse --short HEAD)|" | kubectl apply -f -
```

## 실전 사용 패턴

```bash
# 디렉토리 구조
my-app/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml   # resources만 나열
├── overlays/
│   ├── dev/
│   │   └── kustomization.yaml  # base 참조 + dev 오버라이드
│   └── prod/
│       └── kustomization.yaml  # base 참조 + prod 오버라이드
```

```yaml
# base/kustomization.yaml (순수 리소스 목록)
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
```

```yaml
# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base       # base 디렉토리 참조
namePrefix: prod-
namespace: production
images:
  - name: my-registry/my-app
    newTag: "2.1.0"
```

base/overlays 패턴은 다음 글에서 더 자세히 다룬다.

---

**지난 글:** [Helm Values 전략 — 환경별 오버라이드와 시크릿 분리](/posts/k8s-helm-values-strategy/)

**다음 글:** [Kustomize 오버레이 — base/overlays 구조 완전 이해](/posts/k8s-kustomize-overlays/)

<br>
읽어주셔서 감사합니다. 😊
