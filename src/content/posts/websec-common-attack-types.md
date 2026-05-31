---
title: "주요 웹 공격 유형 한눈에 보기"
description: "OWASP Top 10을 기반으로 SQL 인젝션, XSS, CSRF, SSRF, IDOR 등 12개 주요 웹 공격 유형을 5개 카테고리로 정리하고 각각의 최소 방어 코드를 제시합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 6
type: "knowledge"
category: "Security"
tags: ["공격유형", "OWASP", "SQLinjection", "XSS", "CSRF", "SSRF", "IDOR"]
featured: false
draft: false
---

[지난 글](/posts/websec-security-mindset/)에서 보안 사고방식을 다뤘다. 이제 그 사고방식을 구체적인 공격 유형에 적용해보자. 이 글은 시리즈 전체에서 다룰 공격들의 **항법 지도(Navigation Map)**다. 각 공격이 어떤 카테고리에 속하고, 핵심 방어 원칙이 무엇인지 한눈에 파악할 수 있다.

## 공격 유형 분류

웹 공격은 공격 대상과 메커니즘에 따라 크게 5개 카테고리로 나뉜다.

![주요 웹 공격 유형 전체 지도](/assets/posts/websec-common-attack-types-overview.svg)

## 1. 인젝션 공격

인젝션은 공격자가 애플리케이션이 신뢰하는 채널에 악성 코드나 명령을 주입하는 공격이다. 애플리케이션이 입력과 코드를 구분하지 못할 때 발생한다.

**SQL 인젝션**: 입력값이 SQL 쿼리에 직접 포함되면, 공격자가 쿼리 구조를 바꿀 수 있다.

```sql
-- 원래 의도한 쿼리
SELECT * FROM users WHERE username='alice' AND password='secret'

-- 공격 입력: username = "' OR '1'='1' --"
SELECT * FROM users WHERE username='' OR '1'='1' --' AND password='...'
-- 결과: 모든 사용자가 반환됨 (OR 1=1이 항상 참)
```

**NoSQL 인젝션**: MongoDB 같은 NoSQL DB도 안전하지 않다.

```javascript
// 취약: JSON 페이로드 직접 사용
const user = await db.users.findOne({ username: req.body.username });

// 공격: {"username": {"$gt": ""}} → 모든 사용자 매칭
// 안전: 타입 강제
const username = String(req.body.username);
```

**명령어 인젝션**: `os.system()`, `subprocess`, 셸 명령 실행 시 사용자 입력이 들어가면 위험하다.

## 2. 클라이언트 측 공격

피해자의 브라우저를 매개로 공격자가 원하는 동작을 수행시키는 공격이다.

**XSS(Cross-Site Scripting)**: 공격자가 악성 스크립트를 페이지에 주입해 피해자 브라우저에서 실행되게 한다. 세션 쿠키 탈취, 피싱 페이지 주입이 가능하다. 반사형(URL 파라미터), 저장형(DB 저장 후 다른 사용자에게 노출), DOM 기반(클라이언트 코드)의 세 종류가 있다.

**CSRF(Cross-Site Request Forgery)**: 피해자가 의도하지 않은 요청을 인증된 상태로 전송하게 만든다. 피해자가 로그인된 상태에서 공격자 사이트를 방문하면 공격자 사이트가 피해자 이름으로 은행 송금을 요청할 수 있다.

**클릭재킹**: 투명한 iframe을 통해 피해자가 보이는 버튼과 다른 버튼을 클릭하게 만든다.

## 3. 인증 · 인가 공격

신원 확인(인증)이나 권한 확인(인가)을 우회하는 공격이다.

**브루트 포스**: 비밀번호를 자동화로 대량 시도한다. 레이트 리미팅과 계정 잠금으로 방어한다.

**크리덴셜 스터핑**: 다른 서비스에서 유출된 ID/비밀번호를 다른 서비스에서 시도한다. 2024년 기준 전체 로그인 시도의 40% 이상이 크리덴셜 스터핑이다.

**IDOR(Insecure Direct Object Reference)**: ID만 알면 다른 사용자의 자원에 접근할 수 있는 취약점이다. `/api/orders/1234`를 `/api/orders/1235`로 바꾸면 타인의 주문이 보이는 경우.

**세션 하이재킹**: 유효한 세션 토큰을 탈취해 피해자로 위장한다.

## 4. 서버 측 공격

서버 내부 자원이나 로직을 조작하는 공격이다. 발생 빈도는 낮지만 피해가 크다.

**SSRF(Server-Side Request Forgery)**: 서버가 공격자가 지정한 내부 URL에 요청을 보내게 만든다. AWS EC2의 인스턴스 메타데이터 서버(`169.254.169.254`)에 접근해 자격증명을 탈취하는 것이 대표적이다.

**XXE(XML External Entity)**: XML 파서가 외부 엔티티를 처리할 때 로컬 파일이나 내부 서비스에 접근한다.

**안전하지 않은 역직렬화**: 직렬화된 객체를 복원할 때 공격자가 조작한 객체를 실행한다. Python의 `pickle`, Java의 `ObjectInputStream`이 위험하다.

## 5. 인프라 · 설정 공격

애플리케이션 코드보다 인프라와 설정의 문제다. 발생 빈도가 가장 높다.

**보안 설정 오류**: 기본 자격증명 사용, 불필요한 서비스 활성화, 과도한 CORS 정책이 해당한다.

**의존성 취약점**: 취약한 버전의 라이브러리 사용. 2021년 Log4Shell은 수억 개 서비스에 영향을 미쳤다.

**DDoS**: 대량 트래픽으로 서비스를 마비시킨다.

**로깅 · 모니터링 부재**: 공격이 발생해도 탐지하지 못하는 상태. OWASP 2021에서 새롭게 Top 10에 진입했다.

![공격 유형별 최소 방어 코드](/assets/posts/websec-common-attack-types-code.svg)

## 공격 유형 간 연관성

이 공격들은 독립적이지 않다. XSS로 세션 쿠키를 탈취하면 세션 하이재킹으로 이어진다. SSRF로 내부 자격증명을 훔치면 권한 상승으로 연결된다. 공격자는 항상 여러 취약점을 체인으로 연결한다.

이 시리즈의 3부(OWASP Top 10)에서 각 공격을 상세히 다룬다. 지금은 전체 지도를 머릿속에 그려두는 것으로 충분하다.

---

**지난 글:** [보안 사고방식 기르기](/posts/websec-security-mindset/)

**다음 글:** [HTTP 프로토콜과 보안 기초](/posts/websec-http-security-basics/)

<br>
읽어주셔서 감사합니다. 😊
