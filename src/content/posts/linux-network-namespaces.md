---
title: "네트워크 네임스페이스 — 격리된 네트워크 스택"
description: "리눅스 네트워크 네임스페이스의 격리 원리, ip netns 명령어, veth pair로 네임스페이스 연결, 컨테이너 네트워킹 기초를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "network-namespace", "netns", "veth", "ip", "container", "docker", "network", "isolation"]
featured: false
draft: false
---

[지난 글](/posts/linux-hosts-file/)에서 `/etc/hosts`로 이름 해석을 제어하는 방법을 살펴봤습니다. 이번에는 Docker, Kubernetes, LXC 같은 컨테이너 기술의 핵심 기반인 **네트워크 네임스페이스**를 다룹니다. 네트워크 네임스페이스는 프로세스가 완전히 독립된 네트워크 스택(인터페이스, 라우팅 테이블, iptables 규칙, 소켓)을 갖도록 격리하는 커널 기능입니다.

## 네트워크 네임스페이스란

리눅스 네임스페이스는 프로세스 격리를 위한 커널 기능의 모음입니다. 그 중 **네트워크 네임스페이스(netns)**는 다음 자원을 격리합니다.

- 네트워크 인터페이스 (lo, eth0 등)
- IPv4/IPv6 라우팅 테이블
- iptables/nftables 규칙
- 소켓과 포트 공간
- `/proc/net/` 파일 시스템

같은 포트(예: 80)를 사용하는 두 프로세스를 서로 다른 네트워크 네임스페이스에서 실행하면 충돌 없이 공존할 수 있습니다.

![네트워크 네임스페이스 격리](/assets/posts/linux-network-namespaces-isolation.svg)

## ip netns 기본 명령어

```bash
# 네임스페이스 생성
ip netns add ns0

# 네임스페이스 목록
ip netns list

# 네임스페이스 삭제
ip netns delete ns0

# 특정 네임스페이스 안에서 명령 실행
ip netns exec ns0 ip addr

# ns0 안에서 bash 실행 (인터랙티브)
ip netns exec ns0 bash
```

새로 만든 네임스페이스에는 루프백 인터페이스(`lo`)만 있고, 외부와 연결되는 인터페이스는 없습니다. 호스트와 통신하려면 **veth pair**를 사용합니다.

## veth pair: 가상 이더넷 케이블

veth(virtual ethernet) pair는 한 쪽 끝에서 들어온 패킷이 반대쪽 끝으로 나오는 가상 케이블입니다. 한 끝은 호스트에, 다른 끝은 네임스페이스에 배치합니다.

```bash
# 1. veth pair 생성
ip link add veth0 type veth peer name veth1

# 2. veth1을 ns0 네임스페이스로 이동
ip link set veth1 netns ns0

# 3. 호스트 쪽(veth0) IP 설정 및 활성화
ip addr add 10.0.0.1/24 dev veth0
ip link set veth0 up

# 4. ns0 안에서 veth1 IP 설정 및 활성화
ip netns exec ns0 ip addr add 10.0.0.2/24 dev veth1
ip netns exec ns0 ip link set veth1 up
ip netns exec ns0 ip link set lo up

# 5. 연결 테스트
ip netns exec ns0 ping 10.0.0.1
```

![ip netns 명령어](/assets/posts/linux-network-namespaces-commands.svg)

## 네임스페이스에서 인터넷 접근 (NAT)

네임스페이스 안에서 외부 인터넷에 접근하려면 호스트에서 IP 포워딩과 NAT를 활성화해야 합니다.

```bash
# 호스트: IP 포워딩 활성화
echo 1 > /proc/sys/net/ipv4/ip_forward

# 호스트: MASQUERADE로 NAT 설정
iptables -t nat -A POSTROUTING \
  -s 10.0.0.0/24 -o eth0 -j MASQUERADE

# ns0: 기본 게이트웨이 설정
ip netns exec ns0 ip route add default via 10.0.0.1

# ns0에서 외부 접속 테스트
ip netns exec ns0 ping 8.8.8.8
ip netns exec ns0 curl http://example.com
```

## 여러 네임스페이스 연결: 브리지

여러 네임스페이스가 서로 통신하려면 소프트웨어 브리지를 만들어 연결합니다.

```bash
# 브리지 생성
ip link add br0 type bridge
ip addr add 10.0.0.1/24 dev br0
ip link set br0 up

# ns0, ns1 각각 veth pair 생성
ip link add veth0 type veth peer name veth0-ns
ip link add veth1 type veth peer name veth1-ns

# 호스트 쪽을 브리지에 연결
ip link set veth0 master br0
ip link set veth1 master br0
ip link set veth0 up
ip link set veth1 up

# ns 쪽을 각 네임스페이스로 이동
ip link set veth0-ns netns ns0
ip link set veth1-ns netns ns1
```

Docker는 이 방식으로 `docker0` 브리지를 사용해 컨테이너들을 연결합니다.

## 네임스페이스와 /proc

각 네임스페이스는 `/proc/<PID>/ns/net` 파일로 참조됩니다. `ip netns`가 만드는 네임스페이스는 `/var/run/netns/`에 bind mount 형태로 저장되어, 프로세스가 없어도 유지됩니다.

```bash
# 현재 프로세스의 네임스페이스 확인
ls -la /proc/self/ns/

# 특정 PID의 네임스페이스로 진입
nsenter --target <PID> --net ip addr

# 컨테이너의 네트워크 네임스페이스 진입 (Docker)
PID=$(docker inspect --format '{{.State.Pid}}' mycontainer)
nsenter --target $PID --net ip addr
```

## 네임스페이스 정보 조회

```bash
# 네임스페이스 내 인터페이스 상세 조회
ip netns exec ns0 ip addr show
ip netns exec ns0 ip route show
ip netns exec ns0 ss -tlnp

# 네임스페이스 내 iptables 규칙
ip netns exec ns0 iptables -L -n -v

# 모든 네임스페이스에서 공통 명령 실행
for ns in $(ip netns list | awk '{print $1}'); do
  echo "=== $ns ==="
  ip netns exec $ns ip addr
done
```

네트워크 네임스페이스는 컨테이너 기술의 핵심 빌딩 블록입니다. Docker, Kubernetes, systemd-nspawn 모두 이 메커니즘 위에서 동작합니다. 직접 `ip netns`로 격리 환경을 만들어 보면 컨테이너가 내부적으로 어떻게 동작하는지 명확하게 이해할 수 있습니다.

---

**지난 글:** [/etc/hosts — 정적 호스트 매핑](/posts/linux-hosts-file/)

**다음 글:** [SSH 포트 포워딩 — -L, -R, -D 완전 정복](/posts/linux-ssh-port-forward/)

<br>
읽어주셔서 감사합니다. 😊
