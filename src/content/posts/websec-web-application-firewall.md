---
title: "WAF: 웹 애플리케이션 방화벽 원리, 배포 전략, 우회 방어"
description: "ModSecurity, AWS WAF, Cloudflare WAF의 서명 기반·이상 탐지·ML 규칙 동작 원리와 False Positive 튜닝, WAF 우회 공격 방어 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 1
type: "knowledge"
category: "Security"
tags: ["WAF", "ModSecurity", "CloudflareWAF", "AWSWAF", "웹보안", "방화벽"]
featured: false
draft: false
---

[지난 글](/posts/websec-api-key-management/)에서 API 키의 생성·저장·로테이션을 살펴봤다. 이번 글은 웹 트래픽이 애플리케이션에 도달하기 전 첫 번째 방어선인 WAF(Web Application Firewall)의 원리, 구성, 한계를 다룬다.

![WAF 동작 원리와 탐지 방식](/assets/posts/websec-web-application-firewall-layers.svg)

## WAF란 무엇인가

WAF는 HTTP/HTTPS 트래픽을 검사해 SQL Injection, XSS, CSRF, 경로 탐색 같은 공격 패턴을 차단하는 레이어다. 전통적인 네트워크 방화벽이 IP/포트 수준에서 동작하는 반면, WAF는 레이어 7(애플리케이션 계층)에서 요청 헤더·바디·파라미터·쿠키 전체를 분석한다.

WAF가 막는 주요 공격:

- **인젝션**: SQL, NoSQL, 명령어, LDAP 인젝션
- **XSS**: Reflected, Stored, DOM-based
- **경로 탐색**: `../../../etc/passwd` 유형
- **프로토콜 공격**: HTTP Request Smuggling, HTTP Response Splitting
- **봇 트래픽**: 크리덴셜 스터핑, 스크래핑, DDoS 증폭

## 탐지 방식 3가지

**서명 기반(Signature-based)**: 알려진 공격 패턴 DB와 매칭한다. OWASP Core Rule Set(CRS)가 대표적이며 900개 이상 규칙을 제공한다. 처리 속도는 빠르지만 제로데이 공격에 취약하다.

**이상 탐지(Anomaly Detection)**: 정상 트래픽 기준선을 학습한 뒤 통계적 편차가 큰 요청을 차단한다. 임계값 초과 시 점수를 누적해 총점이 일정 수준을 넘으면 차단한다(ModSecurity 기본 방식).

**ML/AI 기반**: 행동 패턴을 실시간 학습해 알려지지 않은 공격도 탐지한다. Cloudflare, AWS WAF v2가 이 방식을 채택한다.

## ModSecurity 설정

![WAF 규칙 설정 예시](/assets/posts/websec-web-application-firewall-rules.svg)

```nginx
# nginx.conf에 ModSecurity 통합
load_module modules/ngx_http_modsecurity_module.so;

server {
    modsecurity on;
    modsecurity_rules_file /etc/nginx/modsecurity/modsec_includes.conf;
}
```

```conf
# modsec_includes.conf
Include /etc/nginx/modsecurity/modsecurity.conf
Include /etc/nginx/modsecurity/crs/crs-setup.conf
Include /etc/nginx/modsecurity/crs/rules/*.conf

# 탐지 모드 (차단 전 로그만) → 운영 전 필수
SecRuleEngine DetectionOnly
# 운영 시 On으로 전환
# SecRuleEngine On

# 이상 점수 임계값 (기본 5 → 낮을수록 엄격)
SecAction "id:900110,phase:1,pass,nolog,\
  setvar:tx.inbound_anomaly_score_threshold=10"
```

## AWS WAF 설정 (Terraform)

```hcl
resource "aws_wafv2_web_acl" "main" {
  name  = "main-waf"
  scope = "REGIONAL"

  default_action { allow {} }

  # AWS 관리형 규칙: SQL 인젝션 방어
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 10
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLiRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # Rate Limiting: IP당 5분에 1000요청
  rule {
    name     = "RateLimitPerIP"
    priority = 20
    action { block {} }
    statement {
      rate_based_statement {
        limit              = 1000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
      sampled_requests_enabled   = true
    }
  }
}
```

## False Positive 관리

WAF 도입 후 가장 큰 과제는 정상 요청 차단(False Positive)이다. 단계적 접근이 필수다.

```bash
# 1단계: DetectionOnly 모드로 2주 운영하며 로그 수집
# 2단계: 차단되는 정상 요청 패턴 분석
grep "RULE_ID:942100" /var/log/nginx/modsec_audit.log | \
  awk '{print $NF}' | sort | uniq -c | sort -rn | head -20

# 3단계: 특정 규칙 예외 처리
SecRuleUpdateTargetById 942100 "!ARGS:description"
# description 파라미터는 942100 규칙 검사 제외

# 4단계: 특정 경로 전체 예외
SecRule REQUEST_URI "@beginsWith /api/internal/" \
  "id:9999,phase:1,pass,nolog,ctl:ruleEngine=Off"
```

## WAF 우회 기법과 방어

공격자는 WAF 서명을 우회하려 다양한 인코딩을 시도한다.

```sql
-- WAF가 막는 패턴
' OR 1=1 --

-- 우회 시도 1: URL 인코딩
%27%20OR%201%3D1%20--

-- 우회 시도 2: 대소문자 혼용
' oR 1=1 --

-- 우회 시도 3: 주석 삽입
' /*!OR*/ 1=1 --

-- 우회 시도 4: 유니코드 이스케이프
' OR 1=1 --
```

방어 전략: WAF에만 의존하지 않고 **애플리케이션 계층에서도 PreparedStatement, ORM, 입력 검증을 반드시 병행**한다. WAF는 심층 방어의 첫 레이어일 뿐이다.

## 배포 시 체크리스트

```markdown
# WAF 배포 체크리스트
- [ ] DetectionOnly 모드 2주 운영 후 SecRuleEngine On 전환
- [ ] OWASP CRS paranoia level 1 → 2 → 3 단계적 상향
- [ ] CloudWatch / Elastic 대시보드로 차단 통계 모니터링
- [ ] 주요 엔드포인트 자동화 테스트(DAST)로 False Positive 검출
- [ ] 관리자 IP 화이트리스트 설정 (배포 파이프라인 포함)
- [ ] Rate Limiting 임계값 프로덕션 트래픽 기반으로 조정
- [ ] WAF 로그 SIEM 연동 및 알람 규칙 설정
```

---

**지난 글:** [API 키 관리: 생성·저장·스코프·로테이션·폐기 전략 완전 가이드](/posts/websec-api-key-management/)

**다음 글:** [컨테이너 보안: Docker·Kubernetes 취약점과 방어 전략](/posts/websec-container-security/)

<br>
읽어주셔서 감사합니다. 😊
