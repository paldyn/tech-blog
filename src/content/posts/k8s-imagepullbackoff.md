---
title: "ImagePullBackOff — 이미지를 가져오지 못할 때"
description: "컨테이너가 시작조차 못 하는 ImagePullBackOff와 ErrImagePull을 다룹니다. 이미지 풀 흐름과 실패 지점, Events 메시지로 원인을 가르는 법, 그리고 이름·태그 오타, 프라이빗 레지스트리 인증, Docker Hub 레이트 리밋, 아키텍처 불일치, imagePullSecrets 설정까지 단골 원인별 진단과 해결책을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 3
type: "knowledge"
category: "Kubernetes"
tags: ["ImagePullBackOff", "ErrImagePull", "트러블슈팅", "레지스트리", "imagePullSecrets", "이미지", "디버깅", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-crashloopbackoff/)에서 다룬 CrashLoopBackOff가 "컨테이너가 실행은 됐는데 자꾸 죽는" 문제였다면, `ImagePullBackOff`는 그보다 한 단계 앞에서 막히는 문제다. 컨테이너가 단 한 번도 실행되지 못한다. kubelet이 이미지를 레지스트리에서 받아오는 데 실패했기 때문이다. CrashLoop처럼 앱 로그를 봐도 아무것도 없다 — 애초에 앱이 돌지 않았으니까. 그래서 진단의 출발점도 다르다. 로그가 아니라 **Events**가 거의 모든 답을 쥐고 있다.

## ImagePullBackOff와 ErrImagePull

이 둘은 같은 문제의 두 단계다. kubelet이 이미지를 받으려다 실패하면 먼저 `ErrImagePull` 상태가 된다. 곧바로 다시 시도하지 않고, CrashLoop과 마찬가지로 **지수 백오프**로 재시도 간격을 늘려가며 대기하는데, 이 대기 상태가 `ImagePullBackOff`다. 즉 ErrImagePull은 "방금 풀에 실패했다", ImagePullBackOff는 "실패가 반복돼서 재시도를 미루는 중"이라는 뜻이다.

![이미지 풀 흐름과 실패 지점](/assets/posts/k8s-imagepullbackoff-flow.svg)

CrashLoop과 결정적으로 다른 점은, 문제가 컨테이너 **실행 단계가 아니라 이미지를 가져오는 단계**에 있다는 것이다. 그래서 `kubectl logs`는 거의 쓸모가 없고, `kubectl describe`의 Events에 적힌 풀 에러 메시지가 진단의 전부다.

```bash
# 가장 먼저 — Events의 풀 에러 메시지를 읽는다
kubectl describe pod web-7d9f-abcde | grep -A5 Events
```

## Events 메시지로 원인을 가른다

다행히 레지스트리가 돌려주는 에러 메시지는 꽤 정직하다. Events에 찍힌 문구만 봐도 어느 갈래인지 거의 정해진다.

![ImagePullBackOff 단골 원인](/assets/posts/k8s-imagepullbackoff-causes.svg)

### 1) 이름·태그 오타 (manifest unknown / not found)

가장 흔하고 가장 허무한 원인이다. 이미지 이름을 잘못 쓰거나, 존재하지 않는 태그를 가리킨다. `myapp:v1.2.3`이라고 했는데 실제로는 `v1.2.0`까지만 푸시됐다든가, `:latest`를 썼는데 그 태그가 갱신되지 않았다든가 하는 경우다.

```bash
# 매니페스트의 이미지 문자열을 정확히 확인
kubectl get pod web-7d9f-abcde -o jsonpath='{.spec.containers[*].image}'
```

`:latest`는 디버깅을 어렵게 만든다. 어느 시점의 이미지인지 추적이 안 되고, 노드에 캐시된 옛 이미지를 쓰는 함정도 있다. 운영에서는 항상 명시적 태그나 다이제스트(`@sha256:...`)를 쓰는 편이 안전하다.

### 2) 프라이빗 레지스트리 인증 실패 (unauthorized / denied)

공개 이미지는 잘 받는데 사내 레지스트리 이미지에서만 막힌다면 인증 문제다. kubelet에게 레지스트리 자격증명을 알려주는 `imagePullSecrets`가 없거나 잘못된 것이다. docker-registry 타입 시크릿을 만들고 Pod(또는 ServiceAccount)에 연결한다.

```bash
# 레지스트리 자격증명 시크릿 생성
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=ci-bot \
  --docker-password='********'
```

```yaml
spec:
  imagePullSecrets:
    - name: regcred
  containers:
    - name: web
      image: registry.example.com/team/web:1.4.2
```

ServiceAccount에 `imagePullSecrets`를 붙여두면 그 SA를 쓰는 모든 Pod가 자동으로 자격증명을 물려받아, 매번 Pod 스펙에 적지 않아도 된다.

### 3) Docker Hub 레이트 리밋 (toomanyrequests)

익명 풀에는 IP당 시간당 풀 횟수 제한이 걸린다. CI나 오토스케일로 노드가 동시에 같은 이미지를 당기면 금세 한도에 닿아 `toomanyrequests`가 뜬다. 인증된 계정으로 풀하거나, 사내 미러·캐시 레지스트리(pull-through cache)를 두어 외부 풀 자체를 줄이는 것이 근본 해법이다.

### 4) 아키텍처 불일치·네트워크 차단

amd64로 빌드한 이미지를 arm64 노드(예: Graviton, Apple Silicon 기반 노드)에서 받으려 하면 `no match for platform`이 뜬다. 멀티아키텍처 이미지로 빌드하거나 노드 아키텍처에 맞는 태그를 지정해야 한다. 또 노드가 프록시·방화벽 뒤에 있어 레지스트리에 아예 도달하지 못하면 timeout이 난다 — 이때는 노드에서 레지스트리로의 네트워크 도달성부터 확인한다.

## 빠른 검증 — 노드에서 직접 풀해보기

원인이 모호할 때는 문제의 노드에 들어가 같은 이미지를 직접 당겨보면 단숨에 갈린다. 인증 문제인지, 네트워크 문제인지, 이름 문제인지 에러 메시지가 더 구체적으로 나온다.

```bash
# 노드 디버그 컨테이너에서 도달성 확인
kubectl debug node/worker-1 -it --image=busybox \
  -- wget -qO- https://registry.example.com/v2/ || echo unreachable
```

## 정리 — 그리고 다음

ImagePullBackOff는 컨테이너가 실행 전에 막히는 문제라, 로그가 아니라 `describe`의 Events가 핵심이다. 레지스트리가 돌려주는 메시지(manifest unknown / unauthorized / toomanyrequests / no match for platform)가 원인을 거의 그대로 알려주므로, 그 문구를 읽고 해당 갈래의 조치를 취하면 된다. 이미지 이름과 태그를 다시 확인하고, 프라이빗 레지스트리라면 imagePullSecrets를 점검하는 것이 출발점이다. 다음 글에서는 컨테이너가 메모리 한도를 넘겨 강제 종료되는 `OOMKilled`를 깊게 파고든다.

---

**지난 글:** [CrashLoopBackOff — 컨테이너가 계속 재시작될 때](/posts/k8s-crashloopbackoff/)

**다음 글:** [OOMKilled — 메모리 한도를 넘어 강제 종료될 때](/posts/k8s-oomkilled/)

<br>
읽어주셔서 감사합니다. 😊
