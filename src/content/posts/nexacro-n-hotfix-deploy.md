---
title: "[Nexacro N] 핫픽스 배포 전략"
description: "Nexacro N 프로젝트에서 운영 장애를 최소화하며 핫픽스를 안전하게 배포하는 전략을 설명합니다. 긴급 배포 프로세스, 백업과 롤백 절차, 영향 범위 최소화, 핫픽스 후 검증 절차까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "핫픽스", "긴급배포", "롤백", "운영안정성", "배포전략"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-cache-management/)에서 브라우저 캐시를 효과적으로 제어하는 전략을 살펴보았다. 배포 파이프라인이 아무리 잘 갖춰져 있어도 운영 중 예기치 못한 장애가 발생할 수 있다. 핫픽스 배포는 일반 릴리스와 다르다. 시간이 촉박하고, 충분한 테스트 없이 배포해야 할 수 있으며, 잘못되면 롤백해야 한다. Nexacro N 프로젝트에서 핫픽스를 안전하게 처리하는 프로세스를 만들어 두면 장애 상황에서 침착하게 대응할 수 있다.

## 핫픽스와 일반 배포의 차이

일반 배포는 정해진 릴리스 주기에 따라 충분한 테스트와 검토를 거친다. 핫픽스는 운영 장애를 즉시 해결하기 위해 최소 변경만 가하고 빠르게 배포한다. 이 차이가 프로세스 전체에 영향을 준다.

| 구분 | 일반 배포 | 핫픽스 |
|---|---|---|
| 대상 변경 범위 | 전체 릴리스 | 장애 원인 최소 수정 |
| 테스트 | 전체 회귀 테스트 | 핵심 경로만 검증 |
| 리뷰 | 전체 코드 리뷰 | 긴급 리뷰 (1인) |
| 배포 시간 | 계획된 점검 시간 | 장애 발생 즉시 |
| 승인 | 정식 절차 | 책임자 구두 승인 |

핫픽스에서 가장 중요한 원칙은 **변경 최소화**다. 장애를 일으킨 코드만 수정하고, 관련 없는 개선이나 리팩터링을 함께 포함하지 않는다.

## 핫픽스 배포 프로세스

![핫픽스 배포 프로세스](/assets/posts/nexacro-n-hotfix-deploy-flow.svg)

**Step 1. 결함 확인 및 영향 범위 파악**

장애가 보고되면 가장 먼저 영향 범위를 파악한다:
- 어떤 화면/기능이 영향을 받는가
- 얼마나 많은 사용자가 영향을 받는가
- 데이터 오류(저장, 계산)가 포함되는가

**Step 2. 핫픽스 브랜치 생성**

```bash
# 운영 태그에서 핫픽스 브랜치 생성
git checkout -b hotfix/20260520-login-error v2.3.0

# 최소 변경만 적용
git add src/forms/login.xfdl
git commit -m "fix: 로그인 세션 처리 오류 수정 (#HOT-123)"
```

**Step 3. 긴급 검증**

전체 회귀 테스트가 어렵다면 최소한 다음을 확인한다:
- 장애 재현 시나리오 해결 여부
- 수정 코드와 직접 관련된 기능 정상 동작
- 핵심 비즈니스 경로(로그인, 조회, 저장) 작동 여부

**Step 4. 백업 및 배포**

```bash
# 현재 운영 버전 즉시 백업
BACKUP_DIR="/deploy/backup/$(date +%Y%m%d_%H%M%S)"
cp -r /deploy/prod "$BACKUP_DIR"
echo "백업 위치: $BACKUP_DIR"

# 핫픽스 배포
rsync -av --delete dist/ /deploy/prod/
```

## 핫픽스 배포 스크립트

![핫픽스 배포 체크리스트 스크립트](/assets/posts/nexacro-n-hotfix-deploy-checklist.svg)

프로세스를 스크립트로 자동화해 긴급 상황에서 절차를 빠뜨리지 않도록 한다.

