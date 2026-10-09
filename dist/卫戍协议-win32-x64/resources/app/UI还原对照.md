# APK UI 还原对照

当前根目录使用 APK 的完整客户端和服务器源代码：

| APK 页面 /资源 | 根目录实现 |
|---|---|
| 标题、代号、邀请 | `public/js/screens/title.js`、`public/css/theme.css` |
| 协议选择、难度 | `public/js/screens/lobby.js`、`public/js/screens/room.js` |
| 信息确认、敌方领袖、盟约和禁用干员 | `public/js/screens/briefing.js` |
| 策略选择、调度和干员池 | `public/js/screens/game.js`、`public/js/ui/shopBar.js` |
| 作战 HUD、回合、准备、队伍栏 | `public/js/ui/hud.js`、`public/js/ui/combatHud.js` |
| 地图、路径、地块和摄像机 | `public/js/render/board3d/`、`public/js/render/boardArt.js`、`data/stages.json` |
| 地图材质 | `public/assets/local/map/autochess/`、`public/assets/local/map/autochesssand/` |
| 方向环、攻击范围、技能按钮 | `public/assets/ui/battle/`、`public/assets/ui/battleUi/` |
| 干员、敌人和怪物贴图 | `public/assets/spine/`、`public/assets/ui/charEliteSprite/`、`public/assets/ui/enemyTypeIcon/` |
| 战斗特效和状态 | `public/js/render/fx.js`、`data/effects.json`、`data/tokens.json` |
| 结算、教学、编队 | `public/js/screens/result.js`、`public/js/screens/guide.js`、`public/js/screens/loadout.js` |

已用浏览器实际启动并检查标题、同盟大厅、信息确认、策略选择、协议启动和第 1 回合作战准备画面。完整资源使用 APK 提取文件，EXE 打包脚本会排除研究目录和旧原型。
