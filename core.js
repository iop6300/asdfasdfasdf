'use strict';

// Static sample records for both file:// previews and web previews.
// Do not fetch data/kpi.json from the app: the JSON/CSV files are comparison copies.
const KpiCore = (() => {
  const SAMPLE_ROWS = Object.freeze([
    Object.freeze({ id: 's1', month: '2026-08', department: '영업팀', target: 12000000, actual: 10800000 }),
    Object.freeze({ id: 's2', month: '2026-08', department: '마케팅팀', target: 9000000, actual: 9900000 }),
    Object.freeze({ id: 's3', month: '2026-08', department: '운영팀', target: 7000000, actual: 6650000 }),
    Object.freeze({ id: 's4', month: '2026-09', department: '영업팀', target: 13000000, actual: 13650000 }),
    Object.freeze({ id: 's5', month: '2026-09', department: '마케팅팀', target: 10000000, actual: 8700000 }),
    Object.freeze({ id: 's6', month: '2026-09', department: '운영팀', target: 7500000, actual: 7800000 })
  ]);

  function validateRows(rows) {
    if (!Array.isArray(rows)) throw new Error('저장된 데이터 형식이 올바르지 않습니다.');
    const unique = new Set();
    for (const row of rows) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || !String(row.department || '').trim()) {
        throw new Error('월 또는 부서 정보를 확인해 주세요.');
      }
      for (const key of ['target', 'actual']) {
        const value = Number(row[key]);
        if (!Number.isSafeInteger(value) || value < 0 || value > 1e12) {
          throw new Error('목표와 실적은 0 이상의 안전한 정수로 입력해 주세요.');
        }
      }
      const key = `${row.month}|${String(row.department).trim()}`;
      if (unique.has(key)) throw new Error('같은 월·부서 항목이 이미 있습니다.');
      unique.add(key);
    }
    return rows;
  }

  function filterRows(rows, { month = '', department = '' } = {}) {
    return rows.filter(row => (!month || row.month === month) && (!department || row.department === department));
  }

  function summarize(rows) {
    const target = rows.reduce((sum, row) => sum + Number(row.target), 0);
    const actual = rows.reduce((sum, row) => sum + Number(row.actual), 0);
    return { target, actual, achievement: target === 0 ? null : actual / target * 100, count: rows.length };
  }

  function rate(target, actual) {
    return target === 0 ? '목표 미설정' : `${(actual / target * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
  }

  function cloneSamples() { return SAMPLE_ROWS.map(row => ({ ...row })); }
  return Object.freeze({ SAMPLE_ROWS, cloneSamples, validateRows, filterRows, summarize, rate });
})();
