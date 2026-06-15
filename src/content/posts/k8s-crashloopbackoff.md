---
title: "CrashLoopBackOff — 컨테이너가 계속 재시작될 때"
description: "쿠버네티스에서 가장 흔한 장애 CrashLoopBackOff의 정체를 파헤칩니다. 지수 백오프 재시작 메커니즘, 종료 코드(1·137·143)로 원인을 가르는 법, logs --previous의 결정적 역할, 그리고 애플리케이션 버그·설정 누락·OOM·liveness 오작동·느린 부팅이라는 단골 원인별 진단과 조치를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 2
type: "knowledge"
category: "Kubernetes"
tags: ["CrashLoopBackOff", "트러블슈팅", "재시작", "종료코드", "OOMKilled", "liveness", "디버깅", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-kubectl-debugging/)에서 진단 도구를 손에 익혔으니, 이제 그 도구로 실제 증상을 해부할 차례다. 쿠버네티스를 처음 운영하는 사람이 가장 먼저, 그리고 가장 자주 만나는 상태가 바로 `CrashLoopBackOff`다. `kubectl get pods`를 쳤을 때 STATUS 칸에 이 빨간 글자가 떠 있으면 누구나 가슴이 철렁한다. 하지만 이 상태는 무섭게 들리는 이름과 달리, 쿠버네티스가 "이 컨테이너가 자꾸 죽어서 내가 재시작을 늦추는 중"이라고 알려주는 **증상 보고**일 뿐이다. 원인은 따로 있고, 찾는 방법도 정해져 있다.

## CrashLoopBackOff란 정확히 무엇인가

먼저 이 상태가 **무엇이 아닌지**부터 분명히 하자. CrashLoopBackOff 자체는 에러의 원인이 아니라, 컨테이너가 시작하자마자(또는 잠시 뒤) 종료되기를 반복할 때 kubelet이 붙이는 라벨이다. 컨테이너가 죽으면 `restartPolicy`(기본값 `Always`)에 따라 kubelet이 다시 띄운다. 그런데 또 죽고, 또 띄우고가 반복되면 kubelet은 무한히 빠르게 재시작하는 대신 **재시작 간격을 점점 늘린다**. 10초, 20초, 40초, 80초… 이렇게 2배씩 늘려 최대 5분(300초)에서 멈춘다. 이 "재시작을 미루는 중"인 상태가 BackOff다.

![지수 백오프 재시작](/assets/posts/k8s-crashloopbackoff-backoff.svg)

이 백오프 설계 덕분에, 한 번 죽을 때마다 진단할 시간 여유는 점점 늘어난다. 반대로 말하면 BackOff가 깊어질수록 서비스는 그만큼 더 오래 비어 있다는 뜻이라, 빨리 원인을 찾아야 한다.

## 첫 두 명령 — describe와 logs --previous

CrashLoopBackOff를 만나면 반사적으로 던질 명령이 두 개 있다. 둘 다 [지난 글](/posts/k8s-kubectl-debugging/)에서 다룬 도구지만, 이 증상에서 특히 결정적이다.

```bash
# 1) 종료 코드와 Events를 확인 — 어느 갈래인지 가른다
kubectl describe pod web-7d9f-abcde

# 2) 죽은 직전 컨테이너의 마지막 로그 — 현재 컨테이너는 비어 있다
kubectl logs web-7d9f-abcde --previous
```

`describe` 출력에서 `Last State: Terminated`의 `Reason`과 `Exit Code`를 본다. 현재 컨테이너는 방금 재시작했거나 BackOff 대기 중이라 로그가 비어 있을 가능성이 높으므로, 반드시 `--previous`로 **죽은 컨테이너**의 로그를 꺼내야 한다. 여기에 원인의 절반 이상이 적혀 있다.

## 종료 코드로 원인을 가른다

종료 코드는 원인을 빠르게 좁혀주는 지문이다. 자주 보는 코드는 다음과 같다.

