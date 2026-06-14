---
title: "위협 모델링 입문"
description: "STRIDE 프레임워크와 4단계 위협 모델링 프로세스를 활용해 웹 애플리케이션의 보안 위협을 체계적으로 식별하고 우선순위를 정하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 3
type: "knowledge"
category: "Security"
tags: ["위협모델링", "STRIDE", "DREAD", "보안설계", "DFD"]
featured: false
draft: false
---

[지난 글](/posts/websec-cia-triad/)에서 기밀성·무결성·가용성의 의미를 살펴봤다. 이제 이 개념을 실제 시스템에 적용하는 도구가 필요하다. **위협 모델링(Threat Modeling)**은 "어디서 무엇이 잘못될 수 있는가"를 코드를 작성하기 전에 체계적으로 파악하는 프로세스다. 설계 단계에서 발견한 취약점 하나가 배포 후 수정 비용의 30분의 1 수준으로 처리된다.

## 위협 모델링이란

위협 모델링은 시스템의 자산, 공격자, 공격 경로를 문서화하고 우선순위를 정하는 활동이다. 특정 도구나 방법론에 종속되지 않으며, 팀 전체가 "우리가 무엇을 보호하는가"에 대한 공통 언어를 갖게 해준다.

핵심 질문은 네 가지다.

1. **무엇을 만들고 있는가?** — 시스템 구조 파악
2. **무엇이 잘못될 수 있는가?** — 위협 식별
3. **잘못됐을 때 어떻게 되는가?** — 영향 평가
4. **어떻게 막을 것인가?** — 대응책 수립

![STRIDE 위협 분류 모델](/assets/posts/websec-threat-modeling-stride.svg)

## STRIDE: 위협 분류 프레임워크

Microsoft가 개발한 STRIDE는 여섯 가지 위협 유형의 약자다.

**Spoofing(스푸핑)**: 다른 사용자나 서비스로 위장한다. 피싱, ARP 스푸핑, 세션 탈취가 해당한다. 대응: MFA, 상호 TLS 인증.

**Tampering(변조)**: 데이터나 코드를 무단으로 수정한다. SQL 인젝션, 파일 시스템 변조가 해당한다. 대응: HMAC, 체크섬, 감사 로그.

**Repudiation(부인)**: 자신이 한 행위를 나중에 부인한다. "그 요청 나 아님"을 주장할 수 있는 상황이다. 대응: 전자 서명, 불변 감사 로그.

**Information Disclosure(정보 노출)**: 권한 없는 자에게 데이터가 노출된다. 에러 메시지의 스택 트레이스, 과도한 API 응답이 해당한다. 대응: 암호화, 최소 노출.

**Denial of Service(서비스 거부)**: 서비스를 사용 불가 상태로 만든다. DDoS, 무한 루프 유발 입력이 해당한다. 대응: Rate Limiting, WAF.

**Elevation of Privilege(권한 상승)**: 허가되지 않은 더 높은 권한을 얻는다. IDOR, 취약한 인가 로직 우회가 해당한다. 대응: 최소 권한, 명시적 인가 확인.

## 4단계 위협 모델링 프로세스

![위협 모델링 4단계 프로세스](/assets/posts/websec-threat-modeling-process.svg)

### 1단계: 시스템 분해

데이터 흐름도(DFD, Data Flow Diagram)를 작성해 시스템의 구성 요소와 데이터 흐름을 시각화한다. 신뢰 경계(Trust Boundary)를 명확히 표시하는 것이 핵심이다. 신뢰 경계는 "이 경계를 넘을 때 검증이 필요하다"는 표시다.

구성 요소: 외부 엔티티(사용자, 외부 API), 프로세스(비즈니스 로직), 데이터 저장소(DB, 캐시), 데이터 흐름(HTTP, DB 쿼리).

### 2단계: 위협 식별

각 데이터 흐름과 컴포넌트에 STRIDE를 적용한다. "이 흐름에서 S는 어떻게 발생할 수 있는가? T는? I는?"을 반복한다.

```python
# 간단한 위협 모델링 워크시트 예시 (로그인 기능)
threat_model = {
    "component": "POST /api/login",
    "assets": ["사용자 자격증명", "세션 토큰"],
    "threats": [
        {
            "type": "Spoofing",
            "description": "다른 사용자 계정으로 로그인 시도",
            "attack": "크리덴셜 스터핑 · 브루트 포스",
            "mitigation": "레이트 리미팅 · CAPTCHA · 계정 잠금"
        },
        {
            "type": "Information Disclosure",
            "description": "존재하지 않는 계정 vs 잘못된 비밀번호 구분",
            "attack": "사용자 열거(User Enumeration)",
            "mitigation": "동일한 에러 메시지 반환"
        },
        {
            "type": "Denial of Service",
            "description": "로그인 엔드포인트 과부하",
            "attack": "대량 요청 전송",
            "mitigation": "IP 기반 Rate Limit + WAF"
        }
    ]
}
```

### 3단계: 위협 평가

모든 위협을 동일하게 처리할 수 없다. DREAD 점수로 우선순위를 정한다.

- **D**amage(피해 규모): 1-10
- **R**eproducibility(재현 가능성): 1-10
- **E**xploitability(악용 난이도): 1-10
- **A**ffected users(영향 받는 사용자): 1-10
- **D**iscoverability(발견 가능성): 1-10

점수 합산 후 5로 나눈 값이 최종 위험도다. 8 이상은 즉시 대응, 6-8은 다음 스프린트, 6 미만은 백로그로 분류하는 방식이 일반적이다.

### 4단계: 대응책 수립

위협별 대응 전략은 네 가지 중 하나를 선택한다.

**제거(Eliminate)**: 해당 기능 자체를 없앤다. 필요 없는 XML 파서를 제거해 XXE 위협을 근본 제거.

**완화(Mitigate)**: 발생 가능성이나 영향을 낮춘다. 파라미터화 쿼리로 SQL 인젝션 완화.

**수용(Accept)**: 리스크를 이해한 상태에서 감수한다. 낮은 심각도·낮은 가능성 위협에 한해.

**전가(Transfer)**: 보험이나 제3자 서비스로 책임을 이전한다. DDoS 방어를 CDN 사업자에게 위임.

## 실전 팁

**언제 하는가**: 새 기능 설계 시, 아키텍처 변경 시, 정기 보안 리뷰 시(분기 또는 반기). 아무리 바빠도 새 인증/인가 기능이라면 반드시 수행한다.

**누가 하는가**: 개발자, 보안 엔지니어, 아키텍트가 함께. 혼자 하는 위협 모델링은 편향이 생기기 쉽다.

**어떤 도구를 쓰는가**: Microsoft Threat Modeling Tool(무료), OWASP Threat Dragon(오픈소스), 화이트보드도 충분하다.

위협 모델링의 가장 큰 오류는 "나중에 하면 된다"는 생각이다. 코드가 완성된 뒤에는 설계를 바꾸기가 어렵다. 스프린트 계획 단계에서 "이 기능의 위협 모델은?"을 정기적으로 묻는 것만으로 팀의 보안 문화가 달라진다.

---

**지난 글:** [정보보안 3요소(CIA) 완전 이해](/posts/websec-cia-triad/)

**다음 글:** [공격 표면 이해하기](/posts/websec-attack-surface/)

<br>
읽어주셔서 감사합니다. 😊
