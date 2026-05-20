---
title: "[Nexacro N] 환경별 설정 분리 전략"
description: "Nexacro N 프로젝트에서 개발·스테이징·운영 환경의 설정을 체계적으로 분리하는 방법을 설명합니다. TypeDef.xml 환경 분리, 공통 설정과 환경별 설정 관리, 비밀값 처리, 배포 스크립트로의 환경 주입까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "환경설정", "설정분리", "TypeDef", "배포환경", "CI/CD"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-build-options/)에서 빌드 옵션과 배포 파이프라인의 기본 구조를 살펴보았다. 빌드 파이프라인이 갖춰졌다면 그 다음 과제는 환경 설정을 얼마나 안전하고 일관되게 관리하느냐다. 개발 서버 URL이 운영 배포에 포함되거나, 디버그 모드가 운영에 켜진 채 배포되는 사고는 설정 분리가 제대로 되지 않았을 때 발생한다. Nexacro N에서 환경별 설정을 체계적으로 분리하면 이런 실수를 구조적으로 예방할 수 있다.

## 왜 설정을 분리해야 하는가

하나의 TypeDef.xml로 모든 환경을 관리하면 다음 문제가 생긴다.

- 배포할 때마다 URL을 손으로 바꿔야 한다 → 실수 위험
- 개발팀이 실수로 운영 서버를 연결해 테스트한다 → 데이터 오염
- 디버그 로그가 운영에 남는다 → 보안 위험
- 코드 리뷰에서 설정 변경이 묻어간다 → 변경 추적 어려움

설정을 환경별로 분리하면 배포 스크립트가 자동으로 올바른 설정을 선택하므로 사람이 직접 바꿀 일이 없어진다.

## 설정 파일 구조

```
config/
├── TypeDef_common.xml    # 환경 무관 공통 설정
├── TypeDef_dev.xml       # 개발 환경 전용
├── TypeDef_stg.xml       # 스테이징 환경 전용
└── TypeDef_prod.xml      # 운영 환경 전용

scripts/
└── deploy.sh             # 환경 인수받아 설정 선택
```

공통 설정과 환경별 설정을 명확히 구분한다. 폼 경로, 공통 서비스 정의처럼 모든 환경에서 동일한 내용은 `TypeDef_common.xml`에, URL·로그레벨·디버그 플래그처럼 환경마다 다른 값만 각 환경 파일에 둔다.

![환경별 설정 분리 구조](/assets/posts/nexacro-n-env-config-split-structure.svg)

## 공통 설정 파일

```xml
<!-- config/TypeDef_common.xml -->
<TypeDefinition>

  <!-- 폼 정의 — 모든 환경 동일 -->
  <Forms>
    <Form id="frmLogin"  src="app/login.xfdl"/>
    <Form id="frmMain"   src="app/main.xfdl"/>
    <Form id="frmOrder"  src="app/order.xfdl"/>
  </Forms>

  <!-- 리소스 — 모든 환경 동일 -->
  <ResourceInfo>
    <Script id="common"
      src="common/common.js" load="eager"/>
    <Style  id="theme"
      src="app/theme.css"    load="eager"/>
  </ResourceInfo>

  <!-- 서비스 구조 — URL은 변수로 -->
  <ServiceInfo>
    <Service id="SVC"
      url="%SERVER_URL%/nexacro/"
      protocol="NexaProtocol"
      timeout="%SVC_TIMEOUT%"/>
  </ServiceInfo>

</TypeDefinition>
```

## 환경별 설정 파일

```xml
<!-- config/TypeDef_dev.xml -->
<TypeDefinition>
  <Environments>
    <Environment id="dev">
      <Variable id="SERVER_URL"
        value="http://localhost:8080"/>
      <Variable id="SVC_TIMEOUT"  value="60000"/>
      <Variable id="DEBUG_MODE"   value="true"/>
      <Variable id="LOG_LEVEL"    value="DEBUG"/>
      <Variable id="SESSION_TTL"  value="86400"/>
    </Environment>
  </Environments>
</TypeDefinition>
```

```xml
<!-- config/TypeDef_stg.xml -->
<TypeDefinition>
  <Environments>
    <Environment id="stg">
      <Variable id="SERVER_URL"
        value="https://stg-api.example.com"/>
      <Variable id="SVC_TIMEOUT"  value="30000"/>
      <Variable id="DEBUG_MODE"   value="false"/>
      <Variable id="LOG_LEVEL"    value="INFO"/>
      <Variable id="SESSION_TTL"  value="3600"/>
    </Environment>
  </Environments>
</TypeDefinition>
```

```xml
<!-- config/TypeDef_prod.xml -->
<TypeDefinition>
  <Environments>
    <Environment id="prod">
      <Variable id="SERVER_URL"
        value="https://api.example.com"/>
      <Variable id="SVC_TIMEOUT"  value="30000"/>
      <Variable id="DEBUG_MODE"   value="false"/>
      <Variable id="LOG_LEVEL"    value="ERROR"/>
      <Variable id="SESSION_TTL"  value="1800"/>
    </Environment>
  </Environments>
</TypeDefinition>
```

## 배포 스크립트에서 환경 주입

