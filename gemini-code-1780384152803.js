import { useState, useEffect, useRef, useCallback } from "react";
// 파이어베이스 관련 함수들을 한 번에 불러옵니다.
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";

// ==========================================
// 파이어베이스 설정 및 초기화 (합쳐진 부분)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDZ8Ljhd3yWHLWycPYnFO8eYnK1xWenIOY",
  authDomain: "sign-e8e62.firebaseapp.com",
  databaseURL: "https://sign-e8e62-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sign-e8e62",
  storageBucket: "sign-e8e62.firebasestorage.app",
  messagingSenderId: "1060197129585",
  appId: "1:1060197129585:web:c6cce61a15d73ad4e1ead0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// 메인 로직 시작
// ==========================================
const ADMIN_PASSWORD = "admin1234";
const ABSENCE_REASONS = ["출장", "병가", "연가", "조퇴", "공가", "육아시간"];

// Firestore 실시간 연동이 적용된 useStorage 훅
function useStorage(key, defaultVal) {
  const [val, setVal] = useState(defaultVal);

  useEffect(() => {
    const docRef = doc(db, "registry", key);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setVal(docSnap.data().value);
      } else {
        setVal(defaultVal);
      }
    });

    return () => unsubscribe();
  }, [key, defaultVal]);

  const save = useCallback(async (v) => {
    const next = typeof v === "function" ? v(val) : v;
    setVal(next); 
    
    try {
      const docRef = doc(db, "registry", key);
      await setDoc(docRef, { value: next }, { merge: true });
    } catch (error) {
      console.error("데이터 저장 실패:", error);
    }
  }, [key, val]);

  return [val, save];
}

// 서명 캔버스 컴포넌트
function SignatureCanvas({ onSave, onClear, existingSig }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);

  useEffect(() => {
    if (existingSig && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, 400, 160);
        ctx.drawImage(img, 0, 0);
      };
      img.src = existingSig;
    }
  }, [existingSig]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e) => {
    e.preventDefault();
    drawing.current = true;
    const pos = getPos(e, canvasRef.current);
    lastPos.current = pos;
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => { drawing.current = false; };

  const clear = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, 400, 160);
    onClear && onClear();
  };

  const save = () => {
    const data = canvasRef.current.toDataURL("image/png");
    onSave(data);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={160}
        style={{ border: "1px solid #c8d0e0", borderRadius: 8, touchAction: "none", cursor: "crosshair", width: "100%", background: "#f8f9fb" }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={clear} style={{ flex: 1, padding: "8px", background: "#f0f2f5", border: "1px solid #dde1e9", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>지우기</button>
        <button onClick={save} style={{ flex: 2, padding: "8px", background: "#2c5faf", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>서명 저장</button>
      </div>
    </div>
  );
}

// 메인 앱 컴포넌트
export default function App() {
  const [page, setPage] = useState("home");
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [pwError, setPwError] = useState(false);
  
  const [teachers, setTeachers] = useStorage("teachers_v2", []);
  const [trainings, setTrainings] = useStorage("trainings_v2", []);
  const [signatures, setSignatures] = useStorage("signatures_v2", {});
  
  const [newTraining, setNewTraining] = useState({ name: "", org: "", date: "", time: "" });
  const [editTitleId, setEditTitleId] = useState(null);
  const [editTitleVal, setEditTitleVal] = useState("");
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [absenceReason, setAbsenceReason] = useState("");
  const [sigSaved, setSigSaved] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [activeAdminTab, setActiveAdminTab] = useState("teachers");
  const [copiedId, setCopiedId] = useState(null);
  const [newTeacherName, setNewTeacherName] = useState("");

  const urlParams = new URLSearchParams(window.location.search);
  const sharedTrainingId = urlParams.get("training");

  useEffect(() => {
    if (sharedTrainingId) {
      setPage("sharedTraining");
    }
  }, [sharedTrainingId]);

  const getSigKey = (tId, tName) => `${tId}__${tName}`;

  const handleAdminLogin = () => {
    if (adminPw === ADMIN_PASSWORD) {
      setAdminLoggedIn(true);
      setPage("admin");
      setPwError(false);
    } else {
      setPwError(true);
    }
  };

  const addTraining = () => {
    if (!newTraining.name || !newTraining.date) return;
    const t = { ...newTraining, id: Date.now().toString(), createdAt: new Date().toISOString() };
    setTrainings(prev => [t, ...prev]);
    setNewTraining({ name: "", org: "", date: "", time: "" });
  };

  const deleteTraining = (id) => {
    if (confirm("연수를 삭제하시겠습니까?")) setTrainings(prev => prev.filter(t => t.id !== id));
  };

  const save