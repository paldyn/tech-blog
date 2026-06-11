---
title: "Kubernetes 감사 로그(Audit Log) — 누가 무엇을 했는가"
description: "API Server 감사 로그의 동작 원리와 stage·level 개념, 감사 정책(Policy) 작성 규칙과 Secret 본문 기록 금지 같은 보안 원칙, log/webhook 백엔드 설정, 매니지드 클러스터(EKS·GKE)에서의 활성화, 침해 대응 시나리오별 쿼리 예시를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["AuditLog", "감사로그", "보안", "컴플라이언스", "APIServer", "SIEM", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-events/)에서 다룬 Event가 "컨트롤러가 무엇을 했는가"의 기록이라면, 이번 글의 주제는 한 층 더 근본적인 기록이다. "**누가, 언제, 어떤 자격으로, API에 무엇을 요청했고, 결과는 무엇이었나.**" 운영 중인 Secret을 누가 읽어갔는지, 한밤중에 Deployment를 지운 게 누구인지 — 이 질문에 답할 수 있는 유일한 데이터가 **감사 로그(Audit Log)** 다. 보안 사고 대응과 컴플라이언스(ISMS, SOC2 등)의 필수 요건이기도 하다.

## 동작 원리 — API Server의 블랙박스

Kubernetes의 모든 변경은 API Server를 거친다. kubectl도, 컨트롤러도, CI/CD 파이프라인도 예외가 없다. 감사 로그는 바로 이 길목에서 **모든 요청을 가로채 기록**한다.

![감사 로그 파이프라인](/assets/posts/k8s-audit-logs-pipeline.svg)

요청이 들어오면 API Server는 감사 정책(Audit Policy)을 평가해 "이 요청을 어느 상세 수준으로 기록할지"를 결정하고, 처리 단계(stage)마다 감사 이벤트를 백엔드로 내보낸다.

- **RequestReceived**: 요청 수신 직후
- **ResponseComplete**: 응답 완료 시점 — 분석할 때 주로 보는 stage
- **ResponseStarted**: watch처럼 길게 열리는 요청의 응답 시작 시점
- **Panic**: 처리 중 내부 오류

기록된 감사 이벤트 한 건은 이런 모습이다.

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "stage": "ResponseComplete",
  "verb": "delete",
  "user": { "username": "dev@example.com",
            "groups": ["oidc:developers"] },
  "sourceIPs": ["10.0.4.12"],
  "objectRef": { "resource": "deployments",
                 "namespace": "prod", "name": "api" },
  "responseStatus": { "code": 200 },
  "requestReceivedTimestamp": "2026-06-12T03:12:45.120Z"
}
```

누가(`user`), 어디서(`sourceIPs`), 무엇을(`objectRef`), 어떻게(`verb`), 결과는(`responseStatus`) — 침해 조사에 필요한 5하 원칙이 한 레코드에 모두 담긴다.

## 감사 레벨 — 얼마나 자세히 기록할 것인가

정책의 핵심 축은 4단계 **level**이다.

![감사 레벨 4단계와 정책 작성](/assets/posts/k8s-audit-logs-levels.svg)

- `None`: 기록하지 않음 — 노이즈가 큰 요청을 제외할 때
- `Metadata`: 누가·언제·무엇에·어떤 동사 (본문 제외) — 기본 권장
- `Request`: Metadata + 요청 본문
- `RequestResponse`: 요청과 응답 본문 전부 — 가장 상세하지만 용량 폭탄

여기서 보안 원칙 하나가 절대적이다. **Secret·ConfigMap·TokenReview는 Metadata 이상으로 기록하면 안 된다.** Request 레벨로 기록하면 시크릿 값이 감사 로그에 평문으로 남아, 감사 로그 자체가 유출 경로가 되는 본말전도가 벌어진다.

## 감사 정책 작성

정책 파일은 위에서부터 **첫 번째로 매칭되는 규칙이 적용**된다. 따라서 "노이즈 제외 → 민감 리소스 보호 → 중요한 것 상세 기록 → 나머지 기본값" 순서로 쓴다.

```yaml
# audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
# RequestReceived stage는 생략해 로그량 절반으로
omitStages:
  - "RequestReceived"
rules:
  # 1. 노이즈 제외: 시스템 컴포넌트의 읽기 폭주
  - level: None
    users: ["system:kube-proxy"]
    verbs: ["watch"]
  - level: None
    userGroups: ["system:nodes"]
    verbs: ["get"]
    resources:
      - group: ""
        resources: ["nodes", "nodes/status"]

  # 2. 민감 리소스: 본문 절대 금지, 접근 사실만
  - level: Metadata
    resources:
      - group: ""
        resources: ["secrets", "configmaps"]

  # 3. 파괴적 변경은 본문까지 상세 기록
  - level: RequestResponse
    verbs: ["create", "update", "patch", "delete"]
    resources:
      - group: "apps"
        resources: ["deployments", "statefulsets"]
      - group: "rbac.authorization.k8s.io"
        resources: ["clusterrolebindings", "rolebindings"]

  # 4. 나머지는 Metadata로
  - level: Metadata