![환경 설정 배포 스크립트](/assets/posts/nexacro-n-env-config-split-code.svg)

배포 시점에 공통 설정과 환경별 설정을 합쳐 단일 TypeDef.xml을 생성한다.

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENV=${1:-dev}   # dev | stg | prod

echo "[DEPLOY] 환경: $ENV"

# 1. 출력 디렉토리 초기화
rm -rf dist && mkdir -p dist

# 2. 공통 설정 복사
cp config/TypeDef_common.xml dist/TypeDef.xml

# 3. 환경별 변수 삽입
python3 scripts/merge-config.py \
  dist/TypeDef.xml \
  "config/TypeDef_${ENV}.xml"

# 4. 비밀값 주입 (환경 변수에서)
sed -i "s|%DB_PASS%|${DB_PASSWORD}|g" dist/TypeDef.xml
sed -i "s|%API_KEY%|${API_SECRET_KEY}|g" dist/TypeDef.xml

echo "[DEPLOY] 설정 병합 완료"

# 5. 빌드
npm run build

# 6. 배포
rsync -av dist/ "${DEPLOY_HOST}:/deploy/${ENV}/"

echo "[DEPLOY] 완료: $ENV"
```

```python
# scripts/merge-config.py
# 두 TypeDef.xml을 병합 (환경별 변수를 공통 설정에 삽입)

import sys
import xml.etree.ElementTree as ET

base_file = sys.argv[1]   # dist/TypeDef.xml (공통)
env_file  = sys.argv[2]   # TypeDef_prod.xml (환경별)

base_tree = ET.parse(base_file)
env_tree  = ET.parse(env_file)

base_root = base_tree.getroot()
env_root  = env_tree.getroot()

# 환경 변수 수집
env_vars = {}
for env in env_root.iter("Variable"):
    env_vars[env.get("id")] = env.get("value")

# 공통 설정의 %VAR% 치환
for elem in base_root.iter():
    for attr, val in elem.attrib.items():
        for k, v in env_vars.items():
            val = val.replace(f"%{k}%", v)
        elem.set(attr, val)

base_tree.write(base_file, encoding="UTF-8", xml_declaration=True)
print(f"[merge] {len(env_vars)}개 변수 치환 완료")
```

## 비밀값 관리

서버 패스워드, API 키, 인증서 같은 비밀값은 설정 파일에 직접 쓰지 않는다. CI/CD 시스템의 Secret 기능(GitHub Actions Secrets, Jenkins Credentials)으로 관리하고, 배포 시점에 환경 변수로 주입한다.

```yaml
# .github/workflows/deploy-prod.yml
- name: Deploy to production
  run: bash scripts/deploy.sh prod
  env:
    DEPLOY_HOST: ${{ secrets.PROD_DEPLOY_HOST }}
    DB_PASSWORD: ${{ secrets.PROD_DB_PASSWORD }}
    API_SECRET_KEY: ${{ secrets.PROD_API_KEY }}
```

비밀값이 설정 파일에 하드코딩되어 있으면 코드 저장소가 노출될 때 함께 유출된다. 환경 변수 주입 방식을 쓰면 저장소에는 `%DB_PASS%` 같은 플레이스홀더만 남는다.

## 환경별 차이 검증

배포 전 환경 설정이 올바른지 자동으로 검증한다.

```javascript
// scripts/validate-config.js
// 배포된 TypeDef.xml에 %VAR% 플레이스홀더가 남아있으면 실패

const fs = require("fs");
const content = fs.readFileSync("dist/TypeDef.xml", "utf8");

const unreplaced = content.match(/%[A-Z_]+%/g);
if (unreplaced && unreplaced.length > 0) {
  console.error("✗ 미치환 변수 발견:", unreplaced);
  process.exit(1);
}

// 운영 배포 시 DEBUG_MODE 확인
if (process.env.ENV === "prod") {
  if (content.includes("DEBUG_MODE\" value=\"true\"")) {
    console.error("✗ 운영 배포에 DEBUG_MODE=true 발견");
    process.exit(1);
  }
}

console.log("✓ 설정 검증 완료");
```

이 스크립트를 배포 파이프라인에 포함시키면 `%SERVER_URL%`이 치환되지 않은 채 배포되는 사고를 막을 수 있다.

## 정리

환경별 설정 분리의 핵심 원칙은 "배포 환경은 코드가 아닌 배포 스크립트가 결정한다"는 것이다. TypeDef.xml을 공통 설정과 환경별 설정으로 나누고, 비밀값은 CI 시스템의 Secret으로 관리하며, 배포 직전 검증 스크립트로 실수를 자동으로 잡는다. 이 구조가 자리를 잡으면 개발자가 URL을 손으로 바꾸는 일이 사라지고, 잘못된 설정이 운영에 들어가는 위험이 크게 줄어든다.

---

**지난 글:** [\[Nexacro N\] 빌드 옵션과 배포 설정](/posts/nexacro-n-build-options/)

**다음 글:** [\[Nexacro N\] 캐시 관리 전략](/posts/nexacro-n-cache-management/)

<br>
읽어주셔서 감사합니다. 😊
