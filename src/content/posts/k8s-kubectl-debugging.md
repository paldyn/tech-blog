---
title: "kubectl 디버깅 도구 — describe·logs·exec·debug 완전 활용"
description: "kubectl get·describe·logs·exec로 이어지는 진단 파이프라인을 실전 옵션과 함께 정리하고, logs의 --previous·-c·--since, exec의 한계, 그리고 shell조차 없는 distroless 이미지를 kubectl debug 임시 컨테이너로 들여다보는 법, port-forward·cp·top까지 디버깅 도구 전반을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["kubectl", "디버깅", "logs", "exec", "kubectl debug", "ephemeral container", "트러블슈팅", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-troubleshooting/)에서 장애를 클러스터→노드→워크로드→Pod→컨테이너로 좁혀가는 사고법을 정리했다. 방법론이 머릿속에 있어도, 막상 손이 움직이지 않으면 소용이 없다. 이번 글은 그 방법론을 실제로 실행하는 **도구**에 집중한다. `kubectl get`으로 범위를 좁히고, `describe`로 단서를 찾고, `logs`로 앱의 비명을 듣고, 그래도 모르면 `exec`나 `debug`로 컨테이너 안에 직접 들어간다. 이 네 가지를 옵션까지 손에 익히면, 처음 보는 장애 앞에서도 무엇을 어떤 순서로 칠지 망설이지 않게 된다.

![kubectl 진단 4종 세트](/assets/posts/k8s-kubectl-debugging-pipeline.svg)

## get — 전체를 보고 범위를 좁힌다

진단의 첫 칸은 언제나 `get`이다. 어떤 리소스가 어떤 상태인지 목록으로 훑어서, 어디를 더 파고들지 정한다. 여기서 핵심은 정보를 더 끌어내는 플래그를 아는 것이다.

```bash
# 더 많은 컬럼(노드, IP)까지 한 줄에
kubectl get pods -o wide

# 모든 네임스페이스를 한 번에
kubectl get pods -A

# 상태가 자주 바뀌는 워크로드를 실시간 감시
kubectl get pods -w

# 라벨로 범위를 좁히고 정렬
kubectl get pods -l app=web --sort-by=.status.startTime
```

`-o wide`는 Pod가 어느 노드에 떠 있고 IP가 뭔지 보여주기 때문에, "특정 노드에서만 문제가 난다" 같은 패턴을 잡을 때 결정적이다. `-w`(watch)는 CrashLoopBackOff처럼 상태가 출렁이는 Pod를 눈으로 따라갈 때 쓴다. 무엇이 비정상인지 한눈에 들어왔다면, 그 대상 하나를 골라 `describe`로 내려간다.

## describe — 가장 빠른 단서, Events

`kubectl describe`는 단순히 스펙을 출력하는 명령이 아니다. 출력 맨 아래 **Events** 섹션이 트러블슈팅에서 가장 빠른 단서를 준다. 스케줄링 실패, 이미지 풀 에러, 프로브 실패, OOM 종료 — 컨트롤 플레인과 kubelet이 이 Pod에 대해 남긴 사건들이 시간순으로 쌓여 있다.

```bash
kubectl describe pod web-7d9f-abcde
```

출력에서 `State`, `Last State`, `Reason`, `Exit Code`를 먼저 읽는다. 컨테이너가 죽었다면 마지막 종료 코드와 사유가 여기 적힌다. 그다음 Events를 아래에서 위로(최신순) 훑으면 "왜 그렇게 됐는지"의 절반은 풀린다. Events는 기본적으로 약 1시간 뒤 사라지므로, 장애를 발견했으면 곧장 캡처해두는 습관이 중요하다.

## logs — 앱이 직접 남긴 비명

`describe`가 쿠버네티스의 관점이라면, `logs`는 애플리케이션 자신의 관점이다. 표준출력/표준에러로 흘려보낸 로그를 그대로 보여준다.

```bash
# 직전(재시작 전) 컨테이너의 로그 — CrashLoop 진단의 핵심
kubectl logs web-7d9f-abcde --previous

# 멀티 컨테이너 Pod에서 특정 컨테이너 지정
kubectl logs web-7d9f-abcde -c sidecar

# 최근 5분 + 실시간 따라가기
kubectl logs web-7d9f-abcde --since=5m -f

# Deployment의 모든 Pod 로그를 한 번에
kubectl logs deploy/web --all-pods --tail=50
```