```bash
#!/bin/bash
# scripts/hotfix-deploy.sh

set -e

echo "=== 핫픽스 배포 시작 $(date) ==="

# 1. 현재 운영 버전 즉시 백업
BACKUP_TS=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/deploy/backup/${BACKUP_TS}"
mkdir -p "$BACKUP_DIR"
cp -r /deploy/prod/* "$BACKUP_DIR/"
echo "[1/6] 백업 완료: $BACKUP_DIR"

# 2. 빌드 산출물 확인
if [ ! -f "./dist/TypeDef.xml" ]; then
  echo "ERROR: 빌드 산출물 없음 — 빌드 먼저 실행"
  exit 1
fi
echo "[2/6] 빌드 산출물 확인 OK"

# 3. 설정 파일 검증
node scripts/validate-config.js
echo "[3/6] 설정 검증 OK"

# 4. 스테이징 배포 및 스모크 테스트
rsync -av dist/ stg:/deploy/stg/
sleep 3
if ! curl -sf "http://stg.example.com/health"; then
  echo "ERROR: 스테이징 스모크 테스트 실패"
  exit 1
fi
echo "[4/6] 스테이징 검증 OK"

# 5. 운영 배포
rsync -av --delete dist/ /deploy/prod/
echo "[5/6] 운영 배포 완료"

# 6. 운영 헬스체크
sleep 5
if ! curl -sf "http://app.example.com/health"; then
  echo "ERROR: 운영 헬스체크 실패 — 롤백 시작"
  rsync -av --delete "${BACKUP_DIR}/" /deploy/prod/
  echo "롤백 완료"
  exit 1
fi
echo "[6/6] 운영 헬스체크 OK"

echo "=== 핫픽스 배포 완료 ==="
```

## 롤백 절차

핫픽스가 새로운 문제를 일으키면 즉시 이전 버전으로 롤백한다. 백업이 있으면 롤백은 간단하다.

```bash
# scripts/rollback.sh — 즉시 롤백

# 최근 백업 디렉토리 찾기
LATEST_BACKUP=$(ls -td /deploy/backup/*/ | head -1)
echo "롤백 대상: $LATEST_BACKUP"

# 확인 없이 실행 (긴급 상황)
rsync -av --delete "${LATEST_BACKUP}/" /deploy/prod/

# 헬스체크
sleep 3
curl -sf "http://app.example.com/health" \
  && echo "롤백 성공" \
  || echo "ERROR: 롤백 후에도 문제 있음 — 인프라팀 긴급 호출"
```

롤백 후에는 원인 분석을 재개하고, 수정 방향을 다시 검토한 뒤 재배포한다.

## 핫픽스 후 정리 절차

핫픽스가 성공적으로 배포되면 장기적인 코드 관리를 위해 정리한다.

```bash
# 핫픽스 브랜치를 main과 develop에 머지
git checkout main
git merge hotfix/20260520-login-error
git tag v2.3.1

git checkout develop
git merge hotfix/20260520-login-error

# 핫픽스 브랜치 삭제
git branch -d hotfix/20260520-login-error
git push origin main develop --tags
```

핫픽스 내용을 develop 브랜치에도 머지하지 않으면, 다음 정기 릴리스 때 같은 문제가 다시 발생한다. 배포 후 24시간 안에 반드시 처리한다.

## 핫픽스 사후 검토 (Post-mortem)

핫픽스 배포 후 팀 내 사후 검토를 진행한다. 무너진 것보다 앞으로 같은 문제가 발생하지 않도록 하는 것이 목적이다.

```
핫픽스 사후 검토 (Post-mortem)
HOT-123 / 2026-05-20

## 장애 요약
- 발생: 2026-05-20 10:30
- 감지: 2026-05-20 10:35 (사용자 신고)
- 해결: 2026-05-20 11:10 (40분)

## 영향 범위
- 영향 사용자: 전체 사용자 (로그인 불가)
- 데이터 손실: 없음

## 원인
- 세션 만료 시 재로그인 코드에서 null 참조 오류

## 대응 조치
- 로그인 폼 세션 처리 로직 수정
- 핫픽스 배포 (v2.3.1)

## 재발 방지
- 로그인 시나리오 자동화 테스트 추가
- 세션 처리 단위 테스트 커버리지 강화
```

사후 검토 문서는 Confluence나 팀 위키에 저장해 유사 장애 발생 시 참조한다.

## 정리

핫픽스 배포는 준비되어 있을 때 안전하고, 준비 없이 임기응변으로 하면 위험하다. 백업 자동화, 롤백 스크립트, 스테이징 경유 배포, 헬스체크를 기본 프로세스로 갖춰 두면 장애 상황에서 실수를 줄이고 빠르게 복구할 수 있다. 핫픽스는 해결로 끝내지 않고 사후 검토와 재발 방지 조치까지 완료해야 진짜 마무리다.

---

**지난 글:** [\[Nexacro N\] 캐시 관리 전략](/posts/nexacro-n-cache-management/)

**다음 글:** [\[Nexacro N\] Nexacro 14에서 Platform으로 마이그레이션](/posts/nexacro-n-migration-14-to-platform/)

<br>
읽어주셔서 감사합니다. 😊
