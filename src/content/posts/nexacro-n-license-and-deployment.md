---
title: "[Nexacro N] 라이선스 체계와 배포 방식 완전 해설"
description: "Nexacro N 개발·운영 라이선스 종류(Named/Concurrent/Server), 활성화 방법, 세 가지 배포 패턴(웹 서버·HiApp·전자정부)을 실무 관점에서 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "라이선스", "배포", "hiapp", "전자정부"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-runtime-html5/)에서 Nexacro N이 HTML5 Canvas 기반으로 어떻게 동작하는지, 그 런타임 구조와 초기화 시퀀스를 살펴봤습니다. 이번에는 실제 프로젝트 도입을 결정할 때 반드시 파악해야 하는 두 가지 실무 주제를 다룹니다. 하나는 **라이선스 체계**이고, 다른 하나는 **배포 방식**입니다. 이 두 가지를 잘못 이해하면 예산 오산이나 납품 지연으로 이어질 수 있기 때문에, 개발자와 PM 모두 짚어 두는 것이 좋습니다.

## 라이선스 구조 개요

Nexacro N의 라이선스는 **개발 라이선스**와 **운영(배포) 라이선스** 두 축으로 나뉩니다. 이 구분이 가장 중요한 이유는, 개발 라이선스로는 운영 환경에 배포할 수 없기 때문입니다.

![Nexacro N 라이선스 구조](/assets/posts/nexacro-n-license-and-deployment-types.svg)

### 개발 라이선스 — Nexacro Studio N

Nexacro Studio N을 사용해 화면을 개발하고 Test Run으로 미리보기하려면 Studio N 라이선스가 필요합니다. 이 라이선스는 **개발자 1인당 1개**가 필요한 Named 방식입니다. 팀원 5명이 개발하면 5개의 Studio N 라이선스가 필요하다는 뜻입니다.

Studio N 라이선스에는 개발용 런타임이 포함되어 있어, 로컬 PC에서 브라우저를 열지 않아도 IDE 내부에서 바로 Test Run이 가능합니다. 단, 이 런타임은 개발 전용이며 운영 서버에 올리는 빌드 산출물과는 다릅니다.

### 운영 라이선스 — 세 가지 선택지

운영 환경에 배포할 때는 별도의 운영 라이선스를 구매해야 합니다. 세 가지 유형 중 프로젝트 성격에 맞는 것을 선택합니다.

**Named User License**는 서비스에 접속하는 계정(ID) 수를 기준으로 과금합니다. 사내 업무 시스템처럼 사용자가 고정되어 있고 계정을 명확히 관리할 수 있는 환경에 적합합니다. 예를 들어 임직원 300명이 사용하는 ERP라면 Named 300 라이선스를 구매합니다.

**Concurrent User License**는 동시 접속자 수를 기준으로 과금합니다. 공공기관 포털이나 대국민 서비스처럼 사용자가 불특정 다수이거나 전체 계정 수보다 동시 접속자가 훨씬 적은 환경에 유리합니다. 실사용 패턴을 분석해서 최대 동시 접속자를 산정하면 총 비용이 Named보다 낮아질 수 있습니다.

**Server License**는 서버 대수 기준으로 과금하는 특수 구성 방식입니다. 클라우드나 컨테이너 기반으로 오토스케일링이 필요한 환경이라면 투비소프트 영업팀과 별도 협의가 필요합니다.

### 라이선스 활성화

Studio N을 처음 설치하면 활성화 단계가 있습니다. 인터넷이 연결된 환경에서는 투비소프트 고객 포털 계정으로 **온라인 활성화**가 가능합니다. 폐쇄망 환경이라면 **오프라인 활성화** 방식을 사용합니다. 해당 PC의 머신 코드를 고객 포털에 등록하면 키 파일이 발급되고, 그 파일을 Studio N에 입력하면 활성화가 완료됩니다.

```text
[온라인 활성화]
Studio N 실행 → 라이선스 활성화 → 포털 계정 로그인 → 완료

[오프라인 활성화]
Studio N 실행 → 머신 코드 복사 → 포털 등록 → 키 파일 다운로드 → Studio N에 입력 → 완료
```

운영 라이선스 활성화 방식은 배포 형태에 따라 다르므로 반드시 투비소프트 기술지원팀에 확인하는 것이 좋습니다.

## 세 가지 배포 방식

Nexacro N 프로젝트를 빌드하면 `dist/` 폴더 아래에 정적 파일 묶음이 생성됩니다. 이 파일들을 어디에, 어떻게 배포하느냐에 따라 세 가지 경로가 있습니다.

![Nexacro N 배포 방식 비교](/assets/posts/nexacro-n-license-and-deployment-deploy.svg)

