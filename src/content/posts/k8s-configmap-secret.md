---
title: "ConfigMap과 Secret으로 설정 분리하기"
description: "K8s ConfigMap과 Secret의 차이(평문 vs Base64, 용도), 생성·조회·업데이트 방법, 환경변수 주입(envFrom/valueFrom)·볼륨 마운트 패턴, immutable 설정과 보안 주의사항을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["kubernetes", "k8s", "configmap", "secret", "configuration", "security"]
featured: false
draft: false
---

[지난 글](/posts/k8s-ingress-basics/)에서 Ingress로 외부 트래픽을 여러 서비스로 분기하는 방법을 다뤘다. 이번 편은 컨테이너에 설정값을 주입하는 K8s의 표준 방법인 ConfigMap과 Secret이다. 이미지에 설정을 하드코딩하면 환경마다 이미지를 다시 빌드해야 한다. 설정을 분리하면 같은 이미지를 dev/staging/prod에 동일하게 사용할 수 있다.

## ConfigMap vs Secret

![ConfigMap vs Secret 비교](/assets/posts/k8s-configmap-secret-comparison.svg)

핵심 차이는 **저장 방식**이다. ConfigMap은 평문 저장, Secret은 Base64로 인코딩한다. Base64는 암호화가 아니라 인코딩이므로 `base64 -d`로 즉시 복원 가능하다. 민감한 정보를 안전하게 보호하려면 별도의 etcd at-rest 암호화 또는 HashiCorp Vault, Sealed Secrets 같은 외부 시크릿 관리 도구가 필요하다.

## ConfigMap 생성과 조회

```bash
# 리터럴로 생성
kubectl create configmap app-config \
  --from-literal=DB_HOST=postgres \
  --from-literal=APP_PORT=8080 \
  --from-literal=LOG_LEVEL=info

# 파일 전체를 키로 생성
kubectl create configmap nginx-config \
  --from-file=nginx.conf

# 디렉터리 내 파일 전체
kubectl create configmap app-configs \
  --from-file=configs/

# 조회
kubectl get configmap app-config -o yaml

# 값 확인
kubectl describe configmap app-config
```

YAML로 선언하는 방식:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  DB_HOST: "postgres"
  APP_PORT: "8080"
  LOG_LEVEL: "info"
  # 멀티라인 값 (설정 파일)
  nginx.conf: |
    server {
      listen 80;
      location / { proxy_pass http://localhost:8080; }
    }
```

## Secret 생성과 조회

```bash
# 리터럴로 생성 (자동 Base64 인코딩)
kubectl create secret generic db-secret \
  --from-literal=password=mysecretpass \
  --from-literal=username=admin

# TLS 인증서 Secret
kubectl create secret tls tls-cert \
  --cert=cert.pem \
  --key=key.pem

# Docker 레지스트리 인증
kubectl create secret docker-registry regcred \
  --docker-server=myregistry.io \
  --docker-username=myuser \
  --docker-password=mypass

# 조회 (Base64 인코딩된 값)
kubectl get secret db-secret -o yaml

# 디코딩해서 실제 값 확인
kubectl get secret db-secret \
  -o jsonpath='{.data.password}' | base64 -d
```

YAML로 작성할 때는 직접 Base64 인코딩:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  password: bXlzZWNyZXRwYXNz    # echo -n 'mysecretpass' | base64
  username: YWRtaW4=             # echo -n 'admin' | base64
stringData:                       # 평문으로 작성 (자동 인코딩)
  api-key: "my-api-key-value"
```

## 파드에 주입하기

![ConfigMap·Secret 주입 패턴](/assets/posts/k8s-configmap-secret-usage.svg)

### 방법 1: envFrom — 전체를 환경변수로

```yaml
spec:
  containers:
  - name: app
    image: myapp:1.0
    envFrom:
    - configMapRef:
        name: app-config      # ConfigMap의 모든 키를 환경변수로
    - secretRef:
        name: db-secret       # Secret의 모든 키를 환경변수로
```

### 방법 2: valueFrom — 개별 키 선택

```yaml
spec:
  containers:
  - name: app
    env:
    - name: DB_HOST
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: DB_HOST

    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: password
```

### 방법 3: 볼륨 마운트 — 파일로 주입

파일로 마운트하면 앱 재시작 없이 ConfigMap 업데이트가 반영된다(약 60초 지연).

```yaml
spec:
  containers:
  - name: app
    volumeMounts:
    - name: config-volume
      mountPath: /etc/myapp   # 각 키가 파일명이 됨

  volumes:
  - name: config-volume
    configMap:
      name: app-config
      items:
      - key: nginx.conf
        path: nginx.conf      # 특정 키만 특정 파일로 마운트
```

## 업데이트 처리

환경변수로 주입된 값은 Pod 재시작 없이는 변경되지 않는다. 볼륨 마운트는 자동 갱신되지만 앱이 파일 변경을 감지해야 한다.

```bash
# ConfigMap 업데이트
kubectl edit configmap app-config

# 또는 patch로
kubectl patch configmap app-config \
  --type merge \
  -p '{"data":{"LOG_LEVEL":"debug"}}'

# 환경변수 방식은 Pod 재시작 필요
kubectl rollout restart deployment/myapp
```

## immutable ConfigMap/Secret

자주 변경하지 않을 설정을 `immutable: true`로 선언하면 감시(watch)가 제거되어 K8s API 서버 부하가 줄고, 실수로 변경하는 것을 방지할 수 있다.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: stable-config
immutable: true
data:
  REGION: "ap-northeast-2"
```

한번 `immutable: true`를 설정하면 데이터 변경은 불가능하며, 삭제 후 재생성만 가능하다.

---

**지난 글:** [쿠버네티스 Ingress 기초](/posts/k8s-ingress-basics/)

**다음 글:** [쿠버네티스 Namespace로 클러스터 격리하기](/posts/k8s-namespace/)

<br>
읽어주셔서 감사합니다. 😊
