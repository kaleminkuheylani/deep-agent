from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import asyncio
import random
import math
import re
import ast
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---- Models ----
class TrainingConfig(BaseModel):
    code: str
    epochs: int = 10
    learning_rate: float = 0.01
    batch_size: int = 32
    model_name: str = "CustomModel"

class TrainingSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    config: TrainingConfig
    status: str = "pending"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metrics: List[Dict[str, Any]] = []

class LintRequest(BaseModel):
    code: str

class LintResult(BaseModel):
    errors: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []
    info: List[Dict[str, Any]] = []

class AssistRequest(BaseModel):
    message: str
    context: str = ""
    session_id: str = "default"

class AssistResponse(BaseModel):
    response: str
    session_id: str

# ---- Active Training Sessions ----
active_sessions: Dict[str, bool] = {}
event_clients: Dict[str, WebSocket] = {}

EVENT_RULES = [
    {
        "id": "R001",
        "name": "training_loop_detected",
        "keywords": ["loss.backward", "optimizer.step", "for epoch in"],
        "message": "Training loop sinyali algılandı. Lint + train hazırlığı önerilir.",
        "severity": "info",
    },
    {
        "id": "R002",
        "name": "metric_tracking_detected",
        "keywords": ["loss", "accuracy", "val_loss", "val_acc"],
        "message": "Metric takibi bulundu. Canlı chart feedback etkinleştirilebilir.",
        "severity": "info",
    },
    {
        "id": "R003",
        "name": "missing_eval_phase",
        "keywords": ["model.train()"],
        "negative_keywords": ["model.eval()"],
        "message": "model.train() var fakat model.eval() görünmüyor.",
        "severity": "warning",
    },
]

# ---- Linter / Rule Engine ----
LINT_RULES = [
    {
        "id": "E001",
        "name": "missing_import_torch",
        "pattern": r"(?:torch\.|nn\.|optim\.)",
        "check": lambda code: bool(re.search(r'(?:torch\.|nn\.|optim\.)', code)) and 'import torch' not in code,
        "message": "PyTorch kullanılıyor fakat 'import torch' bulunamadı",
        "severity": "error"
    },
    {
        "id": "E002",
        "name": "missing_forward_method",
        "pattern": r"class\s+\w+\(nn\.Module\)",
        "check": lambda code: bool(re.search(r'class\s+\w+\(nn\.Module\)', code)) and 'def forward' not in code,
        "message": "nn.Module sınıfında 'forward' metodu eksik",
        "severity": "error"
    },
    {
        "id": "W001",
        "name": "no_gpu_check",
        "pattern": r"\.cuda\(\)",
        "check": lambda code: '.cuda()' in code and 'torch.cuda.is_available' not in code,
        "message": "GPU kullanılıyor fakat availability kontrolü yapılmamış",
        "severity": "warning"
    },
    {
        "id": "W002",
        "name": "hardcoded_lr",
        "pattern": r"lr\s*=\s*\d+\.\d+",
        "check": lambda code: bool(re.search(r'lr\s*=\s*0\.\d+', code)),
        "message": "Learning rate hard-coded. Parametre olarak geçilmesi önerilir",
        "severity": "warning"
    },
    {
        "id": "W003",
        "name": "no_model_eval",
        "pattern": r"model\.eval\(\)",
        "check": lambda code: 'model.train()' in code and 'model.eval()' not in code,
        "message": "model.train() kullanılıyor fakat model.eval() çağrısı yok",
        "severity": "warning"
    },
    {
        "id": "I001",
        "name": "suggest_dataloader",
        "pattern": r"for\s+.*\s+in\s+.*data",
        "check": lambda code: bool(re.search(r'for\s+.*\s+in\s+.*data', code)) and 'DataLoader' not in code,
        "message": "DataLoader kullanılması önerilir",
        "severity": "info"
    },
    {
        "id": "I002",
        "name": "suggest_seed",
        "pattern": r"torch\.manual_seed",
        "check": lambda code: 'torch.manual_seed' not in code and ('train' in code.lower() or 'epoch' in code.lower()),
        "message": "Tekrarlanabilirlik için torch.manual_seed() kullanın",
        "severity": "info"
    },
]

