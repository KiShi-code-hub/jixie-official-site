# 计算机协会官网

对外展示型静态网站，采用 Astro 构建，内容通过 Markdown 维护，使用 Git 管理变更。正式域名：`mzjx.kishi.uk`。

## 本地开发

```powershell
npm install
npm run dev
```

浏览器访问 `http://localhost:4321`。

## 内容更新（招新公告、活动、项目）

所有动态内容都在 `src/content/` 下，按类型分为：

- `src/content/announcements/`：招新公告等通知
- `src/content/activities/`：活动动态
- `src/content/projects/`：技术项目

更新方式：在对应目录新增或修改 `.md` 文件，推送到 Git 后重新构建发布即可。每个文件开头有一段 `---` 包围的元信息，标题、日期、地点等字段按已有文件格式填写。

## 素材替换

当前是占位素材，正式上线前替换：

- `public/logo.png`：协会 Logo（已替换为你的 logo.png 压缩版）
- `public/images/hero.png`：首页大图
- `public/images/about.png`：关于页面图片
- `public/images/activity-1.png` 等：活动卡片图片

占位图片可运行 `npm run assets` 重新生成。

看不懂项目结构或不知道怎么改内容时，先看：

- [项目结构说明.md](项目结构说明.md)：逐级介绍每个文件夹是干什么的
- [内容修改指南.md](内容修改指南.md)：手把手教怎么改招新公告、活动、项目和图片

## 部署到 Ubuntu Server

1. 在服务器安装 Git、Docker 与 Docker Compose。
2. 拉取代码到服务器。
3. 构建并启动网站容器：

```bash
cd 计协官网设计
sudo docker compose -f deploy/docker-compose.yml up -d --build
```

网站容器只监听 `127.0.0.1:8080`，不直接暴露公网。

## Cloudflare Tunnel

服务器没有公网 IP，通过 Cloudflare Tunnel 对外提供服务：

```bash
sudo apt install cloudflared
cloudflared tunnel login
cloudflared tunnel create jixie-site
cloudflared tunnel route dns <隧道ID> mzjx.kishi.uk
```

把 `deploy/cloudflared-config.yml` 中的隧道 ID 替换后放到 `/etc/cloudflared/config.yml`，然后运行：

```bash
cloudflared service install
sudo systemctl enable --now cloudflared
```

在 Cloudflare 控制台确认 SSL/TLS 模式为 Full (strict)，并把 DNS 记录设为 Cloudflare 代理即可。
