---
title: "SAST·DAST·IAST: 자동화 보안 테스트 도구 비교와 선택"
description: "정적 분석(SAST), 동적 분석(DAST), 대화형 분석(IAST)의 동작 원리와 장단점을 비교하고, CI/CD 파이프라인의 어느 단계에 어떤 도구를 배치할지, 오탐 관리와 도입 순서까지 실무 관점에서 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 4
type: "knowledge"
category: "Security"
tags: ["SAST", "DAST", "IAST", "보안테스트", "Semgrep", "DevSecOps"]
featured: false
draft: false
---

[지난 글](/posts/websec-owasp-asvs/)에서 ASVS로 "무엇을 검증할지"의 기준을 세웠다. 이제 "무엇으로 검증할 것인가"를 정할 차례다. 수백 개의 검증 항목을 사람이 매번 수동으로 점검할 수는 없으므로, 자동화 보안 테스트 도구가 필요하다. 이 분야의 세 축이 SAST, DAST, IAST다. 이름은 비슷하지만 보는 것과 보지 못하는 것이 완전히 다르다.

## 세 가지 접근, 세 가지 시야

핵심 차이는 한 문장으로 요약된다. **SAST는 코드를 읽고, DAST는 실행 중인 앱을 공격해 보고, IAST는 앱 내부에서 실행을 관찰한다.**

![SAST vs DAST vs IAST 비교](/assets/posts/websec-sast-dast-iast-comparison.svg)

### SAST — 소스 코드를 읽는 화이트박스 분석

SAST(Static Application Security Testing)는 애플리케이션을 실행하지 않고 소스 코드(또는 바이너리)를 분석한다. 단순한 패턴 매칭부터, "사용자 입력이 어떤 변환도 거치지 않고 SQL 쿼리 문자열에 도달하는가"를 추적하는 테인트 분석(taint analysis)까지 수준이 다양하다.

```javascript
// SAST가 잡는 전형적인 패턴: source → sink 테인트 흐름
app.get("/search", (req, res) => {
  const keyword = req.query.q;                    // source: 사용자 입력

  // 입력이 정화 없이 쿼리 문자열에 도달 → SQL Injection 경고
  db.query(`SELECT * FROM posts WHERE title LIKE '%${keyword}%'`);

  // 파라미터 바인딩으로 바꾸면 경고가 사라진다
  db.query("SELECT * FROM posts WHERE title LIKE ?", [`%${keyword}%`]);
});
```

- **강점**: 실행 환경이 필요 없어 PR 단계에서 즉시 돌릴 수 있고, 파일·라인 단위로 위치를 짚어 주므로 수정이 빠르다. 발견 시점이 가장 이르다 — 지난 글에서 본 Shift Left 비용 곡선의 가장 왼쪽이다.
- **약점**: 코드만 보기 때문에 런타임 설정 오류(보안 헤더 누락, TLS 설정), 배포 환경 문제를 보지 못한다. 그리고 실행 가능성을 확인하지 않으므로 오탐(false positive)이 많다.
- **대표 도구**: Semgrep, CodeQL, SonarQube, Checkmarx. 시크릿 스캐너(gitleaks, trufflehog)도 넓게는 이 계열이다.

### DAST — 공격자의 자리에서 보는 블랙박스 분석

DAST(Dynamic Application Security Testing)는 실행 중인 애플리케이션에 실제 공격 페이로드를 보내고 응답을 관찰한다. 내부 구현을 전혀 모른다는 점에서 공격자와 같은 시점이다.

- **강점**: 결과가 실증적이다. "이 페이로드를 보냈더니 실제로 반사됐다"는 보고는 오탐일 가능성이 낮다. 언어·프레임워크에 무관하고, SAST가 못 보는 설정 오류·헤더 누락·서버 구성 문제를 잡는다.
- **약점**: 실행 환경이 필요하므로 발견 시점이 늦다. "어느 파일의 어느 라인이 문제인지"를 알려주지 못해 수정 비용이 올라간다. 크롤러가 도달하지 못한 화면은 검사되지 않으며, 인증이 걸린 영역을 스캔하려면 세션 설정이 필요하다.
- **대표 도구**: OWASP ZAP, Burp Suite, Nuclei, Nikto.

### IAST — 앱 내부에 심는 관찰자

IAST(Interactive Application Security Testing)는 애플리케이션 런타임(JVM 에이전트, Node.js 계측 모듈 등)에 센서를 심고, 테스트 트래픽이 흐를 때 내부에서 데이터 흐름을 관찰한다. DAST처럼 실제 실행을 보면서, SAST처럼 코드 위치를 짚어 준다.

