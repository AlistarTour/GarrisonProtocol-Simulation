// Verified layout: PRTS / 卫戍协议：盟约 / 战场一览 / AC-1, 1280 × 720.
// The ready button position is supported by the help text; its skin is pending.
export function originalHUD({round,hp,funds,level,remaining,phase,ready,editable,solo,speed,host,connected}) {
 ready=ready&&phase==='prep';
 const phaseLabel={prep:'休息一下',battle:'作战中',rescue:'联合防卫',reward:'机变阶段',won:'模拟完成',lost:'模拟终止'}[phase]||phase;
 const phaseIcon=phase==='prep'?'<path d="M4 8h5l2-4 4 2-2 4 5 2-1 3-6-2-2 5-4-2 2-5-3-1zM16 5l2-2M18 8l3-1"/>':'<path d="M4 3l15 16M20 3L5 19M2 16l6 6M16 16l6 6"/>';
 return `<div class="original-hud">
  <button class="hud-exit" data-action="leavePrompt" aria-label="离开模拟"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 4H5v16h13v-5M10 12h12M17 7l-5 5 5 5"/></svg></button>
  <span class="hud-connection ${connected?'':'offline'}" id="hud-connection">${connected?'在线':'重连'}</span>
  <div class="hud-status"><div class="hud-status-panel"><span class="hud-round-label">回合</span><b class="hud-round">${round}</b></div><div class="hud-phase"><div class="hud-phase-inner"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${phaseIcon}</svg><span>${phaseLabel}</span></div></div><div class="hud-status-panel"><span class="hud-life"><i class="tower" aria-hidden="true"></i><b id="view-hp">${hp}</b></span></div></div>
  <span class="hud-timer" id="phase-time">${solo&&phase==='prep'?'∞':'00:00'}</span>
  <button class="hud-ready ${ready?'is-ready':''}" data-action="ready" aria-label="${phase==='prep'?(ready?'取消准备':'完成准备'):phaseLabel}" ${connected&&(editable||ready||['won','lost'].includes(phase))?'':'disabled'}><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3l15 16M20 3L5 19M2 16l6 6M16 16l6 6"/></svg><small>${phase==='prep'?(ready?'取消准备':'准备战斗'):phaseLabel}</small></button>
  <button class="hud-speed" data-action="speed" ${host?'':'disabled'} aria-label="切换作战速度">${speed}×</button>
  <span class="hud-remaining">剩余可放置角色：${remaining}</span>
  <div class="hud-fund-panel"><div class="hud-funds"><div class="hud-funds-inner"><img src="/assets/funds.png" alt=""><b>${funds}</b></div></div><div class="hud-fund-label">当前资金</div></div>
  <div class="hud-level"><small>LEVEL</small><b>${level}</b></div>
 </div>`;
}
