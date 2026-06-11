---
title: "공급망 보안: 의존성 하나가 시스템 전체를 위협한다"
description: "타이포스쿼팅, 메인테이너 계정 탈취, 의존성 혼동 등 소프트웨어 공급망 공격 벡터와 event-stream·xz-utils 사례, lockfile 고정·스크립트 차단·Sigstore 출처 증명까지 실전 방어 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 1
type: "knowledge"
category: "Security"
tags: ["공급망보안", "의존성관리", "타이포스쿼팅", "npm보안", "Sigstore", "SLSA"]
featured: false
draft: false
---

[지난 글](/posts/websec-file-upload-security/)에서 파일 업로드 기능의 공격 벡터와 방어를 살펴봤다. 이번 글부터는 시야를 코드 한 줄에서 개발 프로세스 전체로 넓힌다. 그 첫 번째 주제가 소프트웨어 공급망(Supply Chain) 보안이다. 현대 웹 애플리케이션은 직접 작성한 코드보다 가져다 쓰는 코드가 훨씬 많다. `npm install` 한 번에 수백 개의 패키지가 딸려 들어오고, 그중 하나라도 오염되면 내 코드가 아무리 안전해도 시스템 전체가 뚫린다.

## 공급망 공격이란

공급망 공격은 타깃을 직접 공격하는 대신, 타깃이 신뢰하고 가져다 쓰는 것 — 오픈소스 패키지, 빌드 도구, CI 인프라, CDN 스크립트 — 을 오염시키는 공격이다. 방어자 입장에서 까다로운 이유는 명확하다. 신뢰 경계 안쪽에서 실행되는 코드이기 때문에, 전통적인 경계 방어(WAF, 입력 검증)가 전혀 작동하지 않는다.

실제 사건 몇 가지만 봐도 파급력을 체감할 수 있다.

- **event-stream (2018)**: 주간 수백만 다운로드의 npm 패키지. 지친 메인테이너가 관리 권한을 넘긴 새 관리자가 비트코인 지갑 탈취 코드를 심었다.
- **SolarWinds (2020)**: 빌드 시스템 자체가 침해되어, 정식 서명된 업데이트에 백도어가 포함된 채 1만 8천여 고객에게 배포됐다.
- **ua-parser-js (2021)**: 메인테이너 npm 계정이 탈취되어 악성 버전 3개가 게시됐고, 설치 시 암호화폐 채굴기와 정보 탈취 악성코드가 실행됐다.
- **xz-utils (2024)**: 수년에 걸친 사회공학으로 공동 메인테이너 지위를 얻은 공격자가 SSH 인증 우회 백도어를 심었다. 배포 직전에 발견되어 가까스로 막았다.

공통점은 하나다. 피해자들은 아무 잘못도 하지 않았다. 평소처럼 의존성을 업데이트했을 뿐이다.

## 주요 공격 벡터

![공급망 공격 경로](/assets/posts/websec-supply-chain-security-vectors.svg)

**타이포스쿼팅(Typosquatting)**: `lodash`를 `lodahs`로, `requests`를 `request`로 — 오타나 헷갈리는 이름으로 악성 패키지를 등록해 두고 실수를 기다린다. 변형으로 다른 생태계의 유명 패키지명을 선점하는 brandjacking, 기존 패키지와 비슷한 scope를 쓰는 수법도 있다.

**메인테이너 계정 탈취**: 패키지 자체는 정상이지만, 게시 권한을 가진 계정이 피싱·크리덴셜 스터핑으로 탈취되면 정상 패키지에 악성 버전이 올라간다. 사용자는 버전 번호만 바뀐 신뢰하던 패키지를 받게 된다.

**의존성 혼동(Dependency Confusion)**: 회사 내부 레지스트리에만 존재하는 패키지명(`acme-internal-auth` 같은)을 공개 레지스트리에 더 높은 버전으로 등록한다. 패키지 매니저가 내부와 공개 저장소를 모두 조회하도록 설정되어 있으면, "더 높은 버전"인 공개 악성 패키지를 받아간다. 2021년 연구자 Alex Birsan이 이 기법으로 Apple, Microsoft 등 35개 기업 내부망에서 코드 실행을 입증했다.

**설치 스크립트 악용**: npm의 `postinstall` 훅은 패키지 설치 시점에 임의 코드를 실행한다. 악성 패키지 대부분이 이 지점에서 환경변수, `.npmrc` 토큰, SSH 키를 수집해 외부로 전송한다. 애플리케이션이 그 패키지를 import하기도 전에 피해가 발생한다는 뜻이다.

**빌드/배포 인프라 침해**: SolarWinds 사례처럼 CI 서버나 릴리스 파이프라인이 뚫리면, 소스 코드는 깨끗한데 산출물만 오염되는 최악의 상황이 된다. 서명까지 정상적으로 이뤄지므로 다운스트림에서 탐지하기 극히 어렵다.

## 방어 전략

공급망 방어는 단일 도구로 해결되지 않는다. 도입 → 고정 → 감시 → 빌드의 각 단계에 장치를 거는 다층 방어가 기본이다.

