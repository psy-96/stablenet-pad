// ═══════════════════════════════════════════════════════════════════
// FX Simulation — Apps Script (통합본)
// 기능: 데이터 수집 + Spread 판단 + Trade_Log 기록 + Portfolio 탭 생성
// ═══════════════════════════════════════════════════════════════════

// ─── Config 읽기 ──────────────────────────────────────────────────
function getConfig() {
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Config').getDataRange().getValues();
  const cfg = {};
  data.slice(1).forEach(([k, v]) => {
    if (k && !String(k).startsWith('──')) {
      cfg[k] = (v === true) ? 'TRUE' : (v === false) ? 'FALSE' : v;
    }
  });
  return cfg;
}

// ─── Main: 시간 트리거로 실행 ─────────────────────────────────────
function recordSnapshot() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = getConfig();
  const fxRates    = readFXRates(ss, cfg);
  const poolPrices = readAllPoolPrices(cfg);
  appendLog(ss, fxRates, poolPrices, cfg);
}

// ─── FX Rates ─────────────────────────────────────────────────────
function readFXRates(ss, cfg) {
  const sheet = ss.getSheetByName('FX_Live');
  return {
    USDKRW: sheet.getRange('B3').getValue(),
    USDJPY: sheet.getRange('B4').getValue(),
    USDEUR: getEURCPrice(cfg),
    KRWJPY: sheet.getRange('B6').getValue(),
  };
}

// ─── Uniswap V3 EURC/USDC 가격 ───────────────────────────────────
function getEURCPrice(cfg) {
  const poolAddress  = cfg['uniswap_eurc_usdc_pool'];
  const ethRpc       = cfg['eth_rpc_url'];
  const eurcIsToken0 = cfg['eurc_is_token0'] === 'TRUE';

  if (!poolAddress || !ethRpc || ethRpc.includes('YOUR_KEY')) {
    console.warn('Ethereum RPC not configured, USDEUR will be null');
    return null;
  }
  try {
    const res = UrlFetchApp.fetch(ethRpc, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({
        jsonrpc: '2.0', method: 'eth_call',
        params: [{ to: poolAddress, data: '0x3850c7bd' }, 'latest'],
        id: 1
      }),
      muteHttpExceptions: true
    });
    const json = JSON.parse(res.getContentText());
    if (!json.result || json.result === '0x') throw new Error('empty result');
    return sqrtPriceX96ToPrice(json.result.slice(2, 66), eurcIsToken0);
  } catch (e) {
    console.error('getEURCPrice failed:', e);
    return null;
  }
}

// ─── sqrtPriceX96 → 가격 변환 ────────────────────────────────────
function sqrtPriceX96ToPrice(sqrtHex, token0IsBase) {
  const sqrtPriceX96 = BigInt('0x' + sqrtHex);
  const Q96   = BigInt(2) ** BigInt(96);
  const SCALE = BigInt(1e12);
  const priceScaled = Number((sqrtPriceX96 * sqrtPriceX96 * SCALE) / (Q96 * Q96));
  const price = priceScaled / 1e12;
  return token0IsBase ? price : 1 / price;
}

// ─── StableNet 풀 가격 읽기 ───────────────────────────────────────
function readAllPoolPrices(cfg) {
  const pools = {
    USDKRW: cfg['pool_stUSD_stKRW'],
    USDJPY: cfg['pool_stUSD_stJPY'],
    USDEUR: cfg['pool_stUSD_stEUR'],
    KRWJPY: cfg['pool_stKRW_stJPY'],
  };
  const token0IsBase = {
    USDKRW: cfg['token0IsBase_stUSD_stKRW'] === 'TRUE',
    USDJPY: cfg['token0IsBase_stUSD_stJPY'] === 'TRUE',
    USDEUR: cfg['token0IsBase_stUSD_stEUR'] === 'TRUE',
    KRWJPY: cfg['token0IsBase_stKRW_stJPY'] === 'TRUE',
  };
  const rpc = cfg['stablenet_rpc_url'];
  const results = {};
  for (const [pair, address] of Object.entries(pools)) {
    if (!address) { results[pair] = null; continue; }
    try {
      results[pair] = getV3PoolPrice(address, token0IsBase[pair], rpc);
    } catch (e) {
      console.error(`${pair} pool read failed: ${e}`);
      results[pair] = null;
    }
  }
  return results;
}

function getV3PoolPrice(poolAddress, token0IsBase, rpcUrl) {
  const res = UrlFetchApp.fetch(rpcUrl, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({
      jsonrpc: '2.0', method: 'eth_call',
      params: [{ to: poolAddress, data: '0x3850c7bd' }, 'latest'],
      id: 1
    }),
    muteHttpExceptions: true
  });
  const json = JSON.parse(res.getContentText());
  if (!json.result || json.result === '0x') throw new Error('empty result');
  return sqrtPriceX96ToPrice(json.result.slice(2, 66), token0IsBase);
}

