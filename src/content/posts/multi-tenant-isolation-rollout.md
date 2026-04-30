---
title: "PROJECT_CODE 한 컬럼의 무게 — Mebrix 멀티테넌시 도입기"
description: "단일 프로젝트 모델로 운영하던 6개 레포에 멀티 프로젝트 격리를 도입한 회고. 한 컬럼이 4개 API · 38개 SQL · Hibernate @Filter · composite PK · JWT claim · frontend 스위처까지 어떻게 번지는지."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 1
type: "record"
category: "Backend"
tags: ["multi-tenancy", "spring-boot", "mybatis", "hibernate", "jwt", "migration"]
featured: true
draft: false
---

처음에는 컬럼 하나 추가하면 끝나는 일이라 생각했다. `ALTER TABLE ... ADD
COLUMN project_code` 한 줄이면 데이터를 가를 수 있다고. 결과적으로 그
한 줄은 4개 백엔드 API 와 1개 프론트, 그리고 운영 환경의 마이그레이션
순서와 JWT 토큰 형식까지 손보게 만들었다.

---

## 상황 / 배경

- Mebrix 는 한 서버 = 한 사이트 모델로 출발한 self-hosted 데이터 모델링
  플랫폼. 한 서버 안에 데이터 사전 / ERD / DB 워크벤치 모듈이 같이 돈다
- 6개 레포: `mb-client` (React + Electron) / `mb-auth-api` /
  `mb-dict-api` / `mb-erd-api` / `mb-dbwb-api` / `mb-release-orchestrator`
- 4개 백엔드 API 는 별도 PostgreSQL DB 로 분리 (`auth`, `dict`, `erd`, `db`).
  cross-DB FK 안 걸음
- `auth-api` 에 `auth_projects` 테이블이 V6 부터 있었지만, 실제로는
  부트스트랩 1 row 만 들어 있는 채로 코드에서 거의 안 썼음. "단일 서버
  = 단일 프로젝트" 모델

요구사항 자체는 명확했다. **한 사용자가 두 개 이상의 프로젝트 (예: 두
회사의 데이터 모델) 를 같은 시스템에서 따로따로 관리할 수 있어야 한다**.
사용자별로 어떤 프로젝트를 볼 수 있는지 admin 이 통제할 수 있어야 한다.

---

## 무엇이 문제였나

먼저 현재 상태부터 정리했다.

```text
auth-api
  - auth_projects (1 row only, 부트스트랩)
  - auth_user_projects (테이블만 존재, code 미사용)
  - role: USER / ADMIN / SUPER_ADMIN — 단순 3단

dict-api
  - 6개 도메인 테이블 (STD_DIC / STD_DOM / STD_DOM_GRP / ...)
  - MyBatis XML mapper 4개 (PG 2 + SQLite mirror 2)
  - 약 38개 쿼리

erd-api
  - 9개 도메인 테이블 (erd_project / erd_diagram / erd_table / ...)
  - JPA + Spring Data JPA repository
  - 별도 erd_project / erd_project_member 테이블 (이건 ERD 작업 단위)

dbwb-api
  - 2개 테이블 (db_saved_connection_state / db_saved_sql_file_state)
  - JPA, PK 가 user_id 단독
```

3 + 1 + 2 가지 다른 패턴 (MyBatis / JPA / composite PK 후보) 이 한 프로젝트
안에 같이 살고 있다.

처음에 자연스럽게 떠오른 첫 옵션은 **단순한 admin UI 만 정교화** 하는 것
이었다. 사용자별 active/disable 강화, role 관리 UI 정도. 하지만 그건
멀티 프로젝트 모델을 도입하지 않는 안이고 — 결국 다음 분기에 또 같은
이야기가 나올 수밖에 없다.

진짜 옵션 비교는 이렇게 정리됐다.

