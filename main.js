/* =========================================
   災害訓練シミュレーション Main Script
   ========================================= */

// ★重要：ここにGoogle Apps Script (GAS) のURLを貼り付けてください
// 例: "https://script.google.com/macros/s/xxxxxxxxx/exec"
const GAS_URL = https://script.google.com/macros/s/AKfycbxiT-TRcY5vZC0eJ3F6fJa8hrtigaeai5wOQOkFRN1syy61Sa9KxjS6dS5dCLsf3LBj/exec

// グローバル変数
let globalEventData = []; // CSVデータ保持用
let currentSessionLog = []; // 今回のゲームの行動ログ
let totalTime = 0; // 経過時間

// アプリ起動時にCSVデータを読み込む
fetch('data.csv')
    .then(response => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.text();
    })
    .then(text => {
        globalEventData = parseCSV(text);
        console.log("CSV Data Loaded:", globalEventData.length, "rows");
    })
    .catch(err => {
        console.error('CSV読込エラー:', err);
        alert('データの読み込みに失敗しました。data.csvが配置されているか確認してください。');
    });


/* =========================================
   画面遷移・ゲーム進行
   ========================================= */

// ゲーム開始
function startGame() {
    currentSessionLog = [];
    totalTime = 0;
    document.getElementById('total-time').innerText = totalTime;
    switchScreen('game-screen');

    // マップ描画（データロード済みなら）
    if(globalEventData.length > 0) {
        initMap(globalEventData);
    } else {
        alert("データを読み込み中です。少々お待ちください...");
        // リトライ処理などは省略
    }
}

// タイトルへ戻る
function returnToTitle() {
    if(confirm("タイトルに戻りますか？（現在の進行状況はリセットされます）")) {
        switchScreen('start-screen');
    }
}

// 履歴画面表示
function showHistory() {
    switchScreen('history-screen');
    renderHistory();
}

// 画面切り替えヘルパー
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}


/* =========================================
   マップ・ピン処理
   ========================================= */

function initMap(data) {
    const mapContainer = document.getElementById('map-container');
    // 既存のピンを削除（重複防止）
    const existingPins = document.querySelectorAll('.pin');
    existingPins.forEach(p => p.remove());

    // 部屋ごとにグルーピング
    const groupedData = {};
    data.forEach(row => {
        if (!row.No) return;
        if (!groupedData[row.No]) groupedData[row.No] = [];
        groupedData[row.No].push(row);
    });

    // ピン描画
    Object.keys(groupedData).forEach(no => {
        const events = groupedData[no];
        const roomInfo = events[0]; // 座標は1行目のデータを使用

        const pin = document.createElement('div');
        pin.className = 'pin';
        pin.style.left = roomInfo['X座標'] + 'px';
        pin.style.top = roomInfo['Y座標'] + 'px';
        pin.style.width = (roomInfo.radius * 2) + 'px';
        pin.style.height = (roomInfo.radius * 2) + 'px';
        pin.title = roomInfo['部屋名'];

        // クリックイベント
        pin.addEventListener('click', () => {
            // イベント一覧（Phase 1, 2, 3）を表示
            showEventListModal(roomInfo['部屋名'], events);
        });

        mapContainer.appendChild(pin);
    });
}


/* =========================================
   モーダル・シナリオ処理
   ========================================= */

// イベント一覧モーダル（Phase 1,2,3を選ぶ画面）
function showEventListModal(roomName, events) {
    // 順序でソート
    events.sort((a, b) => a['イベント順序'] - b['イベント順序']);
    
    let html = `
        <div class="modal-body">
            <h3>${roomName} - 状況確認</h3>
            <p>確認・対応する状況を選択してください。</p>
            <div>`;
    
    events.forEach(evt => {
        html += `
            <button class="select-btn" onclick="startScenario(${evt.No}, ${evt['イベント順序']})">
                <span class="phase-label">Phase ${evt['イベント順序']}</span>
                <strong>${evt['イベント名']}</strong><br>
                <small style="color:#666;">${evt['イベント本文'].substring(0, 30)}...</small>
            </button>`;
    });
    
    html += `</div><button onclick="closeModal()" class="close-btn">閉じる</button></div>`;
    openModal(html);
}

