'use strict';
(() => {
  const $ = id => document.getElementById(id);
  let client, user = null, generation = 0, busy = false, queryVersion = 0;
  const show = (text, error = false) => { $('message').textContent = text; $('message').classList.toggle('error', error); };
  const controls = () => {
    $('login-fields').disabled = !client || busy || !!user;
    $('record-fields').disabled = !user || busy;
    $('refresh').disabled = !user || busy;
    $('logout').disabled = busy;
  };
  function sessionChanged(session) {
    generation++; queryVersion++; user = session?.user || null;
    $('rows').replaceChildren();
    $('summary').textContent = user ? '조회 전입니다。' : '로그인 후 조회할 수 있습니다.';
    $('account').textContent = user ? `로그인: ${user.email || '앱 사용자'}` : '로그아웃 상태';
    $('logout').hidden = !user;
    controls();
  }
  const rate = (target, actual) => target === 0 ? '목표 미설정' : (actual / target * 100).toLocaleString('ko-KR', {maximumFractionDigits: 2}) + '%';
  async function load() {
    if (!user) return;
    const current = generation, request = ++queryVersion;
    $('rows').replaceChildren(); $('summary').textContent = '조회 중…';
    const {data, error} = await client.from('kpi_records').select('id,month,team,target,actual').eq('user_id', user.id).order('month', {ascending: false});
    if (current !== generation || request !== queryVersion) return;
    if (error) { $('summary').textContent = '조회 실패'; throw Error('DB 조회에 실패했습니다. 연결·로그인·테이블·RLS 설정을 확인하세요.'); }
    for (const row of data) {
      const tr = document.createElement('tr');
      for (const value of [row.month, row.team, Number(row.target).toLocaleString('ko-KR'), Number(row.actual).toLocaleString('ko-KR'), rate(Number(row.target), Number(row.actual))]) {
        const td = document.createElement('td'); td.textContent = value; tr.append(td);
      }
      $('rows').append(tr);
    }
    $('summary').textContent = data.length ? `${data.length}건 조회 완료` : '저장된 데이터가 없습니다.';
    $('connection').textContent = 'DB 조회 성공 · Supabase 연결 확인';
  }
  async function run(action) {
    if (busy) return;
    busy = true; controls();
    try { await action(); } catch (error) { show(error.message || '요청 실패. 연결 상태를 확인하세요.', true); }
    finally { busy = false; controls(); }
  }
  $('login').addEventListener('submit', event => { event.preventDefault(); run(async () => {
    show('로그인 중…');
    let result;
    try { result = await client.auth.signInWithPassword({email: $('email').value.trim(), password: $('password').value}); }
    finally { $('password').value = ''; }
    if (result.error) throw Error('로그인 실패. 앱 사용자 이메일·비밀번호와 이메일 확인 상태를 확인하세요.');
    sessionChanged(result.data.session); show('로그인 성공'); await load();
  }); });
  $('logout').onclick = () => run(async () => {
    const {error} = await client.auth.signOut();
    if (error) throw Error('로그아웃 실패. 다시 시도하세요.');
    sessionChanged(null); show('로그아웃했습니다.');
  });
  $('refresh').onclick = () => run(load);
  $('record').addEventListener('submit', event => { event.preventDefault(); run(async () => {
    if (!user) throw Error('먼저 로그인하세요.');
    const month = $('month').value, team = $('team').value.trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !team || [...team].length > 80) throw Error('월과 부서를 확인하세요.');
    const money = id => {
      const raw = $(id).value.trim(), value = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 0) throw Error('금액은 정확히 계산 가능한 0 이상의 정수로 입력하세요.');
      return value;
    };
    const record = {user_id: user.id, month, team, target: money('target'), actual: money('actual')};
    const current = generation;
    show('저장 중…');
    const {error} = await client.from('kpi_records').insert(record);
    if (current !== generation) return;
    if (error) throw Error(error.code === '23505' ? '같은 월·부서가 이미 저장되어 있습니다. 중복 저장하지 않았습니다.' : 'DB 저장 실패. 연결·로그인·테이블·RLS 설정을 확인하세요.');
    show('DB 저장 성공');
    try { await load(); } catch { show('DB 저장은 성공했지만 재조회에 실패했습니다. 다시 조회하세요.', true); }
  }); });
  async function init() {
    const config = window.KPI_CONFIG;
    if (!config || !/^https:\/\/[^/]+\/?$/.test(config.supabaseUrl || '') || !(config.supabasePublishableKey || '').startsWith('sb_publishable_')) {
      show('미연결: 같은 폴더의 config.js에 Project URL과 publishable key를 입력하세요. 비밀 키는 넣지 마세요.', true); return;
    }
    if (!window.supabase?.createClient) { show('Supabase 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하세요.', true); return; }
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
    $('connection').textContent = '설정 로드 완료 · 실제 연결 미확인';
    client.auth.onAuthStateChange((_event, session) => {
      sessionChanged(session);
      // 인증 콜백 안에서 Supabase 요청을 기다리지 않습니다.
      if (session) setTimeout(() => run(load), 0);
    });
    const {data, error} = await client.auth.getSession();
    if (error) throw Error('로그인 상태 확인 실패. 페이지를 새로고침하세요.');
    sessionChanged(data.session); if (user) await load();
  }
  init().catch(() => show('초기 연결 실패. 설정과 네트워크를 확인하세요.', true));
})();