def lint_code(code: str) -> LintResult:
    errors = []
    warnings = []
    info = []

    # Syntax check
    try:
        ast.parse(code)
    except SyntaxError as e:
        errors.append({
            "rule": "SYNTAX",
            "line": e.lineno or 1,
            "col": e.offset or 0,
            "message": f"Syntax hatası: {e.msg}"
        })
        return LintResult(errors=errors, warnings=warnings, info=info)

    lines = code.split('\n')
    for rule in LINT_RULES:
        if rule["check"](code):
            line_num = 1
            for i, line in enumerate(lines, 1):
                if re.search(rule["pattern"], line):
                    line_num = i
                    break
            entry = {
                "rule": rule["id"],
                "line": line_num,
                "col": 0,
                "message": rule["message"]
            }
            if rule["severity"] == "error":
                errors.append(entry)
            elif rule["severity"] == "warning":
                warnings.append(entry)
            else:
                info.append(entry)

    # Check for unused variables
    try:
        tree = ast.parse(code)
        assigned = set()
        used = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        assigned.add(target.id)
            elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                used.add(node.id)
        unused = assigned - used - {'_', '__', 'model', 'optimizer', 'criterion', 'scheduler', 'device'}
        for var in unused:
            for i, line in enumerate(lines, 1):
                if re.search(rf'\b{var}\b\s*=', line):
                    warnings.append({
                        "rule": "W004",
                        "line": i,
                        "col": 0,
                        "message": f"Değişken '{var}' atanmış fakat kullanılmamış"
                    })
                    break
    except Exception:
        pass

    return LintResult(errors=errors, warnings=warnings, info=info)


def evaluate_event_rules(code: str) -> List[Dict[str, Any]]:
    lowered = code.lower()
    hits: List[Dict[str, Any]] = []
    for rule in EVENT_RULES:
        keywords = [k.lower() for k in rule.get("keywords", [])]
        if not keywords:
            continue
        if not any(keyword in lowered for keyword in keywords):
            continue
        negative_keywords = [k.lower() for k in rule.get("negative_keywords", [])]
        if negative_keywords and any(keyword in lowered for keyword in negative_keywords):
            continue
        hits.append(
            {
                "id": rule["id"],
                "name": rule["name"],
                "severity": rule["severity"],
                "message": rule["message"],
            }
        )
    return hits


# ---- Simulated Training ----
async def run_training(session_id: str, config: TrainingConfig, websocket: WebSocket):
    """Simulate PyTorch model training with realistic metrics."""
    active_sessions[session_id] = True
    epochs = config.epochs
    lr = config.learning_rate

    base_loss = 2.5 + random.uniform(-0.3, 0.3)
    base_acc = 0.1 + random.uniform(-0.05, 0.05)

    await websocket.send_json({
        "type": "status",
        "data": {"status": "running", "message": f"Eğitim başlatılıyor... Model: {config.model_name}"}
    })

    await websocket.send_json({
        "type": "event",
        "data": {"event": "init", "message": f"[AGENT] Model derleniyor... lr={lr}, batch_size={config.batch_size}"}
    })
    await asyncio.sleep(0.5)

    await websocket.send_json({
        "type": "event",
        "data": {"event": "init", "message": "[AGENT] Veri seti yükleniyor... MNIST (60000 örnek)"}
    })
    await asyncio.sleep(0.3)

    metrics_list = []

    for epoch in range(1, epochs + 1):
        if not active_sessions.get(session_id, False):
            await websocket.send_json({
                "type": "status",
                "data": {"status": "stopped", "message": "Eğitim durduruldu"}
            })
            break

        progress = epoch / epochs
        noise = random.uniform(-0.05, 0.05)

        train_loss = base_loss * math.exp(-2.5 * progress) + noise * 0.3
        train_acc = min(0.99, base_acc + (0.95 - base_acc) * (1 - math.exp(-3 * progress)) + noise * 0.02)
        val_loss = train_loss * (1 + random.uniform(0.05, 0.2))
        val_acc = train_acc * (1 - random.uniform(0.01, 0.05))

        batch_count = 1875
        for batch in range(0, batch_count, 375):
            if not active_sessions.get(session_id, False):
                break
            batch_progress = min(batch + 375, batch_count)
            await websocket.send_json({
                "type": "batch",
                "data": {
                    "epoch": epoch,
                    "batch": batch_progress,
                    "total_batches": batch_count,
                    "batch_loss": round(train_loss + random.uniform(-0.1, 0.1), 4)
                }
            })
            await asyncio.sleep(0.1)

        metric = {
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "train_acc": round(train_acc, 4),
            "val_loss": round(val_loss, 4),
            "val_acc": round(val_acc, 4),
            "lr": round(lr * (0.95 ** epoch), 6)
        }
        metrics_list.append(metric)

        await websocket.send_json({
            "type": "epoch",
            "data": metric
        })

        await websocket.send_json({
            "type": "event",
            "data": {
                "event": "epoch_end",
                "message": f"[EPOCH {epoch}/{epochs}] loss={metric['train_loss']:.4f} acc={metric['train_acc']:.4f} val_loss={metric['val_loss']:.4f} val_acc={metric['val_acc']:.4f}"
            }
        })

        await asyncio.sleep(0.3)

    if active_sessions.get(session_id, False):
        await websocket.send_json({
            "type": "status",
            "data": {"status": "completed", "message": "Eğitim tamamlandı!"}
        })

    # Save to DB
    await db.training_sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "completed" if active_sessions.get(session_id, False) else "stopped", "metrics": metrics_list}},
        upsert=True
    )

    active_sessions.pop(session_id, None)


