# 素物集 · 精品生活微信小程序

基于 **uni-app + Vue 3 + Vite + TypeScript + Pinia + SCSS** 构建的精品生活 / 家居好物商城微信小程序，通过微信云函数（`wx-proxy`）或 HTTP 直连阿里云 FC 3.0 + TableStore 真实后端。

## 技术栈

- **框架**：uni-app (`Vue 3` + `<script setup lang="ts">`)
- **构建**：Vite 5 + TypeScript
- **状态管理**：Pinia（购物袋、微信登录态与跨 Tab 状态持久化至本地 Storage）
- **样式风格**：现代极简温润生活美学（暖米白底色 + 炭墨字 + 陶土红点缀）
- **接口与认证**：
  - `wx-cloud` 模式：通过 `wx.cloud.callFunction('apiProxy')` 转发至阿里云 FC，并自动注入可信 `OPENID`；
  - `http` 模式：直连本地/公网 FC HTTP 端点（本地开发可通过 `VITE_DEV_OPENID` 传递测试身份）。

## 快速开始

```bash
# 1. 安装依赖（在仓库根目录执行）
pnpm install

# 2. 复制并配置环境变量（参考 .env.example）
# 配置 VITE_API_MODE=wx-cloud 与 VITE_WX_CLOUD_ENV_ID

# 3. 类型检查
pnpm run type-check

# 4. 启动微信小程序开发编译（输出到 dist/dev/mp-weixin）
pnpm run dev:mp-weixin

# 5. 构建微信小程序生产包（输出到 dist/build/mp-weixin）
pnpm run build:mp-weixin
```

## 导入微信开发者工具

项目已配置 `project.config.json`（`miniprogramRoot` 指向 `dist/dev/mp-weixin/`）：

1. 运行 `pnpm run dev:mp-weixin` 启动微信小程序实时编译。
2. 打开 **微信开发者工具**，点击「导入项目」，选择 `projects/miniapp` 目录即可识别 `dist/dev/mp-weixin/app.json`。
3. 在 `src/manifest.json` 与 `project.config.json` 中填入微信小程序 AppID，并确保 `.env.local` / `.env.production` 已配置正确的 `VITE_WX_CLOUD_ENV_ID`。

## 微信登录与资料设置

- 登录：用户点击「我的 → 微信一键登录」触发 `POST /api/auth/login`，通过云函数注入的可信 `OPENID` 在阿里云 TableStore 中创建或更新用户档案；
- 头像与昵称：编辑资料使用微信合规组件 `<button open-type="chooseAvatar">` 与 `<input type="nickname">`，头像在端侧压缩为小体积 Base64 Data URI 后经 `PUT /api/me` 持久化存储。

## 目录结构

```text
├── index.html                  # H5 入口模板
├── package.json                # 依赖与构建脚本
├── tsconfig.json               # TypeScript 配置
├── vite.config.ts              # Vite 配置
└── src/
    ├── App.vue                 # 应用生命周期与全局样式
    ├── main.ts                 # Vue 3 + Pinia 入口
    ├── manifest.json           # 小程序 / H5 应用配置
    ├── pages.json              # 页面路由与底部 TabBar 配置
    ├── uni.scss                # 全局主题变量与设计令牌
    ├── types/                  # TypeScript 领域模型定义
    ├── utils/                  # API 客户端封装与头像压缩转码工具
    ├── services/               # 后端异步接口服务层
    ├── stores/                 # Pinia 状态管理（用户登录态、购物袋、跨页状态）
    ├── components/             # 通用组件（商品卡片）
    ├── static/tabbar/          # 81×81px 底部 TabBar PNG 图标
    └── pages/
        ├── home/index.vue      # 首页（企划 Banner、搜索、精选分类与好物）
        ├── category/index.vue  # 分类页
        ├── cart/index.vue      # 购物袋
        ├── mine/index.vue      # 个人中心（微信登录与资料编辑）
        └── product/detail.vue  # 商品详情页
```
