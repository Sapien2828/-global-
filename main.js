// ==========================================
// 災害訓練シミュレーション main.js (修正版)
// ==========================================

// ★重要：GASのURL設定（引用符 "" を絶対に消さないでください）
// 修正例: const GAS_URL = "[https://script.google.com/](https://script.google.com/)...";
const GAS_URL = "https://script.google.com/macros/s/AKfycbxiT-TRcY5vZC0eJ3F6fJa8hrtigaeai5wOQOkFRN1syy61Sa9KxjS6dS5dCLsf3LBj/exec"; 


// ▼ 起動確認用のアラート（動いたら後で消してください）
console.log("main.js loaded");
// alert("プログラム読み込み完了：ボタンを押してみてください"); 
// ※もしこのアラートすら出ない場合、コードのコピペミス（余分な文字が入っている等）の可能性があります。


// グローバル変数
window.globalEventData = []; 
window.currentSessionLog = []; 
window.totalTime = 0; 

// ==========================================
// 1. CSVデータの読み込み処理
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded");
    
    fetch('data.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.text();
        })
        .then(text => {
            try {
                window.globalEventData = parseCSV(text);
                console.log("CSV Loaded:", window.globalEventData.length, "rows");
                // データ読み込み完了後にマップ初期化を試みる
                if (document.getElementById('map-container')) {
                    initMap(window.globalEventData);
                }
            } catch (e) {
                console.error("CSV Parse Error:", e);
                alert("CSVデータの解析に失敗しました。Excelの保存形式がUTF-8か確認してください。\n" + e.message);
            }
        })
        .catch(err => {
            console.error('Fetch Error:', err);
            // エラーでもゲーム自体（画面遷移）は動くようにする
            // alert('data.csv が読み込めませんでした。ファイル名や場所を確認してください。');
        });
});

// ==========================================
// 2. ゲーム進行・画面遷移（ボタン操作）
// ==========================================

// ゲーム開始ボタン
window.startGame = function() {
    console.log("startGame clicked");
    
    // 変数リセット
    window.currentSessionLog = [];
    window.totalTime = 0;
    
    const timeEl = document.getElementById('total-time');
    if(timeEl) timeEl.innerText = window.totalTime;

    // 画面切り替え
    switchScreen('game-screen');

    // データ未読み込み時の再試行
    if(window.globalEventData.length === 0) {
        console.warn("CSV data not loaded yet.");
    } else {
        initMap(window.globalEventData);
    }
};

// タイトルへ戻る
window.returnToTitle = function() {
    if(confirm("タイトルに戻りますか？（現在の進行状況はリセットされます）")) {
        switchScreen('start-screen');
    }
};

// 履歴画面表示
window.showHistory = function() {
    switchScreen('history-screen');
    renderHistory();
};

// 画面切り替えヘルパー関数
function switchScreen(screenId) {
    // すべての画面を非表示
    document.querySelectorAll('.screen').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none'; // CSSだけでなく念のためスタイルも操作
    });
    
    // 指定された画面だけ表示
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
    } else {
        console.error("Screen not found:", screenId);
    }
}

// ==========================================
// 3. マップ・ピン描画処理
// ==========================================
function initMap(data) {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) return;

    // 既存ピン削除
    mapContainer.querySelectorAll('.pin').forEach(p => p.remove());

    // データを部屋Noでグループ化
    const groupedData = {};
    data.forEach(row => {
        if (!row.No) return;
        if (!groupedData[row.No]) groupedData[row.No] = [];
        groupedData[row.No].push(row);
    });

    // ピン生成
    Object.keys(groupedData).forEach(no => {
        const events = groupedData[no];
        const roomInfo = events[0];

        // 座標チェック
        if (!roomInfo['X座標'] || !roomInfo['Y座標']) return;

        const pin = document.createElement('div');
        pin.className = 'pin';
        pin.style.left = roomInfo['X座標'] + 'px';
        pin.style.top = roomInfo['Y座標'] + 'px';
        
        // 半径（サイズ）設定
        const r = roomInfo.radius || 10;
        pin.style.width = (r * 2) + 'px';
        pin.style.height = (r * 2) + 'px';
        
        pin.title = roomInfo['部屋名'] || 'Unknown';

        // クリックイベント
        pin.addEventListener('click', function(e) {
            e.stopPropagation(); // バブリング防止
            showEventListModal(roomInfo['部屋名'], events);
        });

        mapContainer.appendChild(pin);
    });
}

// ==========================================
// 4. モーダル・シナリオ処理
// ==========================================
function showEventListModal(roomName, events) {
    // イベント順序でソート
    events.sort((a, b) => (a['イベント順序'] || 0) - (b['イベント順序'] || 0));
    
    let html = `
        <div class="modal-body">
            <h3>${roomName} - 状況確認</h3>
            <p>対応する状況を選択してください。</p>
            <div>`;
    
    events.forEach(evt => {
        const phase = evt['イベント順序'] || '?';
        const title = evt['イベント名'] || '名称不明';
        const body = evt['イベント本文'] || '';
        
        html += `
            <button class="select-btn" onclick="startScenario(${evt.No}, ${phase})">
                <span class="phase-label">Phase ${phase}</span>
                <strong>${title}</strong><br>
                <small style="color:#666;">${body.substring(0, 30)}...</small>
            </button>`;
    });
    
    html += `</div><button onclick="closeModal()" class="close-btn">閉じる</button></div>`;
    openModal(html);
}