### 1. 웹 서버 배포 — 가장 일반적

가장 흔한 방식입니다. `dist/` 폴더 전체를 Apache, Nginx, IIS 같은 웹 서버의 루트 디렉터리에 복사하면 됩니다. HTML, JS, XML 파일이 정적으로 서빙되므로 별도의 서버 사이드 처리가 없습니다.

```bash
# Nginx 예시 — dist/ 내용을 서버 루트에 복사
cp -r dist/* /var/www/html/nexacro-app/

# nginx.conf 핵심 설정
server {
    root /var/www/html/nexacro-app;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

주의할 점이 하나 있습니다. `service.xml` 파일에는 서버 통신 URL이 기재되어 있는데, 개발·스테이징·운영 환경별로 URL이 다릅니다. 빌드 전에 환경별 `service.xml`을 준비해 두거나, 배포 스크립트에서 URL을 치환하는 절차가 필요합니다. 이 부분을 놓치면 운영 환경에서 개발 서버로 요청이 가는 상황이 발생합니다.

### 2. HiApp — 모바일·데스크톱 앱 래핑

HiApp은 투비소프트가 제공하는 하이브리드 앱 빌드 도구입니다. 웹 배포 방식과 동일한 `dist/` 파일을 HiApp 래핑 도구에 입력하면 iOS, Android, Windows 실행 파일로 패키징합니다. 앱 스토어에 등록하거나 MDM(모바일 기기 관리)을 통해 사내 배포할 수 있습니다.

HiApp의 핵심 장점은 **오프라인 지원**입니다. 앱 내부에 Nexacro N 런타임과 폼 파일이 번들되어 있어 인터넷 연결 없이도 화면을 로드할 수 있습니다. 서버 통신이 필요한 Transaction은 온라인 상태일 때만 동작하지만, 기본 UI 구동은 오프라인에서도 가능합니다.

### 3. 전자정부 표준프레임워크 통합

공공기관 프로젝트에서 Nexacro N은 대부분 전자정부 표준프레임워크(eGovFramework)와 함께 사용됩니다. 프런트엔드는 Nexacro N, 백엔드는 eGov + Spring Boot 조합이 일반적입니다.

이 경우 `dist/` 파일은 웹 서버(또는 WAS 내 정적 리소스)에 배포하고, 서버 통신은 Nexacro N의 Transaction이 eGov 컨트롤러에 HTTP 요청을 보내는 구조로 구성합니다. PL Protocol(Nexacro 전용 데이터 포맷) 파싱을 위한 서버 어댑터 설정이 추가로 필요하며, 이 내용은 Nexacro 어댑터 편에서 자세히 다룰 예정입니다.

```java
// eGov + Nexacro N 컨트롤러 패턴 (서버 어댑터 사용 시)
@Controller
public class SampleController {

    @RequestMapping("/sample/getSampleList.do")
    public String getSampleList(
            HttpPlatformRequest xplatformRequest,
            HttpPlatformResponse xplatformResponse) {
        // Nexacro N PL Protocol로 Dataset 수신/송신
        DataSetList inDl  = xplatformRequest.getDataSetList();
        DataSetList outDl = xplatformResponse.getDataSetList();

        DataSet dsOut = outDl.get("dsSampleList");
        // ... 비즈니스 로직 ...
        return "nexacroResponse";
    }
}
```

## 라이선스 선택 시 체크리스트

현장에서 라이선스 선정 실수를 줄이기 위한 간단한 체크리스트입니다.

1. **사용자 수 vs. 동시 접속자 비율** — 전체 사용자 대비 동시 접속 비율이 10% 미만이라면 Concurrent가 경제적일 수 있습니다.
2. **개발 인원** — Studio N 라이선스는 개발자 수만큼 필요합니다. 협력 업체 개발자 인원도 포함해야 합니다.
3. **환경 수** — 개발/스테이징/운영 환경이 분리되어 있다면 운영 라이선스가 각 환경에 필요한지 여부를 확인합니다.
4. **폐쇄망 여부** — 인터넷 단절 환경이라면 오프라인 활성화 절차를 미리 확인해 두어야 합니다.
5. **공공기관 단가 계약** — 나라장터 MAS 납품 품목에 포함된 경우 별도 가격 체계가 적용될 수 있습니다.

이 체크리스트는 영업 문의 전에 내부 정리용으로 활용하고, 최종 결정은 투비소프트 공식 채널을 통해 확인하는 것을 권장합니다.

---

**지난 글:** [Nexacro N HTML5 런타임 동작 원리](/posts/nexacro-n-runtime-html5/)

**다음 글:** [Nexacro Studio N 설치와 환경 구성](/posts/nexacro-n-studio-install/)

<br>
읽어주셔서 감사합니다. 😊