// ─── Log 탭 기록 + 판단 + Trade_Log 기록 ─────────────────────────
function appendLog(ss, fx, pool, cfg) {
  const logSheet  = ss.getSheetByName('Log');
  const threshold = parseFloat(cfg['spread_threshold_%']) / 100;
  const now       = new Date();
  const nowStr    = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');

  const calcSpread = (fxRate, poolPrice) =>
    (fxRate && poolPrice) ? (poolPrice - fxRate) / fxRate : null;

  const spreads = {
    USDKRW: calcSpread(fx.USDKRW, pool['USDKRW']),
    USDJPY: calcSpread(fx.USDJPY, pool['USDJPY']),
    USDEUR: calcSpread(fx.USDEUR, pool['USDEUR']),
    KRWJPY: calcSpread(fx.KRWJPY, pool['KRWJPY']),
  };

  // Log 헤더 (최초 1회)
  if (logSheet.getLastRow() === 0) {
    logSheet.appendRow([
      'timestamp',
      'fx_USDKRW', 'pool_stUSD/stKRW', 'spread_USDKRW',
      'fx_USDJPY', 'pool_stUSD/stJPY', 'spread_USDJPY',
      'eurc_USDEUR', 'pool_stUSD/stEUR', 'spread_USDEUR',
      'fx_KRWJPY', 'pool_stKRW/stJPY', 'spread_KRWJPY',
    ]);
  }

  // Log 기록 (A열부터)
  logSheet.appendRow([
    nowStr,
    fx.USDKRW,  pool['USDKRW'],  spreads.USDKRW,
    fx.USDJPY,  pool['USDJPY'],  spreads.USDJPY,
    fx.USDEUR,  pool['USDEUR'],  spreads.USDEUR,
    fx.KRWJPY,  pool['KRWJPY'],  spreads.KRWJPY,
  ]);

  // 판단 + Trade_Log 기록
  const triggered = Object.entries(spreads)
    .filter(([, v]) => v !== null && Math.abs(v) >= threshold)
    .map(([k, v]) => ({ pair: k, spread: v }));

  if (triggered.length === 0) {
    appendTradeLog(ss, {
      executed_at: nowStr, pair: 'ALL', direction: '-',
      spread_pct: '-', status: 'NO_OP', pnl_est: ''
    });
  } else {
    const top = triggered.sort((a, b) => Math.abs(b.spread) - Math.abs(a.spread))[0];
    const directionMap = {
      USDKRW: top.spread < 0 ? 'BUY stUSD'  : 'BUY stKRW',
      USDJPY: top.spread < 0 ? 'BUY stUSD'  : 'BUY stJPY',
      USDEUR: top.spread < 0 ? 'SELL stUSD' : 'BUY stUSD',
      KRWJPY: top.spread < 0 ? 'BUY stKRW'  : 'BUY stJPY',
    };
    appendTradeLog(ss, {
      executed_at: nowStr,
      pair:        top.pair,
      direction:   directionMap[top.pair] || '-',
      spread_pct:  (top.spread * 100).toFixed(4) + '%',
      status:      'OPPORTUNITY_DETECTED',
      pnl_est:     (10000 * Math.abs(top.spread)).toFixed(2)
    });
    console.log(`[TRIGGER] ${nowStr} — ${top.pair} ${(top.spread * 100).toFixed(2)}%`);
  }
}

// ─── Trade_Log 기록 (중복 방지) ───────────────────────────────────
function appendTradeLog(ss, entry) {
  const sheet    = ss.getSheetByName('Trade_Log');
  const existing = sheet.getDataRange().getValues();

  const isDuplicate = existing.slice(1).some(row => {
    const rowDate = row[0] instanceof Date
      ? Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
      : String(row[0]).substring(0, 16);
    return rowDate === entry.executed_at.substring(0, 16) && row[1] === entry.pair;
  });

  if (isDuplicate) {
    console.log(`[SKIP] Duplicate: ${entry.executed_at} ${entry.pair}`);
    return;
  }

  sheet.appendRow([
    entry.executed_at, entry.pair, entry.direction,
    '', '', entry.spread_pct,
    '', '', '', '',
    entry.tx_hash || 'NOT_EXECUTED', entry.status, entry.pnl_est
  ]);
}