![공급망 방어 4계층](/assets/posts/websec-supply-chain-security-defense.svg)

### 1. 의존성 자체를 줄인다

가장 확실한 방어는 공격 표면 축소다. 패키지를 추가하기 전에 묻자. 이 기능을 직접 작성하면 몇 줄인가? 이 패키지의 전이 의존성은 몇 개인가? 마지막 릴리스는 언제이고 메인테이너는 몇 명인가? `npm ls --all | wc -l`로 전이 의존성 개수를 확인해 보면, `left-pad` 한 줄짜리 패키지가 생태계를 멈춘 사건이 왜 일어났는지 이해된다.

### 2. 버전을 고정하고 무결성을 검증한다

lockfile(`package-lock.json`, `yarn.lock`, `poetry.lock`)을 반드시 커밋한다. lockfile에는 각 패키지의 정확한 버전과 함께 콘텐츠 해시(`integrity` 필드)가 기록되므로, 같은 이름·버전으로 내용이 바뀐 패키지를 설치 시점에 잡아낼 수 있다.

CI에서는 `npm install`이 아니라 `npm ci`를 쓴다. `npm ci`는 lockfile과 `package.json`이 어긋나면 즉시 실패하고, lockfile을 절대 수정하지 않는다. 설치 스크립트 실행도 차단하는 것이 좋다.

```bash
# lockfile 그대로, 설치 스크립트 실행 없이 설치
npm ci --ignore-scripts

# 빌드에 정말 필요한 패키지(node-gyp 등)만 선별적으로 빌드 허용
npm rebuild some-native-package
```

의존성 혼동 방어는 레지스트리 설정에서 해결한다. 내부 패키지는 반드시 조직 scope(`@acme/auth`)를 쓰고, 해당 scope가 내부 레지스트리만 바라보도록 고정한다.

```ini
# .npmrc — @acme scope는 내부 레지스트리에서만 받는다
@acme:registry=https://npm.internal.acme.com/
registry=https://registry.npmjs.org/
```

### 3. 알려진 취약점을 자동으로 감시한다

새 CVE는 매일 나온다. 한 번 스캔하고 끝나는 게 아니라, 의존성 그래프를 상시 감시하는 자동화가 필요하다.

- **Dependabot / Renovate**: 취약 버전 감지 시 패치 PR을 자동 생성
- **npm audit / pip-audit**: CI 단계에서 임계 등급 이상이면 빌드 실패 처리
- **OSV (osv.dev)**: 생태계 통합 취약점 데이터베이스, `osv-scanner`로 lockfile 직접 스캔

```yaml
# GitHub Actions — 의존성 취약점 게이트
- name: Audit dependencies
  run: npm audit --omit=dev --audit-level=high
```

단, 자동 업데이트에는 양면성이 있다. 악성 버전이 게시된 직후 자동으로 끌어올 수도 있기 때문이다. 그래서 "패치는 빠르게, 단 게시 후 며칠의 숙성 기간(cooldown)을 두고"라는 절충이 실무에서 자주 쓰인다.

### 4. 빌드 산출물의 출처를 증명한다

마지막 계층은 "이 산출물이 정말 그 소스에서, 그 파이프라인으로 빌드됐는가"를 검증하는 것이다.

- **Sigstore / cosign**: 빌드 산출물과 컨테이너 이미지에 키리스(keyless) 서명을 붙이고 검증한다.
- **SLSA(Supply-chain Levels for Software Artifacts)**: 빌드 무결성 보증 수준을 1~3단계로 정의한 프레임워크. npm의 `--provenance` 게시 옵션이 이 모델을 따른다.
- **npm provenance**: `npm publish --provenance`로 게시된 패키지는 어떤 저장소의 어떤 커밋에서 어떤 워크플로로 빌드됐는지 레지스트리에서 확인할 수 있다.

## 실무 체크리스트

```text
- [ ] lockfile 커밋 + CI는 npm ci (frozen install)
- [ ] CI/로컬 공통 --ignore-scripts, 필요한 패키지만 예외 허용
- [ ] 내부 패키지는 조직 scope + 레지스트리 고정 (.npmrc)
- [ ] Dependabot/Renovate + audit 게이트 (high 이상 빌드 실패)
- [ ] 신규 의존성 도입 리뷰 절차 (전이 의존성·관리 상태 확인)
- [ ] 릴리스 산출물 서명(cosign) 및 provenance 검증
- [ ] CI 시크릿 최소 권한 + OIDC 기반 단기 자격증명
```

공급망 보안은 결국 "신뢰를 검증 가능하게 만드는 일"이다. 다음 글에서는 이런 장치들을 개발 프로세스 전체에 어떻게 체계적으로 심는지, Secure SDLC를 다룬다.

---

**지난 글:** [파일 업로드 보안: 악성 파일 업로드 방어 전략](/posts/websec-file-upload-security/)

**다음 글:** [Secure SDLC: 개발 생명주기에 보안을 내재화하는 법](/posts/websec-secure-sdlc/)

<br>
읽어주셔서 감사합니다. 😊
