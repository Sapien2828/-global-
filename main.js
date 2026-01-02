/* =========================================
   災害訓練シミュレーション main.js (デバッグ強化版)
   ========================================= */

// ★GASのURL（そのまま残します）
const GAS_URL = "https://script.google.com/macros/s/AKfycbxiT-TRcY5vZC0eJ3F6fJa8hrtigaeai5wOQOkFRN1syy61Sa9KxjS6dS5dCLsf3LBj/exec"; 

// グローバル変数
window.globalEventData = []; 
window.currentSessionLog = []; 
window.totalTime = 0; 

// 1. 起動とデータ読み込み
document.addEventListener('DOMContentLoaded', function() {
    console.log("① プログラム起動");
    
    fetch('data.csv')
        .then(response => {
            if (!response.ok) {
                alert("【エラー】data.csv が見つかりません。ファイル名を確認してください。");
                throw new Error("HTTP error " + response.status);
            }
            return response.text();
        })
        .then(text => {
            try {
                window.globalEventData = parseCSV(text);
                console.log("② CSV読み込み成功:", window.globalEventData.length, "件");
                
                // データが空の場合の警告
                if (window.globalEventData.length === 0) {
                    alert("【注意】data.csvの中身が空っぽか、正しく読み込めませんでした。");
                }
            } catch (e) {
                console.error(e);
                alert("【エラー】CSVの解析に失敗しました。文字コードがUTF-8か確認してください。");
            }
        })
        .catch(err => {
            console.error(err);
            alert("【エラー】データの読み込みに失敗しました。\n" + err.message);
        });
});

// 2. ゲーム開始ボタン
window.startGame = function() {
    console.log("③ ゲーム開始ボタンが押されました");
    
    // データが読み込めていない場合
    if (!window.globalEventData || window.globalEventData.length === 0) {
        alert("データがまだ読み込まれていません。\nLive Serverを使っているか確認してください。");
        return;
    }

    window.currentSessionLog = [];
    window.totalTime = 0;
    
    // 画面切り替え
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');

    // マップ初期化
    initMap(window.globalEventData);
};

// 3. マップ描画
function initMap(data) {
    const mapContainer = document.getElementById('map-container');
    mapContainer.innerHTML = '<img src="map.png" alt="病院マップ" id="hospital-map">'; // ピンをリセットして画像を再配置

    const groupedData = {};
    data.forEach(row => {
        if (!row.No) return;
        if (!groupedData[row.No]) groupedData[row.No] = [];
        groupedData[row.No].push(row);
    });

    let pinCount = 0;
    Object.keys(groupedData).forEach(no => {
        const events = groupedData[no];
        const roomInfo = events[0];

        // 座標チェック
        if (!roomInfo['X座標'] || !roomInfo['Y座標']) return;

        const pin = document.createElement('div');
        pin.className = 'pin';
        pin.style.left = roomInfo['X座標'] + 'px';
        pin.style.top = roomInfo['Y座標'] + 'px';
        pin.style.width = (roomInfo.radius * 2 || 20) + 'px';
        pin.style.height = (roomInfo.radius * 2 || 20) + 'px';
        pin.title = roomInfo['部屋名'];

        pin.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log("④ ピンがクリックされました:", roomInfo['部屋名']);
            showEventListModal(roomInfo['部屋名'], events);
        });

        mapContainer.appendChild(pin);
        pinCount++;
    });
    
    console.log("⑤ ピンを配置しました: " + pinCount + "個");
    if (pinCount === 0) {
        alert("【注意】ピンが1つも作成されませんでした。CSVの「X座標」「Y座標」列を確認してください。");
    }
}

// 4. イベントリスト表示
function showEventListModal(roomName, events) {
    events.sort((a, b) => (a['イベント順序'] || 0) - (b['イベント順序'] || 0));
    
    let html = `
        <div class="modal-body">
            <h3>${roomName}</h3>
            <p>確認する状況を選択してください。</p>`;
    
    events.forEach(evt => {
        html += `
            <button class="select-btn" onclick="startScenario(${evt.No}, ${evt['イベント順序']})">
                Phase ${evt['イベント順序'] || '?'}: ${evt['イベント名'] || '名称不明'}
            </button>`;
    });
    
    html += `<button onclick="closeModal()" class="close-btn">閉じる</button></div>`;
    openModal(html);
}

// 5. シナリオ開始
window.startScenario = function(roomNo, order) {
    const targetEvent = window.globalEventData.find(e => e.No == roomNo && e['イベント順序'] == order);
    if (!targetEvent) return;

    let buttonsHtml = '';
    for (let i = 1; i <= 4; i++) {
        const numFull = toFullWidth(i);
        const nameKey = `選択肢${numFull}名称`;
        const bodyKey = `選択肢${numFull}本文（結果）`; // CSVヘッダーと完全一致させること
        const timeKey = `選択肢${numFull}経過時間`;

        if (targetEvent[nameKey]) {
            // エスケープ処理
            const safeRoom = (targetEvent['部屋名'] || '').replace(/'/g, "\\'");
            const safeEvent = (targetEvent['イベント名'] || '').replace(/'/g, "\\'");
            const safeChoice = (targetEvent[nameKey] || '').replace(/'/g, "\\'");
            const safeResult = (targetEvent[bodyKey] || '').replace(/'/g, "\\'");

            buttonsHtml += `
                <button class="choice-btn" onclick="handleChoice('${safeRoom}', '${safeEvent}', '${safeChoice}', '${safeResult}', ${targetEvent[timeKey] || 0})">
                    ${targetEvent[nameKey]}
                </button>`;
        }
    }

    const html = `
        <div class="modal-body">
            <h2>${targetEvent['イベント名']}</h2>
            <p>${targetEvent['イベント本文']}</p>
            <hr>
            <div>${buttonsHtml}</div>
            <button onclick="closeModal()" class="close-btn">キャンセル</button>
        </div>`;
    openModal(html);
};

// 6. 選択処理
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

    window.currentSessionLog.push(logEntry);
    
    // GAS送信（エラーが出ても止まらないように修正）
    sendToGoogleSheets(logEntry);

    alert(`【結果】\n${resultText}\n\n経過時間: +${timeCost}分`);
    closeModal();
};

function sendToGoogleSheets(data) {
    if(GAS_URL.includes("ここに")) return;
    fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).catch(e => console.log("GAS送信エラー（無視してOK）:", e));
}

// ユーティリティ
window.returnToTitle = function() {
    location.reload(); // シンプルにリロードしてリセット
};

window.showHistory = function() {
    alert("履歴機能は現在調整中です");
};

window.exportCSV = function() {
    alert("CSV出力機能は現在調整中です");
};

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

function parseCSV(text) {
    const lines = text.trim().split(/\r\n|\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const entry = {};
        headers.forEach((h, i) => entry[h] = values[i] ? values[i].trim() : '');
        // 数値変換
        ['No', 'X座標', 'Y座標', 'radius', 'イベント順序'].forEach(k => {
            if(entry[k]) entry[k] = Number(entry[k]);
        });
        return entry;
    });
}

function toFullWidth(num) {
    const map = {1:'１', 2:'２', 3:'３', 4:'４'};
    return map[num] || num;
}