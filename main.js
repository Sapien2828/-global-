/* =========================================
   災害訓練シミュレーション main.js (時間制限機能付き)
   ========================================= */

// ★GASのURL（そのまま残します）
const GAS_URL = "https://script.google.com/macros/s/AKfycbxiT-TRcY5vZC0eJ3F6fJa8hrtigaeai5wOQOkFRN1syy61Sa9KxjS6dS5dCLsf3LBj/exec"; 

// グローバル変数
window.globalEventData = []; 
window.currentSessionLog = []; 
window.totalTime = 0; 
const TIME_LIMIT = 30; // 制限時間（分）

// 1. 起動とデータ読み込み
document.addEventListener('DOMContentLoaded', function() {
    console.log("① プログラム起動");
    
    fetch('data.csv')
        .then(response => {
            if (!response.ok) {
                alert("【エラー】data.csv が見つかりません。");
                throw new Error("HTTP error " + response.status);
            }
            return response.text();
        })
        .then(text => {
            try {
                window.globalEventData = parseCSV(text);
                console.log("② CSV読み込み成功:", window.globalEventData.length, "件");
            } catch (e) {
                console.error(e);
                alert("【エラー】CSVの解析に失敗しました。");
            }
        })
        .catch(err => {
            console.error(err);
        });
});

// 2. ゲーム開始ボタン
window.startGame = function() {
    // データチェック
    if (!window.globalEventData || window.globalEventData.length === 0) {
        alert("データ読み込み中です。少々お待ちください。");
        return;
    }

    window.currentSessionLog = [];
    window.totalTime = 0;
    
    // 時間表示リセット
    const timeEl = document.getElementById('total-time');
    if(timeEl) {
        timeEl.innerText = "0";
        timeEl.style.color = "white"; // 色を戻す
    }
    
    // 画面切り替え
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('history-screen').classList.remove('active'); // 念のため
    document.getElementById('game-screen').classList.add('active');

    // マップ初期化
    initMap(window.globalEventData);
};

// 3. マップ描画
function initMap(data) {
    const mapContainer = document.getElementById('map-container');
    mapContainer.innerHTML = '<img src="map.png" alt="病院マップ" id="hospital-map">';

    const groupedData = {};
    data.forEach(row => {
        if (!row.No) return;
        if (!groupedData[row.No]) groupedData[row.No] = [];
        groupedData[row.No].push(row);
    });

    Object.keys(groupedData).forEach(no => {
        const events = groupedData[no];
        const roomInfo = events[0];

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
            // ★時間切れならクリック無効
            if (window.totalTime >= TIME_LIMIT) {
                alert("【終了】制限時間を超えているため操作できません。");
                return;
            }
            showEventListModal(roomInfo['部屋名'], events);
        });

        mapContainer.appendChild(pin);
    });
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
        const bodyKey = `選択肢${numFull}本文（結果）`;
        const timeKey = `選択肢${numFull}経過時間`;

        if (targetEvent[nameKey]) {
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
            <p>${targetEvent['イベント本文']}</p>
            <hr>
            <div>${buttonsHtml}</div>
            <button onclick="closeModal()" class="close-btn">キャンセル</button>
        </div>`;
    openModal(html);
};

// 6. 選択処理（★ここを修正：時間制限チェック）
window.handleChoice = function(roomName, eventName, choiceName, resultText, timeCost) {
    // 時間加算
    window.totalTime += timeCost;
    
    const timeEl = document.getElementById('total-time');
    if(timeEl) {
        timeEl.innerText = window.totalTime;
        // 30分超えたら赤文字にする演出
        if (window.totalTime >= TIME_LIMIT) {
            timeEl.style.color = "red";
            timeEl.style.fontWeight = "bold";
        }
    }

    const logEntry = {
        timestamp: new Date().toLocaleString(),
        room: roomName,
        event: eventName,
        choice: choiceName,
        result: resultText,
        timeCost: timeCost
    };

    window.currentSessionLog.push(logEntry);
    
    // ログ保存・送信
    saveToLocalStorage(logEntry);
    sendToGoogleSheets(logEntry);

    // モーダルを閉じる
    closeModal();

    // ★時間経過チェックとゲーム終了判定
    setTimeout(() => {
        // 先に結果を表示
        alert(`【結果】\n${resultText}\n\n経過時間: +${timeCost}分 (合計: ${window.totalTime}分)`);

        // 30分以上なら強制終了
        if (window.totalTime >= TIME_LIMIT) {
            alert("【ゲーム終了】\n経過時間が30分を超えました。\nこれ以上の活動はできません。記録画面へ移動します。");
            showHistory(); // 履歴画面（結果画面）へ飛ばす
        }
    }, 100); // 少し遅らせてアラートを出す
};

// データ送信
function sendToGoogleSheets(data) {
    if(GAS_URL.includes("ここに")) return;
    fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).catch(e => console.log("GAS送信エラー:", e));
}

// 履歴保存
function saveToLocalStorage(newEntry) {
    try {
        let allHistory = JSON.parse(localStorage.getItem('disasterAppHistory')) || [];
        allHistory.push(newEntry);
        localStorage.setItem('disasterAppHistory', JSON.stringify(allHistory));
    } catch(e) { console.error(e); }
}

// ユーティリティ
window.returnToTitle = function() {
    location.reload(); 
};

window.showHistory = function() {
    // 画面切り替え
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById('history-screen').classList.add('active');

    const listDiv = document.getElementById('history-list');
    const history = JSON.parse(localStorage.getItem('disasterAppHistory')) || [];
    
    if(history.length === 0) {
        listDiv.innerHTML = '<p>履歴はありません。</p>';
        return;
    }

    let html = '<ul>';
    // 今回のセッションだけでなく、全履歴を表示（または今回の分だけ強調しても良い）
    [...history].reverse().forEach(log => {
        html += `
            <li style="border-bottom:1px solid #ddd; padding:10px; margin-bottom:5px; background:#fff;">
                <small>${log.timestamp}</small><br>
                <strong>${log.room}：${log.event}</strong><br>
                選択: ${log.choice} <span style="color:red;">(+${log.timeCost}分)</span><br>
                結果: ${log.result}
            </li>`;
    });
    html += '</ul>';
    listDiv.innerHTML = html;
};

window.exportCSV = function() {
    const history = JSON.parse(localStorage.getItem('disasterAppHistory')) || [];
    if(history.length === 0) {
        alert("履歴がありません");
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
        ['No', 'X座標', 'Y座標', 'radius', 'イベント順序'].forEach(k => {
            if(entry[k]) entry[k] = Number(entry[k]);
        });
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