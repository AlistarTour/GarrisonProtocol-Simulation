# 卫戍协议：模拟 · 云端联机版

一个可在浏览器和 Windows 桌面游玩的非官方同人项目。玩家连接同一台游戏服务器，通过房间码或邀请链接进入同盟，完成信息确认、策略选择、作战准备、部署与战斗流程。

当前运行版本为 **0.1.1**，网络协议版本为 **1**。项目参考同人作者二创的 APK 与游戏截图，整合现有网页客户端、游戏数据和地图、角色、敌人及特效资源。

源码与成品仓库：[AlistarTour/- · main](https://github.com/AlistarTour/-/tree/main)。本次同步包含 Windows 联机便携文件夹、`卫戍协议-0.1.1-win32-x64.zip` 和 `卫戍协议-云服务器部署包.zip`，均位于 `dist/`；校验值见[发布文件校验](https://github.com/AlistarTour/-/blob/main/dist/发布文件校验.json)。

## 现在开始游玩

**浏览器入口：[进入云端游戏](http://103.236.57.91:3001/)**

**Windows 入口：**双击便携版目录中的 `卫戍协议.exe`。当前成品位于 `dist/卫戍协议-win32-x64/`，已配置上述云服务器地址。发送给其他玩家时，打包整个成品目录，保留 `resources/`、运行库和 `服务器配置.json`。

联机流程：

1. 所有玩家打开相同服务器地址，输入各自代号。
2. 一名玩家创建同盟，其他玩家通过房间码或邀请链接加入。
3. 队友准备后，房主启动协议。
4. 根据界面提示完成信息确认和策略选择，进入作战准备。

支持独立模拟、最多 4 席的同盟房间和 AI 队友。房间码属于当前服务器；切换到另一台服务器后，需要在那里重新创建房间。

## 本次联机版的重点

| 能力 | 当前实现 |
| --- | --- |
| 公网联机 | Node.js 服务通过 HTTP 提供页面和资源，通过 WebSocket 同步房间与对局 |
| 桌面游玩 | Windows x64 便携 EXE，可选择连接云端或启动本地服务 |
| 同盟协作 | 房间创建、加入、准备、开局、队友状态同步和 AI 席位 |
| 断线恢复 | 自动重连，并在有效窗口内恢复会话及当前房间、对局状态 |
| 游戏资源 | 本地随项目提供地图、地块、UI、人物和敌人 Spine 资源及游戏 JSON 数据 |
| 部署管理 | 默认端口 3001，支持宝塔 Node 项目；另提供 PM2 配置和 Dockerfile |

运行状态保存在服务器进程内存中，当前没有独立账号系统或 MySQL 数据库。服务器重启会结束当前房间和对局。

## 开发者快速运行

先安装 Git 和 Git LFS，再获取仓库。EXE、ZIP 和 Electron 运行库使用 Git LFS 保存，未拉取 LFS 对象时只有指针文件，不能启动成品。获取方法与限制见 [GitHub 的 Git LFS 协作说明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/collaboration-with-git-large-file-storage)。

```powershell
git lfs install
git clone https://github.com/AlistarTour/-.git covenant
Set-Location -LiteralPath './covenant'
git lfs pull
```

本次开发和服务器验收使用 **Node.js 24.18.0**。`package.json` 声明的最低版本为 Node.js 18；其他版本不属于本次验收范围。

在项目根目录执行以下 Windows PowerShell 命令；macOS/Linux 可将 `npm.cmd` 改为 `npm`：

```powershell
npm.cmd ci
npm.cmd start
```

打开 <http://127.0.0.1:3001/>。源码启动默认监听 `0.0.0.0:3001`；局域网玩家可访问该电脑的局域网 IP 和 3001 端口。

开发时可使用：

```powershell
npm.cmd run dev
```

该命令使用 Node 的 `--watch` 重启服务。当前前端通过原生 ES 模块、import map 和随项目提供的 vendor 文件加载，正常启动不需要另行构建前端。静态页面修改后刷新浏览器；游戏数据修改后重启服务。

自定义服务器监听地址与端口：

```powershell
$env:HOST = '0.0.0.0'
$env:PORT = '3001'
$env:NODE_ENV = 'production'
npm.cmd start
```

## EXE 连接配置

EXE 从**自身所在目录**读取 `服务器配置.json`。云联机配置：

```json
{
  "serverUrl": "http://103.236.57.91:3001/",
  "localPort": 3001
}
```

保存后重新打开 EXE。远程模式由 `serverUrl` 决定访问地址，关闭客户端不会停止云端服务；此时 `localPort` 不会修改服务器端口。

本地运行配置：

```json
{
  "serverUrl": "",
  "localPort": 3001
}
```

本地模式优先连接已有且版本匹配的本机服务，否则由 EXE 启动服务。关闭 EXE 时，它会结束自己启动的服务进程。需要多人局域网连接时，按上面的源码启动方式监听 `0.0.0.0`。

## 验证与已完成的验收

本地资源和 HTTP 冒烟检查：

```powershell
npm.cmd test
```

当前测试检查关卡数据、地图纹理、方向环、攻击范围和相关资源文件，并用临时端口请求页面、JSON 和地图。它不等于完整对局或全部特效的验证。

对指定服务器进行真实联机验收：

```powershell
node scripts/verify-public-network.mjs http://103.236.57.91:3001/
```

脚本会创建两名测试玩家和一个测试房间，验证开局、状态同步与断线重连，最后退出房间并关闭连接。结果写入 `deployment/公网联机验证结果.json`，退出码非零表示验收失败；在安装项目依赖后，从项目根目录运行。

**2026-10-09（北京时间）已完成的公网验收：**

| 检查 | 结果 |
| --- | --- |
| `/healthz` | HTTP 200，`ok=true`，`app=0.1.1` |
| 两个独立 WebSocket 会话 | 通过 |
| 创建、加入房间与席位同步 | 通过 |
| 队友准备、房主开局、公共和个人状态同步 | 通过 |
| 对局中断线、自动重连、恢复原身份 | 通过 |
| 两人推进至策略选择 | 通过 |
| 28 项页面、代码、数据、vendor、地图和人物/敌人资源 | HTTP 200，SHA-256 与本地一致 |
| 测试结束后的房间、对局和连接清理 | 通过 |

这是该时间点的部署验收，完整对局通关、全部素材遍历、各设备画面和逐像素还原不在本次公网检查范围内。详细记录见[联机验收结果](deployment/公网联机验证结果.json)和[部署验证记录](deployment/3001验证记录.json)。

## 打包与部署

本地模式 Windows 便携版：

```powershell
npm.cmd run desktop
```

预配置云联机地址的 Windows 便携版：

```powershell
npm.cmd run desktop -- --server-url http://103.236.57.91:3001/
```

两种命令都输出到 `dist/卫戍协议-win32-x64/`，会覆盖该输出目录；不带 `--server-url` 的打包结果默认使用本地模式。

打包脚本同时同步最新 README、开发/协议文档、部署说明和版权声明。便携版根目录的 README 面向玩家，完整文档位于 `resources/app/`。已有同版本 EXE 文件夹只更新文档并重新生成 ZIP 时，使用 PowerShell 7：

```powershell
pwsh -File scripts/package-portable.ps1
```

该命令保留成品的 `服务器配置.json`，覆盖对应版本的 ZIP；修改运行代码后应先重新执行 EXE 打包。

生成完整服务端部署包，需要 **PowerShell 7**：

```powershell
pwsh -File scripts/package-cloud.ps1
```

输出 `dist/卫戍协议-云服务器部署包.zip`，顶层目录为 `covenant-server/`。完整包含运行代码、游戏数据和资源，生产依赖需在目标目录安装；现有的 `卫戍协议-3001修复包.zip` 只用于已有完整目录的端口与依赖修复。

当前云服务器使用 **Windows Server + 宝塔**，游戏目录为 `C:/Games/covenant-server`，监听 TCP 3001。服务端部署与维护步骤见[云服务器部署说明](deployment/云服务器部署说明.md)。

## 项目结构与文档

```text
server/            HTTP/WebSocket 入口、会话、房间、对局与战斗模拟
shared/            客户端和服务端共用的常量、消息与校验
public/            当前网页客户端、vendor、样式与素材
data/              关卡、干员、敌人、波次、效果和资源清单
electron-main.cjs  Windows 桌面启动器与连接配置
scripts/           打包、资源处理与公网联机验收工具
tests/             当前运行版本的冒烟测试
deployment/        云端部署说明与实际验收记录
docs/              开发架构与联机协议文档
dist/              EXE、完整部署包和修复包输出
```

运行和部署使用根目录的 `server/index.js`、`shared/`、`data/`、`public/`。`server.mjs`、`client/`、`game/`、旧原型目录和嵌套副本保留作历史参考，不作为当前开发入口。

| 文档 | 用途 |
| --- | --- |
| [开发文档](docs/开发文档.md) | 架构、模块职责、开发流程、数据修改、打包和维护 |
| [联机协议](docs/联机协议.md) | 消息格式、会话、房间、状态同步、重连与战斗上报 |
| [云服务器部署说明](deployment/云服务器部署说明.md) | Windows + 宝塔部署、3001 配置和故障排查 |
| [UI 还原对照](UI还原对照.md) | 页面和素材对应的实现位置 |

## 项目与素材说明

本项目为非官方同人作品，与明日方舟官方服务独立运行，供学习、研究和个人非商业娱乐。明日方舟相关素材、数据与商标归相应权利人所有，不属于代码的 GPL 授权范围。`package.json` 声明代码许可证为 `GPL-3.0-or-later`；原运行时的[许可证](research/apk/full/licenses/LICENSE.txt)、[版权与使用声明](research/apk/full/licenses/NOTICE.txt)和[第三方声明](research/apk/full/licenses/THIRD-PARTY-NOTICES.txt)保留在项目中。完整服务端打包脚本会将这些声明复制到包内 `licenses/`；再分发成品时应保留相应声明。