- **강점**: "이 HTTP 요청이 → 이 코드 경로를 타고 → 이 쿼리에 도달했다"를 한 번에 보여 주므로 정확도와 수정 용이성을 동시에 얻는다.
- **약점**: 커버리지가 테스트 트래픽에 의존한다. E2E 테스트가 부실하면 IAST도 그만큼만 본다. 에이전트 설치가 필요해 도입 장벽이 있고 상용 도구 중심이다.
- **대표 도구**: Contrast Security, Synopsys Seeker 등. 프로덕션에서 비슷한 원리로 동작하며 공격을 차단까지 하는 것은 RASP(Runtime Application Self-Protection)라고 구분해 부른다.

여기에 한 가지를 더 얹어야 그림이 완성된다. **SCA(Software Composition Analysis)** — 내 코드가 아니라 의존성의 알려진 취약점(CVE)을 찾는 도구로, 공급망 보안 글에서 다룬 `npm audit`, Dependabot, osv-scanner가 여기에 해당한다. SAST와 SCA는 보는 대상 자체가 다르므로 둘 다 필요하다.

## 파이프라인 배치 전략

세 도구는 경쟁 관계가 아니라 서로의 사각지대를 메우는 보완 관계다. 문제는 "무엇을 쓰느냐"보다 "어디에 꽂느냐"다.

![파이프라인 단계별 도구 배치](/assets/posts/websec-sast-dast-iast-pipeline.svg)

```yaml
# 배치 예시 — PR은 빠르게, 야간/스테이징은 깊게
# 1) PR 단계: diff 기반 SAST (수 분 내 완료)
pr-checks:
  - semgrep ci --config p/owasp-top-ten --baseline-commit $BASE

# 2) 야간 배치: 전체 코드베이스 심층 분석
nightly:
  - codeql database analyze --format=sarif-latest

# 3) 스테이징 배포 후: DAST 베이스라인 스캔
staging:
  - zap-baseline.py -t https://staging.example.com -r report.html
```

배치의 원칙은 두 가지다.

**첫째, PR 게이트는 5분 안에 끝나야 한다.** 전체 코드베이스 심층 분석을 PR마다 돌리면 개발자는 게이트를 우회할 방법부터 찾는다. PR에서는 변경분(diff) 기반의 빠른 SAST와 시크릿 스캔만 돌리고, 무거운 전체 분석은 야간 배치로 분리한다.

**둘째, 단계가 오른쪽으로 갈수록 "실제 환경과의 유사성"이 보상이다.** 스테이징의 DAST는 PR의 SAST보다 늦지만, 설정 오류와 배포 환경 문제까지 실증적으로 확인해 준다. E2E 테스트가 충실한 조직이라면 같은 트래픽에 IAST를 얹어 정확도를 한 단계 끌어올릴 수 있다.

## 오탐 관리 — 도구 도입보다 중요한 것

보안 테스트 자동화가 실패하는 가장 흔한 원인은 도구 성능이 아니라 **오탐 방치**다. 경고 200개 중 190개가 오탐이면, 개발자는 곧 200개 전부를 무시한다. 늑대가 정말 나타났을 때는 아무도 보지 않는다.

- **베이스라인 전략**: 도입 시점의 기존 경고는 베이스라인으로 동결하고, 신규 코드의 신규 경고만 게이트로 막는다. 부채는 별도 트랙으로 상환한다.
- **룰 튜닝은 보안팀의 책임**: 반복되는 오탐 패턴은 룰을 수정하거나 해당 코드에 명시적 예외(`# nosemgrep: rule-id — 사유`)를 달아 기록을 남긴다.
- **심각도 게이트 차등화**: Critical/High만 빌드 실패, Medium 이하는 리포트로. 모든 경고를 같은 무게로 다루면 전부가 소음이 된다.
- **지표 추적**: 오탐률, 경고 처리 소요 시간(MTTR)을 추적해야 게이트가 신뢰를 유지하는지 알 수 있다.

## 무엇부터 도입할까

정답은 조직 상황에 따라 다르지만, 비용 대비 효과 순서는 비교적 명확하다.

```text
1. 시크릿 스캔 (gitleaks)        — 설치 10분, 효과 즉시
2. SCA (Dependabot/npm audit)   — 알려진 CVE 차단, 거의 공짜
3. SAST (Semgrep 무료 룰셋)      — PR 게이트화, 오탐 튜닝 필수
4. DAST (ZAP 베이스라인 스캔)     — 스테이징 정착 후
5. IAST                         — E2E 테스트가 충실해진 다음
```

자동화 도구는 "알려진 패턴"을 잘 잡는다. 하지만 도구가 모르는 입력, 예상 밖의 경계 조건은 어떻게 찾을까. 다음 글에서는 무작위에 가까운 변형 입력으로 숨은 결함을 찾아내는 기법, 퍼징(Fuzzing)을 다룬다.

---

**지난 글:** [OWASP ASVS: 애플리케이션 보안 검증 표준 활용 가이드](/posts/websec-owasp-asvs/)

**다음 글:** [퍼징(Fuzzing): 예상 밖의 입력으로 숨은 취약점 찾기](/posts/websec-fuzzing/)

<br>
읽어주셔서 감사합니다. 😊
