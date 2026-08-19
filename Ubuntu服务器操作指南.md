# Ubuntu Server 26 服务器操作指南（计协官网）

本指南覆盖从“在服务器上安装 Ubuntu Server 26”到“计协官网通过 Cloudflare Tunnel 上线”的完整流程，每一条命令都附带解释。

适用前提：

- 服务器没有公网 IP，网站通过 Cloudflare Tunnel 对外提供访问
- 官网域名：`mzjx.kishi.uk`
- 网站部署方式：Docker + Nginx + Astro 静态站

## 一、准备 Ubuntu Server 26

### 1. 下载系统镜像

在可以上网的电脑上下载官方镜像：

```text
https://releases.ubuntu.com/26.04/
```

选择 `ubuntu-26.04-live-server-amd64.iso`（AMD64 架构，兼容绝大多数服务器 CPU）。

### 2. 制作启动 U 盘（Windows 环境）

1. 下载并打开 Rufus：`https://rufus.ie/`
2. 插入一个至少 4GB 的 U 盘
3. Rufus 里选择：
   - 设备：你的 U 盘
   - 引导类型：刚下载的 Ubuntu ISO
   - 分区类型：`GPT`
   - 目标系统：`UEFI (non CSM)`
   - 文件系统：`FAT32`
4. 点击“开始”，等待写入完成

> 如果服务器是云服务器或虚拟机，不需要 U 盘，直接在后端控制台选择“重装系统 / 更换镜像”，选 Ubuntu Server 26.04 LTS 即可。

### 3. 从 U 盘启动

物理服务器开机时按品牌对应的启动菜单键，常见的是：

```text
F2、F10、F11、F12 或 Del
```

选择 U 盘启动。云服务器则在控制台直接开机并打开 VNC/远程终端。

## 二、安装过程

进入 Ubuntu 安装器后按提示操作：

1. **语言**：建议选 English，终端环境更稳定；需要中文界面也可以选中文。
2. **键盘布局**：默认 English (US) 即可。
3. **网络**：选择 `DHCP` 自动获取内网 IP，没有公网 IP 不影响后续部署。
4. **代理地址**：留空。
5. **存储配置**：选择 `Use An Entire Disk`，方案选 `LVM`（方便以后扩容）。如果不需要磁盘加密就跳过加密。
6. **用户名和服务器名**：创建普通用户，例如用户名 `jixie`，服务器名 `jixie-server`。不要直接使用 root 日常操作。
7. **OpenSSH**：在安装界面勾选 `Install OpenSSH server`，这是必须的。
8. **Ubuntu Pro**：不需要订阅，跳过。

安装完成后拔掉 U 盘，重启进入系统。

## 三、首次登录与基础设置

### 1. 查看服务器内网 IP

登录服务器后运行：

```bash
ip a
```

找到类似 `192.168.x.x` 的地址，后面从电脑 SSH 登录要用。也可以只看 IP：

```bash
hostname -I
```

### 2. 从 Windows 电脑 SSH 登录

Windows 10/11 自带 OpenSSH 客户端，在 PowerShell 里执行：

```powershell
ssh jixie@192.168.x.x
```

把 `192.168.x.x` 换成服务器实际内网 IP，密码换成安装时设置的密码。

### 3. 更新系统

更新软件源和已安装软件：

```bash
sudo apt update
sudo apt upgrade -y
```

解释：

- `sudo`：以管理员权限执行
- `apt update`：刷新软件包列表
- `apt upgrade -y`：升级所有可升级软件包，`-y` 表示自动确认

### 4. 安装基础工具

```bash
sudo apt install -y git curl ca-certificates gnupg ufw
```

这些是后面拉代码、下载安装包和开防火墙需要的工具。

### 5. 设置主机名和时区

```bash
sudo hostnamectl set-hostname jixie-server
sudo timedatectl set-timezone Asia/Shanghai
```

解释：

- `hostnamectl set-hostname`：设置服务器名称
- `timedatectl set-timezone`：设置时区为东八区，日志时间才会正确

