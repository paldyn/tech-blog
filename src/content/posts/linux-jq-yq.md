---
title: "jq · yq — JSON/YAML 커맨드라인 처리"
description: "jq로 JSON 데이터를 필터링·변환하고, yq로 YAML/Kubernetes 설정 파일을 조작하는 방법을 필터 문법부터 실전 패턴까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["jq", "yq", "JSON", "YAML", "Linux", "쉘", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/linux-comm-cmp/)에서 comm과 cmp로 파일을 비교하는 방법을 살펴봤습니다. 이번 글에서는 현대 인프라에서 필수인 두 도구를 다룹니다. `jq`는 JSON을 파싱·변환하는 커맨드라인 프로세서이고, `yq`는 같은 개념을 YAML에 적용한 도구입니다. API 응답 처리, Kubernetes 매니페스트 수정, CI/CD 파이프라인 자동화에 광범위하게 쓰입니다.

![jq · yq 필터 체계 다이어그램](/assets/posts/linux-jq-yq-overview.svg)

## jq — JSON 프로세서

### 설치

```bash
# Debian/Ubuntu
sudo apt install jq

# RHEL/Fedora
sudo dnf install jq

# macOS
brew install jq
```

### 기본 문법

jq는 파이프(`|`)로 이어지는 필터 체인입니다. `.`은 입력 전체를 그대로 통과시킵니다.

```bash
# JSON 예쁘게 출력 (pretty-print)
curl -s https://api.example.com/users | jq .

# 단일 필드 추출
echo '{"name":"Alice","age":30}' | jq '.name'
# → "Alice"

# 중첩 필드
jq '.user.profile.email' response.json

# 배열 인덱스
jq '.[0]' items.json
jq '.[-1]' items.json    # 마지막 요소
jq '.[2:5]' items.json   # 슬라이스
```

### 배열 이터레이션: .[]

`.[]`는 배열의 각 요소를 독립적인 출력으로 풀어냅니다.

```bash
# 배열의 모든 name 필드
jq '.[].name' users.json

# 파이프 형식
jq '.[] | .name' users.json
```

### select: 조건 필터

```bash
# age가 30 초과인 사용자
jq '[.[] | select(.age > 30)]' users.json

# 특정 키 존재 여부
jq '[.[] | select(.email != null)]' users.json

# 문자열 포함 여부
jq '[.[] | select(.name | test("^A"))]' users.json
```

`select()`는 조건이 거짓이면 해당 항목을 버립니다. `[...]`로 감싸면 다시 배열로 모읍니다.

### map: 배열 변환

```bash
# 모든 name을 대문자로
jq '[.[] | .name | ascii_upcase]' users.json
# 위와 동일:
jq 'map(.name | ascii_upcase)' users.json

# 특정 필드만 추출해 새 배열 만들기
jq 'map({id: .id, name: .name})' users.json
```

### 문자열 보간

```bash
# 문자열 내 필드 삽입
jq -r '.[] | "\(.name) (\(.age))"' users.json
# → Alice (30)
# → Bob (25)
```

`-r`(raw) 옵션은 문자열 출력 시 따옴표를 제거합니다. 쉘 변수 할당이나 추가 처리에 필요합니다.

### 변수와 조건

```bash
# --arg로 쉘 변수 전달
name="Alice"
jq --arg n "$name" '.[] | select(.name == $n)' users.json

# --argjson으로 숫자/불리언
jq --argjson min 25 '.[] | select(.age >= $min)' users.json

# if-then-else
jq '.[] | if .age >= 18 then "adult" else "minor" end' users.json
```

### 집계 함수

```bash
# 길이
jq '.items | length' response.json

# 합산
jq '[.[] | .price] | add' items.json

# 최대/최소
jq '[.[] | .score] | max' scores.json

# 부서별 급여 합계
jq 'group_by(.dept)[] | {dept: .[0].dept, total: map(.salary) | add}' employees.json
```

### 유용한 옵션

```bash
# -c: compact (한 줄 출력)
jq -c '.' data.json

# -e: null/false 출력 시 종료 코드 1 (스크립트 조건 처리)
jq -e '.status == "ok"' response.json && echo "성공"

# 파일에 저장
jq '.' input.json > output.json
```

![jq · yq 실전 코드 패턴](/assets/posts/linux-jq-yq-code.svg)

---

## yq — YAML 프로세서

`yq`는 `mikefarah/yq`(Go 구현)와 `kislyuk/yq`(Python, jq 래퍼) 두 버전이 있습니다. 이 글에서는 Kubernetes 생태계에서 더 많이 쓰이는 mikefarah/yq를 기준으로 합니다.

```bash
# 설치
brew install yq        # macOS
wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
chmod +x /usr/local/bin/yq
```

### 기본 사용법

```bash
# 전체 출력
yq '.' config.yaml

# 필드 읽기
yq '.metadata.name' pod.yaml

# 중첩 배열 접근
yq '.spec.containers[0].image' deployment.yaml
```

### 값 변경: = 연산자

```bash
# 복제본에 출력 (원본 보존)
yq '.spec.replicas = 5' deployment.yaml

# 인플레이스 수정 (-i)
yq -i '.spec.replicas = 5' deployment.yaml

# 환경 변수 사용
yq -i ".spec.containers[0].image = \"${IMAGE_TAG}\"" deployment.yaml
```

### 형식 변환

```bash
# YAML → JSON
yq -o json '.' config.yaml

# JSON → YAML
yq -P '.' data.json

# 여러 YAML 문서(-d all)의 kind 목록
yq '.kind' all.yaml    # 멀티독 자동 처리
```

### Kubernetes 매니페스트 처리

```bash
# 특정 종류의 리소스만 선택
yq 'select(.kind == "Deployment")' all.yaml

# 모든 Deployment 이미지 목록
yq '.spec.template.spec.containers[].image' deployment.yaml

# 레이블 추가
yq -i '.metadata.labels.env = "prod"' deployment.yaml
```

### 여러 파일 병합

```bash
# 기본 설정 + 오버라이드 병합
yq eval-all '. as $item ireduce ({}; . *+ $item)' base.yaml override.yaml
```

## 실전 파이프라인 조합

```bash
# API 응답에서 특정 조건 충족하는 항목의 ID 목록
curl -s https://api.example.com/items \
  | jq -r '[.[] | select(.status == "active")] | .[].id'

# kubectl 출력을 jq로 파싱
kubectl get pods -o json | jq '.items[] | {name: .metadata.name, phase: .status.phase}'

# yq로 이미지 태그 일괄 업데이트
for f in k8s/*.yaml; do
  yq -i ".spec.template.spec.containers[0].image = \"${NEW_IMAGE}\"" "$f"
done
```

## 정리

| 도구 | 대상 | 핵심 패턴 |
|------|------|-----------|
| `jq '.'` | JSON | pretty-print |
| `jq '.field'` | JSON | 필드 추출 |
| `jq 'select()'` | JSON | 조건 필터 |
| `jq 'map()'` | JSON | 배열 변환 |
| `yq '.field'` | YAML | 필드 읽기 |
| `yq -i '.field = val'` | YAML | 인플레이스 수정 |

---

**지난 글:** [comm · cmp — 파일 집합 연산과 바이너리 비교](/posts/linux-comm-cmp/)

**다음 글:** [SSH 키 쌍 생성과 관리](/posts/linux-ssh-key-pair/)

<br>
읽어주셔서 감사합니다. 😊