window.startScenario = function(roomNo, order) {
    const targetEvent = window.globalEventData.find(e => e.No == roomNo && e['イベント順序'] == order);
    if (!targetEvent) return;

    let buttonsHtml = '';
    
    for (let i = 1; i <= 4; i++) {
        const numFull = toFullWidth(i);
        const nameKey = `選択肢${numFull}名称`;
        const bodyKey = `選択肢${numFull}本文（結果）`;
        const timeKey = `選択肢${numFull}経過時間`;

        if (targetEvent[nameKey]) {
            // 文字列のエスケープ処理
            const safeRoom = (targetEvent['部屋名'] || '').replace(/'/g, "\\'");
            const safeEvent = (targetEvent['イベント名'] || '').replace(/'/g, "\\'");
            const safeChoice = (targetEvent[nameKey] || '').replace(/'/g, "\\'");
            const safeResult = (targetEvent[bodyKey] || '').replace(/'/g, "\\'");
            const cost = targetEvent[timeKey] || 0;

            buttonsHtml += `
                <button class="choice-btn" onclick="handleChoice('${safeRoom}', '${safeEvent}', '${safeChoice}', '${safeResult}', ${cost})">
                    ${targetEvent[nameKey]} <span style="font-size:0.8em;">(+${cost}分)</span>
                </button>`;
        }
    }

    const html = `
        <div class="modal-body">
            <h2>${targetEvent['イベント名']}</h2>
            <p style="font-size:1.1em;">${targetEvent['イベント本文']}</p>
            <hr>
            <div>${buttonsHtml}</div>
            <button onclick="closeModal()" class="close-btn">キャンセル</button>
        </div>`;
    
    openModal(html);
};

window.handleChoice = function(roomName, eventName, choiceName, resultText, timeCost) {
    window.totalTime += timeCost;
    const timeEl = document.getElementById('total-time');
    if(timeEl) timeEl.innerText = window.totalTime;

    const logEntry = {
        timestamp: new Date().toLocaleString(),
        room: roomName,
        event: eventName,
        choice: choiceName,
        result: resultText,
        timeCost: timeCost
    };

    // ローカル保存
    window.currentSessionLog.push(logEntry);
    saveToLocalStorage(logEntry);

    // GAS送信
    sendToGoogleSheets(logEntry);

    alert(`【結果】\n${resultText}\n\n経過時間: +${timeCost}分`);
    closeModal();
};

// ==========================================
// 5. データ保存・出力・ユーティリティ
// ==========================================
function saveToLocalStorage(newEntry) {
    try {
        let allHistory = JSON.parse(localStorage.getItem('disasterAppHistory')) || [];
        allHistory.push(newEntry);
        localStorage.setItem('disasterAppHistory', JSON.stringify(allHistory));
    } catch(e) {
        console.error("Local Storage Error:", e);
    }
}

function renderHistory() {
    const listDiv = document.getElementById('history-list');
    if(!listDiv) return;

    const history = JSON.parse(localStorage.getItem('disasterAppHistory')) || [];
    
    if(history.length === 0) {
        listDiv.innerHTML = '<p style="text-align:center;">履歴はありません。</p>';
        return;
    }

    let html = '<ul>';
    [...history].reverse().forEach(log => {
        html += `
            <li>
                <small>${log.timestamp}</small><br>
                <strong>${log.room}：${log.event}</strong><br>
                選択: ${log.choice} (+${log.timeCost}分)<br>
                結果: ${log.result}
            </li>`;
    });
    html += '</ul>';
    listDiv.innerHTML = html;
}

window.exportCSV = function() {
    const history = JSON.parse(localStorage.getItem('disasterAppHistory')) || [];
    if(history.length === 0) {
        alert('記録がありません。');
        return;
    }

    let csvContent = "\uFEFF日時,部屋名,イベント名,選択した行動,結果,経過時間\n";
    history.forEach(row => {
        const clean = (t) => t ? `"${String(t).replace(/"/g, '""')}"` : '""';
        csvContent += `${clean(row.timestamp)},${clean(row.room)},${clean(row.event)},${clean(row.choice)},${clean(row.result)},${row.timeCost}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `training_log_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

function sendToGoogleSheets(data) {
    if(!GAS_URL || GAS_URL.includes("ここに")) {
        console.log("GAS URL未設定のため送信スキップ");
        return;
    }
    fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).catch(e => console.error("GAS Send Error:", e));
}

function openModal(html) {
    const overlay = document.getElementById('overlay');
    if(overlay) {
        overlay.innerHTML = html;
        overlay.style.display = 'flex';
    }
}

window.closeModal = function() {
    const overlay = document.getElementById('overlay');
    if(overlay) overlay.style.display = 'none';
};

// CSV解析（ExcelのUTF-8 CSVに対応）
function parseCSV(text) {
    const lines = text.trim().split(/\r\n|\n/); // 改行コード対応
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
        // カンマ区切り（簡易実装）
        // ※データ内にカンマが含まれるとズレますが、今回は簡易版でいきます
        const values = line.split(','); 
        const entry = {};
        
        headers.forEach((h, i) => {
            entry[h] = values[i] ? values[i].trim() : '';
        });

        // 数値変換（エラー防止のためNaNチェック）
        const numFields = ['No', 'X座標', 'Y座標', 'radius', 'イベント順序'];
        numFields.forEach(f => {
            if(entry[f]) entry[f] = Number(entry[f]);
        });

        // 選択肢の経過時間
        for(let j=1; j<=4; j++){
            const k = `選択肢${toFullWidth(j)}経過時間`;
            if(entry[k]) entry[k] = Number(entry[k]);
        }
        return entry;
    });
}

function toFullWidth(num) {
    const map = {1:'１', 2:'２', 3:'３', 4:'４'};
    return map[num] || num;
}