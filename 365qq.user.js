// ==UserScript==
// @name         365QQ 最终4.0.6 双触发增强（超迷你UI）
// @namespace    http://tampermonkey.net/
// @version      4.0.6
// @description  保留4.0主逻辑 + 左右角球Observer/Polling双触发 + 上下位置可选 + 超迷你UI + 折叠记忆
// @author       david
// @match        https://www.bet365.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=www.bet365.com
// @require      https://cdn.bootcss.com/jquery/1.12.4/jquery.min.js
// @grant        none
// ==/UserScript==

(function () {
'use strict';

/* ================== 基础状态 ================== */
var timer1 = null, flashInterval = null;
var old_var = "0", show_notice = 0, lastTotalCorners = null;
var fuck_class_ad = "sip-MarketGroup_Info ";
var suspendnum = "gl-ParticipantOddsOnly gl-Participant_General gl-Market_General-cn1 gl-ParticipantOddsOnly_Suspended ";

/* ================== 配置 + 记忆 ================== */
var soundConfig = {
    enabled: true,
    flash: true,
    volume: 0.15,
    mode: 'normal',
    flashMode: 'orange',
    uiCollapsed: false,
    flashVertical: 'up' // up=队伍位置, down=work左右
};
var STORAGE_KEY = 'QQ365_SOUND_CONFIG';

function loadConfig() {
    try {
        var s = localStorage.getItem(STORAGE_KEY);
        if (s) Object.assign(soundConfig, JSON.parse(s));
    } catch (e) {}
}
function saveConfig() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(soundConfig)); } catch (e) {}
}
loadConfig();

/* ================== 声音 / 闪烁模式 ================== */
var SOUND_MODES = {
    normal: { freq: 480, interval: 600, dur: 0.2 },
    high: { freq: 900, interval: 500, dur: 0.15 },
    low: { freq: 300, interval: 700, dur: 0.3 },
    double: { freq: 600, interval: 700, dur: 0.15, double: true }
};
var FLASH_MODES = {
    orange: { bg: 'orange', shadow: '0 0 20px orange' },
    red: { bg: 'red', shadow: '0 0 20px red' },
    blue: { bg: '#1e90ff', shadow: '0 0 20px #1e90ff' },
    green: { bg: '#00ff88', shadow: '0 0 20px #00ff88' }
};

/* ================== 声音 ================== */
var AudioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playDingBeep() {
    if (!soundConfig.enabled) return;
    var cfg = SOUND_MODES[soundConfig.mode] || SOUND_MODES.normal;
    var start = Date.now();

    function beep() {
        var o = AudioCtx.createOscillator();
        var g = AudioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = cfg.freq;
        g.gain.setValueAtTime(soundConfig.volume, AudioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, AudioCtx.currentTime + cfg.dur);
        o.connect(g);
        g.connect(AudioCtx.destination);
        o.start();
        o.stop(AudioCtx.currentTime + cfg.dur);
    }

    (function loop() {
        if (Date.now() - start > 10000) return;
        beep();
        if (cfg.double) setTimeout(beep, 200);
        setTimeout(loop, cfg.interval);
    })();
}

