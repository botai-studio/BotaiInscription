# 快速开始指南

## 项目已配置完成！

你的 3D 产品定制应用已经配置好，连接到你的 Vercel API：
`https://shopify-draft-order-io3s5gd2e-ricerolls-projects.vercel.app/api/create-order`

## 立即运行

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```

应用将在 http://localhost:3000 启动

## 功能说明

### 左侧 GUI 面板
- **上传模型**: 选择 .obj 文件
- **邮箱输入**: 输入客户邮箱（必填）
- **Ratio 滑动条**: 调整模型宽高比（0.5 - 2.0）
- **价格显示**: 自动计算动态价格
- **Order 按钮**: 提交订单并跳转 Shopify

### 右侧 3D 查看器
- **鼠标左键拖动**: 旋转模型
- **鼠标右键拖动**: 平移视角  
- **滚轮**: 缩放视角

## API 调用方式

当用户点击 Order 按钮时：

```javascript
// 1. 生成随机 GUID
const guid = generateGUID(); // 例如: 'a1b2c3d4-e5f6-7890-...'

// 2. 构建产品名称
const productName = `定制3D产品-${guid.substring(0, 8)}`;

// 3. 调用 API
const url = 'https://shopify-draft-order-io3s5gd2e-ricerolls-projects.vercel.app/api/create-order'
  + `?productName=${encodeURIComponent(productName)}`
  + `&price=${price}`
  + `&email=${encodeURIComponent(email)}`;

// 4. 获取响应并跳转
const response = await fetch(url);
const data = await response.json();
window.location.href = data.invoice_url; // 跳转到 Shopify 付款页面
```

## 定价规则

```
基础价格 = $100
偏离值 = |ratio - 1.0|
最终价格 = 基础价格 + (偏离值 × $50)
```

**示例**:
- ratio = 1.0 → $100.00 ✓ 标准价格
- ratio = 1.5 → $125.00 (偏离 0.5)
- ratio = 0.5 → $125.00 (偏离 0.5)
- ratio = 2.0 → $150.00 (偏离 1.0)

## 测试建议

1. **准备测试 OBJ 文件**: 
   - 简单的立方体或球体即可
   - 可以从网上下载免费的 OBJ 模型

2. **测试流程**:
   - 上传 OBJ 文件
   - 输入测试邮箱
   - 调整 ratio 观察价格变化
   - 在 3D 视图中旋转/缩放模型
   - 点击 Order 测试 API 调用

3. **查看日志**:
   - 打开浏览器控制台 (F12)
   - 查看 API 请求和响应
   - 确认 Shopify URL 返回正常

## 常见问题

**Q: 模型加载失败？**
A: 确保文件是有效的 .obj 格式，Three.js OBJLoader 只支持标准 OBJ 格式。

**Q: API 调用失败？**
A: 检查浏览器控制台的错误信息，确认：
- Vercel API 正常运行
- 参数正确传递
- CORS 设置正确

**Q: 模型显示但是是黑色的？**
A: 这是正常的，代码会自动添加灰色材质。如果需要彩色，需要同时上传 .mtl 文件。

**Q: 如何修改定价规则？**
A: 编辑 `src/App.jsx` 中的 `calculatePrice` 函数。

## 部署到生产环境

```bash
npm run build
```

构建完成后，将 `dist` 目录部署到你喜欢的静态托管服务：
- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages

## 文件结构

```
3d-product-customizer/
├── src/
│   ├── App.jsx           # 主应用（GUI + 逻辑）
│   ├── ModelViewer.jsx   # 3D 模型组件
│   ├── App.css          # 样式
│   ├── main.jsx         # 入口
│   └── index.css        # 全局样式
├── package.json         # 依赖
├── vite.config.js      # Vite 配置
└── index.html          # HTML 模板
```

## 需要帮助？

如果遇到问题，请检查：
1. Node.js 版本 >= 16
2. 所有依赖正确安装
3. 浏览器控制台的错误信息
4. Vercel API 是否正常响应

祝使用愉快！🚀