```
A. 단일 프로젝트 + 사용자 active/disable 강화
   → 멀티 프로젝트 안 함. 1 PR 분량.
   → 멀티 운영 시작하면 되돌리기 힘듦.

B. 멀티 프로젝트 + 진짜 데이터 격리
   → 모든 도메인 테이블에 project_code, 모든 쿼리에 WHERE.
   → 4개 API + frontend, 며칠 분량.

C. 멀티 프로젝트 "메뉴 그룹" 만 (격리 없음)
   → 사용자 메뉴는 필터되지만 데이터는 공용.
   → 보안 약함. motivated attacker 가 헤더 위조 시 우회 가능.
```

A 는 보수적, C 는 위험. **B 를 골랐다**. 그리고 그 결정이 한 줄이 아니라
세 단계 (Phase) 의 작업이 필요하다는 사실을 받아들이는 데서 진짜
설계가 시작됐다.

---

## 어떻게 해결했나

### 단계 분할

한 PR 로는 못 끝낸다. 단계별로 나눠 머지해야 한다.

![멀티테넌시 도입 — 3단계 Phase 로드맵](/assets/posts/multi-tenant-phase-roadmap.svg)

```
Phase 1 — auth-api 만:
  · project CRUD + 멤버 grant API
  · /auth/projects 가 사용자가 grant 받은 활성 프로젝트만 반환
  · AuthAdmin UI 에 "프로젝트 관리" 탭

Phase 2 — 백엔드 데이터 격리:
  2.1 auth-api JWT 에 grants claim 추가
  2.2 dict-api 격리 (MyBatis)
  2.3 erd-api 격리 (Hibernate)
  2.4 dbwb-api 격리 (composite PK)

Phase 3 — frontend:
  · axios 인터셉터가 X-Mebrix-Project 헤더 자동 첨부
  · SideBar 의 프로젝트 스위처 드롭다운
```

각 단계는 독립적으로 배포 가능해야 한다. Phase 2 가 운영에 들어가도
Phase 3 (프론트) 가 미배포면 헤더 없이 호출이 오는데, 이때
**default `mebrix` fallback** 으로 단일 프로젝트 환경에서는 이전과
완전히 동일하게 작동하도록 만들었다. 이게 backward compat 의 핵심
설계.

### Phase 1 — auth 에서 grants 모델 활성화

V6 에서 만들어 두고 안 쓰던 `auth_user_projects` 를 본격 활용했다.
Hibernate `BaseEntity` 호환을 위해 audit 컬럼을 V18 로 추가하고,
기존 ACTIVE 사용자 → 활성 프로젝트 전체에 자동 grant 백필 했다.
단일 프로젝트 운영 중이던 곳은 이 backfill 후에도 변화 0.

권한 레이아웃은 단순하게:

- **SUPER_ADMIN** — 프로젝트 라이프사이클 (생성/수정/비활성화) 독점.
  멤버 grant 도 무관하게 모든 프로젝트 접근.
- **ADMIN** — 본인이 멤버인 프로젝트 안에서 다른 사용자 grant 가능.
  프로젝트 생성/삭제는 ✗.
- **/auth/projects** 호출 시 SUPER_ADMIN 은 모든 활성 프로젝트, 일반
  사용자는 본인이 grant 받은 활성 프로젝트만 응답.

`AdminProjectService` 에서 핵심은 마지막 활성 프로젝트 보호:

```java
private boolean isLastEnabledProject(AuthProjectEntity project) {
    if (!project.isEnabled()) return false;
    long enabledCount = projectRepository.findAllByEnabledTrueOrderByIdAsc().size();
    return enabledCount <= 1;
}
```

운영자가 실수로 마지막 프로젝트를 비활성화해 자기 자신을 시스템 밖으로
가두는 일을 막는다.

### Phase 2.1 — JWT 에 grants claim

dict / erd / dbwb 가 매 요청마다 auth-api 에 다시 물어보는 건 latency
× 2 라 비효율. 대신 access token 발급 시 사용자의 grants 를 JWT 에
박아 보낸다.

