---
title: "Liveness · Readiness · Startup Probe — 자가 치유와 트래픽 제어"
description: "Kubernetes의 세 가지 프로브(livenessProbe, readinessProbe, startupProbe)의 목적 차이, httpGet·tcpSocket·exec 체크 방식, 파라미터 튜닝 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "livenessProbe", "readinessProbe", "startupProbe", "헬스체크", "자가 치유"]
featured: false
draft: false
---

[지난 글](/posts/k8s-sidecar-pattern/)에서 사이드카 패턴으로 메인 컨테이너를 확장하는 방법을 살펴봤습니다. 이번에는 **프로브(Probe)**를 다룹니다. 쿠버네티스는 세 종류의 프로브를 제공하며, 각각 다른 목적과 실패 시 동작을 가집니다. 프로브를 올바르게 설정하면 컨테이너 장애를 자동 복구하고, 준비되지 않은 컨테이너에 트래픽이 가는 것을 막을 수 있습니다.

## 세 프로브의 역할 차이

**livenessProbe**: 컨테이너가 살아있는지 확인합니다. 데드락이나 무한 루프로 응답하지 않는 컨테이너를 감지하고 재시작합니다.

**readinessProbe**: 컨테이너가 트래픽을 받을 준비가 됐는지 확인합니다. 실패하면 서비스의 Endpoints에서 Pod IP가 제거되어 트래픽이 차단됩니다. 컨테이너는 재시작되지 않습니다.

**startupProbe**: 느리게 시작하는 컨테이너를 보호합니다. startupProbe가 성공할 때까지 livenessProbe와 readinessProbe가 비활성화됩니다.

![세 프로브 비교](/assets/posts/k8s-probes-comparison.svg)

## httpGet 프로브

가장 일반적인 방식입니다. HTTP GET 요청을 보내 200~399 응답코드를 받으면 성공으로 판단합니다.

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
    httpHeaders:
    - name: X-Custom-Header
      value: health-check
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
  successThreshold: 1
```

헬스체크 엔드포인트(`/healthz`)에서는 실제 비즈니스 로직을 실행하지 말고 애플리케이션의 핵심 컴포넌트(DB 연결, 메모리 상태 등)만 간단히 확인해야 합니다. 무거운 작업을 하면 프로브 자체가 타임아웃으로 실패할 수 있습니다.

## tcpSocket 프로브

HTTP 엔드포인트 없이 TCP 포트가 열려있는지만 확인합니다. 데이터베이스, 캐시, 메시지 큐 같은 TCP 서비스에 적합합니다.

```yaml
livenessProbe:
  tcpSocket:
    port: 5432
  initialDelaySeconds: 15
  periodSeconds: 20
```

## exec 프로브

컨테이너 내부에서 커맨드를 실행하고 exitCode 0이면 성공으로 판단합니다. HTTP 엔드포인트도 없고 TCP 포트 확인도 불충분할 때 사용합니다.

```yaml
livenessProbe:
  exec:
    command:
    - redis-cli
    - ping
  initialDelaySeconds: 5
  periodSeconds: 10
```

exec 프로브는 컨테이너 내에서 프로세스를 생성하므로 빈번한 실행(periodSeconds가 짧을 때) 시 오버헤드가 있습니다.

## readinessProbe와 livenessProbe 함께 설정

일반적으로 두 프로브를 모두 설정하는 것이 권장됩니다.

```yaml
containers:
- name: app
  image: myapp:1.0
  livenessProbe:
    httpGet:
      path: /healthz
      port: 8080
    initialDelaySeconds: 30
    periodSeconds: 10
    failureThreshold: 3
  readinessProbe:
    httpGet:
      path: /ready
      port: 8080
    initialDelaySeconds: 10
    periodSeconds: 5
    failureThreshold: 3
    successThreshold: 1
```

`/healthz`는 컨테이너가 살아있는지 확인하고, `/ready`는 요청을 처리할 수 있는 상태인지 확인합니다. DB 연결이 없어서 일시적으로 처리 불가할 때는 readinessProbe만 실패시키고 livenessProbe는 성공시키면 컨테이너 재시작 없이 트래픽만 차단됩니다.

![프로브 설정 YAML](/assets/posts/k8s-probes-yaml.svg)

## startupProbe — 느린 시작 앱 보호

JVM 앱이나 레거시 애플리케이션은 시작 시간이 수십 초에서 수분까지 걸릴 수 있습니다. 이때 livenessProbe가 너무 빨리 실패 판정을 내리면 컨테이너가 계속 재시작됩니다.

```yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30     # 30번 실패 허용
  periodSeconds: 10        # 10초마다 체크
  # 최대 5분(30 × 10s) 대기
```

`failureThreshold × periodSeconds`가 최대 허용 시작 시간입니다. startupProbe가 성공하면 livenessProbe가 활성화됩니다.

## 파라미터 튜닝 가이드

| 파라미터 | 기본값 | 의미 |
|----------|--------|------|
| initialDelaySeconds | 0 | 컨테이너 시작 후 첫 체크까지 대기 시간 |
| periodSeconds | 10 | 체크 주기(초) |
| timeoutSeconds | 1 | 응답 타임아웃(초) |
| failureThreshold | 3 | 연속 실패 허용 횟수 |
| successThreshold | 1 | 성공 판정 연속 성공 수 |

`initialDelaySeconds`는 애플리케이션 시작 시간보다 넉넉하게 설정해야 합니다. 너무 짧으면 아직 초기화 중인 컨테이너가 불필요하게 재시작됩니다.

## 프로브 없는 Pod의 문제

프로브를 설정하지 않으면 쿠버네티스는 컨테이너가 Running 상태이기만 하면 정상으로 간주합니다. 실제로 데드락이 걸려 응답 못 해도, DB 연결이 없어 모든 요청이 실패해도 트래픽이 계속 옵니다. 프로덕션 환경에서는 모든 컨테이너에 프로브를 설정하는 것이 강력히 권장됩니다.

---

**지난 글:** [쿠버네티스 사이드카 패턴 — 공유 리소스로 기능 확장](/posts/k8s-sidecar-pattern/)

**다음 글:** [쿠버네티스 Resources Requests와 Limits — 노드 자원 배분](/posts/k8s-resource-requests-limits/)

<br>
읽어주셔서 감사합니다. 😊
