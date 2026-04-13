import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AiAssistant({ currentCode }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `chat-${Date.now()}`);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await axios.post(`${API}/code/assist`, {
        message: userMsg,
        context: currentCode || "",
        session_id: sessionId,
      });
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: res.data.response },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Hata: AI servisi yanıt veremedi." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div data-testid="ai-assistant" className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-950">
        <Sparkles size={14} className="text-violet-400" />
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-zinc-400">
          AI Assistant
        </span>
        <span className="ml-auto font-mono text-[10px] text-zinc-600">GPT-4o</span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="text-zinc-600 text-xs font-mono p-2">
            PyTorch hakkında soru sorun...
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`animate-slide-up ${
              msg.role === "user" ? "ml-4" : "mr-4"
            }`}
          >
            <div
              className={`text-xs font-mono p-2 ${
                msg.role === "user"
                  ? "bg-zinc-800/60 text-zinc-200 ml-auto"
                  : "border-l-2 border-violet-500 bg-zinc-900/50 text-zinc-300"
              }`}
            >
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                {msg.content}
              </pre>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono p-2">
            <Loader2 size={12} className="animate-spin" />
            Düşünüyor...
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 p-2">
        <div className="flex items-center border border-zinc-700 bg-zinc-900/50">
          <input
            data-testid="ai-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Soru sor..."
            className="flex-1 bg-transparent text-xs font-mono text-zinc-200 px-3 py-2 outline-none placeholder:text-zinc-600"
          />
          <button
            data-testid="ai-send-btn"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-3 py-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-30"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
