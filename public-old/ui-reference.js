const live='https://www.bilibili.com/video/BV1oHyrBsEZU/';
const screens={
 home:{source:'/references/home-reference.png',actual:'/references/current-home.jpg',link:'https://www.taptap.cn/moment/738117540928029245?group_id=53933',caption:'官方玩法介绍长图 · 活动主页',difference:'主页功能区域已重排。背景使用官方 PV 的工业场景，亮度、天空及主界面原始切图仍不同。标志字体、图标、奖励和目标页面未通过逐像素验收。'},
 shop:{source:'/references/shop-reference.jpg',actual:'/references/current-shop.jpg',link:live+'?t=2505',caption:'官方实机演示 · 41:45',difference:'准备按钮、盟约横栏、玩家头像、底部调度中心和整备区已重建。当前地图仍是十列七行的简化拓扑；等阶边框、字体、背景纹理及升级 / 刷新数值存在差异。'},
 unit:{source:'/references/unit-reference.jpg',actual:'/references/current-unit.jpg',link:live+'?t=2520',caption:'官方实机演示 · 42:00',difference:'干员详情已移至左侧覆盖层，包含属性、生命栏、四个标签和出售 / 撤回 / 旋转操作。51 名干员已载入 Wiki 原始骨骼模型及待机 / 攻击 / 技能动画，加入部署朝向菱形。背面模型、拖拽朝向交互和原技能描述尚未完整复现。'},
 combat:{source:'/references/combat-reference.jpg',actual:'/references/current-combat.jpg',link:live+'?t=2560',caption:'官方实机演示 · 42:40',difference:'作战时隐藏商店，阶段栏显示实际击退数量，玩家可切换队友阵地。干员采用 Wiki 原始模型。完整三维场景、背面动作、技能特效、音效与联防合并场地仍未复现。'}
};
let selected='home';
function draw(){const s=screens[selected];document.querySelector('#source-image').src=s.source;document.querySelector('#implementation-image').src=s.actual;document.querySelector('#overlay-image').src=s.actual;document.querySelector('#source-link').href=s.link;document.querySelector('#source-caption').textContent=s.caption;document.querySelector('#difference').textContent=s.difference;const mode=document.querySelector('#view-mode').value;document.querySelector('#comparison').className='comparison '+mode;document.querySelector('#overlay-image').hidden=mode!=='overlay';document.querySelector('#overlay-image').style.opacity=document.querySelector('#overlay-opacity').value/100;}
document.querySelector('#screen-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-screen]');if(!b)return;selected=b.dataset.screen;for(const tab of document.querySelectorAll('[data-screen]'))tab.classList.toggle('selected',tab===b);draw()});
document.querySelector('#view-mode').addEventListener('change',draw);document.querySelector('#overlay-opacity').addEventListener('input',draw);draw();
