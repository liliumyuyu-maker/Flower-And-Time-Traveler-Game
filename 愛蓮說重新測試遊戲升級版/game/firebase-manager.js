(function (global) {
    'use strict';

    // === 1. 延遲載入 Firebase SDK ===
    async function loadFirebase() {
        if (global.firebase) return global.firebase;

        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
        const { getAuth, signInAnonymously, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        const {
            getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, addDoc, collection,
            increment, arrayUnion, onSnapshot, serverTimestamp, query
        } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');

        global.firebase = {
            initializeApp, getAuth, signInAnonymously, onAuthStateChanged,
            getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, addDoc, collection,
            increment, arrayUnion, onSnapshot, serverTimestamp, query
        };
        return global.firebase;
    }

    // --- 宣告變數 ---
    let db, auth, userId, app;
    let firebase;

    // === 2. 初始化 Firebase (整合了匿名登入持久化) ===
    async function initFirebase() {
        firebase = await loadFirebase();

        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
        if (!firebaseConfig) {
            console.error("Firebase 設定未找到！");
            alert("⚠️ 錯誤：無法連接至遊戲伺服器。");
            return Promise.reject("Firebase config not found");
        }

        app = firebase.initializeApp(firebaseConfig);
        db = firebase.getFirestore(app);
        auth = firebase.getAuth(app);

        return new Promise((resolve, reject) => {
            const unsubscribe = firebase.onAuthStateChanged(auth, (user) => {
                if (user) {
                    userId = user.uid;
                    // 當用戶首次匿名登入時，將其UID存入localStorage
                    if (user.isAnonymous) {
                        localStorage.setItem('anonymousUID', user.uid);
                    }
                    console.log("✅ Firebase 已認證，用戶 ID:", userId);
                    unsubscribe(); // 收到認證後就停止監聽，避免重複解析
                    resolve({ userId });
                }
            });

            // 執行登入流程
            if (auth.currentUser) {
                userId = auth.currentUser.uid;
                resolve({ userId });
            } else {
                // 檢查localStorage中是否有已保存的UID
                const savedUID = localStorage.getItem('anonymousUID');
                if (savedUID && auth.currentUser?.uid === savedUID) {
                    // 如果已登入且UID匹配，直接完成
                    resolve({ userId: savedUID });
                } else {
                    // 否則，進行匿名登入
                    firebase.signInAnonymously(auth).catch(error => {
                        console.error("Firebase 匿名登入失敗:", error);
                        reject(error);
                    });
                }
            }
        });
    }

    // --- 輔助函數：生成一個隨機且檢查唯一的四位數房間號 ---
    async function generateUniqueRoomId() {
        let attempts = 0;
        while (attempts < 10) { // 最多嘗試10次
            const roomId = Math.floor(1000 + Math.random() * 9000).toString();
            const roomRef = firebase.doc(db, "rooms", roomId);
            const roomSnap = await firebase.getDoc(roomRef);
            if (!roomSnap.exists()) {
                return roomId; // 找到一個沒被用過的ID
            }
            attempts++;
        }
        // 如果嘗試10次都失敗，拋出錯誤
        throw new Error("無法生成唯一的房間 ID，伺服器可能已滿。");
    }

    // === 3. 創建與加入房間 (功能實作) ===
    async function createRoom(playerName) {
        if (!db || !userId) { alert("尚未連接到伺服器"); return null; }
        try {
            const roomId = await generateUniqueRoomId();
            const roomRef = firebase.doc(db, "rooms", roomId);
            await firebase.setDoc(roomRef, {
                id: roomId,
                host: { id: userId, name: playerName },
                players: [{ id: userId, name: playerName }],
                createdAt: firebase.serverTimestamp(),
                status: "waiting"
            });
            console.log(`✅ 房間 #${roomId} 創建成功！`);
            return { id: roomId };
        } catch (e) {
            console.error("❌ 創建房間失敗:", e);
            alert("創建房間時發生錯誤，請稍後再試。");
            return null;
        }
    }

    async function joinRoom(roomId, playerName) {
        if (!db || !userId) { alert("尚未連接到伺服器"); return null; }
        const roomRef = firebase.doc(db, "rooms", roomId);
        try {
            const roomSnap = await firebase.getDoc(roomRef);
            if (!roomSnap.exists()) {
                alert("找不到這個雅集編號，請確認後再輸入。");
                return null;
            }
            await firebase.updateDoc(roomRef, {
                players: firebase.arrayUnion({ id: userId, name: playerName })
            });
            console.log(`✅ 成功加入房間 #${roomId}！`);
            return { id: roomId };
        } catch (e) {
            console.error("❌ 加入房間失敗:", e);
            alert("加入房間時發生錯誤，請稍後再試。");
            return null;
        }
    }

    // === 4. 上傳創作作品 ===
    async function uploadWork(roomId, workData) {
        if (!db || !userId) { throw new Error("Firestore 尚未初始化"); }
        const worksColl = firebase.collection(db, `rooms/${roomId}/works`);
        try {
            const docRef = await firebase.addDoc(worksColl, {
                ...workData,
                votes: 0,
                voters: [],
                createdAt: firebase.serverTimestamp()
            });
            console.log("🎨 已上傳創作：", docRef.id);
            return docRef.id;
        } catch (e) {
            console.error("❌ 上傳作品失敗：", e);
            return null;
        }
    }

    // === 5. 即時監聽與一次性獲取作品榜單 ===
    function listenToWorks(roomId, callback) {
        if (!db) return () => { };
        const worksColl = firebase.collection(db, `rooms/${roomId}/works`);
        const q = firebase.query(worksColl);
        return firebase.onSnapshot(q, (snapshot) => {
            const works = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            callback(works);
        });
    }

    async function getWorksOnce(roomId) {
        if (!db) return [];
        try {
            const worksColl = firebase.collection(db, `rooms/${roomId}/works`);
            const q = firebase.query(worksColl);
            const snapshot = await firebase.getDocs(q);
            return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.error("❌ 一次性獲取作品失敗：", e);
            return [];
        }
    }

    // === 6. 投票與評論 ===
    async function voteWork(roomId, workId, voterId, amount = 1) {
        if (!db) throw new Error("Firestore 尚未初始化");
        const workRef = firebase.doc(db, `rooms/${roomId}/works`, workId);
        try {
            await firebase.updateDoc(workRef, {
                votes: firebase.increment(amount),
                voters: firebase.arrayUnion(voterId)
            });
            console.log(`💰 ${voterId} 為 ${workId} 投了 ${amount} 票`);
        } catch (e) {
            console.error("❌ 投票失敗：", e);
            throw e;
        }
    }

    async function addCommentToWork(roomId, workId, commentData) {
        if (!db) throw new Error("Firestore 尚未初始化");
        const workRef = firebase.doc(db, `rooms/${roomId}/works`, workId);
        try {
            await firebase.updateDoc(workRef, {
                comments: firebase.arrayUnion(commentData)
            });
            console.log(`💬 為 ${workId} 新增了一條評論`);
        } catch (e) {
            console.error("❌ 新增評論失敗：", e);
            throw e;
        }
    }

    // === 7. 匯出公開函數 ===
    global.FirebaseManager = {
        initFirebase,
        createRoom,
        joinRoom,
        uploadWork,
        listenToWorks,
        voteWork,
        addCommentToWork,
        getWorksOnce
    };

})(window);