```java
JwtClaimsSet claims = JwtClaimsSet.builder()
    ...
    .claim("roles", roles)
    .claim("projects", grants.codes())                  // List<String>
    .claim("project_access", grants.access())           // Map<code, READ|WRITE>
    .build();
```

trade-off 가 명확하다. **grant 변경이 access token TTL (기본 15분) 만큼
지연 반영**된다. 즉시 회수가 필요하면 시스템 설정에서 TTL 줄이거나
사용자 강제 로그아웃 (refresh token revoke).

dict-api 의 `JwtClaimAuthenticationConverter` 가 이 두 claim 을 읽어
`PROJECT_<code>` / `PROJECT_<code>_<level>` Spring Security authority 로
변환한다. 이 변환기가 우연히도 Phase 1 시작 전부터 코드에 준비되어
있었지만 발급이 안 돼 작동 안 하던 자리를 — 이제 실제로 채우는 셈이다.

### Phase 2.2 — dict-api: MyBatis 의 정직한 작업

JPA 의 `@Filter` 같은 자동 격리가 없다. **38개 쿼리를 일일이 수정**한다.
모든 SELECT 의 WHERE 절에 `AND PROJECT_CODE = #{PROJECT_CODE}`, 모든
INSERT 의 컬럼/values 에 `PROJECT_CODE`, JOIN 의 ON 절에도 양쪽 PROJECT_CODE
일치 조건. 빠뜨리면 곧바로 데이터 누수.

```xml
<select id="findByDomNm" resultType="com.paldyn.mbdict.domain.StdDom">
    SELECT ...
      FROM STD_DOM A
      LEFT JOIN DA_CODE B
        ON B.PROJECT_CODE = A.PROJECT_CODE   <!-- JOIN 도 격리 -->
       AND B.UP_CD_ID = '6022'
       AND A.DOM_TYPE_CD = B.CD_ID
     WHERE A.PROJECT_CODE = #{PROJECT_CODE}
       <if test="DOM_NM != null and DOM_NM != ''">
            AND A.DOM_NM LIKE '%' || #{DOM_NM} || '%'
       </if>
       AND TO_CHAR(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYYMMDDHH24MISS')
           BETWEEN A.AVAL_ST_DT AND A.AVAL_END_DT
     ORDER BY A.DOM_NM
</select>
```

`ProjectContextHolder` (ThreadLocal) 가 요청 단위 project_code 를 보관
한다. `ProjectAuthorizationFilter` 가 X-Mebrix-Project 헤더에서 코드를
추출하고, JWT 의 `PROJECT_<code>` authority 와 매칭 — SUPER_ADMIN 또는
grant 보유자만 통과한 후 set, 응답 종료 시 clear. 서비스 레이어가
`ProjectContextHolder.get()` 으로 가져와 mapper 에 인자로 전달한다.

### Phase 2.3 — erd-api: Hibernate 의 선언적 격리

JPA 기반이라 똑같이 명시적으로 가면 9개 entity × 수십 개 repository
메서드를 다 손봐야 한다. 대신 **Hibernate `@Filter`** 한 번에:

```java
@MappedSuperclass
@FilterDef(name = "projectFilter",
           parameters = @ParamDef(name = "projectCode", type = String.class))
@Filter(name = "projectFilter", condition = "project_code = :projectCode")
@EntityListeners(ProjectCodeAutoFill.class)
public abstract class BaseAuditEntity {
    @Column(name = "project_code", nullable = false, length = 100)
    private String projectCode;
    ...
}
```

`BaseAuditEntity` 를 상속하는 4개 entity 는 자동 적용. 안 쓰는 5개
entity 에는 직접 `@Filter` 어노테이션을 걸었다.

요청 단위로 filter 를 활성화하는 건 service AOP 로 처리:

```java
@Aspect @Component
public class ProjectFilterAspect {
    @PersistenceContext private EntityManager entityManager;

    @Before("execution(* com.paldyn.mberd..service..*(..))")
    public void enableProjectFilter(JoinPoint jp) {
        String code = ProjectContextHolder.getOrNull();
        if (code == null) return;
        Session session = entityManager.unwrap(Session.class);
        if (session.getEnabledFilter("projectFilter") == null) {
            session.enableFilter("projectFilter").setParameter("projectCode", code);
        }
    }
}
```