# ---- Routes ----
@api_router.get("/")
async def root():
    return {"message": "Deep Agent API v1.0"}

@api_router.get("/agent/status")
async def agent_status():
    return {
        "status": "online",
        "active_sessions": len(active_sessions),
        "version": "1.0.0"
    }

@api_router.post("/code/lint", response_model=LintResult)
async def lint_endpoint(req: LintRequest):
    return lint_code(req.code)

@api_router.post("/code/assist", response_model=AssistResponse)
async def assist_endpoint(req: AssistRequest):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"deepagent-{req.session_id}",
            system_message="Sen bir PyTorch deep learning uzmanısın. Kullanıcıya PyTorch model eğitimi, kod yazımı ve optimizasyon konusunda yardım ediyorsun. Kısa ve teknik cevaplar ver. Kod örnekleri Python/PyTorch olsun."
        )
        chat.with_model("openai", "gpt-4o")
        prompt = req.message
        if req.context:
            prompt = f"Mevcut kod:\n```python\n{req.context}\n```\n\nSoru: {req.message}"
        user_msg = UserMessage(text=prompt)
        response = await chat.send_message(user_msg)
        return AssistResponse(response=response, session_id=req.session_id)
    except Exception as e:
        logger.error(f"AI assist error: {e}")
        return AssistResponse(response=f"AI servisi şu an kullanılamıyor: {str(e)}", session_id=req.session_id)

@api_router.post("/training/start")
async def start_training(config: TrainingConfig):
    session_id = str(uuid.uuid4())
    doc = {
        "id": session_id,
        "config": config.model_dump(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metrics": []
    }
    await db.training_sessions.insert_one(doc)
    return {"session_id": session_id, "status": "pending"}

@api_router.post("/training/stop/{session_id}")
async def stop_training(session_id: str):
    if session_id in active_sessions:
        active_sessions[session_id] = False
        return {"status": "stopping", "session_id": session_id}
    return {"status": "not_found", "session_id": session_id}

@api_router.get("/training/history")
async def training_history():
    sessions = await db.training_sessions.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return sessions

@api_router.get("/training/{session_id}")
async def get_training(session_id: str):
    session = await db.training_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        return {"error": "Session bulunamadı"}
    return session

# ---- WebSocket ----
@api_router.websocket("/ws/training/{session_id}")
async def websocket_training(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("action") == "start":
                config = TrainingConfig(**data.get("config", {}))
                # Update DB
                await db.training_sessions.update_one(
                    {"id": session_id},
                    {"$set": {"status": "running", "config": config.model_dump()}},
                    upsert=True
                )
                await run_training(session_id, config, websocket)
            elif data.get("action") == "stop":
                active_sessions[session_id] = False
            elif data.get("action") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        active_sessions.pop(session_id, None)
        logger.info(f"WebSocket disconnected: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        active_sessions.pop(session_id, None)


@api_router.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await websocket.accept()
    client_id = str(uuid.uuid4())
    event_clients[client_id] = websocket
    try:
        await websocket.send_json(
            {
                "type": "status",
                "data": {
                    "status": "connected",
                    "message": "Event stream hazır. Kod değişikliklerini gönderebilirsiniz.",
                },
            }
        )
        while True:
            payload = await websocket.receive_json()
            action = payload.get("action")
            if action == "code_changed":
                code = payload.get("code", "")
                lint_result = lint_code(code)
                rule_hits = evaluate_event_rules(code)
                await websocket.send_json(
                    {
                        "type": "code_analysis",
                        "data": {
                            "event": "code.changed",
                            "rule_hits": rule_hits,
                            "lint_summary": {
                                "errors": len(lint_result.errors),
                                "warnings": len(lint_result.warnings),
                                "info": len(lint_result.info),
                            },
                        },
                    }
                )
            elif action == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        logger.info("Event websocket disconnected")
    except Exception as e:
        logger.error(f"Event websocket error: {e}")
    finally:
        event_clients.pop(client_id, None)

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
