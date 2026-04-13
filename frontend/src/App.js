import { useState, useCallback, useRef, useEffect } from "react";
import "@/App.css";
import axios from "axios";
import {
  Play,
  Square,
  Code2,
  Braces,
  Settings,
  Cpu,
  BarChart3,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import CodeEditor, { DEFAULT_CODE } from "./components/CodeEditor";
import FeedbackTerminal from "./components/FeedbackTerminal";
import TrainingCharts from "./components/TrainingCharts";
import AiAssistant from "./components/AiAssistant";
import LintPanel from "./components/LintPanel";
import MetricsBar from "./components/MetricsBar";
import TrainingHistory from "./components/TrainingHistory";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace(/^http/, "ws");

function App() {
  // State
  const [code, setCode] = useState(DEFAULT_CODE);
  const [lintResults, setLintResults] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [logs, setLogs] = useState([]);
  const [agentStatus, setAgentStatus] = useState("idle");
  const [isTraining, setIsTraining] = useState(false);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [totalEpochs, setTotalEpochs] = useState(10);
  const [rightTab, setRightTab] = useState("charts");
  const [trainingConfig, setTrainingConfig] = useState({
    epochs: 10,
    learning_rate: 0.001,
    batch_size: 32,
    model_name: "SimpleNet",
  });

  const wsRef = useRef(null);
  const sessionIdRef = useRef(null);

  // Lint on code change with debounce
  const lintTimerRef = useRef(null);
  const handleCodeChange = useCallback((newCode) => {
    setCode(newCode);
    if (lintTimerRef.current) clearTimeout(lintTimerRef.current);
    lintTimerRef.current = setTimeout(async () => {
      try {
        const res = await axios.post(`${API}/code/lint`, { code: newCode });
        setLintResults(res.data);
      } catch (err) {
        console.error("Lint error:", err);
      }
    }, 800);
  }, []);

  // Initial lint
  useEffect(() => {
    const doLint = async () => {
      try {
        const res = await axios.post(`${API}/code/lint`, { code });
        setLintResults(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    doLint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start training
  const startTraining = useCallback(async () => {
    // Create session
    try {
      const res = await axios.post(`${API}/training/start`, {
        code,
        ...trainingConfig,
      });
      const sessionId = res.data.session_id;
      sessionIdRef.current = sessionId;

      // Reset state
      setMetrics([]);
      setLogs([]);
      setCurrentEpoch(0);
      setTotalEpochs(trainingConfig.epochs);
      setIsTraining(true);
      setAgentStatus("running");

      setLogs((prev) => [
        ...prev,
        { type: "status", message: `[SYSTEM] Session: ${sessionId.slice(0, 8)}...` },
      ]);

      // Connect WebSocket
      const ws = new WebSocket(`${WS_URL}/api/ws/training/${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setLogs((prev) => [
          ...prev,
          { type: "status", message: "[SYSTEM] WebSocket bağlantısı kuruldu" },
        ]);
        ws.send(
          JSON.stringify({
            action: "start",
            config: { code, ...trainingConfig },
          })
        );
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "epoch":
            setMetrics((prev) => [...prev, data.data]);
            setCurrentEpoch(data.data.epoch);
            break;
          case "batch":
            setLogs((prev) => [
              ...prev,
              {
                type: "batch",
                message: `  Epoch ${data.data.epoch} | Batch ${data.data.batch}/${data.data.total_batches} | loss=${data.data.batch_loss}`,
              },
            ]);
            break;
          case "event":
            setLogs((prev) => [
              ...prev,
              { type: "event", message: data.data.message },
            ]);
            break;
          case "status":
            setAgentStatus(data.data.status);
            setLogs((prev) => [
              ...prev,
              { type: "status", message: `[STATUS] ${data.data.message}` },
            ]);
            if (data.data.status === "completed" || data.data.status === "stopped") {
              setIsTraining(false);
            }
            break;
          default:
            break;
        }
      };

      ws.onclose = () => {
        setLogs((prev) => [
          ...prev,
          { type: "status", message: "[SYSTEM] Bağlantı kapandı" },
        ]);
        if (isTraining) {
          setIsTraining(false);
          setAgentStatus("idle");
        }
      };

      ws.onerror = () => {
        setLogs((prev) => [
          ...prev,
          { type: "error", message: "[ERROR] WebSocket hatası" },
        ]);
      };
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        { type: "error", message: `[ERROR] Eğitim başlatılamadı: ${err.message}` },
      ]);
      setIsTraining(false);
      setAgentStatus("idle");
    }
  }, [code, trainingConfig, isTraining]);

  // Stop training
  const stopTraining = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ action: "stop" }));
    }
    if (sessionIdRef.current) {
      try {
        await axios.post(`${API}/training/stop/${sessionIdRef.current}`);
      } catch (err) {
        console.error(err);
      }
    }
    setIsTraining(false);
    setAgentStatus("stopped");
  }, []);

  // Select historical session
  const handleSelectSession = (session) => {
    if (session.metrics) {
      setMetrics(session.metrics);
      setCurrentEpoch(session.metrics.length);
      setTotalEpochs(session.config?.epochs || session.metrics.length);
    }
    setRightTab("charts");
  };

  const hasLintErrors = lintResults?.errors?.length > 0;

  return (
    <div className="h-screen w-full bg-zinc-950 text-zinc-50 overflow-hidden flex flex-col">
      {/* Top Bar */}
      <div
        data-testid="top-bar"
        className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-950"
      >
        <div className="flex items-center gap-3">
          <Cpu size={18} className="text-blue-500" />
          <span className="heading-font text-sm font-bold tracking-tight">
            DEEP AGENT
          </span>
          <span className="font-mono text-[10px] text-zinc-600 tracking-wider">
            v1.0
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Training Config */}
          <div className="flex items-center gap-2 mr-4">
            <label className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
              Epochs
            </label>
            <input
              data-testid="epochs-input"
              type="number"
              value={trainingConfig.epochs}
              onChange={(e) =>
                setTrainingConfig((c) => ({
                  ...c,
                  epochs: parseInt(e.target.value) || 1,
                }))
              }
              className="w-14 bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 px-2 py-1 outline-none focus:border-blue-500"
              min="1"
              max="100"
            />
            <label className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
              LR
            </label>
            <input
              data-testid="lr-input"
              type="number"
              step="0.0001"
              value={trainingConfig.learning_rate}
              onChange={(e) =>
                setTrainingConfig((c) => ({
                  ...c,
                  learning_rate: parseFloat(e.target.value) || 0.001,
                }))
              }
              className="w-20 bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 px-2 py-1 outline-none focus:border-blue-500"
            />
          </div>

          {/* Lint Status */}
          {lintResults && (
            <div className="flex items-center gap-1 mr-2">
              {hasLintErrors ? (
                <AlertTriangle size={14} className="text-red-400" />
              ) : (
                <CheckCircle2 size={14} className="text-emerald-400" />
              )}
              <span
                className={`font-mono text-[10px] ${
                  hasLintErrors ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {hasLintErrors
                  ? `${lintResults.errors.length} hata`
                  : "Temiz"}
              </span>
            </div>
          )}

          {/* Run / Stop */}
          {!isTraining ? (
            <button
              data-testid="run-training-btn"
              onClick={startTraining}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-mono uppercase text-xs tracking-[0.1em] px-4 py-2 transition-colors"
            >
              <Play size={14} />
              Başlat
            </button>
          ) : (
            <button
              data-testid="stop-training-btn"
              onClick={stopTraining}
              className="flex items-center gap-2 bg-transparent text-red-400 hover:bg-red-500/10 border border-red-500/50 hover:border-red-500 font-mono uppercase text-xs tracking-[0.1em] px-4 py-2 transition-colors"
            >
              <Square size={14} />
              Durdur
            </button>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      <MetricsBar
        metrics={metrics}
        currentEpoch={currentEpoch}
        totalEpochs={totalEpochs}
      />

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
        {/* Left Sidebar */}
        <div className="hidden lg:flex col-span-1 border-r border-zinc-800 flex-col h-full bg-zinc-950">
          {/* Agent Info */}
          <div className="px-3 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={14} className="text-blue-400" />
              <span className="font-mono text-xs uppercase tracking-[0.15em] text-zinc-400">
                Agent
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="font-mono text-[10px] text-zinc-500">Status</span>
                <span
                  className={`font-mono text-[10px] ${
                    agentStatus === "running"
                      ? "text-emerald-400"
                      : agentStatus === "completed"
                      ? "text-blue-400"
                      : "text-zinc-500"
                  }`}
                >
                  {agentStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-[10px] text-zinc-500">Model</span>
                <span className="font-mono text-[10px] text-zinc-300">
                  {trainingConfig.model_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-[10px] text-zinc-500">Batch</span>
                <span className="font-mono text-[10px] text-zinc-300">
                  {trainingConfig.batch_size}
                </span>
              </div>
            </div>
          </div>

          {/* Model Name Config */}
          <div className="px-3 py-3 border-b border-zinc-800">
            <label className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
              Model Adı
            </label>
            <input
              data-testid="model-name-input"
              type="text"
              value={trainingConfig.model_name}
              onChange={(e) =>
                setTrainingConfig((c) => ({ ...c, model_name: e.target.value }))
              }
              className="w-full bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 px-2 py-1.5 outline-none focus:border-blue-500"
            />
            <label className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider block mb-1 mt-2">
              Batch Size
            </label>
            <input
              data-testid="batch-size-input"
              type="number"
              value={trainingConfig.batch_size}
              onChange={(e) =>
                setTrainingConfig((c) => ({
                  ...c,
                  batch_size: parseInt(e.target.value) || 32,
                }))
              }
              className="w-full bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 px-2 py-1.5 outline-none focus:border-blue-500"
              min="1"
            />
          </div>

          {/* Training History */}
          <div className="flex-1 overflow-hidden">
            <TrainingHistory onSelectSession={handleSelectSession} />
          </div>
        </div>

        {/* Code Editor Area (2 cols) */}
        <div className="col-span-1 lg:col-span-2 border-r border-zinc-800 flex flex-col h-full relative">
          {/* Editor Tabs */}
          <div className="flex items-center border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-center gap-2 px-3 py-2 border-r border-zinc-800 bg-zinc-900/50">
              <Code2 size={12} className="text-blue-400" />
              <span className="font-mono text-xs text-zinc-300">model.py</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-zinc-600">
              <Braces size={12} />
              <span className="font-mono text-xs">config.json</span>
            </div>
          </div>

          {/* Monaco Editor */}
          <CodeEditor
            code={code}
            onCodeChange={handleCodeChange}
            lintResults={lintResults}
          />

          {/* Lint Panel */}
          <LintPanel lintResults={lintResults} />
        </div>

        {/* Right Sidebar */}
        <div className="col-span-1 flex flex-col h-full bg-zinc-950">
          {/* Tab Switcher */}
          <div className="flex border-b border-zinc-800">
            <button
              data-testid="tab-charts"
              onClick={() => setRightTab("charts")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                rightTab === "charts"
                  ? "text-zinc-100 border-b-2 border-blue-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <BarChart3 size={12} />
              Charts
            </button>
            <button
              data-testid="tab-terminal"
              onClick={() => setRightTab("terminal")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                rightTab === "terminal"
                  ? "text-zinc-100 border-b-2 border-blue-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Settings size={12} />
              Terminal
            </button>
            <button
              data-testid="tab-ai"
              onClick={() => setRightTab("ai")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                rightTab === "ai"
                  ? "text-zinc-100 border-b-2 border-violet-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <MessageSquare size={12} />
              AI
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === "charts" && <TrainingCharts metrics={metrics} />}
            {rightTab === "terminal" && (
              <FeedbackTerminal logs={logs} agentStatus={agentStatus} />
            )}
            {rightTab === "ai" && <AiAssistant currentCode={code} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