가장 자주 잊는 옵션이 `--previous`다. 컨테이너가 막 재시작했다면 현재 컨테이너 로그는 비어 있고, 정작 원인은 **죽은 직전 컨테이너**의 로그에 있다. CrashLoopBackOff를 만나면 거의 반사적으로 `--previous`를 붙여야 한다. `-c`는 사이드카가 있는 Pod에서 어느 컨테이너인지 명시할 때 쓰고, `--since`/`--tail`은 수만 줄짜리 로그에서 관심 구간만 잘라낸다.

## exec — 컨테이너 안으로 들어가기

로그만으로 부족하면 컨테이너 안에 직접 들어가 환경을 확인한다. 환경변수가 제대로 주입됐는지, 마운트한 ConfigMap이 보이는지, DNS가 풀리는지 같은 것은 안에서 봐야 확실하다.

```bash
# 셸로 진입
kubectl exec -it web-7d9f-abcde -- sh

# 단발성 명령 — 환경변수 확인
kubectl exec web-7d9f-abcde -- env | grep DB_

# 클러스터 내부 DNS 확인
kubectl exec web-7d9f-abcde -- nslookup api.default.svc.cluster.local
```

`exec`의 분명한 한계는, **컨테이너 안에 그 도구가 있어야 한다**는 점이다. `sh`도 `nslookup`도 없는 최소 이미지라면 `exec`는 막다른 골목이다. 바로 이 지점에서 `kubectl debug`가 등장한다.

## debug — distroless에도 도구를 주입한다

운영 이미지는 점점 가벼워진다. distroless나 scratch 기반 이미지는 셸도, `ps`도, `curl`도 없다. 보안상 바람직하지만 디버깅은 막막해진다. `kubectl debug`는 대상 Pod에 **임시(ephemeral) 컨테이너**를 끼워 넣어, 원본 이미지를 전혀 건드리지 않고도 도구가 가득한 컨테이너로 같은 네임스페이스를 들여다보게 해준다.

![distroless 디버깅](/assets/posts/k8s-kubectl-debugging-debug.svg)

```bash
# 대상 컨테이너와 프로세스 네임스페이스를 공유하는 디버그 컨테이너
kubectl debug -it web-7d9f-abcde \
  --image=nicolaka/netshoot \
  --target=app

# 노드 자체를 디버깅 (호스트 파일시스템이 /host 로 마운트됨)
kubectl debug node/worker-1 -it --image=busybox
```

`--target=app`을 주면 디버그 컨테이너가 app 컨테이너의 프로세스 네임스페이스까지 공유해서, 안에서 `app`의 프로세스를 직접 들여다볼 수 있다. `netshoot`은 `dig`·`tcpdump`·`curl`·`ss`가 다 들어 있는 네트워크 디버깅 전용 이미지라 한 번 알아두면 두고두고 쓴다. 노드 디버깅 모드는 호스트 루트 파일시스템을 `/host`에 마운트해주므로 kubelet 로그나 컨테이너 런타임 상태까지 확인할 수 있다.

## 나머지 무기들 — port-forward·cp·top

진단을 마무리할 때 자주 쓰는 보조 도구들도 짚어두자.

```bash
# Service를 거치지 않고 Pod에 직접 연결 — 노출 없이 검증
kubectl port-forward pod/web-7d9f-abcde 8080:80

# 컨테이너 안의 힙 덤프·코어 파일을 로컬로 꺼내오기
kubectl cp web-7d9f-abcde:/tmp/heap.hprof ./heap.hprof

# 실시간 리소스 사용량(메트릭 서버 필요)
kubectl top pod -l app=web
```

`port-forward`는 Service나 Ingress 설정이 의심스러울 때, 그 계층을 건너뛰고 Pod에 직접 붙어 앱 자체는 멀쩡한지 가른다. `top`은 OOM이나 throttling이 의심될 때 실제 CPU/메모리 사용량을 즉시 보여준다(메트릭 서버가 떠 있어야 한다).

## 정리 — 그리고 다음

`get`으로 범위를 좁히고, `describe`의 Events에서 단서를 잡고, `logs --previous`로 죽은 컨테이너의 마지막 말을 듣고, 그래도 부족하면 `exec`로 들어가거나 `debug`로 도구를 주입한다. 이 흐름은 어떤 장애든 출발점이 된다. 도구를 손에 쥐었으니, 이제 가장 흔한 증상들을 하나씩 해부할 차례다. 다음 글은 운영자를 가장 자주 괴롭히는 `CrashLoopBackOff` — 컨테이너가 끝없이 재시작하는 상황을 파고든다.

---

**지난 글:** [트러블슈팅 방법론 — 장애를 체계적으로 진단하기](/posts/k8s-troubleshooting/)

**다음 글:** [CrashLoopBackOff — 컨테이너가 계속 재시작될 때](/posts/k8s-crashloopbackoff/)

<br>
읽어주셔서 감사합니다. 😊
