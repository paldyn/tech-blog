---
title: "쿠버네티스 Annotations 실전 활용"
description: "Kubernetes Annotations의 역할과 Labels와의 차이를 명확히 하고, Ingress 설정·CI/CD 메타데이터·Prometheus 수집 등 실무에서 자주 쓰이는 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 3
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Annotations", "Labels", "메타데이터", "Ingress", "Prometheus"]
featured: false
draft: false
---

[지난 글](/posts/k8s-labels-selectors/)에서 Labels와 Selectors가 Pod를 그룹화하고 선택하는 방법을 살펴봤습니다. 이번에는 Labels와 자주 혼동되지만 용도가 전혀 다른 **Annotations**를 다룹니다. Annotations는 오브젝트를 식별하거나 선택하는 용도가 아니라, 도구·사람·시스템이 읽고 쓰는 **비식별 메타데이터**를 저장하는 공간입니다.

## Annotations란

Annotations는 Kubernetes 오브젝트의 `metadata.annotations` 필드에 저장되는 key-value 쌍입니다. Labels와 달리 Selector 쿼리에 사용되지 않으며 API 서버가 인덱싱하지 않습니다. 그러나 값의 크기 제한이 사실상 없어 긴 JSON 문자열, URL, 설명 텍스트를 담을 수 있습니다.

```yaml
metadata:
  annotations:
    description: "사용자 인증을 담당하는 마이크로서비스"
    contact: "platform-team@example.com"
    runbook: "https://wiki.example.com/runbooks/auth-service"
```

## Labels vs Annotations

두 개념의 핵심 차이는 **선택 가능 여부**입니다.

| 기준 | Labels | Annotations |
|------|--------|-------------|
| Selector 사용 | 가능 | 불가 |
| API 인덱싱 | 됨 | 안 됨 |
| 값 크기 | 63자 이하 | 제한 없음 |
| 주요 용도 | Pod 선택, 그룹화 | 도구 설정, 문서화 |

![Labels vs Annotations 차이점](/assets/posts/k8s-annotations-vs-labels.svg)

**판단 기준**: 이 값으로 리소스를 선택해야 한다면 Label, 그 외 정보를 저장하는 것이 목적이라면 Annotation을 사용하세요.

## 주요 활용 패턴

### Ingress Controller 설정

NGINX Ingress Controller처럼 Ingress를 해석하는 컨트롤러는 Annotation을 통해 세부 동작을 제어합니다. 이 방식 덕분에 Kubernetes Ingress 스펙을 변경하지 않고도 컨트롤러별 기능을 활성화할 수 있습니다.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: 10m
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-svc
            port:
              number: 80
```

### CI/CD 빌드 메타데이터

배포 자동화 파이프라인이 어떤 커밋에서 어떤 빌드가 이루어졌는지 추적하기 위해 Annotation에 기록합니다.

```yaml
metadata:
  annotations:
    build.example.io/git-commit: "a1b2c3d4e5f6"
    build.example.io/git-branch: "main"
    build.example.io/pipeline-url: "https://ci.example.com/pipelines/123"
    build.example.io/build-time: "2026-06-02T10:00:00Z"
    build.example.io/owner: "platform-team"
```

### Prometheus 메트릭 수집

Prometheus의 Kubernetes SD(Service Discovery)는 Pod Annotation을 읽어 메트릭 수집 여부와 경로를 결정합니다.

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "9090"
    prometheus.io/path: "/metrics"
```

### kubectl apply 자동 관리

`kubectl apply`를 실행하면 Kubernetes는 마지막으로 적용된 설정을 자동으로 Annotation에 저장합니다. 이 정보는 다음 `apply` 시 3방향 diff에 사용됩니다.

```bash
# Annotation 확인
kubectl get deployment web -o jsonpath='{.metadata.annotations}'
```

```json
{
  "kubectl.kubernetes.io/last-applied-configuration": "{\"apiVersion\":\"apps/v1\"...}"
}
```

![Annotations 실전 활용 패턴](/assets/posts/k8s-annotations-usecases.svg)

## Annotation 작성 규칙

```yaml
# 올바른 형식: prefix/name
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /
  app.kubernetes.io/managed-by: helm

# prefix 없는 키 (사용자 영역)
annotations:
  description: "인증 서비스"
  contact: "ops@example.com"
```

- **키 형식**: `prefix/name` 또는 `name`만. prefix는 DNS 서브도메인 형식.
- **예약 prefix**: `kubernetes.io/`, `k8s.io/`는 Kubernetes 내부 사용 예약.
- **값**: 문자열만 가능. JSON을 저장하려면 문자열로 직렬화해서 넣어야 합니다.

## kubectl로 Annotation 관리

```bash
# Annotation 추가
kubectl annotate pod my-pod description="인증 서비스 파드"

# Annotation 수정 (--overwrite 필수)
kubectl annotate pod my-pod description="수정된 설명" --overwrite

# Annotation 삭제 (키 뒤에 -)
kubectl annotate pod my-pod description-

# Annotation 확인
kubectl get pod my-pod -o jsonpath='{.metadata.annotations}'
```

주의할 점은 `kubectl edit`으로 Annotation을 직접 수정하면 `last-applied-configuration`과 충돌이 발생할 수 있다는 점입니다. 가능하면 `kubectl annotate` 또는 YAML 파일을 통한 `kubectl apply`를 사용하는 것이 안전합니다.

---

**지난 글:** [쿠버네티스 Labels와 Selectors 완전 이해](/posts/k8s-labels-selectors/)

**다음 글:** [쿠버네티스 Owner References와 가비지 컬렉션](/posts/k8s-owner-references/)

<br>
읽어주셔서 감사합니다. 😊
