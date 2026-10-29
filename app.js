'use strict';

const $ = id => document.getElementById(id);
const CONFIG = window.APP_CONFIG || {};
const BASE_URL = typeof CONFIG.SUPABASE_URL === 'string' ? CONFIG.SUPABASE_URL.trim().replace(/\/+$/, '') : '';
const ANON_KEY = typeof CONFIG.SUPABASE_ANON_KEY === 'string' ? CONFIG.SUPABASE_ANON_KEY.trim() : '';
const PLACEHOLDER = value => !value || /YOUR_|PLACEHOLDER|CHANGE_ME|EXAMPLE/i.test(value);
function isPrivilegedKey(value) {
  if (/^sb_secret_/i.test(value)) return true;
  if (!/^eyJ/.test(value)) return false;
  try {
    const payload = value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload + '='.repeat((4 - payload.length % 4) % 4))).role === 'service_role';
  } catch { return false; }
}
const PRIVILEGED_KEY = isPrivilegedKey(ANON_KEY);
let API_BASE = '';
try {
  const parsed = new URL(BASE_URL);
  if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co') && !PLACEHOLDER(ANON_KEY) && !PRIVILEGED_KEY) API_BASE = parsed.origin;
} catch { /* Missing or invalid public settings: sample mode remains available. */ }
const CONNECTED = Boolean(API_BASE);
const SESSION_KEY = 'kpi-supabase-session-v1';
let session = null;
let dbVerified = false;
let currentMode = CONNECTED ? 'db' : 'sample';
let rows = currentMode === 'sample' ? KpiCore.cloneSamples() : [];
let busy = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function money(value) { return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value) + '원'; }
function showMessage(text, error = false) {
  const alert = $('alert');
  alert.textContent = text;
  alert.classList.toggle('error', error);
  alert.hidden = !text;
}
function filters() { return { month: $('monthFilter').value, department: $('deptFilter').value }; }
function setSession(value) {
  session = value;
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* Keep the session in memory when browser storage is unavailable. */ }
}
function readStoredSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    return value && typeof value.access_token === 'string' && typeof value.refresh_token === 'string' ? value : null;
  } catch { return null; }
}
function updateChrome() {
  const dbMode = currentMode === 'db';
  $('modeBadge').textContent = dbMode ? (session ? '● DB 모드 · 로그인됨' : '● DB 모드 · 로그인 필요') : '● 샘플 모드';
  $('modeBadge').classList.toggle('db-mode', dbMode);
  $('authPanel').hidden = CONNECTED ? (!dbMode || Boolean(session)) : false;
  $('authForm').hidden = !CONNECTED || !dbMode || Boolean(session);
  $('connectionState').textContent = CONNECTED ? (dbVerified ? 'DB 응답·본인 조회 확인됨' : '설정값 있음 · 실제 연결 미검증') : '연결 설정 없음';
  $('authTitle').textContent = CONNECTED ? 'Supabase 로그인' : 'DB 미연결 안내';
  $('authHelp').textContent = CONNECTED
    ? (session ? '로그인한 계정의 행만 불러오고 저장합니다.' : '기존 사용자 계정으로 로그인하세요. 이 앱은 계정을 생성하지 않습니다.')
    : (PRIVILEGED_KEY
      ? 'config.js에서 서버용 비밀 키가 감지되어 DB 요청을 차단했습니다. 브라우저에는 공개 anon/publishable key만 설정하세요.'
      : 'config.js에 Supabase 프로젝트 URL과 공개 anon key를 설정하면 DB 모드를 사용할 수 있습니다. 현재 샘플은 DB에 저장되지 않습니다.');
  $('sampleToggle').hidden = !CONNECTED || !dbMode;
  $('dbToggle').hidden = !CONNECTED || dbMode;
  $('logout').hidden = !CONNECTED || !session;
  $('addToggle').disabled = dbMode && !session;
  $('addToggle').title = dbMode && !session ? '먼저 Supabase에 로그인하세요.' : '';
  $('saveNote').textContent = dbMode ? '로그인 계정의 DB에 저장 · 응답과 재조회 확인' : '샘플 모드 · 변경사항은 저장되지 않음';
  $('modeFootnote').textContent = dbMode
    ? 'DB 모드에서는 로그인한 사용자의 행만 요청하며, 저장 응답과 재조회를 확인합니다. 샘플 데이터는 DB에 전송되지 않습니다.'
    : (CONNECTED ? '샘플 모드입니다. 입력·삭제는 현재 화면에만 반영되며 새로고침하면 샘플로 돌아옵니다. DB 모드로 전환해 로그인하면 본인 행을 불러옵니다.'
      : 'Supabase 설정이 없어 샘플 모드로 실행 중입니다. 이 샘플은 자동 저장되지 않으며 실제 DB와 연결되지 않았습니다.');
}
function renderFilters() {
  const selected = filters();
  const months = [...new Set(rows.map(row => row.month))].sort().reverse();
  const departments = [...new Set(rows.map(row => row.department))].sort();
  $('monthFilter').innerHTML = '<option value="">전체 월</option>' + months.map(month => `<option value="${month}">${month}</option>`).join('');
  $('deptFilter').innerHTML = '<option value="">전체 부서</option>' + departments.map(name => `<option>${escapeHtml(name)}</option>`).join('');
  $('monthFilter').value = months.includes(selected.month) ? selected.month : '';
  $('deptFilter').value = departments.includes(selected.department) ? selected.department : '';
  $('departments').innerHTML = departments.map(name => `<option value="${escapeHtml(name)}">`).join('');
}
function renderChart(visible) {
  const groups = new Map();
  for (const row of visible) {
    const group = groups.get(row.department) || { target: 0, actual: 0 };
    group.target += Number(row.target);
    group.actual += Number(row.actual);
    groups.set(row.department, group);
  }
  $('chart').innerHTML = groups.size ? [...groups].map(([department, totals]) => {
    const width = totals.target ? Math.min(100, totals.actual / totals.target * 100) : 0;
    return `<div class="barrow"><span>${escapeHtml(department)}</span><div class="track" role="img" aria-label="${escapeHtml(department)} 달성률 ${KpiCore.rate(totals.target, totals.actual)}"><div class="fill" style="width:${width}%"></div></div><strong>${KpiCore.rate(totals.target, totals.actual)}</strong></div>`;
  }).join('') : '<div class="empty chart-empty">표시할 데이터가 없습니다.</div>';
}
function render() {
  const visible = KpiCore.filterRows(rows, filters());
  const totals = KpiCore.summarize(visible);
  $('targetTotal').textContent = money(totals.target);
  $('actualTotal').textContent = money(totals.actual);
  $('achievement').textContent = KpiCore.rate(totals.target, totals.actual);
  $('recordCount').textContent = `${visible.length}건`;
  renderChart(visible);
  $('evidenceRows').innerHTML = visible.length ? visible.map(row => `<tr>
    <td>${row.month}</td><td class="dept">${escapeHtml(row.department)}</td>
    <td class="num">${money(row.target)}</td><td class="num">${money(row.actual)}</td>
    <td class="num"><span class="rate-pill ${row.target === 0 ? 'zero' : ''}">${KpiCore.rate(row.target, row.actual)}</span></td>
    <td><button class="danger delete" data-id="${escapeHtml(row.id)}" aria-label="${escapeHtml(row.department)} ${row.month} 항목 삭제">삭제</button></td>
  </tr>`).join('') : '<tr><td colspan="6"><div class="empty">조건에 맞는 KPI 데이터가 없습니다.<br>필터를 바꾸거나 KPI 항목을 입력해 주세요.</div></td></tr>';
  updateChrome();
}
function resetFilters() { $('monthFilter').value = ''; $('deptFilter').value = ''; render(); }
function apiHeaders(token = null, extra = {}) {
  return { apikey: ANON_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}
async function authRequest(path, body, token = null) {
  const response = await fetch(`${API_BASE}/auth/v1/${path}`, {
    method: 'POST', headers: apiHeaders(token, { 'Content-Type': 'application/json' }), body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error('인증 요청 실패'), { status: response.status });
  return data;
}
async function refreshSession() {
  if (!session?.refresh_token) throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
  const previous = session;
  try {
    const fresh = await authRequest('token?grant_type=refresh_token', { refresh_token: previous.refresh_token });
    if (!fresh?.access_token || !fresh?.refresh_token) throw new Error('refresh');
    setSession({ access_token: fresh.access_token, refresh_token: fresh.refresh_token, user_id: fresh.user?.id || previous.user_id });
    return session;
  } catch {
    setSession(null);
    throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
  }
}
async function authenticatedFetch(path, options = {}, retried = false) {
  if (!session?.access_token) throw new Error('먼저 로그인해 주세요.');
  const response = await fetch(`${API_BASE}/rest/v1/${path}`, {
    ...options,
    headers: apiHeaders(session.access_token, { ...(options.headers || {}) })
  });
  if (response.status === 401 && !retried) {
    await refreshSession();
    return authenticatedFetch(path, options, true);
  }
  return response;
}
async function currentUser() {
  const response = await fetch(`${API_BASE}/auth/v1/user`, { headers: apiHeaders(session.access_token) });
  if (!response.ok) throw Object.assign(new Error('세션 확인 실패'), { status: response.status });
  const user = await response.json();
  if (!user?.id || user.id !== session.user_id) throw new Error('로그인 계정을 확인할 수 없습니다.');
  return user;
}
function explainHttp(status, action) {
  if (status === 401) return '인증이 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.';
  if (status === 403) return '접근이 거부되었습니다. RLS 정책과 테이블 권한을 확인해 주세요.';
  if (status === 404) return 'DB 테이블 또는 API 경로를 찾지 못했습니다. schema.sql 적용 여부를 확인해 주세요.';
  if (status === 409) return '같은 사용자·월·부서의 KPI가 이미 있습니다.';
  return `${action} 요청에 실패했습니다 (HTTP ${status}). 연결 설정과 DB 스키마를 확인해 주세요.`;
}
async function readOwnedRows() {
  await currentUser();
  const query = 'kpi_records?select=id,user_id,month,department,target,actual,created_at&user_id=eq.' + encodeURIComponent(session.user_id) + '&order=month.desc,department.asc';
  const response = await authenticatedFetch(query);
  if (!response.ok) throw new Error(explainHttp(response.status, '조회'));
  const data = await response.json();
  if (!Array.isArray(data) || data.some(row => row.user_id !== session.user_id)) throw new Error('본인 소유가 아닌 행이 감지되어 화면 표시를 중단했습니다. RLS 정책을 확인해 주세요.');
  const mapped = data.map(row => ({ id: row.id, month: String(row.month).slice(0, 7), department: row.department, target: Number(row.target), actual: Number(row.actual), created_at: row.created_at }));
  KpiCore.validateRows(mapped);
  return mapped;
}
async function loadDbRows() {
  if (!session) { rows = []; renderFilters(); render(); return; }
  showMessage('로그인 계정의 KPI 데이터를 불러오는 중입니다.');
  try {
    rows = await readOwnedRows();
    dbVerified = true;
    renderFilters(); render(); showMessage('본인 계정의 데이터 조회를 확인했습니다.');
  } catch (error) {
    rows = []; renderFilters(); render(); showMessage(error.message, true);
  }
}
function setMode(mode) {
  if (mode === 'db' && !CONNECTED) {
    showMessage('Supabase 연결 설정이 없어 DB 모드를 사용할 수 없습니다. 샘플 모드는 계속 사용할 수 있습니다.', true);
    return;
  }
  currentMode = mode;
  showMessage('');
  if (mode === 'sample') {
    rows = KpiCore.cloneSamples();
    renderFilters(); render();
  } else {
    rows = [];
    renderFilters(); render();
    loadDbRows();
  }
}
async function saveDbRow(entry) {
  const payload = { user_id: session.user_id, month: `${entry.month}-01`, department: entry.department, target: entry.target, actual: entry.actual };
  const query = 'kpi_records?on_conflict=user_id%2Cmonth%2Cdepartment&select=id,user_id,month,department,target,actual';
  const response = await authenticatedFetch(query, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify([payload])
  });
  if (!response.ok) throw new Error(explainHttp(response.status, '저장'));
  const saved = await response.json();
  if (!Array.isArray(saved) || saved.length !== 1 || saved[0].user_id !== session.user_id) throw new Error('저장 응답을 확인하지 못했습니다. 데이터는 다시 조회해 확인하세요.');
  const checked = await readOwnedRows();
  const found = checked.find(row => row.id === saved[0].id);
  if (!found || found.department !== entry.department || found.month !== entry.month || found.target !== entry.target || found.actual !== entry.actual) {
    throw new Error('저장 응답은 받았지만 재조회 값이 일치하지 않아 완료로 표시하지 않았습니다.');
  }
  rows = checked;
  dbVerified = true;
  return true;
}
async function deleteDbRow(id) {
  const query = `kpi_records?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(session.user_id)}&select=id,user_id`;
  const response = await authenticatedFetch(query, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
  if (!response.ok) throw new Error(explainHttp(response.status, '삭제'));
  const removed = await response.json();
  if (!Array.isArray(removed) || removed.length !== 1 || removed[0].user_id !== session.user_id) throw new Error('삭제 응답을 확인하지 못했습니다.');
  const checked = await readOwnedRows();
  if (checked.some(row => row.id === id)) throw new Error('삭제 후 재조회에서 행이 확인되어 완료로 표시하지 않았습니다.');
  rows = checked;
  dbVerified = true;
}

$('monthFilter').addEventListener('change', render);
$('deptFilter').addEventListener('change', render);
$('resetFilter').addEventListener('click', resetFilters);
$('sampleToggle').addEventListener('click', () => setMode('sample'));
$('dbToggle').addEventListener('click', () => setMode('db'));
$('addToggle').addEventListener('click', () => {
  if (currentMode === 'db' && !session) { showMessage('DB 저장을 위해 먼저 로그인해 주세요.', true); return; }
  $('entryPanel').hidden = !$('entryPanel').hidden;
  if (!$('entryPanel').hidden) {
    const now = new Date();
    $('entryMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    $('entryMonth').focus();
  }
});
$('authForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  busy = true; $('authForm').querySelector('button').disabled = true; showMessage('로그인 중입니다.');
  try {
    const result = await authRequest('token?grant_type=password', { email: $('authEmail').value.trim(), password: $('authPassword').value });
    if (!result?.access_token || !result?.refresh_token || !result?.user?.id) throw new Error('로그인 응답이 올바르지 않습니다.');
    setSession({ access_token: result.access_token, refresh_token: result.refresh_token, user_id: result.user.id });
    await currentUser();
    $('authPassword').value = '';
    currentMode = 'db';
    await loadDbRows();
  } catch (error) {
    setSession(null);
    showMessage(error.status ? explainHttp(error.status, '로그인') : (error.message === 'Failed to fetch' ? 'Supabase에 연결할 수 없습니다. 네트워크와 URL 설정을 확인해 주세요.' : '로그인에 실패했습니다. 계정 정보와 Supabase Auth 설정을 확인해 주세요.'), true);
  } finally { busy = false; $('authForm').querySelector('button').disabled = false; updateChrome(); }
});
$('logout').addEventListener('click', async () => {
  if (session?.access_token) {
    try { await fetch(`${API_BASE}/auth/v1/logout`, { method: 'POST', headers: apiHeaders(session.access_token) }); } catch { /* Local session is cleared even if the network is unavailable. */ }
  }
  setSession(null); currentMode = 'db'; rows = []; resetFilters(); renderFilters(); render(); showMessage('로그아웃했습니다. 샘플 데이터는 DB에 저장되지 않습니다.');
});
$('entryForm').addEventListener('submit', async event => {
  event.preventDefault(); showMessage('');
  if (currentMode === 'db' && !session) { showMessage('먼저 로그인해 주세요.', true); return; }
  const entry = { id: currentMode === 'sample' ? `sample-${crypto.randomUUID()}` : '', month: $('entryMonth').value, department: $('entryDept').value.trim(), target: Number($('entryTarget').value), actual: Number($('entryActual').value) };
  try {
    KpiCore.validateRows([...rows, entry]);
    if (currentMode === 'sample') {
      rows.push(entry); renderFilters(); render(); event.target.reset();
      showMessage('샘플 화면에만 반영했습니다. 저장되지 않았고 DB로 전송되지 않았습니다.');
      return;
    }
    $('entryForm').querySelector('button').disabled = true;
    await saveDbRow(entry);
    renderFilters(); render(); event.target.reset();
    showMessage('DB 저장 응답과 재조회 결과가 일치하는 것을 확인했습니다.');
  } catch (error) { showMessage(error.message, true); }
  finally { $('entryForm').querySelector('button').disabled = false; }
});
$('evidenceRows').addEventListener('click', async event => {
  const button = event.target.closest('.delete');
  if (!button) return;
  if (currentMode === 'db' && !session) return;
  button.disabled = true;
  try {
    if (currentMode === 'sample') {
      rows = rows.filter(row => row.id !== button.dataset.id); renderFilters(); render();
      showMessage('샘플 화면에서만 삭제했습니다. DB에는 반영되지 않았습니다.');
    } else {
      await deleteDbRow(button.dataset.id); renderFilters(); render();
      showMessage('삭제 응답과 재조회 결과를 확인했습니다.');
    }
  } catch (error) { showMessage(error.message, true); }
  finally { button.disabled = false; }
});

async function initialize() {
  renderFilters(); render(); updateChrome();
  if (!CONNECTED) {
    currentMode = 'sample'; rows = KpiCore.cloneSamples(); renderFilters(); render();
    showMessage('Supabase 연결값이 없어 샘플 모드로 실행 중입니다. 샘플은 자동 저장되지 않습니다.');
    return;
  }
  const saved = readStoredSession();
  if (!saved) { rows = []; renderFilters(); render(); return; }
  session = saved; currentMode = 'db';
  try {
    try { await currentUser(); }
    catch (error) {
      if (error.status === 401) { await refreshSession(); await currentUser(); }
      else throw error;
    }
    await loadDbRows();
  } catch {
    setSession(null); rows = []; renderFilters(); render();
    showMessage('저장된 로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.');
  }
}

initialize();
