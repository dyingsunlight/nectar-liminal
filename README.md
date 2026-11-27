# Nectar Liminal · 素物集全栈架构与 Monorepo

> 微信小程序（通过微信云函数仅作请求转发，不绑定微信数据库/业务逻辑） + 阿里云 FC 3.0（原生 HTTP 端点 + CORS + TableStore） + Cloudflare Pages 管理后台 + Pulumi 统一 IaC。

## 1. 整体架构

```text
  微信小程序 (projects/miniapp)
         │ wx.cloud.callFunction('apiProxy')
         ▼
  微信云函数转发器 (projects/wx-proxy)
         │ 注入 OPENID / UNIONID / APPID + X-Proxy-Token
         ▼ HTTPS
  阿里云 FC 3.0 HTTP 端点 (projects/fc-api, Hono + nodejs20 + 原生 CORS)
         ▲
         │ 浏览器 fetch 直连 (HTTPS + CORS)
  Cloudflare Pages 管理后台 (projects/admin, Vue 3 + Vite)
         │
         ▼
  阿里云 TableStore (categories / products / banners / users)
```

- **彻底解耦微信生态**：`projects/wx-proxy` 不含任何业务逻辑，仅读取 `cloud.getWXContext()` 后将请求安全转发至阿里云 FC 3.0 HTTP 端点。
- **零额外代理 Worker**：阿里云 FC 3.0 内置 `nodejs20` HTTP 触发器放行 `OPTIONS` 并由 Hono `cors` 中间件直接下发 `Access-Control-Allow-*` 响应头，Cloudflare Pages 管理后台可直连调用 JSON API。
- **独立子项目目录**：根目录保持极简，所有子项目彼此隔离在 `projects/*` 下，通过 `@nectar/shared` 共享 TypeScript 契约与种子数据。

## 2. 目录结构

```text
.
├── .gitignore
├── .npmrc
├── README.md
├── package.json
├── pnpm-workspace.yaml
└── projects/
    ├── shared/          # @nectar/shared — 共享 DTO、代理请求协议、初始种子数据
    ├── miniapp/         # @nectar/miniapp — uni-app 微信小程序（支持 mock / wx-cloud / http）
    ├── wx-proxy/        # @nectar/wx-proxy — 微信云函数纯 HTTP 转发器
    ├── fc-api/          # @nectar/fc-api — 阿里云 FC 3.0 + Hono + TableStore 后端
    ├── admin/           # @nectar/admin — 部署到 Cloudflare Pages 的演示管理后台
    └── infra/           # @nectar/infra — Pulumi TypeScript IaC（编排阿里云、微信云函数、Cloudflare）
```

## 3. 本地快速启动与联调

### 3.1 安装与全量校验

```bash
pnpm install
pnpm run type-check
pnpm run build
```

### 3.2 启动本地全栈演示（免云账号）

未配置 `OTS_ENDPOINT` 时，`fc-api` 自动启用预置了初始商品数据的内存库，方便立即联调：

```bash
# 终端 1：启动本地 FC HTTP API (http://localhost:8787，默认 Admin Token: dev-admin-token)
pnpm run dev:api

# 终端 2：启动管理后台 (http://localhost:5173)
pnpm run dev:admin

# 终端 3（可选）：启动微信小程序开发编译（输出到 projects/miniapp/dist/dev/mp-weixin）
pnpm run dev:miniapp
```

> **微信开发者工具导入路径变更提示**：重构后小程序目录已迁移至 `projects/miniapp/`，请在微信开发者工具中导入 **`projects/miniapp`** 目录。

## 4. Pulumi IaC 部署与上线前准备清单

进入 `projects/infra` 目录前，请确认本地已构建一次产物（`pnpm run build`），并按以下清单准备好各云平台凭证与配置：

### 4.1 阿里云侧（FC 3.0 + TableStore + RAM）