- **Exit Code 0** — 정상 종료인데 재시작. 메인 프로세스가 할 일을 마치고 끝나버리는 경우(데몬이어야 하는데 일회성 스크립트처럼 종료). `command`/`args`나 앱 구조를 의심한다.
- **Exit Code 1 (또는 비-0)** — 애플리케이션이 에러로 죽음. 코드 예외, 설정/시크릿 누락, 의존 서비스 연결 실패가 대부분. 로그에 스택트레이스가 찍혀 있다.
- **Exit Code 137** — 128+9, 즉 SIGKILL. 거의 항상 **OOMKilled**(메모리 한도 초과)이거나 liveness 프로브 실패로 인한 강제 종료다.
- **Exit Code 143** — 128+15, 즉 SIGTERM. 정상적인 graceful shutdown 신호인데 컨테이너가 이를 제대로 처리 못 하거나, 외부에서 종료를 반복적으로 보내는 상황.

![CrashLoopBackOff 원인 분류](/assets/posts/k8s-crashloopbackoff-causes.svg)

## 단골 원인 다섯 가지

실무에서 마주치는 CrashLoopBackOff는 거의 다음 다섯 갈래 안에 든다.

**1) 애플리케이션 버그·예외.** 가장 흔하다. `--previous` 로그의 스택트레이스가 그대로 답이다. 코드 수정 후 이미지를 다시 빌드·배포한다.

**2) 설정·시크릿 누락.** DB 비밀번호나 필수 환경변수가 없어서 부팅 직후 죽는다. ConfigMap/Secret이 제대로 마운트·주입됐는지 `exec`로 안에 들어가 `env`를 확인한다.

```bash
# 환경변수가 실제로 들어왔는지 확인
kubectl exec web-7d9f-abcde -- env | grep -i db
```

**3) OOMKilled (137).** 메모리 limit이 너무 빡빡하거나 앱에 누수가 있다. `describe`의 `Reason: OOMKilled`로 확정하고, limit을 올리거나 앱의 메모리 사용을 잡는다. 이 주제는 다음 글들에서 따로 깊게 다룬다.

**4) liveness 프로브 오작동.** 앱은 멀쩡한데 부팅이 느려서, liveness가 준비되기도 전에 "죽었다"고 판단해 컨테이너를 죽인다. 그러면 또 부팅하다 또 죽임당하는 악순환이 된다. 해법은 `startupProbe`를 추가해 부팅 구간을 보호하거나 `initialDelaySeconds`를 늘리는 것이다.

```yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30   # 최대 30 × 10s = 5분간 부팅을 기다림
  periodSeconds: 10
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  periodSeconds: 10
```

**5) 의존성 미준비.** DB나 다른 서비스가 아직 안 떠서 연결 실패로 죽는다. 앱에 재시도 로직을 넣거나 initContainer로 의존성 대기를 두면, 일시적 순서 문제로 인한 CrashLoop을 막을 수 있다.

## 정리 — 그리고 다음

CrashLoopBackOff는 무서운 이름과 달리 "자꾸 죽어서 재시작을 미루는 중"이라는 증상 보고일 뿐이다. 진단은 늘 같은 두 걸음에서 시작한다 — `describe`로 종료 코드와 Events를 보고, `logs --previous`로 죽은 컨테이너의 마지막 말을 듣는다. 종료 코드가 갈래를 좁혀주고, 거기서 다섯 단골 원인 중 하나로 수렴한다. 다음 글에서는 컨테이너가 시작조차 못 하는 또 다른 단골, 이미지를 가져오지 못해 멈추는 `ImagePullBackOff`를 다룬다.

---

**지난 글:** [kubectl 디버깅 도구 — describe·logs·exec·debug 완전 활용](/posts/k8s-kubectl-debugging/)

**다음 글:** [ImagePullBackOff — 이미지를 가져오지 못할 때](/posts/k8s-imagepullbackoff/)

<br>
읽어주셔서 감사합니다. 😊
