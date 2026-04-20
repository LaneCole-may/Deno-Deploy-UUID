# Deno Deploy VLESS 代理服务

基于 Deno Deploy 的 VLESS 代理服务，支持 WebSocket 传输、内置管理后台与伪装页面。

## 功能

- VLESS 协议 + WebSocket 传输 + TLS
- 0-RTT early data 支持（减少握手延迟）
- 管理后台（查看连接参数、一键复制链接）
- 伪装页面（非授权访问显示普通网页）


![预览](./_resources/b616d830beb925ce6fcd472b55f457c1.png)

> **流量说明：** 不绑卡仅每月有 **1GB** 流量可用，绑卡后有每月 **20GB** 流量（最初为 100GB，现已下调至 20GB）。

---

## 部署步骤

### 1. Fork 项目

Fork 项目到自己的 GitHub 账号，可修改 `deno.tsx` 文件中的 UUID。

默认 UUID：`93f6e6d0-9593-4104-8991-f28bb00d59a0`

项目地址：https://github.com/helloyangy/Deno-Deploy-UUID

![Fork 项目](./_resources/5605272611cfa7097dcfb8e1223512c5.png)

![Fork 完成](./_resources/4b69a0e8835e59bba27c059a60783011.png)

### 2. 登录 Deno Deploy

使用 GitHub 账号登录 [Deno Deploy](https://deno.com/deploy)。

![登录页面](./_resources/47959a66c1ccd8b620788dc9e32f2352.png)

### 3. 创建新应用

找到并点击 **New App** 按钮（无论界面显示什么样，找到该按钮即可）。

![New App](./_resources/b6ef1f193ed59ca3ee263030490fc2c1.png)

### 4. 绑定自定义域名（可选）

1. 在 Deno Deploy 控制台进入你的项目
2. 点击 **Settings** → **Domains**
3. 添加你的域名并按提示配置 DNS 记录

### 5. 绑定 GitHub 账号

![绑定 GitHub](./_resources/a9829f8345a749759994411febafa2b1.png)

### 6. 选择 Fork 的项目

选择 `Deno-Deploy-UUID` 项目。

![选择项目](./_resources/60a1590ba733c44122e833142462b8f8.png)

### 7. 编辑应用配置

往下滑动，点击 **Edit app config**。

![Edit app config](./_resources/784bcb90a5c5b27c1038cea9513878c5.png)

### 8. 设置入口文件

在 **Entrypoint** 输入框中填入 `deno.tsx`。

![设置入口](./_resources/541c0ec0a89ba443e8b2eb38bf32b803.png)

### 9. 创建应用

点击 **Create App** 按钮。

![Create App](./_resources/b706a8358f775a7dd38d216f66b9042d.png)

### 10. 等待构建完成

构建完成后，点击 **Preview URL** 预览地址。

![构建完成](./_resources/162b862443652683699f6b0c46c179d0.png)

### 11. 伪装页面

打开后显示的是伪装界面。

![伪装页面](./_resources/c3a8eea083801e1e960f18c44e14e5f4.png)

### 12. 访问管理后台

后台地址格式：`Preview URL` + `UUID`

示例：

```
https://deno-deploy-uuid-cn0zt4zfwwzj.helloyangy.deno.net/93f6e6d0-9593-4104-8991-f28bb00d59a0
```

![管理后台](./_resources/12a146fca692867d83d445ef33797901.png)

后台中展示所有节点信息，点击复制按钮即可一键复制。

## 使用说明

| 地址 | 说明 |
|------|------|
| `https://你的域名/` | 伪装页面（对外显示正常网站） |
| `https://你的域名/<UUID>` | 管理后台（查看配置、复制链接） |

### 客户端配置

在管理后台页面可以直接复制 VLESS 链接，也可以手动填写：

| 参数 | 值 |
|------|------|
| 地址 | 你的域名 |
| 端口 | 443 |
| UUID | 你设置的 UUID |
| 加密 | none |
| 传输 | ws |
| TLS | tls |
| 路径 | / |

支持的客户端：v2rayN、v2rayNG、Clash Meta、Shadowrocket、Quantumult X 等。

## 本地开发

```bash
# 安装 Deno（如未安装）
# https://docs.deno.com/runtime/getting_started/installation/

# 运行
deno run --allow-net deno.tsx
```

## License

MIT
