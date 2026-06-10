---
title: "Helm Values 전략 — 환경별 오버라이드와 시크릿 분리"
description: "Helm values 레이어 오버라이드 우선순위, 환경별 values 파일 분리 전략, --set과 --values 조합, 시크릿 외부화 패턴(Vault, External Secrets), helm get values로 현재 상태 확인하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 2
type: "knowledge"
category: "Kubernetes"
tags: ["Helm", "HelmValues", "환경별배포", "시크릿관리", "Kubernetes", "GitOps"]
featured: false
draft: false
---

[지난 글](/posts/k8s-helm-dependencies/)에서 Helm 의존성 관리와 서브차트 제어 방법을 살펴봤다. 이번 글에서는 Helm의 값 관리 전략을 심층적으로 다룬다. 개발, 스테이징, 프로덕션 환경에 동일한 차트를 배포하되 설정만 달리하는 방법, 그리고 시크릿을 안전하게 외부화하는 패턴을 알아본다.

## Values 오버라이드 우선순위

Helm은 여러 소스의 values를 deep merge 방식으로 결합한다. 나중에 지정된 값이 이전 값을 덮어쓴다.

![Helm Values 레이어 오버라이드 구조](/assets/posts/k8s-helm-values-strategy-layers.svg)

우선순위 순서는 다음과 같다 (낮음 → 높음):

1. **차트 내장 `values.yaml`** — 차트 패키지에 포함된 기본값
2. **`-f / --values` 파일** — 명시한 순서대로 적용, 뒤 파일이 앞 파일 덮어씀
3. **`--set`** — 명령줄에서 직접 지정, key=value 형태
4. **`--set-string`, `--set-file`, `--set-json`** — 특수 타입 강제

```bash
# 우선순위 확인 예시
helm install myapp ./chart \
  -f values.yaml \           # priority 2 (앞)
  -f values-prod.yaml \      # priority 2 (뒤, 앞을 덮어씀)
  --set image.tag=v2.1.0 \   # priority 3 (더 높음)
  --set replicas=5            # priority 3
```

## 환경별 Values 파일 전략

실무에서는 공통 기본값과 환경별 오버라이드를 분리하는 패턴이 효과적이다.

![환경별 Values 파일 전략](/assets/posts/k8s-helm-values-strategy-envfiles.svg)

```
helm-chart/
├── Chart.yaml
├── values.yaml          # 공통 기본값 (모든 환경 공통)
├── values-dev.yaml      # 개발 환경 오버라이드
├── values-staging.yaml  # 스테이징 환경 오버라이드
└── values-prod.yaml     # 프로덕션 환경 오버라이드
```

공통 `values.yaml`에는 모든 환경에서 동일한 값을 두고, 환경별 파일에는 그 환경에서만 달라지는 값만 포함한다. 중복을 최소화하면 변경 범위가 좁아져 실수가 줄어든다.

```yaml
# values.yaml (공통)
image:
  repository: my-registry/my-app
  pullPolicy: IfNotPresent
  tag: "1.0.0"

service:
  type: ClusterIP
  port: 8080

livenessProbe:
  initialDelaySeconds: 30
  periodSeconds: 10
```

```yaml
# values-prod.yaml (prod 환경만 다른 부분)
replicaCount: 3

image:
  tag: "1.2.0"   # prod 전용 태그 고정

resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2
    memory: 2Gi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

podDisruptionBudget:
  enabled: true
  minAvailable: 2
```

## --set의 올바른 사용법

`--set`은 단순 키 오버라이드에 편리하지만 복잡한 값에는 주의가 필요하다.

```bash
# 기본 사용
helm install myapp ./chart --set image.tag=v2.0.0

# 배열 값 (인덱스로 접근)
helm install myapp ./chart \
  --set ingress.hosts[0].host=example.com \
  --set ingress.hosts[0].paths[0].path=/

# 콤마 포함된 값 (이스케이프)
helm install myapp ./chart \
  --set "affinity=region in (us-east-1\\,us-west-2)"

# JSON 형태로 복잡한 값 전달
helm install myapp ./chart \
  --set-json 'tolerations=[{"key":"gpu","operator":"Exists"}]'

# 파일 내용을 값으로 전달 (CA 인증서 등)
helm install myapp ./chart \
  --set-file "config.ca=./ca.crt"
```

## 시크릿 외부화 전략

`values.yaml`에 비밀번호, API 키를 직접 넣으면 Git 히스토리에 평문이 남는다. 세 가지 안전한 패턴이 있다.

### 패턴 1 — Helm Secrets 플러그인 (SOPS 연동)

```bash
# helm-secrets 플러그인 설치
helm plugin install https://github.com/jkroepke/helm-secrets

# secrets.yaml 암호화 (GPG 또는 age 키 사용)
helm secrets enc values-secrets.yaml

# 암호화된 파일로 배포
helm secrets install myapp ./chart \
  -f values.yaml \
  -f secrets://values-secrets.yaml
```

암호화된 `values-secrets.yaml`은 Git에 커밋해도 안전하다. 복호화는 CI 환경의 키를 통해 자동으로 이루어진다.

### 패턴 2 — External Secrets Operator

```yaml
# ExternalSecret 리소스 정의
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: myapp-secret     # 생성될 Kubernetes Secret 이름
  data:
    - secretKey: db-password
      remoteRef:
        key: secret/myapp/prod
        property: db_password
```

External Secrets Operator는 Vault, AWS Secrets Manager, GCP Secret Manager 등에서 시크릿을 가져와 Kubernetes Secret으로 동기화한다. Helm chart는 `secretName`만 참조하면 된다.

### 패턴 3 — CI/CD 환경 변수에서 --set으로 주입

```yaml
# GitHub Actions 예시
- name: Helm Deploy
  run: |
    helm upgrade --install myapp ./chart \
      -f values.yaml \
      -f values-${{ env.ENVIRONMENT }}.yaml \
      --set database.password=${{ secrets.DB_PASSWORD }} \
      --set api.key=${{ secrets.API_KEY }}
  env:
    ENVIRONMENT: prod
```

시크릿을 CI/CD 환경의 Secrets에 저장하고 `--set`으로 런타임에 주입한다. 가장 단순하지만, 시크릿이 `helm get values`로 노출될 수 있으므로 `--set-string`을 사용하고 audit 로그를 관리해야 한다.

## 현재 배포 상태 확인

```bash
# 현재 릴리스에 실제 적용된 values 확인
helm get values myapp -n production

# 차트 기본값 포함 전체 values 확인
helm get values myapp -n production --all

# 이전 버전의 values 확인
helm get values myapp -n production --revision 3

# values를 파일로 추출 (롤백 또는 복제에 활용)
helm get values myapp -n production --all -o yaml > backup-values.yaml
```

`helm get values --all`은 렌더링에 사용된 모든 값을 보여주므로, 의도하지 않은 기본값이 적용되고 있는지 디버깅할 때 매우 유용하다.

---

**지난 글:** [Helm 의존성 관리 — Chart.lock과 서브차트 완전 이해](/posts/k8s-helm-dependencies/)

**다음 글:** [Kustomize 기초 — 패치 없는 설정 오버레이](/posts/k8s-kustomize/)

<br>
읽어주셔서 감사합니다. 😊