INSERT 시점은 `ProjectCodeAutoFill` listener 가 `@PrePersist` 에서
projectCode 자동 충전. service 가 깜빡 잊어도 안전망.

### Phase 2.4 — dbwb-api: composite PK 라는 구조 변경

dict / erd 와 다르게 dbwb 의 두 테이블은 **PK 자체가 user_id 단독**.
멀티 프로젝트 운영 시 같은 사용자가 두 프로젝트에서 별도 connection
state 를 가져야 하니 PK 를 `(project_code, user_id)` 로 확장해야 한다.

```sql
ALTER TABLE db_saved_connection_state ADD COLUMN project_code ...;
ALTER TABLE db_saved_connection_state DROP CONSTRAINT db_saved_connection_state_pkey;
ALTER TABLE db_saved_connection_state ADD PRIMARY KEY (project_code, user_id);
```

JPA 에선 `@IdClass(UserProjectKey.class)` 로 표현. repository 의
ID 타입도 String → UserProjectKey 로 바뀌고, service 에서
`repository.findById(new UserProjectKey(currentProject, userId))` 패턴으로 호출.

```
4 API × 4가지 격리 패턴
─────────────────────────
auth-api    → JWT claim (grant 정보 자체)
dict-api    → MyBatis 명시 (38 쿼리 손작업)
erd-api     → Hibernate @Filter (선언, AOP 자동 활성화)
dbwb-api    → composite PK 구조 변경
```

같은 문제 — 데이터 격리 — 에 4가지 답이 있다. 어느 쪽도 만능 아니고,
원래 시스템의 모양이 답을 정한다.

![같은 격리 문제, 4가지 답 — MyBatis / Hibernate @Filter / composite PK / JWT claim](/assets/posts/multi-tenant-isolation-patterns.svg)

### Phase 3 — frontend

axios 인터셉터에 한 줄.

```js
const projectHeader = () => {
  const code = uds.getState().projectCode;
  return code ? { "X-Mebrix-Project": code } : {};
};

// 3개 axios 인스턴스의 request interceptor 에서
Object.assign(config.headers, projectHeader());
```

`projectCode` 미설정 시 헤더 안 보냄 → 백엔드 default `mebrix` fallback.
SideBar 상단에 `ProjectSwitcher` 드롭다운을 넣어 본인이 grant 받은
프로젝트만 목록에 보여주고, 선택 시 store 갱신 + 페이지 reload (진행
중인 데이터 캐시 한 번에 무효화).

---

## 결과

| 항목 | 이전 | 이후 |
|---|---|---|
| 데이터 격리 단위 | 한 서버 = 한 프로젝트 | 한 서버 = N 프로젝트 |
| auth_user_projects 활용 | 미사용 (테이블만 존재) | 본격 사용 |
| 도메인 테이블의 project_code | 0 / 17 | 17 / 17 |
| MyBatis 쿼리 격리 | - | 38 쿼리 |
| Hibernate @Filter 적용 entity | - | 9 / 9 |
| 새 통합 테스트 (격리 시나리오) | - | 12 + 4 + 3 |
| 단일 프로젝트 운영 환경 영향 | - | **변화 없음** (default fallback) |

**검증** — 4개 API 띄우고 단일 프로젝트 운영자 입장에서 데이터사전/ERD/
DB 워크벤치 평소처럼 사용. 헤더 없이 모든 API 호출이 default 'mebrix'
로 자동 처리. 신규 INSERT 도 `project_code='mebrix'` 로 들어감. 기존
사용자 입장에서 변화 없음.

curl 로 멀티 프로젝트 시나리오:

