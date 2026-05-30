# 웹 보안 완전 정복 시리즈 — 마스터 TOC

> **참고용 문서**: 실제 자동 포스팅 작성 결정의 진실 공급원은 `src/content/posts/` 디렉터리이며, 슬러그 순서는 해당 루틴 프롬프트의 `PLANNED_EOF` 리스트에 박혀 있다. 이 TOC 체크박스는 사람이 보기 위한 참고일 뿐이다.

카테고리: `Security`
슬러그 프리픽스: `websec-`


## 1부 — 웹 보안 기초

1. [ ] `websec-what-is-web-security` — 웹 보안이란 무엇인가
2. [ ] `websec-cia-triad` — 정보보안 3요소(CIA)
3. [ ] `websec-threat-modeling` — 위협 모델링 입문
4. [ ] `websec-attack-surface` — 공격 표면 이해하기
5. [ ] `websec-security-mindset` — 보안 사고방식 기르기
6. [ ] `websec-common-attack-types` — 주요 웹 공격 유형 한눈에 보기
7. [ ] `websec-http-security-basics` — HTTP 프로토콜과 보안 기초

## 2부 — 인증과 인가

8. [ ] `websec-authentication-vs-authorization` — 인증과 인가의 차이
9. [ ] `websec-password-hashing` — 비밀번호 해싱(bcrypt·argon2)
10. [ ] `websec-salting-peppering` — 솔트와 페퍼로 해시 강화하기
11. [ ] `websec-session-management` — 세션 관리의 기본
12. [ ] `websec-session-fixation` — 세션 고정 공격과 방어
13. [ ] `websec-session-hijacking` — 세션 하이재킹 막기
14. [ ] `websec-jwt-security` — JWT 보안 제대로 다루기
15. [ ] `websec-oauth2` — OAuth 2.0 동작 원리
16. [ ] `websec-openid-connect` — OpenID Connect로 신원 인증
17. [ ] `websec-multi-factor-auth` — 다중 인증(MFA) 적용하기
18. [ ] `websec-single-sign-on` — 싱글 사인온(SSO) 구조
19. [ ] `websec-rbac` — 역할 기반 접근 제어(RBAC)
20. [ ] `websec-abac` — 속성 기반 접근 제어(ABAC)
21. [ ] `websec-credential-stuffing` — 크리덴셜 스터핑과 계정 탈취 방어

## 3부 — OWASP Top 10

22. [ ] `websec-owasp-top10-overview` — OWASP Top 10 개요
23. [ ] `websec-injection-overview` — 인젝션 공격 전반 이해
24. [ ] `websec-sql-injection` — SQL 인젝션 공격과 방어
25. [ ] `websec-nosql-injection` — NoSQL 인젝션 이해하기
26. [ ] `websec-command-injection` — 명령어 인젝션 막기
27. [ ] `websec-xss-reflected` — 반사형 XSS 공격
28. [ ] `websec-xss-stored` — 저장형 XSS 공격
29. [ ] `websec-xss-dom-based` — DOM 기반 XSS 공격
30. [ ] `websec-csrf` — CSRF 공격과 방어
31. [ ] `websec-ssrf` — SSRF 공격 이해하기
32. [ ] `websec-broken-access-control` — 취약한 접근 제어
33. [ ] `websec-idor` — IDOR 취약점 다루기
34. [ ] `websec-security-misconfiguration` — 보안 설정 오류
35. [ ] `websec-sensitive-data-exposure` — 민감 데이터 노출 방지
36. [ ] `websec-xxe` — XXE(XML 외부 엔티티) 공격
37. [ ] `websec-insecure-deserialization` — 안전하지 않은 역직렬화
38. [ ] `websec-broken-authentication` — 취약한 인증 메커니즘
39. [ ] `websec-logging-monitoring-failures` — 보안 로깅·모니터링 실패

## 4부 — 브라우저·프론트엔드 보안

40. [ ] `websec-same-origin-policy` — 동일 출처 정책(SOP)
41. [ ] `websec-cors-security` — CORS 안전하게 설정하기
42. [ ] `websec-content-security-policy` — 콘텐츠 보안 정책(CSP)
43. [ ] `websec-cookie-security` — 쿠키 보안(HttpOnly·Secure·SameSite)
44. [ ] `websec-clickjacking` — 클릭재킹 공격과 방어
45. [ ] `websec-subresource-integrity` — 서브리소스 무결성(SRI)
46. [ ] `websec-security-headers` — 필수 보안 헤더 정리
47. [ ] `websec-hsts` — HSTS로 HTTPS 강제하기

## 5부 — 암호화

48. [ ] `websec-symmetric-vs-asymmetric` — 대칭키와 비대칭키 암호
49. [ ] `websec-hashing-vs-encryption` — 해싱과 암호화의 차이
50. [ ] `websec-tls-https` — TLS와 HTTPS 동작 원리
51. [ ] `websec-certificate-pinning` — 인증서 피닝 적용하기
52. [ ] `websec-secrets-management` — 시크릿 관리 모범 사례

## 6부 — 심화·실무

53. [ ] `websec-rate-limiting` — 레이트 리미팅으로 남용 막기
54. [ ] `websec-input-validation-output-encoding` — 입력 검증과 출력 인코딩
55. [ ] `websec-file-upload-security` — 파일 업로드 보안
56. [ ] `websec-supply-chain-security` — 의존성·공급망 보안
57. [ ] `websec-secure-sdlc` — 보안 개발 생명주기(SDLC)
58. [ ] `websec-penetration-testing-intro` — 침투 테스트 입문
59. [ ] `websec-web-application-firewall` — 웹 방화벽(WAF) 활용
60. [ ] `websec-ddos-mitigation` — DDoS 공격 대응
61. [ ] `websec-security-audit-logging` — 보안 감사와 로깅 실무
