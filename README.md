# H5 多人联机娱乐房

这是一个可部署到 Render/Railway 的 H5 网页小游戏：

- 中国象棋：两人对战、观战、合法走子、吃子、将军、将死、悔棋申请、重置申请、剩余棋子。
- 虚拟老虎机：只使用虚拟筹码。
- 虚拟百家乐：只使用虚拟筹码，支持闲、庄、和下注。
- 房间聊天：输入相同房间号即可进入同一房间。
- 手机和电脑浏览器自适应。

本项目不包含真钱、充值、提现、支付、现金兑换或任何真实账户余额功能。

## 本地运行

先安装 Node.js 18 或更新版本。

```bash
npm install
npm start
```

打开：

```text
http://localhost:3000
```

测试多人联机时，可以开两个浏览器窗口，输入相同房间号。前两个进入房间的人自动成为红方和黑方，后面进入的人是观战。

## Render 部署

1. 注册 Render。
2. 新建 Web Service。
3. 连接 GitHub 仓库，或上传本项目代码。
4. Build Command 填：

```bash
npm install
```

5. Start Command 填：

```bash
npm start
```

6. 部署完成后，Render 会给一个网址。把网址发给同事，大家输入相同房间号即可一起玩。

Render 免费服务可能会休眠，第一次打开会慢一些。

## Railway 部署

1. 注册 Railway。
2. 新建项目并导入代码。
3. Railway 通常会自动识别 Node.js 项目。
4. 确认启动命令为：

```bash
npm start
```

5. 生成公开域名后，大家打开该网址进入房间。

## 文件说明

- `server.js`：静态页面服务和 WebSocket 房间服务。
- `public/index.html`：H5 页面入口。
- `public/src/app.js`：前端交互和界面渲染。
- `public/src/chess.js`：象棋规则。
- `public/src/casino.js`：虚拟老虎机和百家乐规则。
- `public/src/styles.css`：棋盘和国风界面样式。
- `tests/`：规则自动测试。

## 测试

```bash
npm test
```

当前测试覆盖象棋马腿、炮架、将帅照面、将死，以及老虎机和百家乐核心结算规则。