```bash
# alpha 프로젝트로 도메인 추가
curl -X POST -H "X-Mebrix-Project: alpha" ... /api/v1/stddom/insertdom

# mebrix 헤더로 검색 → alpha 도메인 안 보임
curl -H "X-Mebrix-Project: mebrix" ... /api/v1/stddom/search
# 빈 배열

# grant 없는 프로젝트 → 403
curl -H "X-Mebrix-Project: nonexistent" ...
# {"code":"PROJECT_403","message":"이 프로젝트에 접근 권한이 없습니다."}
```

---

## 운영 검증에서 발견된 갭들

도입 검증을 지나가면서 세 가지 작은 사고 / 갭이 드러났다. 본 작업 자체
가 깨진 건 아니지만, "테스트는 다 통과했는데 운영에선 막히는" 종류의
문제들.

1. **CORS preflight 의 allowedHeaders 누락**
   ```
   Request header field x-mebrix-project is not allowed by
   Access-Control-Allow-Headers in preflight response
   ```
   4개 API 모두 SecurityConfig 의 CorsConfiguration 에 `X-Mebrix-Project`
   추가 누락. 통합 테스트는 CORS 검사 안 하고 통과.

2. **V13 마이그레이션의 부분 적용**
   첫 시도가 어딘가에서 실패한 후 재실행 시 `column "project_code" of
   relation "erd_relation" already exists` 에러로 무한 실패. 9개 ALTER
   중 일부가 commit 된 채 멈춘 상태였다. 모든 ALTER 에 `IF NOT EXISTS`
   추가해 idempotent 하게 만들어 해결. (이 사건은 별도 글로 정리)

3. **stale JWT 의 자동 logout 누락**
   V17 마이그레이션이 모든 refresh token 을 revoke 한 시점 + JWT claim
   변경 후, 옛 세션을 가진 사용자가 dict-api 호출 시 401 만 받고 자동
   로그인 페이지 이동이 안 됐다. `resetAuthState` 가 zustand store reset
   만 하고 sessionStorage 키 명시 삭제 안 하던 것 + axios interceptor 의
   retry 후 다시 401 시 redirect 누락 두 군데 fix.

세 갭 모두 통합 테스트가 잡지 못하는 영역이었고, 손으로 운영 흐름을
한 번 따라가본 후에야 드러났다. 이런 검증은 사람이 한 번 해보는 것
외에는 잡을 방법이 없다.

---

## 앞으로 어떻게 할 것인가

- **Phase 별 backward compat 의 default 값** 은 다음 멀티테넌시 작업
  에서도 그대로 가져갈 패턴. 새 컬럼 / 새 헤더는 항상 "옛날 클라이언트
  가 안 보내도 동작하는" 기본값 fallback 을 가져야 단계 배포 가능.
- **JWT claim 형식 변경 시 운영 배포 가이드** 추가 — V17 처럼 refresh
  token revoke 가 따라오면 모든 사용자가 강제 재로그인. 다음 release
  catalog 에 명시.
- **dict-api 의 MyBatis 격리 검증** 은 통합 테스트로 핵심 시나리오만
  덮었지만, 운영에서 새 쿼리 추가 시 `PROJECT_CODE` 필터 누락이 발생
  할 수 있음. PR 리뷰 체크리스트에 추가하고, 향후 시간 나면
  MyBatis interceptor 로 자동 검증 도구를 도입하거나 native query
  scan linter 를 만드는 것도 고려.
- **데이터 격리 enforcement 의 access_level (READ/WRITE) 분리**는
  현재 application 레벨에서 enforcement 가 없다. SUPER_ADMIN 우회만
  검증되고, READ 권한자가 mutation 호출했을 때 백엔드가 거부하는 로직
  은 다음 todo 로 남겨둠.

---

## 회고 한 줄

> 한 컬럼을 추가하는 일이 진짜로 한 컬럼에서 끝나는 건 거의 없다.
> 테이블, 쿼리, JOIN, PK, JWT, 헤더, axios, 캐시 무효화까지 — 격리는
> 데이터 모델의 결정이 아니라 시스템의 architecture 결정이다.

<br>
읽어주셔서 감사합니다. 😊