// シナリオ詳細（選択肢画面）を表示
window.startScenario = function(roomNo, order) {
    const targetEvent = globalEventData.find(e => e.No == roomNo && e['イベント順序'] == order);
    if (!targetEvent) return;

    let buttonsHtml = '';
    // 選択肢1〜4を作成
    for (let i = 1; i <= 4; i++) {
        const numFull = toFullWidth(i); // 1->１
        const nameKey = `選択肢${numFull}名称`;
        const bodyKey = `選択肢${numFull}本文（結果）`;
        const timeKey = `選択肢${numFull}経過時間`;

        // 選択肢が存在する場合のみボタンを作成
        if (targetEvent[nameKey]) {
            // エスケープ処理（シングルクォート対策）
            const safeRoom = targetEvent['部屋名'].replace(/'/g, "\\'");
            const safeEvent = targetEvent['イベント名'].replace(/'/g, "\\'");
            const safeChoice = targetEvent[nameKey].replace(/'/g, "\\'");
            const safeResult = targetEvent[bodyKey].replace(/'/g, "\\'");

            buttonsHtml += `
                <button class="choice-btn" onclick="handleChoice(
                    '${safeRoom}',
                    '${safeEvent}',
                    '${safeChoice}',
                    '${safeResult}',
                    ${targetEvent[timeKey]}
                )">
                    ${targetEvent[nameKey]} <span style="font-weight:normal; font-size:0.8em;">(予想時間 +${targetEvent[timeKey]}分)</span>
                </button>`;
        }
    }

    const html = `
        <div class="modal-body">
            <h2>${targetEvent['イベント名']}</h2>
            <p style="font-size:1.1em; line-height:1.6;">${targetEvent['イベント本文']}</p>
            <hr>
            <p>どう行動しますか？</p>
            <div>${buttonsHtml}</div>
            <button onclick="closeModal()" class="close-btn">キャンセル</button>
        </div>`;
    
    openModal(html);
};

// 選択肢を選んだ時の処理（ログ保存 ＆ スプレッドシート送信）
window.handleChoice = function(roomName, eventName, choiceName, resultText, timeCost) {
    // 1. 時間加算
    totalTime += timeCost;
    document.getElementById('total-time').innerText = totalTime;

    // 2. ログデータの作成
    const logEntry = {
        timestamp: new Date().toLocaleString(),
        room: roomName,
        event: eventName,
        choice: choiceName,
        result: resultText,
        timeCost: timeCost
    };

    // 3. ローカルストレージに保存（履歴機能用）
    currentSessionLog.push(logEntry);
    saveToLocalStorage(logEntry);

    // 4. Googleスプレッドシートへ送信（バックグラウンドで）
    sendToGoogleSheets(logEntry);

    // 5. 結果表示
    alert(`【結果】\n${resultText}\n\n経過時間: +${timeCost}分`);
    closeModal();
};


/* =========================================
   データ管理（保存・出力・送信）
   ========================================= */

// ローカルストレージへ保存（追記）
function saveToLocalStorage(newEntry) {
    let allHistory = JSON.parse(localStorage.getItem('disasterAppHistory')) || [];
    allHistory.push(newEntry);
    localStorage.setItem('disasterAppHistory', JSON.stringify(allHistory));
}

// 履歴画面の描画
function renderHistory() {
    const listDiv = document.getElementById('history-list');
    const history = JSON.parse(localStorage.getItem('disasterAppHistory')) || [];
    
    if(history.length === 0) {
        listDiv.innerHTML = '<p style="text-align:center; color:#666;">まだ履歴はありません。</p>';
        return;
    }

    // 新しい順に表示
    let html = '<ul>';
    [...history].reverse().forEach(log => {
        html += `
            <li>
                <div style="font-size:0.8em; color:#888;">${log.timestamp}</div>
                <div style="font-weight:bold; color:#2c3e50;">${log.room}：${log.event}</div>
                <div style="color:#e67e22;">選択: ${log.choice} (+${log.timeCost}分)</div>
                <div style="margin-top:5px;">結果: ${log.result}</div>
            </li>`;
    });
    html += '</ul>';
    listDiv.innerHTML = html;
}

// Googleスプレッドシートへ送信
function sendToGoogleSheets(data) {
    // URLが設定されていない場合はスキップ
    if(GAS_URL.includes("ここに")) {
        console.warn("GAS_URLが設定されていません。スプレッドシートへの記録はスキップされます。");
        return;
    }

    fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(() => console.log("記録送信成功"))
    .catch(err => console.error("記録送信失敗:", err));
}

// 管理者モード：CSVエクスポート
window.exportCSV = function() {
    const history = JSON.parse(localStorage.getItem('disasterAppHistory')) || [];
    if(history.length === 0) {
        alert('出力する記録がありません。');
        return;
    }

    let csvContent = "\uFEFF"; // BOM (Excel文字化け防止)
    csvContent += "日時,部屋名,イベント名,選択した行動,結果,経過時間\n";

    history.forEach(row => {
        const clean = (text) => text ? `"${text.replace(/"/g, '""')}"` : '""';
        csvContent += `${clean(row.timestamp)},${clean(row.room)},${clean(row.event)},${clean(row.choice)},${clean(row.result)},${row.timeCost}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `training_log_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


/* =========================================
   ユーティリティ
   ========================================= */

function openModal(html) {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = html;
    overlay.style.display = 'flex';
}

window.closeModal = function() {
    document.getElementById('overlay').style.display = 'none';
};

// CSVテキストをパースする関数
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        // カンマ区切り（簡易版：セル内のカンマには非対応）
        const values = line.split(','); 
        const entry = {};
        headers.forEach((h, i) => entry[h] = values[i] ? values[i].trim() : '');
        
        // 数値型への変換
        if(entry['No']) entry['No'] = Number(entry['No']);
        if(entry['X座標']) entry['X座標'] = Number(entry['X座標']);
        if(entry['Y座標']) entry['Y座標'] = Number(entry['Y座標']);
        if(entry['radius']) entry['radius'] = Number(entry['radius']);
        if(entry['イベント順序']) entry['イベント順序'] = Number(entry['イベント順序']);
        
        for(let j=1; j<=4; j++){
            const k = `選択肢${toFullWidth(j)}経過時間`;
            if(entry[k]) entry[k] = Number(entry[k]);
        }
        return entry;
    });
}

function toFullWidth(num) {
    const map = {1:'１', 2:'２', 3:'３', 4:'４'};
    return map[num];
}