/* ================== UI（超迷你） ================== */
function createSoundUI() {
    if ($('#soundCtrl').length) return;

    var box = $(`
<div id="soundCtrl">
  <div id="sc_header" style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
    <span style="font-size:11px;">控</span>
    <span id="sc_toggle" style="cursor:pointer;font-size:12px;line-height:1;">—</span>
  </div>
  <div id="sc_body" style="display:flex;align-items:center;gap:4px;margin-top:4px;white-space:nowrap;">
    <label style="display:flex;align-items:center;gap:2px;margin:0;"><input type="checkbox" id="sc_sound">声</label>
    <select id="sc_mode" style="width:54px;height:20px;font-size:11px;padding:0 2px;"></select>

    <label style="display:flex;align-items:center;gap:2px;margin:0;"><input type="checkbox" id="sc_flash">闪</label>
    <select id="sc_flashMode" style="width:50px;height:20px;font-size:11px;padding:0 2px;"></select>

    <select id="sc_flashVertical" style="width:60px;height:20px;font-size:11px;padding:0 2px;">
      <option value="up">上(队)</option>
      <option value="down">下(work)</option>
    </select>
  </div>
</div>`).css({
        position:'fixed',
        left:'50%',
        bottom:'12px',
        transform:'translateX(-50%)',
        background:'rgba(0,0,0,0.72)',
        color:'#fff',
        padding:'5px 7px',
        fontSize:'11px',
        border:'1px solid #fff',
        borderRadius:'7px',
        zIndex:99999,
        minWidth:'205px'
    });

    Object.keys(SOUND_MODES).forEach(function(k){
        $('#sc_mode', box).append('<option value="'+k+'">'+k+'</option>');
    });
    Object.keys(FLASH_MODES).forEach(function(k){
        $('#sc_flashMode', box).append('<option value="'+k+'">'+k+'</option>');
    });

    $('#sc_sound', box).prop('checked', soundConfig.enabled);
    $('#sc_flash', box).prop('checked', soundConfig.flash);
    $('#sc_mode', box).val(soundConfig.mode);
    $('#sc_flashMode', box).val(soundConfig.flashMode);
    $('#sc_flashVertical', box).val(soundConfig.flashVertical || 'up');

    box.on('change', 'input,select', function () {
        soundConfig.enabled = $('#sc_sound').prop('checked');
        soundConfig.flash = $('#sc_flash').prop('checked');
        soundConfig.mode = $('#sc_mode').val();
        soundConfig.flashMode = $('#sc_flashMode').val();
        soundConfig.flashVertical = $('#sc_flashVertical').val();
        saveConfig();
    });

    function applyCollapsedState(collapsed){
        var body = $('#sc_body', box);
        if(collapsed){
            body.hide();
            $('#soundCtrl').css({ padding:'4px 7px', minWidth:'auto' });
            $('#sc_toggle', box).text('+');
        }else{
            body.show();
            $('#soundCtrl').css({ padding:'5px 7px', minWidth:'205px' });
            $('#sc_toggle', box).text('—');
        }
    }

    applyCollapsedState(!!soundConfig.uiCollapsed);

    $('#sc_toggle', box).on('click', function(){
        soundConfig.uiCollapsed = !soundConfig.uiCollapsed;
        applyCollapsedState(soundConfig.uiCollapsed);
        saveConfig();
    });

    $('body').append(box);
}

/* ================== Working 闪烁 ================== */
function createWorkingBox() {
    if ($('#working').length) return;
    $('<div id="working">正常工作中</div>').css({
        position:'absolute', left:200, top:450,
        width:'120px', height:'35px',
        background:'red', opacity:0.4,
        color:'white', border:'2px solid white',
        borderRadius:'8px', textAlign:'center',
        lineHeight:'35px', zIndex:99999,
        pointerEvents:'none'
    }).appendTo('body');
}
function startSuperFlash(el) {
    if (!soundConfig.flash) return;
    var cfg = FLASH_MODES[soundConfig.flashMode] || FLASH_MODES.orange;
    var v = true;
    clearInterval(flashInterval);
    flashInterval = setInterval(function(){
        el.css(v ? {
            opacity:0.9, backgroundColor:cfg.bg, boxShadow:cfg.shadow
        } : {
            opacity:0, backgroundColor:'transparent', boxShadow:'none'
        });
        v = !v;
    }, 150);
}
function stopSuperFlash(el) {
    clearInterval(flashInterval);
    el.css({opacity:0.4, backgroundColor:'red', boxShadow:'none'});
}

/* ================== 角球文字（上/下定位） ================== */
function showCornerText(pos, text) {
    var id = 'cornerText_' + pos;
    if (document.getElementById(id)) return;

    var c = document.createElement('div');
    c.id = id;
    c.textContent = text;
    c.style.cssText = [
        'position:fixed',
        'z-index:99999',
        'pointer-events:none',
        'padding:3px 8px',
        'font-size:13px',
        'font-weight:bold',
        'color:white',
        'border:2px solid white',
        'border-radius:6px',
        'background:rgba(255,0,0,0.9)',
        'white-space:nowrap',
        'transition:opacity .12s linear, transform .12s linear, background-color .12s linear, box-shadow .12s linear'
    ].join(';');
    document.body.appendChild(c);

    function getTeamAnchor() {
        var leftBar  = document.querySelector('.lsm-42.lsm-9.lsm-da');
        var rightBar = document.querySelector('.lsm-42.lsm-9.lsm-99.lsm-93');

        if (pos === 'left' && leftBar) return leftBar;
        if (pos === 'right' && rightBar) return rightBar;

        var names = document.querySelectorAll('.lsm-1f4.lsm-e, .lsm-c7.lsm-f, .lsm-c7');
        if (names.length >= 2) return pos === 'left' ? names[0] : names[1];
        return null;
    }

    function updPos() {
        var cr = c.getBoundingClientRect();

        // 上方 = 队伍
        if ((soundConfig.flashVertical || 'up') === 'up') {
            var ta = getTeamAnchor();
            if (ta) {
                var tr = ta.getBoundingClientRect();
                c.style.left = (tr.left + (tr.width - cr.width) / 2) + 'px';
                c.style.top  = (tr.top + (tr.height - cr.height) / 2) + 'px';
                return;
            }
        }

        // 下方 = work左右（或上方找不到时兜底）
        var w = document.getElementById('working');
        if (!w) return;
        var wr = w.getBoundingClientRect();
        var gapX = 8;
        var x = (pos === 'left') ? (wr.left - cr.width - gapX) : (wr.right + gapX);
        var y = wr.top + (wr.height - cr.height) / 2;
        c.style.left = x + 'px';
        c.style.top = y + 'px';
    }

    updPos();
    var posTimer = setInterval(updPos, 150);

    var blinkTimer = null;
    if (soundConfig.flash) {
        var mode = FLASH_MODES[soundConfig.flashMode] || FLASH_MODES.orange;
        var on = true;
        blinkTimer = setInterval(function () {
            if (on) {
                c.style.opacity = '1';
                c.style.transform = 'scale(1.06)';
                c.style.backgroundColor = mode.bg;
                c.style.boxShadow = mode.shadow;
            } else {
                c.style.opacity = '0.25';
                c.style.transform = 'scale(0.98)';
                c.style.backgroundColor = 'rgba(255,0,0,0.28)';
                c.style.boxShadow = 'none';
            }
            on = !on;
        }, 150);
    }

    setTimeout(function () {
        clearInterval(posTimer);
        if (blinkTimer) clearInterval(blinkTimer);
        if (c && c.parentNode) c.parentNode.removeChild(c);
    }, 15000);
}