```

RBAC 바인딩 변경을 상세 기록하는 3번 규칙은 꼭 넣자. 권한 상승(privilege escalation)은 거의 항상 RoleBinding 변경으로 시작된다.

## 활성화 — 셀프 호스팅 vs 매니지드

셀프 호스팅(kubeadm 등)에서는 API Server 플래그로 켠다.

```yaml
# kube-apiserver 매니페스트에 추가
- --audit-policy-file=/etc/kubernetes/audit-policy.yaml
- --audit-log-path=/var/log/kubernetes/audit/audit.log
- --audit-log-maxage=30      # 보관 일수
- --audit-log-maxbackup=10   # 로테이션 파일 수
- --audit-log-maxsize=100    # 파일당 MB
```

파일로 떨어지는 감사 로그는 [로깅 파이프라인](/posts/k8s-logging-efk-loki/)에서 구축한 노드 에이전트(Fluent Bit)로 수집해 Loki나 Elasticsearch에 보존하면 된다. 실시간 보안 분석이 필요하면 `--audit-webhook-config-file`로 SIEM에 직접 쏘는 webhook 백엔드를 병행한다.

매니지드 클러스터는 컨트롤 플레인에 접근할 수 없으므로 클라우드별 기능을 쓴다.

```bash
# EKS — 컨트롤 플레인 로깅에서 audit 활성화 (CloudWatch로)
aws eks update-cluster-config --name my-cluster \
  --logging '{"clusterLogging":[{"types":["audit"],"enabled":true}]}'

# GKE는 Cloud Audit Logs에 기본 기록 (Admin Activity)
# 데이터 접근 로그는 별도 활성화 필요
```

매니지드 환경에서는 정책을 직접 쓸 수 없고 클라우드가 정한 정책이 적용된다는 한계가 있다. 대신 CloudWatch Logs Insights, Cloud Logging 같은 쿼리 도구가 함께 제공된다.

## 실전 쿼리 시나리오

감사 로그의 가치는 질문에 답할 때 드러난다. jq 기준 예시로 패턴을 익혀두자.

```bash
# Q1. prod 네임스페이스의 Secret을 누가 읽었나?
jq 'select(.objectRef.resource=="secrets"
  and .objectRef.namespace=="prod"
  and .verb=="get")
  | {user: .user.username, name: .objectRef.name,
     time: .requestReceivedTimestamp}' audit.log

# Q2. 어제 삭제된 Deployment와 삭제한 사람은?
jq 'select(.verb=="delete"
  and .objectRef.resource=="deployments")
  | {user: .user.username, ns: .objectRef.namespace,
     name: .objectRef.name}' audit.log

# Q3. 인가 거부(403)가 반복되는 주체 — 권한 스캔 시도 탐지
jq 'select(.responseStatus.code==403)
  | .user.username' audit.log | sort | uniq -c | sort -rn
```

Q3 패턴은 특히 중요하다. 탈취된 ServiceAccount 토큰으로 권한을 더듬는 공격은 403 폭주라는 흔적을 남긴다. "동일 주체의 403이 5분간 N회 이상"을 알림 규칙로 만들어 두면 침해를 조기에 감지할 수 있다.

## 운영 팁

- **용량을 계획하라**: 감사 로그는 클러스터에서 가장 빠르게 자라는 로그다. `omitStages`로 RequestReceived를 빼고, None 규칙으로 watch 노이즈를 제거하는 것만으로 절반 이하로 줄어든다
- **감사 로그의 무결성**: 침해 대응 증거로 쓰려면 공격자가 지울 수 없어야 한다. 노드 로컬 파일로만 두지 말고 외부 저장소(전용 버킷, SIEM)로 즉시 내보내라
- **정책도 코드로**: audit-policy.yaml을 Git으로 관리하고 변경을 리뷰하라. 정책의 빈틈이 곧 기록의 빈틈이다

## 마무리

감사 로그는 평소에는 존재감이 없지만, 사고가 터진 순간 "그날 무슨 일이 있었는가"를 증언할 수 있는 유일한 기록이다. Metadata를 기본으로, 민감 리소스는 본문 금지, 파괴적 변경은 상세 기록 — 이 세 원칙으로 정책을 세우고 외부로 내보내 보존하자. 이것으로 관측성 파트가 마무리됐다. 다음 글부터는 시리즈의 새 장을 연다. 클러스터 상태를 Git 저장소와 자동으로 동기화하는 운영 패러다임, **GitOps**다.

---

**지난 글:** [Kubernetes Events — 클러스터의 블랙박스 기록](/posts/k8s-events/)

**다음 글:** [GitOps 입문 — Git을 단일 진실 공급원으로](/posts/k8s-gitops-intro/)

<br>
읽어주셔서 감사합니다. 😊