// ─── Web App POST 엔드포인트 (외부 호출용) ────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (!data.executed_at || !data.pair || !data.status) {
      return ContentService
        .createTextOutput(JSON.stringify({ result: 'skipped_empty' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    appendTradeLog(ss, {
      executed_at: data.executed_at,
      pair:        data.pair,
      direction:   data.direction  || '-',
      spread_pct:  data.spread_pct || '',
      status:      data.status,
      pnl_est:     data.pnl_est    || '',
      tx_hash:     data.tx_hash     || 'NOT_EXECUTED',
    });
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── Portfolio 탭 생성 (수동 1회 실행) ───────────────────────────
function createPortfolioTab() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Portfolio');
  if (!sheet) sheet = ss.insertSheet('Portfolio');
  sheet.clearContents();

  sheet.getRange('A1').setValue('FX 시뮬레이션 포트폴리오');
  sheet.getRange('A3').setValue('항목');
  sheet.getRange('B3').setValue('값');
  sheet.getRange('A4').setValue('총 기록 수');
  sheet.getRange('B4').setFormula('=COUNTA(Trade_Log!A:A)-1');
  sheet.getRange('A5').setValue('기회 감지 횟수');
  sheet.getRange('B5').setFormula('=COUNTIF(Trade_Log!L:L,"OPPORTUNITY_DETECTED")');
  sheet.getRange('A6').setValue('NO_OP 횟수');
  sheet.getRange('B6').setFormula('=COUNTIF(Trade_Log!L:L,"NO_OP")');
  sheet.getRange('A7').setValue('누적 추정 수익 (TUSD)');
  sheet.getRange('B7').setFormula('=SUMIF(Trade_Log!L:L,"OPPORTUNITY_DETECTED",Trade_Log!M:M)');
  sheet.getRange('A8').setValue('마지막 실행');
  sheet.getRange('B8').setFormula('=TEXT(MAX(Trade_Log!A:A),"yyyy-MM-dd HH:mm")');

  sheet.getRange('A11').setValue('페어별 분석');
  sheet.getRange('A12').setFormula(
    '=QUERY(Trade_Log!A:M,"SELECT B, COUNT(A), SUM(M) WHERE L=\'OPPORTUNITY_DETECTED\' GROUP BY B ORDER BY SUM(M) DESC LABEL B \'페어\', COUNT(A) \'기회횟수\', SUM(M) \'누적pnl(TUSD)\'",0)'
  );

  sheet.getRange('A18').setValue('최근 기회 감지');
  sheet.getRange('A19').setFormula(
    '=QUERY(Trade_Log!A:M,"SELECT A,B,C,F,L,M WHERE L=\'OPPORTUNITY_DETECTED\' ORDER BY A DESC LIMIT 10 LABEL A \'시각\',B \'페어\',C \'방향\',F \'spread\',L \'상태\',M \'pnl_est\'",0)'
  );

  SpreadsheetApp.flush();
  Logger.log('Portfolio 탭 생성 완료');
}

// ─── 트리거 등록 (최초 1회 실행) ─────────────────────────────────
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  const hours = parseInt(getConfig()['trigger_interval_hours']) || 1;
  ScriptApp.newTrigger('recordSnapshot').timeBased().everyHours(hours).create();
  console.log(`Trigger set: every ${hours}h`);
}

// ─── 수동 테스트 ──────────────────────────────────────────────────
function runOnce() { recordSnapshot(); }

// ─── 최신 미실행 기회 조회 (Execution Bot용) ──────────────────────
function doGet(e) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Trade_Log');
  const data  = sheet.getDataRange().getValues();

  const now = new Date();
  const TWO_HOURS = 2 * 60 * 60 * 1000;

  // 2시간 이내에 EXECUTED된 페어 목록
  const recentlyExecutedPairs = new Set(
    data.slice(1)
      .filter(row => {
        if (String(row[11]) !== 'EXECUTED') return false;
        const rowTime = row[0] instanceof Date ? row[0] : new Date(row[0]);
        return (now - rowTime) < TWO_HOURS;
      })
      .map(row => String(row[1]))
  );

  // OPPORTUNITY_DETECTED 중 2시간 이내 + 같은 페어가 최근 실행되지 않은 것
  const unexecuted = data.slice(1).filter(row => {
    if (String(row[11]) !== 'OPPORTUNITY_DETECTED') return false;
    if (recentlyExecutedPairs.has(String(row[1]))) return false;
    const rowTime = row[0] instanceof Date ? row[0] : new Date(row[0]);
    return (now - rowTime) < TWO_HOURS;
  });

  if (unexecuted.length === 0) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'none' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const latest = unexecuted[unexecuted.length - 1];
  return ContentService
    .createTextOutput(JSON.stringify({
      result:      'found',
      executed_at: String(latest[0]).substring(0, 16),
      pair:        latest[1],
      direction:   latest[2],
      spread_pct: typeof latest[5] === 'number'
        ? (latest[5] * 100).toFixed(4) + '%'
        : latest[5],
    }))
    .setMimeType(ContentService.MimeType.JSON);
}