/* ================== 你原来的双源总角球逻辑（保留） ================== */
function getTotalFromInfo() {
    var el = document.querySelector('.sip-MarketGroup_Info');
    if (!el) return null;
    var m = (el.innerText || '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}
function getTotalFromTimeline() {
    var rows = document.querySelectorAll('.ml1-SoccerSummaryRow_Text');
    var max = null;
    rows.forEach(function(r){
        var m = (r.innerText || '').match(/(\d+)\s*角球/);
        if (m) {
            var n = parseInt(m[1], 10);
            if (max === null || n > max) max = n;
        }
    });
    return max;
}
function getTotalCorners() {
    var a = getTotalFromInfo(), b = getTotalFromTimeline();
    if (a === null) return b;
    if (b === null) return a;
    return Math.max(a, b);
}
function detectSideByTotal(t) {
    var rows = document.querySelectorAll('.ml1-SoccerSummaryRow_Text');
    for (var i=0; i<rows.length; i++) {
        var r = rows[i];
        var m = (r.innerText || '').match(/(\d+)\s*角球/);
        if (m && parseInt(m[1], 10) === t) {
            if (r.classList.contains('ml1-SoccerSummaryRow_Text-1')) return 'left';
            if (r.classList.contains('ml1-SoccerSummaryRow_Text-2')) return 'right';
        }
    }
    return 'unknown';
}

/* ================== 左右角球双触发逻辑 ================== */
var cornerObserver = null;
var cornerObserverRoot = null;
var cornerInitDone = false;
var seenCornerEvents = new Set();

var lrInited = false;
var lastLeftCorners = null;
var lastRightCorners = null;
var lastNotifiedNum = { left: -1, right: -1 };

function fireSideCorner(side, num) {
    if (side !== 'left' && side !== 'right') return;
    if (typeof num === 'number' && lastNotifiedNum[side] === num) return;
    if (typeof num === 'number') lastNotifiedNum[side] = num;

    showCornerText(side, '有角球有角球!!');
    playDingBeep();
    startSuperFlash($('#working'));
    setTimeout(function(){ stopSuperFlash($('#working')); }, 15000);
}

function handleCorner(t) {
    var s = detectSideByTotal(t);
    if (s !== 'left' && s !== 'right') s = 'right';
    fireSideCorner(s, t);
}

function parseCornerEventRow(row) {
    if (!row) return null;
    var leftEl = row.querySelector('.ml1-SoccerSummaryRow_Text-1');
    var rightEl = row.querySelector('.ml1-SoccerSummaryRow_Text-2');
    var timeEl = row.querySelector('.ml1-SoccerSummaryRow_Time');

    var side = null, txt = '';
    if (leftEl && /角球/.test(leftEl.innerText || '')) {
        side = 'left'; txt = (leftEl.innerText || '').trim();
    } else if (rightEl && /角球/.test(rightEl.innerText || '')) {
        side = 'right'; txt = (rightEl.innerText || '').trim();
    } else {
        return null;
    }

    var m = txt.match(/(\d+)/);
    if (!m) return null;
    var num = parseInt(m[1], 10);

    var tm = timeEl ? (timeEl.innerText || '').trim() : '';
    var rowTxt = (row.innerText || '').replace(/\s+/g, ' ').trim();
    var key = side + '|' + tm + '|' + num + '|' + rowTxt;
    return { side: side, num: num, key: key };
}

function scanCornerRows(triggerNotify) {
    var rows = document.querySelectorAll('.ml1-SoccerSummaryRow-eventrow');
    rows.forEach(function(row){
        var ev = parseCornerEventRow(row);
        if (!ev) return;
        if (!seenCornerEvents.has(ev.key)) {
            seenCornerEvents.add(ev.key);
            if (triggerNotify) fireSideCorner(ev.side, ev.num);
        }
    });
}

function ensureCornerObserver() {
    var root = document.querySelector('.ml1-SoccerSummary') || document.body;
    if (cornerObserver && cornerObserverRoot === root) return;

    if (cornerObserver) {
        cornerObserver.disconnect();
        cornerObserver = null;
    }

    scanCornerRows(false);
    cornerInitDone = true;
    cornerObserverRoot = root;

    cornerObserver = new MutationObserver(function () {
        if (!cornerInitDone) return;
        scanCornerRows(true);
    });
    cornerObserver.observe(root, { childList: true, subtree: true });
}

function stopCornerObserver() {
    if (cornerObserver) {
        cornerObserver.disconnect();
        cornerObserver = null;
    }
    cornerObserverRoot = null;
    cornerInitDone = false;
    seenCornerEvents.clear();
}

function getLiveSideCorners() {
    var left = null, right = null;
    var leftNodes = document.querySelectorAll('.ml1-SoccerSummaryRow_Text-1');
    var rightNodes = document.querySelectorAll('.ml1-SoccerSummaryRow_Text-2');

    leftNodes.forEach(function(el){
        var t = (el.innerText || '').trim();
        if (t.indexOf('角球') < 0) return;
        var m = t.match(/(\d+)/);
        if (!m) return;
        var n = parseInt(m[1], 10);
        if (left === null || n > left) left = n;
    });

    rightNodes.forEach(function(el){
        var t = (el.innerText || '').trim();
        if (t.indexOf('角球') < 0) return;
        var m = t.match(/(\d+)/);
        if (!m) return;
        var n = parseInt(m[1], 10);
        if (right === null || n > right) right = n;
    });

    return { left: left, right: right };
}

function checkSideCornersPolling() {
    var cur = getLiveSideCorners();

    if (!lrInited) {
        lastLeftCorners = cur.left;
        lastRightCorners = cur.right;
        lrInited = true;
        return;
    }

    if (cur.left !== null) {
        if (lastLeftCorners === null) lastLeftCorners = cur.left;
        else if (cur.left > lastLeftCorners) {
            fireSideCorner('left', cur.left);
            lastLeftCorners = cur.left;
        } else if (cur.left < lastLeftCorners) {
            lastLeftCorners = cur.left;
        }
    }

    if (cur.right !== null) {
        if (lastRightCorners === null) lastRightCorners = cur.right;
        else if (cur.right > lastRightCorners) {
            fireSideCorner('right', cur.right);
            lastRightCorners = cur.right;
        } else if (cur.right < lastRightCorners) {
            lastRightCorners = cur.right;
        }
    }
}

/* ================== 主循环（保持4.0框架） ================== */
function loop_finding() {
    var tar = document.getElementsByClassName(fuck_class_ad);
    if (tar.length) {
        createSoundUI();
        createWorkingBox();

        ensureCornerObserver();
        checkSideCornersPolling();

        var ad = tar[0];
        var odds = document.getElementsByClassName(suspendnum);

        if ((odds.length || (old_var !== "0" && old_var !== ad.innerHTML)) && show_notice === 0) {
            show_notice = 1;
            playDingBeep();
            startSuperFlash($('#working'));
            setTimeout(function(){ stopSuperFlash($('#working')); }, 15000);
        } else if (!odds.length) {
            show_notice = 0;
        }

        old_var = ad.innerHTML;

        var total = getTotalCorners();
        if (total !== null) {
            if (lastTotalCorners === null) lastTotalCorners = total;
            else if (total > lastTotalCorners) {
                for (var i = lastTotalCorners + 1; i <= total; i++) handleCorner(i);
                lastTotalCorners = total;
            }
        }
    } else {
        stopCornerObserver();
        lrInited = false;
        lastLeftCorners = null;
        lastRightCorners = null;
        lastNotifiedNum = { left: -1, right: -1 };
    }

    timer1 = setTimeout(loop_finding, 2000);
}

setTimeout(function(){
    lastTotalCorners = null;
    lrInited = false;
    lastLeftCorners = null;
    lastRightCorners = null;
    lastNotifiedNum = { left: -1, right: -1 };
    loop_finding();
}, 5000);

})();
