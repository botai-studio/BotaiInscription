# 3D Product Customizer

一个基于 React + React Three Fiber 的 3D 产品定制应用，支持动态定价和 Shopify 集成。

## 功能特性

- 📦 **OBJ 模型上传** - 支持上传和显示 OBJ 格式的 3D 模型
- 🎚️ **动态缩放** - 通过 ratio 滑动条调整模型的宽高比
- 🎮 **3D 交互** - 支持鼠标缩放、平移、旋转查看模型
- 💰 **动态定价** - ratio 越偏离 1，价格越高
- 🛒 **Shopify 集成** - 自动生成订单并跳转到 Shopify 付款页面

## 技术栈

- **前端框架**: React 18
- **3D 渲染**: React Three Fiber + Three.js
- **3D 工具**: @react-three/drei
- **构建工具**: Vite
- **部署**: Vercel

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 本地开发

```bash
npm run dev
```

应用将在 http://localhost:3000 启动

### 3. 构建生产版本

```bash
npm run build
```

## 部署到 Vercel

### 方法一：通过 Vercel CLI

1. 安装 Vercel CLI:
```bash
npm install -g vercel
```

2. 登录 Vercel:
```bash
vercel login
```

3. 部署:
```bash
vercel --prod
```

### 方法二：通过 GitHub

1. 将代码推送到 GitHub
2. 在 Vercel Dashboard 中导入项目
3. Vercel 会自动检测 Vite 配置并部署

## 配置 Shopify

### 1. 获取 Shopify API 凭证

1. 登录你的 Shopify 管理后台
2. 进入 **Settings** > **Apps and sales channels**
3. 点击 **Develop apps** > **Create an app**
4. 创建应用后，进入 **API credentials**
5. 在 **Admin API access scopes** 中启用:
   - `write_draft_orders`
   - `read_draft_orders`
6. 安装应用并获取 **Admin API access token**

### 2. 配置 Vercel 环境变量

在 Vercel Dashboard 中设置以下环境变量:

```
SHOPIFY_STORE=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxx
```

**注意**: 不要在代码中硬编码这些敏感信息！

### 3. 更新前端 API 地址

在 `src/App.jsx` 中，将 API 端点更新为你的 Vercel 部署地址:

```javascript
const response = await fetch(
  `https://your-vercel-app.vercel.app/api/create-order?guid=${guid}&price=${price}&ratio=${ratio}`,
  // ...
);
```

## 使用说明

### 前端界面

1. **上传模型**: 点击文件上传按钮，选择 `.obj` 格式的 3D 模型文件
2. **调整比例**: 拖动 Ratio 滑动条，观察模型实时变化和价格更新
3. **查看模型**: 
   - 鼠标左键拖动: 旋转模型
   - 鼠标右键拖动: 平移视角
   - 滚轮: 缩放视角
4. **下单**: 点击 Order 按钮，自动跳转到 Shopify 付款页面

### 定价规则

```javascript
basePrice = $100
deviation = |ratio - 1.0|
finalPrice = basePrice + (deviation × $50)
```

**示例**:
- ratio = 1.0 → 价格 = $100.00 (标准)
- ratio = 1.5 → 价格 = $125.00 (偏离 0.5)
- ratio = 0.5 → 价格 = $125.00 (偏离 0.5)
- ratio = 2.0 → 价格 = $150.00 (偏离 1.0)

## API 端点

### `GET /api/create-order`

创建 Shopify Draft Order 并返回付款链接。

**参数**:
- `guid` (string): 订单唯一标识符
- `price` (number): 产品价格
- `ratio` (number): 宽高比

**响应**:
```json
{
  "success": true,
  "guid": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
  "shopifyUrl": "https://your-store.myshopify.com/...",
  "orderId": 123456789,
  "price": "125.00",
  "ratio": "1.5"
}
```

## 项目结构

```
3d-product-customizer/
├── api/
│   └── create-order.js          # Vercel Serverless API
├── src/
│   ├── App.jsx                  # 主应用组件
│   ├── App.css                  # 应用样式
│   ├── ModelViewer.jsx          # 3D 模型查看器组件
│   ├── main.jsx                 # 入口文件
│   └── index.css                # 全局样式
├── index.html                   # HTML 模板
├── package.json                 # 项目依赖
├── vite.config.js              # Vite 配置
└── vercel.json                  # Vercel 配置
```

## 常见问题

### Q: 支持哪些 3D 模型格式？

A: 目前只支持 `.obj` 格式。如果你有其他格式（如 .fbx, .gltf），可以使用 Blender 等工具转换为 OBJ。

### Q: 模型显示不正确或没有材质？

A: OBJ 文件可能没有包含材质信息。应用会自动添加一个灰色的标准材质。如果需要保留原始材质，请确保上传时包含 `.mtl` 文件（需要修改代码以支持）。

### Q: API 调用失败？

A: 检查以下几点:
1. Vercel 环境变量是否正确配置
2. Shopify API Token 是否有正确的权限
3. 网络是否正常，查看浏览器控制台的错误信息
4. Shopify API 版本是否匹配

### Q: 如何自定义定价规则？

A: 在 `src/App.jsx` 中修改 `calculatePrice` 函数:

```javascript
const calculatePrice = (ratio) => {
  // 你的自定义逻辑
  return customPrice;
};
```

### Q: 如何添加更多控制选项？

A: 在 `App.jsx` 中添加新的 state 和 UI 控件，然后在 `ModelViewer.jsx` 中应用这些参数。

## 许可证

MIT

## 联系方式

如有问题或建议，请提交 Issue。
