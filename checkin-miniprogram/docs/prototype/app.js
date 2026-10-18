/* 课堂签到交互原型
 * 同一套 render(state) 同时驱动左侧可操作的手机和流转图里的缩略图。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 示例数据
  const COURSES = [
    { id: 'db', name: '数据库原理 第 5 周', short: '数据库原理', place: '教学楼 B 204', radius: 50, count: 38 },
    { id: 'net', name: '计算机网络 第 5 周', short: '计算机网络', place: '实验楼 302', radius: 30, count: 12 },
    { id: 'se', name: '软件工程 第 4 周', short: '软件工程', place: '图书馆报告厅', radius: 100, count: 86 }
  ];
  const STUDENTS = [
    ['计科 2301', '林知夏', '2023010101'], ['计科 2301', '周以安', '2023010102'], ['计科 2301', '许南星', '2023010103'],
    ['计科 2301', '陈一鸣', '2023010104'], ['计科 2301', '赵书言', '2023010105'],
    ['计科 2302', '王泽宇', '2023020101'], ['计科 2302', '李沐阳', '2023020102'], ['计科 2302', '吴语桐', '2023020103'],
    ['计科 2302', '郑嘉禾', '2023020104']
  ];
  const BASE_RECORDS = [
    { c: 0, no: '2023010102', nm: '周以安', cl: '计科 2301', t: '10:21:46', d: 12.4, src: 'student', dev: '3b7c1e9a' },
    { c: 0, no: '2023010103', nm: '许南星', cl: '计科 2301', t: '10:20:05', d: 31.0, src: 'student', dev: '9d02f4c1' },
    { c: 0, no: '2023020101', nm: '王泽宇', cl: '计科 2302', t: '10:19:58', d: 8.7, src: 'student', dev: 'e51a77b0' },
    { c: 0, no: '2023010104', nm: '陈一鸣', cl: '计科 2301', t: '10:18:12', d: null, src: 'admin', dev: '', remark: '手机没电' },
    { c: 0, no: '2023020103', nm: '吴语桐', cl: '计科 2302', t: '10:17:40', d: 44.1, src: 'student', dev: '0c6b2d98' },
    { c: 2, no: '2023010105', nm: '赵书言', cl: '计科 2301', t: '09:12:31', d: 66.0, src: 'student', dev: '71fa03e2' },
    { c: 1, no: '2023020102', nm: '李沐阳', cl: '计科 2302', t: '08:05:09', d: 21.9, src: 'student', dev: 'a4c8e1f7' }
  ];

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const BASE = {
    screen: 'home',
    stu: { no: '2023010101', name: '林知夏', err: false },
    me: { no: '2023010101', name: '林知夏', cl: '计科 2301' },
    course: 0,
    dist: 74, acc: 15, bearing: -38,
    done: { se: '09:08' },
    used: {},
    holdFrac: 0,
    justDone: false,
    admin: 'active',
    tab: 'courses',
    sheet: null,
    editCourse: 0,
    radius: 50,
    recFilter: 'all',
    records: BASE_RECORDS,
    recSel: 0,
    confirmDel: false,
    exportStage: 'choose',
    exportScope: 'course',
    pending: 1,
    toast: null
  };
  let S = clone(BASE);

  // ---------------------------------------------------------------- 图标
  const ic = {
    back: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrow: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11h13m-5-5.5L17.5 11 12 16.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pin: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 13s4.5-4 4.5-7.3A4.5 4.5 0 0 0 2.5 5.7C2.5 9 7 13 7 13Z" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="5.8" r="1.6" fill="currentColor"/></svg>',
    check: '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="m2 5.2 2 2L8 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    search: '<svg width="17" height="17" viewBox="0 0 17 17" fill="none"><circle cx="7.5" cy="7.5" r="5.2" stroke="currentColor" stroke-width="1.8"/><path d="m11.5 11.5 3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    upload: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 12V3m-4 4 4-4 4 4M3 13v2h12v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    download: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3v9m-4-4 4 4 4-4M3 13v2h12v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    locate: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="4.2" stroke="currentColor" stroke-width="1.7"/><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    book: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 3.5h4.5A1.5 1.5 0 0 1 9 5v10a1.5 1.5 0 0 0-1.5-1.5H3v-10Zm12 0h-4.5A1.5 1.5 0 0 0 9 5v10a1.5 1.5 0 0 1 1.5-1.5H15v-10Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    people: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7" cy="6" r="2.8" stroke="currentColor" stroke-width="1.7"/><path d="M2 15c.6-2.8 2.5-4.2 5-4.2s4.4 1.4 5 4.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 3.5a2.6 2.6 0 0 1 0 5.1M13.5 11c1.4.5 2.2 1.7 2.5 3.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    list: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M6.5 4.5H15M6.5 9H15M6.5 13.5H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="3.2" cy="4.5" r="1.2" fill="currentColor"/><circle cx="3.2" cy="9" r="1.2" fill="currentColor"/><circle cx="3.2" cy="13.5" r="1.2" fill="currentColor"/></svg>',
    chat: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 3.5c-4.4 0-8 2.9-8 6.6 0 2.1 1.2 4 3 5.2l-.6 2.7 3.1-1.6c.8.2 1.6.3 2.5.3 4.4 0 8-2.9 8-6.6s-3.6-6.6-8-6.6Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="8" cy="10.2" r="1.1" fill="currentColor"/><circle cx="14" cy="10.2" r="1.1" fill="currentColor"/></svg>',
    warn: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex:none;margin-top:2px"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.6v4M8 11v.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  // ---------------------------------------------------------------- 公共部件
  const status = () => '<div class="status"><span>9:41</span><span class="sig"><svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="#13312E"/><rect x="5" y="5" width="3" height="6" rx="1" fill="#13312E"/><rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="#13312E"/><rect x="15" y="0" width="3" height="11" rx="1" fill="#13312E"/></svg><span class="bat"></span></span></div>';
  const capsule = '<div class="capsule"><span><span class="dots"><i></i><i></i><i></i></span></span><span><span class="ring"></span></span></div>';
  const nav = (title, back) =>
    `<div class="nav">${back ? `<button class="back tap" data-act="${back}" aria-label="返回">${ic.back}</button>` : ''}${title ? `<span class="ttl">${title}</span>` : ''}${capsule}</div>`;
  const frame = (inner, opts = {}) =>
    `<div class="app">${status()}${nav(opts.title || '', opts.back)}<div class="body">${inner}</div>${opts.overlay || ''}</div>`;
  const toast = (st) => (st.toast ? `<div class="toast">${st.toast}</div>` : '');
  const inRange = (st) => st.dist <= COURSES[st.course].radius;

  // ---------------------------------------------------------------- 首页
  function home() {
    return `<div class="app">${status()}<div class="nav">${capsule}</div>
      <div class="home-mark"><span class="dot"></span>课堂签到</div>
      <div class="ripple" aria-hidden="true"><i class="r4"></i><i class="r3"></i><i class="r2"></i><i class="pulse"></i><i class="r1"></i><span class="pin"></span><span class="me"></span></div>
      <div class="home-copy"><h1>在教室范围内<br>用手机签到</h1><p class="sub">学生用学号和姓名登录；老师和助教用微信登录后管理课程与记录。</p></div>
      <div class="choices">
        <button class="choice stu peb tap" data-act="go:stuLogin"><span><span class="t">我是学生</span><span class="d">学号 + 姓名登录，定位签到</span></span><span class="arr">${ic.arrow}</span></button>
        <button class="choice adm peb2 tap" data-act="go:admLogin"><span><span class="t">我是管理员</span><span class="d">微信授权登录，管理课程、学生、记录</span></span><span class="arr">${ic.arrow}</span></button>
      </div></div>`;
  }

  // ---------------------------------------------------------------- 学生登录
  function stuLogin(st) {
    const ready = st.stu.no.trim() && st.stu.name.trim();
    return frame(
      `<div class="pad" style="padding-top:18px">
        <h1>学生登录</h1>
        <p class="sub">学号和姓名需要与老师导入的名单一致。不需要密码。</p>
        <div style="display:grid;gap:18px;margin-top:34px">
          <div class="field"><label>学号</label><input class="input num peb3 ${st.stu.err ? 'err' : ''}" data-field="no" inputmode="numeric" placeholder="例如 2023010101" value="${st.stu.no}"></div>
          <div class="field"><label>姓名</label><input class="input peb3 ${st.stu.err ? 'err' : ''}" data-field="name" placeholder="与名单上一致" value="${st.stu.name}"></div>
          ${st.stu.err ? `<div class="errmsg">${ic.warn}<span>名单里没有这个学号和姓名的组合，请核对后再试，或联系老师确认是否已导入。</span></div>` : ''}
        </div>
      </div>
      <div style="position:absolute;right:24px;bottom:42px;display:flex;align-items:center;gap:14px">
        <span style="font-size:13px;color:var(--a-ink3)">下次会自动登录</span>
        <button class="go-round tap" data-act="stuSubmit" ${ready ? '' : 'disabled'} aria-label="登录">${ic.arrow}</button>
      </div>${toast(st)}`,
      { back: 'go:home' }
    );
  }

  // ---------------------------------------------------------------- 签到
  function radar(st) {
    const c = COURSES[st.course];
    const size = 240, mid = size / 2, maxR = mid - 6;
    const maxM = c.radius * 2.3;
    const k = maxR / maxM;
    const rT = c.radius * k;
    const inside = inRange(st);
    const done = st.done[c.id];
    const d = Math.min(st.dist, maxM);
    const a = (st.bearing * Math.PI) / 180;
    const ux = mid + d * k * Math.cos(a), uy = mid + d * k * Math.sin(a);
    const accR = Math.min(st.acc * k, 46);
    const diskFill = done ? 'rgba(19,49,46,.07)' : inside ? 'rgba(242,183,5,.26)' : 'rgba(47,125,109,.08)';
    const ringCol = done ? '#7E958F' : '#2F7D6D';
    return `<svg class="radar" viewBox="0 0 ${size} ${size}" aria-label="签到范围示意">
      <circle cx="${mid}" cy="${mid}" r="${maxR}" fill="none" stroke="#C9D8D2" stroke-width="1"/>
      <circle cx="${mid}" cy="${mid}" r="${rT * 2}" fill="none" stroke="#C9D8D2" stroke-width="1.2" stroke-dasharray="3 5"/>
      <circle cx="${mid}" cy="${mid}" r="${rT}" fill="${diskFill}" stroke="${ringCol}" stroke-width="2"/>
      <text x="${mid}" y="${mid - rT - 7}" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-size="11.5" font-weight="600" fill="${ringCol}">${c.radius} 米</text>
      <line x1="${mid}" y1="${mid}" x2="${ux}" y2="${uy}" stroke="#13312E" stroke-opacity=".35" stroke-width="1.4" stroke-dasharray="2 4"/>
      <circle cx="${mid}" cy="${mid}" r="9" fill="#F2B705" stroke="#FFFFFF" stroke-width="4"/>
      <circle cx="${mid}" cy="${mid}" r="12" fill="none" stroke="#2F7D6D" stroke-width="2"/>
      ${done ? '' : `<circle cx="${ux}" cy="${uy}" r="${accR}" fill="rgba(19,49,46,.10)"/>
      <circle cx="${ux}" cy="${uy}" r="7.5" fill="#13312E" stroke="#FFFFFF" stroke-width="3.5"/>`}
    </svg>`;
  }

  function holdArea(st) {
    const c = COURSES[st.course];
    if (st.used[c.id]) {
      return `<div class="used"><b>本机已<br>签过此课</b></div>
        <p class="hint">这台手机已经给其他同学签过这门课。每台手机每门课只能签到一次。</p>`;
    }
    if (st.done[c.id]) {
      return `${st.justDone ? '<span class="burst"></span>' : ''}<div class="seal ${st.justDone ? 'just' : ''}"><b>已签到</b><span>${st.done[c.id]}</span></div>
        <p class="hint">这门课已经签到成功，不能再次提交。</p>`;
    }
    const ok = inRange(st);
    const C = 2 * Math.PI * 67;
    const off = C * (1 - (st.holdFrac || 0));
    return `<button class="hold ${ok ? 'ready' : 'off'} ${st.holdFrac ? 'holding-static' : ''}" data-hold="1" ${ok ? '' : 'aria-disabled="true"'} aria-label="${ok ? '按住签到' : '不在范围内'}">
        <svg viewBox="0 0 148 148" width="148" height="148"><circle cx="74" cy="74" r="67" fill="none" stroke="#DCE6E1" stroke-width="5"/>
        <circle class="prog" cx="74" cy="74" r="67" fill="none" stroke="#13312E" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 74 74)"/></svg>
        <span class="face">${ok ? '<b>按住签到</b><span>约 1 秒</span>' : '<b>不在范围内</b><span>靠近教室后再试</span>'}</span>
      </button>
      <p class="hint">${ok ? '按住直到外圈走满，松手前不会提交。' : `需要进入 ${c.radius} 米范围内才能签到。`}</p>`;
  }

  function checkin(st) {
    const c = COURSES[st.course];
    const done = st.done[c.id];
    const used = st.used[c.id];
    const ok = inRange(st);
    const over = Math.max(0, Math.round(st.dist - c.radius));
    const chips = COURSES.map((x, i) =>
      `<button class="chip tap ${i === st.course ? 'on' : ''}" data-act="course:${i}">${st.done[x.id] ? `<span class="ok">${ic.check}</span>` : ''}${x.short}</button>`).join('');
    let stateTag;
    if (done) stateTag = `<span class="state wait peb3">签到于 ${done}</span>`;
    else if (used) stateTag = `<span class="state out peb3">本机已用</span>`;
    else stateTag = ok ? `<span class="state in peb3">在范围内</span>` : `<span class="state out peb3">还差 ${over} 米</span>`;
    return frame(
      `<div class="who"><span class="nm">${st.me.name}</span><span class="cl">${st.me.cl}　<span class="num">${st.me.no}</span></span><button class="link out tap" data-act="logout">退出</button></div>
      <div class="chips">${chips}</div>
      <div class="place">${ic.pin}<span>${c.place}　范围 <span class="num">${c.radius}</span> 米</span></div>
      ${radar(st)}
      <div class="reading">
        <div><div class="lbl">${done ? '签到时距离' : '距签到点'}</div><div class="big num">${Math.round(st.dist)}<small>米</small></div></div>
        <div class="meta">${stateTag}${done ? '' : `<span class="line"><span class="acc">精度 ±<span class="num">${st.acc}</span> 米</span><button class="link tap" data-act="relocate" style="display:inline-flex;gap:5px;align-items:center">${ic.locate}重新定位</button></span>`}</div>
      </div>
      <div class="holdwrap">${holdArea(st)}</div>${toast(st)}`,
      {}
    );
  }

  // ---------------------------------------------------------------- 管理员登录
  function admLogin(st) {
    return frame(
      `<div class="pad" style="padding-top:18px">
        <h1>管理员登录</h1>
        <p class="sub">用当前微信的身份进入管理后台，不需要账号密码。</p>
      </div>
      <div class="center" style="position:absolute;left:24px;right:24px;top:170px">
        <div class="waitring" style="width:168px;height:168px;border-style:solid;border-color:var(--a-line)"><div class="avatar" style="margin:0;width:92px;height:92px;border-radius:46px 38px 44px 36px / 40px 46px 38px 44px"><span style="transform:scale(1.9);display:block">${ic.chat}</span></div></div>
      </div>
      <div style="position:absolute;left:20px;right:20px;bottom:40px;display:grid;gap:16px">
        <p class="sub" style="margin:0;padding:0 6px">系统里还没有管理员时，第一个登录的微信会自动成为管理员；之后的人需要提交申请，由已有管理员通过。</p>
        <button class="pill cel peb tap" style="height:64px;font-size:17px" data-act="admLogin">${ic.chat}微信授权登录</button>
        <button class="link tap" style="justify-self:center" data-act="go:admApply">演示：未授权的微信登录</button>
      </div>${toast(st)}`,
      { back: 'go:home' }
    );
  }

  function admApply(st) {
    return frame(
      `<div class="pad" style="padding-top:18px">
        <h1>申请成为管理员</h1>
        <p class="sub">这个微信还不是管理员。填一个让同事认得出的称呼，提交后等待已有管理员通过。</p>
        <div class="field" style="margin-top:34px"><label>称呼</label><input class="input peb3" placeholder="例如 王老师" value="李助教"></div>
      </div>
      <div style="position:absolute;left:20px;right:20px;bottom:40px;display:grid">
        <button class="pill ink peb tap" style="height:60px" data-act="go:admPending">提交申请</button>
      </div>`,
      { back: 'go:admLogin' }
    );
  }

  function admPending(st) {
    return frame(
      `<div class="center" style="position:absolute;left:24px;right:24px;top:110px">
        <div class="waitring"><i></i></div>
        <h2 style="margin-top:12px">等待审核</h2>
        <p class="sub" style="max-width:270px">申请已提交。管理员在后台点「通过」后，你再次打开这一页就能进入。</p>
      </div>
      <div style="position:absolute;left:20px;right:20px;bottom:40px;display:grid;gap:14px">
        <button class="pill soft peb tap" style="height:58px" data-act="pendingRefresh">刷新状态</button>
        <button class="link tap" style="justify-self:center" data-act="admLogin">演示：审核已通过</button>
      </div>${toast(st)}`,
      { back: 'go:home' }
    );
  }

  // ---------------------------------------------------------------- 管理端：底部切换
  function dock(st) {
    const t = (id, label, icon) => `<button class="tap ${st.tab === id ? 'on' : ''}" data-act="tab:${id}">${icon}${label}</button>`;
    return `<nav class="dock">${t('courses', '课程', ic.book)}${t('students', '学生', ic.people)}${t('records', '记录', ic.list)}</nav>`;
  }
  const ahead = (title, cnt, st) =>
    `<div class="ahead"><h1 style="font-size:38px">${title}</h1><span class="cnt">${cnt}</span><button class="avatar tap" data-act="sheet:admins" aria-label="管理员">王${st.pending ? `<span class="badge">${st.pending}</span>` : ''}</button></div>`;

  function courses(st) {
    const rows = COURSES.map((c, i) => `
      <button class="crow peb3 tap" data-act="edit:${i}">
        <span class="glyph"><b>${c.radius}</b></span>
        <span><span class="nm">${c.name}</span><span class="ad" style="display:flex;gap:4px;align-items:center">${ic.pin}${c.place}</span></span>
        <span class="ct"><b>${c.count}</b><span>人已签到</span></span>
      </button>`).join('');
    return frame(
      `${ahead('课程', `${COURSES.length} 门`, st)}
      <p class="sub" style="padding:0 24px;margin-top:4px">圆圈里的数字是签到范围（米）。点课程可修改点位和范围。</p>
      <div class="list">${rows}</div>
      <button class="fab peb tap" data-act="edit:new">${ic.plus}新增课程</button>
      ${dock(st)}${toast(st)}`,
      { overlay: sheet(st) }
    );
  }

  function mapArt(radius) {
    const r = Math.max(26, Math.min(radius * 0.9, 96));
    return `<svg viewBox="0 0 343 230" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-label="地图选点">
      <rect width="343" height="230" fill="#DCE7E1"/>
      <path d="M-10 168 C 80 150, 140 190, 360 150" stroke="#C3DCEB" stroke-width="22" fill="none"/>
      <path d="M40 -10 L 70 240" stroke="#FFFFFF" stroke-width="12"/>
      <path d="M-10 70 L 360 92" stroke="#FFFFFF" stroke-width="14"/>
      <path d="M230 -10 L 250 240" stroke="#FFFFFF" stroke-width="9"/>
      <rect x="86" y="104" width="62" height="40" rx="6" fill="#CBDAD3"/><rect x="160" y="18" width="56" height="44" rx="6" fill="#CBDAD3"/>
      <rect x="264" y="104" width="64" height="34" rx="6" fill="#CBDAD3"/><rect x="88" y="10" width="54" height="48" rx="6" fill="#CBDAD3"/>
      <rect x="150" y="102" width="70" height="48" rx="7" fill="#BFD2C9"/>
      <text x="185" y="132" text-anchor="middle" font-family="Noto Sans SC, sans-serif" font-size="11" fill="#4E6A65">教学楼 B</text>
      <circle cx="172" cy="112" r="${r}" fill="rgba(47,125,109,.16)" stroke="#2F7D6D" stroke-width="2"/>
      <path d="M172 112 l-9 -20 a10 10 0 1 1 18 0 z" fill="#D9415B"/><circle cx="172" cy="89" r="3.6" fill="#FFFFFF"/>
    </svg>`;
  }

  function courseEdit(st) {
    const isNew = st.editCourse === 'new';
    const c = isNew ? { name: '', place: '还没有选择点位', radius: st.radius } : COURSES[st.editCourse];
    const r = st.radius;
    const pct = ((r - 10) / (500 - 10)) * 100;
    return frame(
      `<div class="map">${mapArt(r)}<div class="map-btns"><button class="pill soft peb3 tap" data-act="toast:已打开地图选点">${ic.pin}在地图上选点</button><button class="pill soft peb3 tap" data-act="toast:已使用当前位置">${ic.locate}用当前位置</button></div></div>
      <div class="addr">${ic.pin}<span>${isNew ? '教学楼 B 东门（已选）' : c.place}　<span class="num">30.5123, 114.4101</span></span></div>
      <div class="pad" style="display:grid;gap:14px;margin-top:14px">
        <div class="field"><label>课程名称</label><input class="input peb3" style="height:52px;font-size:16px" placeholder="例如 数据库原理 第 5 周" value="${isNew ? '' : c.name}"></div>
      </div>
      <div class="radius">
        <div class="top"><span style="font-size:14px;color:var(--a-ink2);font-weight:500">签到范围</span><span class="val">${r}<small>米</small></span></div>
        <div class="slider tap" data-act="slider"><span class="track"></span><span class="fill" style="width:${pct}%"></span><span class="knob" style="left:${pct}%"></span></div>
        <div class="presets">${[30, 50, 100, 200].map((v) => `<button class="chip tap ${v === r ? 'on' : ''}" data-act="radius:${v}">${v} 米</button>`).join('')}</div>
      </div>
      <div style="position:absolute;left:20px;right:20px;bottom:26px;display:flex;gap:12px;align-items:center">
        ${isNew ? '' : '<button class="link danger tap" data-act="sheet:delCourse">删除课程</button>'}
        <button class="pill cel peb tap" style="flex:1;height:58px" data-act="saveCourse">${isNew ? '创建课程' : '保存修改'}</button>
      </div>${toast(st)}`,
      { title: isNew ? '新增课程' : '编辑课程', back: 'tab:courses', overlay: sheet(st) }
    );
  }

  function students(st) {
    const groups = {};
    STUDENTS.forEach(([cl, nm, no]) => (groups[cl] = groups[cl] || []).push([nm, no]));
    const total = { '计科 2301': 43, '计科 2302': 43 };
    const body = Object.entries(groups).map(([cl, list]) =>
      `<div class="grp">${cl}<small>${total[cl]} 人</small></div>${list.slice(0, cl === '计科 2301' ? 5 : 3).map(([nm, no]) =>
        `<div class="srow"><span class="av">${nm[0]}</span><span class="nm">${nm}</span><span class="no">${no}</span></div>`).join('')}`).join('');
    return frame(
      `${ahead('学生', '86 人', st)}
      <div class="tools"><button class="pill ink sm peb tap" data-act="import">${ic.upload}导入名单</button><button class="pill soft sm peb2 tap" data-act="toast:模板已下载，可直接在微信里打开">${ic.download}下载模板</button></div>
      <div class="search peb3">${ic.search}搜索学号或姓名</div>
      <div class="filters"><button class="chip on">全部 <span class="n">86</span></button><button class="chip">计科 2301 <span class="n">43</span></button><button class="chip">计科 2302 <span class="n">43</span></button></div>
      ${body}${dock(st)}${toast(st)}`,
      { overlay: sheet(st) }
    );
  }

  function records(st) {
    const list = st.records.filter((r) => st.recFilter === 'all' || r.c === st.recFilter);
    const rows = list.slice(0, 6).map((r) => {
      const i = st.records.indexOf(r);
      return `<button class="rrow peb3 tap" data-act="rec:${i}">
        <span class="nm">${r.nm}<small>${r.no}</small></span><span class="tm">${r.t.slice(0, 5)}</span>
        <span class="sm">${r.cl}　${COURSES[r.c].short}</span>
        ${r.src === 'admin' ? '<span class="tag">补录</span>' : `<span class="tag ok">${r.d} 米</span>`}
      </button>`;
    }).join('');
    const chips = [['all', '全部课程']].concat(COURSES.map((c, i) => [i, c.short]))
      .map(([v, l]) => `<button class="chip tap ${st.recFilter === v ? 'on' : ''}" data-act="filter:${v}">${l}</button>`).join('');
    return frame(
      `${ahead('签到记录', `${list.length} 条`, st)}
      <div class="tools"><button class="pill ink sm peb tap" data-act="sheet:export">${ic.download}导出 Excel</button><button class="pill soft sm peb2 tap" data-act="sheet:recAdd">${ic.plus}补录</button></div>
      <div class="filters">${chips}</div>
      <div class="list" style="gap:8px;padding-top:12px">${rows || '<p class="sub" style="padding:20px 8px">这门课还没有人签到。</p>'}</div>
      ${dock(st)}${toast(st)}`,
      { overlay: sheet(st) }
    );
  }

  // ---------------------------------------------------------------- 底部抽屉
  function sheet(st) {
    if (!st.sheet) return '';
    let inner = '';
    const r = st.records[st.recSel] || st.records[0];
    switch (st.sheet) {
      case 'importing':
        inner = `<h3>正在导入</h3><p class="sub" style="margin:0">学生名单.xlsx　读取班级、姓名、学号三列</p><div class="progress"><i></i></div>`;
        break;
      case 'import':
        inner = `<h3>导入完成</h3>
          <div class="stats"><div><b>40</b><span>新增</span></div><div><b>3</b><span>更新</span></div><div><b style="color:var(--a-rouge)">2</b><span>跳过</span></div></div>
          <div class="probs"><div><b>第 7 行</b>学号「2023 0105」格式不对</div><div><b>第 19 行</b>学号与第 4 行重复</div></div>
          <p class="sub" style="margin:0">已存在的学号按新名单更新班级和姓名。跳过的行改好后可以再导入一次。</p>
          <button class="pill ink peb tap" data-act="close">完成</button>`;
        break;
      case 'recEdit':
        inner = `<h3>修改签到记录</h3>
          <dl class="kv"><dt>课程</dt><dd>${COURSES[r.c].name}</dd><dt>来源</dt><dd>${r.src === 'admin' ? '管理员补录' : '学生签到'}</dd>${r.src === 'admin' ? '' : `<dt>位置</dt><dd>距点位 ${r.d} 米（范围 ${COURSES[r.c].radius} 米）</dd><dt>设备</dt><dd>${r.dev}</dd>`}</dl>
          <div class="row2"><div class="field"><label>学号</label><input class="input num peb3" style="height:50px;font-size:16px" value="${r.no}"></div><div class="field"><label>姓名（按学号匹配）</label><div class="input peb3" style="height:50px;font-size:16px;background:var(--a-mist2)">${r.nm}</div></div></div>
          <div class="row2"><div class="field"><label>签到时间</label><div class="input num peb3" style="height:50px;font-size:16px">10月13日 ${r.t}</div></div></div>
          <div class="field"><label>备注</label><input class="input peb3" style="height:50px;font-size:15px" placeholder="可选" value="${r.remark || ''}"></div>
          ${st.confirmDel
            ? `<div class="confirm peb3"><span>删除后，${r.nm} 和这台手机都不能再自助签到这门课；需要时可以用「补录」恢复。</span><div style="display:flex;gap:10px"><button class="pill sm tap" style="background:var(--a-rouge);color:#fff;border-radius:16px 12px 15px 11px" data-act="delRec">确认删除</button><button class="pill sm soft tap" style="border-radius:12px 16px 11px 15px" data-act="cancelDel">取消</button></div></div>`
            : `<div style="display:flex;gap:12px;align-items:center"><button class="link danger tap" data-act="askDel">删除记录</button><button class="pill cel peb tap" style="flex:1" data-act="saveRec">保存修改</button></div>`}`;
        break;
      case 'recAdd':
        inner = `<h3>补录签到</h3><p class="sub" style="margin:0">给定位有问题或手机没电的同学补一条记录。每人每门课仍然只能有一条。</p>
          <div class="field"><label>课程</label><div class="input peb3" style="height:50px;font-size:16px;justify-content:space-between">${COURSES[0].name}<span style="color:var(--a-ink3)">更换</span></div></div>
          <div class="row2"><div class="field"><label>学号</label><input class="input num peb3" style="height:50px;font-size:16px" value="2023010101"></div><div class="field"><label>姓名</label><div class="input peb3" style="height:50px;font-size:16px;background:var(--a-mist2)">林知夏</div></div></div>
          <div class="field"><label>备注</label><input class="input peb3" style="height:50px;font-size:15px" value="定位失败，课上点名确认"></div>
          <button class="pill cel peb tap" data-act="addRec">补录</button>`;
        break;
      case 'export':
        if (st.exportStage === 'choose') {
          inner = `<h3>导出签到记录</h3>
            <div style="display:grid;gap:10px">
              <button class="crow peb3 tap" style="grid-template-columns:24px 1fr;padding:14px 16px" data-act="scope:course"><span style="width:22px;height:22px;border-radius:50%;border:2px solid var(--a-cel);display:grid;place-items:center">${st.exportScope === 'course' ? '<i style="width:10px;height:10px;border-radius:50%;background:var(--a-cel)"></i>' : ''}</span><span><span class="nm" style="font-size:15px">当前课程</span><span class="ad">${st.recFilter === 'all' ? COURSES[0].name : COURSES[st.recFilter].name}</span></span></button>
              <button class="crow peb3 tap" style="grid-template-columns:24px 1fr;padding:14px 16px" data-act="scope:all"><span style="width:22px;height:22px;border-radius:50%;border:2px solid var(--a-cel);display:grid;place-items:center">${st.exportScope === 'all' ? '<i style="width:10px;height:10px;border-radius:50%;background:var(--a-cel)"></i>' : ''}</span><span><span class="nm" style="font-size:15px">全部课程</span><span class="ad">按课程、签到时间排序</span></span></button>
            </div>
            <p class="sub" style="margin:0">表格包含课程、班级、学号、姓名、签到时间、距离和来源，已删除的记录不导出。</p>
            <button class="pill ink peb tap" data-act="makeExport">${ic.download}生成 Excel</button>`;
        } else if (st.exportStage === 'making') {
          inner = `<h3>正在生成</h3><p class="sub" style="margin:0">云函数正在整理记录并写入表格</p><div class="progress"><i></i></div>`;
        } else {
          inner = `<h3>已生成</h3>
            <div class="crow peb3" style="grid-template-columns:48px 1fr;cursor:default"><span class="glyph" style="width:48px;height:48px;background:#E3F1EA;color:var(--a-cel2)">${ic.list}</span><span><span class="nm" style="font-size:15px">签到记录-数据库原理 第 5 周-202610131030.xlsx</span><span class="ad"><span class="num">38</span> 条记录</span></span></div>
            <p class="sub" style="margin:0">打开后可以用右上角菜单转发给自己或保存到手机。</p>
            <button class="pill ink peb tap" data-act="close">打开文件</button>`;
        }
        break;
      case 'admins':
        inner = `<h3>管理员</h3>
          ${st.pending ? `<div class="arow"><span class="av p">李</span><span><span class="nm">李助教</span><br><span class="st">申请成为管理员　尾号 <span class="num">7Hk2aQ</span></span></span><span class="acts"><button class="pill sm cel tap" style="border-radius:16px 12px 15px 11px" data-act="approve">通过</button><button class="pill sm soft tap" style="border-radius:12px 16px 11px 15px" data-act="reject">拒绝</button></span></div>` : ''}
          <div class="arow"><span class="av">王</span><span><span class="nm">王老师（你）</span><br><span class="st">已启用　尾号 <span class="num">p3XcQ1</span></span></span></div>
          <div class="arow"><span class="av">刘</span><span><span class="nm">刘老师</span><br><span class="st">已启用　尾号 <span class="num">Z0f9Tb</span></span></span></div>
          <button class="pill soft peb tap" data-act="close">关闭</button>`;
        break;
      case 'delCourse':
        inner = `<h3>删除这门课程？</h3><p class="sub" style="margin:0">${COURSES[st.editCourse === 'new' ? 0 : st.editCourse].name} 和它的 ${COURSES[st.editCourse === 'new' ? 0 : st.editCourse].count} 条签到记录会一起删除，无法恢复。需要留档请先导出 Excel。</p>
          <div class="row2"><button class="pill soft peb tap" data-act="close">保留</button><button class="pill peb2 tap" style="background:var(--a-rouge);color:#fff" data-act="delCourse">删除课程</button></div>`;
        break;
    }
    return `<div class="scrim tap" data-act="close"></div><div class="sheet"><span class="grab"></span>${inner}</div>`;
  }

  // ---------------------------------------------------------------- 分发
  function render(st) {
    switch (st.screen) {
      case 'home': return home(st);
      case 'stuLogin': return stuLogin(st);
      case 'checkin': return checkin(st);
      case 'admLogin': return admLogin(st);
      case 'admApply': return admApply(st);
      case 'admPending': return admPending(st);
      case 'courses': return courses(st);
      case 'courseEdit': return courseEdit(st);
      case 'students': return students(st);
      case 'records': return records(st);
    }
    return home(st);
  }

  // 当前状态 → 说明面板的 key
  function keyOf(st) {
    if (st.screen === 'checkin') {
      const c = COURSES[st.course];
      if (st.used[c.id]) return 'ck_used';
      if (st.done[c.id]) return 'ck_done';
      if (st.holdFrac) return 'ck_hold';
      return inRange(st) ? 'ck_in' : 'ck_out';
    }
    if (st.sheet === 'import' || st.sheet === 'importing') return 'importRes';
    if (st.sheet === 'recEdit') return 'recEdit';
    if (st.sheet === 'recAdd') return 'recAdd';
    if (st.sheet === 'export') return 'export';
    if (st.sheet === 'admins') return 'admins';
    if (st.sheet === 'delCourse') return 'courseEdit';
    return st.screen;
  }

  // ---------------------------------------------------------------- 界面说明与预设
  const P = (patch) => Object.assign(clone(BASE), patch);
  const NODES = {
    home: { who: '公共', title: '选择身份', state: P({}), desc: '小程序的唯一入口。学生和管理员共用一套小程序，在这里分流。', rules: ['本机登录过的学生点「我是学生」会直接进入签到页。'] },
    stuLogin: { who: '学生端', title: '学生登录', state: P({ screen: 'stuLogin' }), desc: '输入学号和姓名，云函数到学生名单里匹配。不设密码，也不绑定微信。', rules: ['学号与姓名必须同时匹配名单，否则提示核对或联系老师。', '登录信息只保存在本机，下次点「我是学生」直接进入签到页。'] },
    ck_out: { who: '学生端', title: '签到：不在范围内', state: P({ screen: 'checkin', dist: 74 }), desc: '进入签到页即开始定位，点位、范围和你的位置画在同一张图里。超出范围时按钮置灰。', rules: ['距离由云函数按 Haversine 公式重新计算，前端显示仅供参考。', '超出课程设置的阈值（默认 50 米）一律拒绝。'] },
    ck_in: { who: '学生端', title: '签到：在范围内', state: P({ screen: 'checkin', dist: 32, bearing: -28 }), desc: '进入范围后圆圈变成黄色，按钮亮起。', rules: ['需要按住约 1 秒，防止误触提交。', '提交时再次定位，以提交瞬间的位置为准。'] },
    ck_hold: { who: '学生端', title: '按住签到', state: P({ screen: 'checkin', dist: 32, bearing: -28, holdFrac: 0.62 }), desc: '外圈随按住时间走满，走满才提交；中途松手外圈退回，什么都不会发生。', rules: ['提交只有一次机会：服务端用「课程ID_设备ID」作为记录主键，重复提交只会有一条成功。'] },
    ck_done: { who: '学生端', title: '已签到', state: P({ screen: 'checkin', dist: 32, done: { se: '09:08', db: '10:24' } }), desc: '签到成功后按钮变成带时间的印章，这门课不能再次提交。', rules: ['同一学号在同一课程只能有一条记录，换手机也不行。', '不区分迟到和缺勤，也不设签到起止时间。'] },
    ck_used: { who: '学生端', title: '本机已签过此课', state: P({ screen: 'checkin', dist: 20, used: { db: true } }), desc: '这台手机已经给别人签过当前课程时的状态。', rules: ['同一课程同一设备 ID 只能签 1 次，无例外。', '清理缓存会让本地设备 ID 重新生成，所以云函数还会比对同一微信，防止借手机代签。'] },
    admLogin: { who: '管理端', title: '管理员登录', state: P({ screen: 'admLogin' }), desc: '点「微信授权登录」，云函数从调用上下文拿到 OPENID 判断身份，前端无法伪造。', rules: ['系统还没有管理员时，第一个登录的微信自动成为管理员。', '已是管理员直接进入课程页。'] },
    admApply: { who: '管理端', title: '申请成为管理员', state: P({ screen: 'admApply' }), desc: '不是管理员的微信登录后来到这里，填写称呼提交申请。', rules: [] },
    admPending: { who: '管理端', title: '等待审核', state: P({ screen: 'admPending' }), desc: '申请已提交，等待已有管理员在后台通过或拒绝。', rules: ['被拒绝的申请会被删除，可以重新申请。'] },
    courses: { who: '管理端', title: '课程列表', state: P({ screen: 'courses', tab: 'courses' }), desc: '管理端首页。每门课程一个签到点位，圆圈里是签到范围，右侧是已签到人数。', rules: ['不支持一门课程多个点位。', '建议每节课新建一条课程，例如「数据库原理 第 5 周」。'] },
    courseEdit: { who: '管理端', title: '新增 / 编辑课程', state: P({ screen: 'courseEdit', tab: 'courses', editCourse: 0, radius: 50 }), desc: '在地图上选点或直接用当前位置作为签到点位，再设置距离阈值。', rules: ['阈值默认 50 米，可设 10–500 米（服务端允许最大 1000 米）。', '删除课程会一并删除它的签到记录。'] },
    admins: { who: '管理端', title: '管理员与审核', state: P({ screen: 'courses', tab: 'courses', sheet: 'admins' }), desc: '点右上角头像打开。待审核的申请排在最前面。', rules: [] },
    students: { who: '管理端', title: '学生管理', state: P({ screen: 'students', tab: 'students' }), desc: '按班级分组查看学生名单，支持按学号或姓名搜索。', rules: ['导入 Excel 需要包含「班级」「姓名」「学号」三列，列顺序不限。'] },
    importRes: { who: '管理端', title: '导入结果', state: P({ screen: 'students', tab: 'students', sheet: 'import' }), desc: '导入后显示新增、更新、跳过的人数，以及跳过的行号和原因。', rules: ['学号作为主键：已存在的学号按新名单更新。', '上传的原始文件解析完立即从云存储删除。'] },
    records: { who: '管理端', title: '签到记录', state: P({ screen: 'records', tab: 'records' }), desc: '按课程筛选全部签到记录，点一条可修改或删除；右上可以补录和导出。', rules: [] },
    recEdit: { who: '管理端', title: '修改 / 删除记录', state: P({ screen: 'records', tab: 'records', sheet: 'recEdit', recSel: 0 }), desc: '可以更正学生、签到时间和备注。设备与位置信息只读。', rules: ['删除为软删除：该学生和这台手机仍然不能再自助签到这门课。', '需要恢复时用「补录」，会复用原记录。'] },
    recAdd: { who: '管理端', title: '补录签到', state: P({ screen: 'records', tab: 'records', sheet: 'recAdd' }), desc: '学生定位失败或手机没电时，由管理员补一条记录，来源标记为「补录」。', rules: ['同一课程同一学号已有记录时不能补录。'] },
    export: { who: '管理端', title: '导出 Excel', state: P({ screen: 'records', tab: 'records', sheet: 'export' }), desc: '选择导出范围后由云函数生成 .xlsx 存入云存储，小程序下载后直接打开，可转发或保存。', rules: [] }
  };

  // 每个界面能去哪里（右侧「从这里可以去」）
  const GO = {
    home: [['stuLogin', '我是学生'], ['admLogin', '我是管理员']],
    stuLogin: [['ck_out', '登录成功'], ['home', '返回']],
    ck_out: [['ck_in', '走进范围'], ['ck_used', '本机已给他人签过'], ['home', '退出登录']],
    ck_in: [['ck_hold', '按住按钮'], ['ck_out', '走出范围']],
    ck_hold: [['ck_done', '按满约 1 秒'], ['ck_in', '中途松手']],
    ck_done: [['home', '退出登录']],
    ck_used: [['home', '退出登录']],
    admLogin: [['courses', '已是管理员 / 首个登录'], ['admApply', '未授权的微信']],
    admApply: [['admPending', '提交申请']],
    admPending: [['courses', '审核通过后再进'], ['home', '返回首页']],
    courses: [['courseEdit', '新增或点课程'], ['admins', '点头像'], ['students', '底部切到学生'], ['records', '底部切到记录']],
    courseEdit: [['courses', '保存 / 删除 / 返回']],
    admins: [['courses', '关闭']],
    students: [['importRes', '导入名单'], ['courses', '切到课程'], ['records', '切到记录']],
    importRes: [['students', '完成']],
    records: [['recEdit', '点一条记录'], ['recAdd', '补录'], ['export', '导出 Excel'], ['courses', '切到课程']],
    recEdit: [['records', '保存 / 删除']],
    recAdd: [['records', '补录完成']],
    export: [['records', '打开文件后返回']]
  };

  // ---------------------------------------------------------------- 主手机
  const phone = document.getElementById('phone');
  const screenEl = document.getElementById('screen');
  let toastTimer = 0;
  let holdTimer = 0;

  function fit() {
    const w = screenEl.clientWidth;
    phone.style.transform = `scale(${w / 375})`;
  }

  function showToast(msg) {
    S.toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { S.toast = null; paint(); }, 1900);
  }

  function paint() {
    phone.innerHTML = render(S);
    const key = keyOf(S);
    const n = NODES[key] || NODES.home;
    document.getElementById('now-who').textContent = n.who;
    document.getElementById('now-title').textContent = n.title;
    document.getElementById('now-desc').textContent = n.desc;
    document.getElementById('now-rules').innerHTML = n.rules.map((r) => `<li>${r}</li>`).join('');
    document.getElementById('now-go').innerHTML = (GO[key] || []).map(([k, why]) =>
      `<button type="button" class="chip-btn" data-node="${k}"><b>${NODES[k].title}</b><small>${why}</small></button>`).join('');
    document.getElementById('sim').hidden = S.screen !== 'checkin';
    document.querySelectorAll('.node').forEach((el) => el.classList.toggle('active', el.dataset.node === key));
    const role = S.screen === 'home' ? 'home' : n.who === '学生端' ? 'student' : 'admin';
    document.querySelectorAll('.roles button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.role === role)));
    S.justDone = false;
  }

  function jump(key) {
    clearTimeout(holdTimer);
    S = clone(NODES[key].state);
    syncSim();
    paint();
  }

  function act(a) {
    const [cmd, arg] = a.split(':');
    switch (cmd) {
      case 'go':
        S.screen = arg; S.sheet = null; S.stu.err = false;
        if (arg === 'stuLogin') S.stu = { no: '2023010101', name: '林知夏', err: false };
        break;
      case 'stuSubmit':
        if (S.stu.no.trim() === S.me.no && S.stu.name.trim() === S.me.name) { S.screen = 'checkin'; S.stu.err = false; }
        else S.stu.err = true;
        break;
      case 'logout': S = clone(BASE); break;
      case 'course': S.course = Number(arg); S.holdFrac = 0; break;
      case 'relocate':
        S.dist = Math.max(0, Math.round(S.dist + (Math.random() * 6 - 3)));
        S.acc = Math.max(5, Math.round(S.acc + (Math.random() * 6 - 3)));
        syncSim(); showToast('位置已更新'); break;
      case 'admLogin': S.screen = 'courses'; S.tab = 'courses'; showToast('已登录'); break;
      case 'pendingRefresh': showToast('还在等待审核'); break;
      case 'tab': S.screen = arg; S.tab = arg; S.sheet = null; break;
      case 'edit':
        S.screen = 'courseEdit';
        S.editCourse = arg === 'new' ? 'new' : Number(arg);
        S.radius = arg === 'new' ? 50 : COURSES[Number(arg)].radius;
        break;
      case 'radius': S.radius = Number(arg); break;
      case 'saveCourse': S.screen = 'courses'; showToast(S.editCourse === 'new' ? '课程已创建' : '修改已保存'); break;
      case 'delCourse': S.sheet = null; S.screen = 'courses'; showToast('课程已删除'); break;
      case 'sheet':
        S.sheet = arg; S.confirmDel = false;
        if (arg === 'export') S.exportStage = 'choose';
        break;
      case 'close': S.sheet = null; S.confirmDel = false; break;
      case 'import':
        S.sheet = 'importing'; paint();
        setTimeout(() => { if (S.sheet === 'importing') { S.sheet = 'import'; paint(); } }, 1100);
        return;
      case 'rec': S.recSel = Number(arg); S.sheet = 'recEdit'; S.confirmDel = false; break;
      case 'askDel': S.confirmDel = true; break;
      case 'cancelDel': S.confirmDel = false; break;
      case 'delRec':
        S.records = S.records.filter((_, i) => i !== S.recSel);
        S.sheet = null; S.confirmDel = false; showToast('记录已删除'); break;
      case 'saveRec': S.sheet = null; showToast('修改已保存'); break;
      case 'addRec':
        if (!S.records.some((r) => r.no === '2023010101' && r.c === 0)) {
          S.records = [{ c: 0, no: '2023010101', nm: '林知夏', cl: '计科 2301', t: '10:31:02', d: null, src: 'admin', dev: '', remark: '定位失败，课上点名确认' }].concat(S.records);
          S.sheet = null; showToast('已补录');
        } else { S.sheet = null; showToast('林知夏 已经签到过这门课了'); }
        break;
      case 'filter': S.recFilter = arg === 'all' ? 'all' : Number(arg); break;
      case 'scope': S.exportScope = arg; break;
      case 'makeExport':
        S.exportStage = 'making'; paint();
        setTimeout(() => { if (S.sheet === 'export') { S.exportStage = 'done'; paint(); } }, 1200);
        return;
      case 'approve': S.pending = 0; showToast('已通过，李助教现在是管理员'); break;
      case 'reject': S.pending = 0; showToast('已拒绝申请'); break;
      case 'toast': showToast(arg); break;
      case 'slider': return;
    }
    paint();
  }

  phone.addEventListener('click', (e) => {
    const slider = e.target.closest('[data-act="slider"]');
    if (slider) {
      const rect = slider.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      S.radius = Math.round((10 + f * 490) / 5) * 5;
      paint();
      return;
    }
    const t = e.target.closest('[data-act]');
    if (t) act(t.dataset.act);
  });

  phone.addEventListener('input', (e) => {
    const f = e.target.dataset.field;
    if (!f) return;
    S.stu[f] = e.target.value;
    S.stu.err = false;
    e.target.classList.remove('err');
    const btn = phone.querySelector('[data-act="stuSubmit"]');
    if (btn) btn.disabled = !(S.stu.no.trim() && S.stu.name.trim());
  });
  phone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset.field) act('stuSubmit');
  });

  // 按住签到：外圈 0.9 秒走满才提交
  function startHold(e) {
    const btn = e.target.closest('[data-hold]');
    if (!btn || !btn.classList.contains('ready')) return;
    e.preventDefault();
    btn.classList.add('holding');
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      const c = COURSES[S.course];
      const now = new Date();
      S.done = Object.assign({}, S.done, { [c.id]: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` });
      S.holdFrac = 0;
      paint();
      S.justDone = true;
      phone.innerHTML = render(S);
      S.justDone = false;
      showToast('签到成功');
      const sr = document.getElementById('now-title');
      if (sr) sr.textContent = NODES.ck_done.title;
    }, 900);
  }
  function endHold() {
    const btn = phone.querySelector('.hold.holding');
    if (btn) btn.classList.remove('holding');
    clearTimeout(holdTimer);
  }
  phone.addEventListener('pointerdown', startHold);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => phone.addEventListener(ev, endHold));
  phone.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && e.target.closest('[data-hold]') && !e.repeat) startHold(e); });
  phone.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') endHold(); });

  // 侧栏
  document.querySelector('.roles').addEventListener('click', (e) => {
    const b = e.target.closest('[data-role]');
    if (!b) return;
    jump({ home: 'home', student: 'ck_out', admin: 'courses' }[b.dataset.role]);
  });
  document.getElementById('now-go').addEventListener('click', (e) => {
    const b = e.target.closest('[data-node]');
    if (b) jump(b.dataset.node);
  });

  const simDist = document.getElementById('sim-dist');
  const simAcc = document.getElementById('sim-acc');
  function syncSim() {
    simDist.value = Math.min(140, S.dist);
    simAcc.value = S.acc;
    document.getElementById('sim-dist-out').textContent = `${Math.round(S.dist)} 米`;
    document.getElementById('sim-acc-out').textContent = `±${S.acc} 米`;
  }
  simDist.addEventListener('input', () => { S.dist = Number(simDist.value); syncSim(); paint(); });
  simAcc.addEventListener('input', () => { S.acc = Number(simAcc.value); syncSim(); paint(); });

  // ---------------------------------------------------------------- 流转图
  const COLW = 220, X0 = 40;
  const ROWY = [84, 520, 930, 1340];
  const LAYOUT = {
    home: [0, 0], stuLogin: [1, 0], ck_out: [2, 0], ck_in: [3, 0], ck_hold: [4, 0], ck_done: [5, 0], ck_used: [6, 0],
    admLogin: [0, 1], courses: [1, 1], courseEdit: [2, 1], admins: [3, 1],
    admApply: [0, 2], students: [1, 2], importRes: [2, 2],
    admPending: [0, 3], records: [1, 3], recEdit: [2, 3], recAdd: [3, 3], export: [4, 3]
  };
  const TW = 156, TH = 324;
  const EDGES = [
    ['home', 'stuLogin', '我是学生'],
    ['stuLogin', 'ck_out', '登录成功'],
    ['ck_out', 'ck_in', '走进范围'],
    ['ck_in', 'ck_hold', '按住'],
    ['ck_hold', 'ck_done', '按满 1 秒'],
    ['ck_hold', 'ck_in', '中途松手', 'below'],
    ['ck_out', 'ck_used', '本机已给他人签过', 'above'],
    ['home', 'admLogin', '我是管理员', 'down'],
    ['admLogin', 'courses', '已授权'],
    ['admLogin', 'admApply', '未授权', 'down'],
    ['admApply', 'admPending', '提交申请', 'down'],
    ['admPending', 'courses', '通过后', 'back'],
    ['courses', 'courseEdit', '点课程'],
    ['courseEdit', 'admins', '', 'none'],
    ['courses', 'admins', '点头像', 'above'],
    ['courses', 'students', '底部切换', 'downDash'],
    ['students', 'importRes', '导入名单'],
    ['students', 'records', '底部切换', 'downDash'],
    ['records', 'recEdit', '点记录'],
    ['records', 'recAdd', '补录', 'below'],
    ['records', 'export', '导出 Excel', 'below2']
  ];

  function buildFlow() {
    const flow = document.getElementById('flow');
    const pos = {};
    let html = '<span class="lane" style="top:26px">学生端</span><span class="lane" style="top:430px;left:auto;right:auto;transform:none">管理端</span>';
    Object.entries(LAYOUT).forEach(([k, [col, row]]) => {
      const x = X0 + col * COLW;
      const y = ROWY[row];
      pos[k] = { x, y };
      const n = NODES[k];
      html += `<div class="node" role="button" tabindex="0" data-node="${k}" style="left:${x}px;top:${y}px" aria-label="跳到：${n.title}">
        <div class="thumb" inert><div class="screen-inner">${render(n.state)}</div></div>
        <div class="cap">${n.title}<small>${n.who}</small></div></div>`;
    });

    // 连线
    const L = (k) => ({ l: pos[k].x, r: pos[k].x + TW, t: pos[k].y, b: pos[k].y + TH, cx: pos[k].x + TW / 2, cy: pos[k].y + TH / 2 });
    let paths = '';
    let labels = '';
    const arrow = (id, col) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></marker>`;
    EDGES.forEach(([a, b, label, kind]) => {
      if (kind === 'none') return;
      const A = L(a), B = L(b);
      let d, lx, ly, dashed = false;
      if (!kind) {
        const y = A.cy;
        d = `M${A.r + 6} ${y} L${B.l - 8} ${B.cy}`;
        lx = (A.r + B.l) / 2; ly = y - 10;
      } else if (kind === 'down' || kind === 'downDash') {
        dashed = kind === 'downDash';
        d = `M${A.cx} ${A.b + 46} L${B.cx} ${B.t - 10}`;
        lx = A.cx + 10; ly = (A.b + 46 + B.t) / 2 + 4;
      } else if (kind === 'above') {
        const top = Math.min(A.t, B.t) - 34;
        d = `M${A.cx} ${A.t - 6} C${A.cx} ${top}, ${B.cx} ${top}, ${B.cx} ${B.t - 10}`;
        lx = (A.cx + B.cx) / 2; ly = top + 8; dashed = true;
      } else if (kind === 'below' || kind === 'below2') {
        const depth = kind === 'below2' ? 92 : 62;
        const bot = A.b + depth;
        d = `M${A.cx + 22} ${A.b + 44} C${A.cx + 22} ${bot}, ${B.cx} ${bot}, ${B.cx} ${B.b + 46}`;
        lx = (A.cx + B.cx) / 2 + 12; ly = bot - 8; dashed = kind === 'below' && a === 'ck_hold';
      } else if (kind === 'back') {
        const x = A.r + 14;
        d = `M${A.r + 6} ${A.cy} C${x + 40} ${A.cy}, ${B.l - 50} ${B.cy + 60}, ${B.l - 8} ${B.cy + 40}`;
        lx = A.r + 22; ly = A.cy - 30; dashed = true;
      }
      const col = dashed ? 'var(--edge-soft)' : 'var(--edge)';
      paths += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.2" ${dashed ? 'stroke-dasharray="6 6"' : ''} marker-end="url(#${dashed ? 'ah2' : 'ah'})"/>`;
      if (label) labels += `<text class="edge-label" x="${lx}" y="${ly}" text-anchor="${kind === 'down' || kind === 'downDash' || kind === 'back' ? 'start' : 'middle'}">${label}</text>`;
    });
    html = `<svg class="edges" aria-hidden="true"><defs>${arrow('ah', 'var(--edge)')}${arrow('ah2', 'var(--edge-soft)')}</defs>${paths}${labels}</svg>` + html;
    flow.innerHTML = html;
    const lanes = flow.querySelectorAll('.lane');
    lanes[1].style.left = `${X0 + 5 * COLW}px`;
    lanes[1].style.top = `${ROWY[1] + 20}px`;
    lanes[1].style.fontSize = '44px';
    lanes[0].style.fontSize = '26px';
    flow.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('node')) { e.preventDefault(); e.target.click(); }
    });
    flow.addEventListener('click', (e) => {
      const n = e.target.closest('.node');
      if (!n) return;
      jump(n.dataset.node);
      document.querySelector('.stage').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
  }

  // ---------------------------------------------------------------- 启动
  new ResizeObserver(fit).observe(screenEl);
  fit();
  buildFlow();
  syncSim();
  paint();
  // 按 #节点名 直接打开某个界面，例如 #ck_in
  const h = (location.hash || '').slice(1);
  if (NODES[h]) jump(h);
})();