## 四、SSH 密钥登录（强烈推荐）

使用密钥登录比密码更安全，也方便以后多个协会成员维护。

### 1. 在 Windows 电脑生成密钥

```powershell
ssh-keygen -t ed25519
```

一路回车即可，生成的公钥位置：

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub
```

把输出的整行内容复制下来。

### 2. 在服务器上安装公钥

```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
```

粘贴公钥后按 `Ctrl+O` 保存，`Ctrl+X` 退出，然后设置权限：

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### 3. 测试密钥登录

新开一个终端：

```powershell
ssh jixie@192.168.x.x
```

如果不需要密码就能登录，再进行下一步。

### 4. 关闭密码登录和 root 登录

```bash
sudo nano /etc/ssh/sshd_config
```

找到或新增这两行：

```text
PermitRootLogin no
PasswordAuthentication no
```

保存后重启 SSH 服务：

```bash
sudo systemctl restart ssh
```

> 重要：必须先确认密钥可以登录，再关密码登录，否则可能把自己锁在门外。

## 五、防火墙

### 1. 只放行 SSH

```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

解释：

- `allow OpenSSH`：放行 22 端口，否则重启后 SSH 会断开
- `enable`：启用防火墙
- `status`：查看当前规则

### 2. 校内直连预览（可选）

如果希望校园网内直接访问网站，可以放行 8080 端口（按实际内网网段调整）：

```bash
sudo ufw allow from 192.168.0.0/16 to any port 8080
```

Cloudflare Tunnel 是服务器主动向外连接，不需要开放公网 80/443 入站端口。

## 六、安装 Docker

### 1. 使用官方安装脚本

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

解释：

- `curl` 下载官方脚本
- `sudo sh` 以管理员权限执行安装

### 2. 把当前用户加入 docker 组

```bash
sudo usermod -aG docker $USER
```

然后退出 SSH 重新登录，或执行：

```bash
newgrp docker
```

之后运行 docker 命令就不需要每次加 `sudo`。

### 3. 验证安装

```bash
docker --version
docker compose version
```

两条命令都输出版本号即安装成功。

## 七、获取并启动计协官网

### 1. 拉取网站代码

如果 GitHub 仓库已经建好：

```bash
cd ~
git clone <你的GitHub仓库地址> jixie-official-site
cd jixie-official-site
```

如果 GitHub 仓库还没建好，可以先用 Windows 本机通过内网传过去：

```powershell
scp -r C:\Users\jqx\Desktop\计协官网设计 jixie@192.168.x.x:~/jixie-official-site
```

### 2. 构建并启动网站

```bash
cd ~/jixie-official-site
docker compose -f deploy/docker-compose.yml up -d --build
```

解释：

- `-f deploy/docker-compose.yml`：指定部署配置
- `up -d`：启动并后台运行
- `--build`：每次重新构建网站镜像，代码有更新时用

### 3. 验证网站是否启动

```bash
docker compose -f deploy/docker-compose.yml ps
curl -I http://127.0.0.1:8080
```

`curl -I` 返回 `HTTP/1.1 200` 就说明网站容器正常。

查看网站日志：

```bash
docker compose -f deploy/docker-compose.yml logs -f website
```

按 `Ctrl+C` 退出日志查看。

## 八、安装并配置 Cloudflare Tunnel

### 1. 安装 cloudflared

```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

解释：

- 从 Cloudflare 官方 GitHub 下载 Ubuntu 版安装包
- `dpkg -i` 安装 `.deb` 包

### 2. 登录 Cloudflare 账号

```bash
cloudflared tunnel login
```

会打印一个网址，在浏览器里打开并授权 `kishi.uk` 域名。

### 3. 创建隧道

```bash
cloudflared tunnel create jixie-site
```

创建成功后查看隧道 ID：

```bash
cloudflared tunnel list
```

记录下 `ID` 一列，下面会用到。

### 4. 绑定域名

```bash
cloudflared tunnel route dns jixie-site mzjx.kishi.uk
```

这条命令会在 Cloudflare 自动创建 `mzjx.kishi.uk` 的 CNAME 记录。

### 5. 创建隧道配置文件

```bash
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/<隧道ID>.json /etc/cloudflared/
```

然后把下面的配置写入 `/etc/cloudflared/config.yml`：

```bash
sudo tee /etc/cloudflared/config.yml > /dev/null <<'EOF'
tunnel: <隧道ID>
credentials-file: /etc/cloudflared/<隧道ID>.json