1. **开通服务**：确保当前阿里云账号已开通 **函数计算 FC（3.0）**、**表格存储 TableStore（OTS）** 与 **访问控制 RAM**。
2. **准备 RAM 子账号 AccessKey（AK/SK）**：建议授予 `AliyunFCFullAccess`、`AliyunOTSFullAccess`、`AliyunRAMFullAccess`（Pulumi 会自动创建 FC 执行角色并绑定 `AliyunOTSFullAccess`）。
3. **配置 Pulumi**：
   ```bash
   cd projects/infra
   pulumi stack init dev
   pulumi config set alicloud:region cn-hangzhou
   pulumi config set --secret alicloud:accessKey <YOUR_ALIBABA_CLOUD_AK>
   pulumi config set --secret alicloud:secretKey <YOUR_ALIBABA_CLOUD_SK>
   ```

### 4.2 微信小程序 & 微信云函数侧

1. **获取云开发环境 ID（`wxEnvId`）**：在微信开发者工具「云开发控制台 → 设置」或微信公众平台查看已开通的云环境 ID（例如 `cloud1-xxxxxxx`）。
2. **下载代码上传密钥（`private.key`）并配置 IP 白名单**：
   - 登录 [微信公众平台](https://mp.weixin.qq.com/) → **开发管理 → 开发设置 → 小程序代码上传**；
   - 生成并下载 **小程序代码上传密钥**（如 `private.wxd4fffd6f357a8e76.key`）；
   - **务必将执行 `pulumi up` 的本机公网出口 IP（或 CI Runner IP）加入「代码上传 IP 白名单」**（若无固定公网 IP 也可在界面按需关闭白名单校验，否则 `miniprogram-ci` 会报 IP 校验失败）。
3. **微信云开发环境出网权限**：微信云开发新环境默认可访问公网 HTTPS 端点（FC `*.fcapp.run`）。
4. **配置 Pulumi**：
   ```bash
   pulumi config set wxAppId wxd4fffd6f357a8e76
   pulumi config set wxEnvId <YOUR_WECHAT_CLOUD_ENV_ID>
   pulumi config set --secret wxPrivateKey "$(cat /path/to/private.wxd4fffd6f357a8e76.key)"
   # 或使用本地路径：pulumi config set wxPrivateKeyPath /path/to/private.wxd4fffd6f357a8e76.key
   ```

### 4.3 Cloudflare Pages 侧

1. **获取 Account ID**：在 Cloudflare 控制台右侧边栏复制 `Account ID`。
2. **创建 API Token**：进入 **My Profile → API Tokens → Create Token**，赋予权限：
   - `Account` → `Cloudflare Pages` → `Edit`
3. **配置 Pulumi**：
   ```bash
   pulumi config set cloudflareAccountId <YOUR_CLOUDFLARE_ACCOUNT_ID>
   pulumi config set --secret cloudflare:apiToken <YOUR_CLOUDFLARE_API_TOKEN>
   ```

### 4.4 一键预览与部署

```bash
cd "/Users/tenghou/Nectar Liminal"
pnpm run build
pnpm run infra:preview
pnpm run infra:up
```

部署成功后，Pulumi 将输出：
- `fcHttpUrl`：阿里云 FC 3.0 公网 HTTP 地址（已自动注入微信云函数和 Cloudflare Pages 构建环境变量）；
- `adminPagesUrl`：Cloudflare Pages 管理后台访问域名（可点击界面上的「初始化种子数据」写入 TableStore）；
- `adminApiToken`（secret）：使用 `pulumi stack output adminApiToken --show-secrets` 查看，用于登录管理后台。

最后将 `projects/miniapp/.env.production` 中的 `VITE_API_MODE=wx-cloud`、`VITE_WX_CLOUD_ENV_ID=<YOUR_WECHAT_CLOUD_ENV_ID>` 填入并重新构建小程序（`pnpm run build:miniapp`），即可通过微信云函数转发联调阿里云 FC + TableStore。