ingress:
  - hostname: mzjx.kishi.uk
    service: http://127.0.0.1:8080
  - service: http_status:404
EOF
```

解释：

- `tunnel`：隧道 ID
- `credentials-file`：刚才复制过去的凭证文件
- `ingress`：访问 `mzjx.kishi.uk` 时转发到本机 8080 端口的网站

### 6. 先手动测试隧道

```bash
cloudflared tunnel run jixie-site
```

看到日志里出现连接成功且 `https://mzjx.kishi.uk` 能打开后，按 `Ctrl+C` 停止测试。

### 7. 安装为系统服务（开机自启）

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
systemctl status cloudflared
```

解释：

- `service install`：安装成 systemd 服务，服务器重启后自动运行
- `enable --now`：设置开机自启并立即启动
- `status`：查看运行状态

## 九、Cloudflare 控制台确认

1. 打开 Cloudflare 控制台，进入 `kishi.uk` 的 DNS 页面。
2. 确认存在 `mzjx.kishi.uk` 的 CNAME 记录，目标为 `<隧道ID>.cfargotunnel.com`，代理状态是橙色云朵（Proxied）。
3. 进入 `SSL/TLS` 设置，把加密模式设为 **Full (strict)**。
4. 浏览器访问 `https://mzjx.kishi.uk` 验证。

服务器上也可以自测：

```bash
curl -I https://mzjx.kishi.uk
```

返回 `200 OK` 即上线成功。

## 十、日常更新网站内容

以后更新公告、活动、图片后，只需要：

```bash
cd ~/jixie-official-site
git pull
docker compose -f deploy/docker-compose.yml up -d --build
```

解释：

- `git pull`：拉取电脑上推送的最新代码
- `up -d --build`：重新构建并重启网站

看日志和重启服务：

```bash
docker compose -f deploy/docker-compose.yml logs -f website
docker compose -f deploy/docker-compose.yml restart website
```

## 十一、备份建议

至少备份以下内容：

- Git 仓库（建议推到 GitHub/Gitee 远程仓库）
- `public/images/` 里的真实照片
- `/etc/cloudflared/` 里的隧道凭证和配置
- `deploy/` 部署配置

简单打包备份：

```bash
cd ~
tar -czf backup-$(date +%F).tar.gz --exclude node_modules --exclude dist jixie-official-site /etc/cloudflared
```

把生成的 `backup-日期.tar.gz` 复制到其他电脑或网盘保存。

## 十二、常见问题

**问：网站能访问但 Cloudflare 隧道没起来？**

查看服务日志：

```bash
journalctl -u cloudflared -n 50
```

**问：国内访问很慢？**

Cloudflare 免费版没有大陆边缘节点，校外访问可能不稳定。校内访问建议直接用内网 IP 或内网域名，校外走隧道。

**问：`apt update` 很慢？**

可以换成清华镜像源：

```bash
sudo sed -i 's@//.*archive.ubuntu.com@//mirrors.tuna.tsinghua.edu.cn@g; s@//security.ubuntu.com@//mirrors.tuna.tsinghua.edu.cn@g' /etc/apt/sources.list.d/ubuntu.sources
sudo apt update
```

**问：不知道服务器内网 IP 了？**

登录服务器执行 `ip a`，或者进路由器后台查看设备列表。

**问：SSH 连不上？**

检查电脑和服务器是否在同一局域网，确认防火墙放行了 `OpenSSH`。
