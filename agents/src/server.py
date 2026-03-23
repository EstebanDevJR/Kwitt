from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import os
import uuid
import json
import logging
from .orchestrator import run_portfolio_workflow_stream
from .agents.state import AgentState, PortfolioSpec
from .tools.job_storage import save_job, load_job, list_jobs as get_job_list, delete_job

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Kwitt Agents API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def send_telegram_message(chat_id: int, text: str, token: str):
    """Envía mensaje a Telegram"""
    import httpx
    try:
        base_url = f"https://api.telegram.org/bot{token}"
        await httpx.AsyncClient().post(
            f"{base_url}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
        )
    except Exception as e:
        logger.warning(f"[Telegram] Failed to send: {e}")


async def send_framework_buttons(chat_id: int, job_id: str, token: str):
    """Envía botones de selección de framework"""
    import httpx
    try:
        base_url = f"https://api.telegram.org/bot{token}"
        keyboard = {
            "inline_keyboard": [
                [{"text": "🌐 HTML simple", "callback_data": f"fw_html_{job_id}"},
                 {"text": "⚛️ Next.js", "callback_data": f"fw_nextjs_{job_id}"}],
                [{"text": "⚛️ React", "callback_data": f"fw_react_{job_id}"},
                 {"text": "💚 Vue", "callback_data": f"fw_vue_{job_id}"}],
                [{"text": "🚀 Astro", "callback_data": f"fw_astro_{job_id}"},
                 {"text": "🔥 Svelte", "callback_data": f"fw_svelte_{job_id}"}],
            ]
        }
        await httpx.AsyncClient().post(
            f"{base_url}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": "🎨 *¿Qué framework prefieres para tu portafolio?*\n\nElige una opción:",
                "parse_mode": "Markdown",
                "reply_markup": keyboard
            }
        )
    except Exception as e:
        logger.warning(f"[Telegram] Failed to send framework buttons: {e}")


STATUS_MESSAGES = {
    "pending": "⏳ Iniciando...",
    "intake": "📝 Analizando tu solicitud...",
    "creative": "🎨 Creando tu portafolio...",
    "deploy": "🚀 Desplegando a GitHub y Vercel...",
    "monitor": "🔧 Verificando errores...",
    "success": "✅ ¡Completado!",
    "failed": "❌ Error"
}


class PortfolioRequest(BaseModel):
    prompt: str
    spec: Optional[PortfolioSpec] = None
    user_id: Optional[str] = None
    chat_id: Optional[int] = None
    telegram_token: Optional[str] = None


class WorkflowStatus(BaseModel):
    job_id: str
    status: str
    message: str
    final_url: Optional[str] = None
    github_url: Optional[str] = None
    errors: List[str] = []


def validate_config():
    """Valida configuración requerida"""
    deploy_enabled = os.getenv("DEPLOY_ENABLED", "true").lower() == "true"
    if not deploy_enabled:
        return []  # No config needed if deploy disabled
    
    missing = []
    if not os.getenv("GITHUB_TOKEN"):
        missing.append("GITHUB_TOKEN")
    if not os.getenv("VERCEL_API_TOKEN"):
        missing.append("VERCEL_API_TOKEN")
    return missing


@app.get("/")
def root():
    return {"message": "Kwitt Agents API", "version": "2.0.0"}


@app.get("/health")
def health():
    missing = validate_config()
    return {"status": "ok" if not missing else "missing_config", "missing": missing}


@app.get("/portfolio/config")
def get_config():
    """Retorna configuración requerida"""
    deploy_enabled = os.getenv("DEPLOY_ENABLED", "true").lower() == "true"
    return {
        "deploy_enabled": deploy_enabled,
        "required_env": ["GITHUB_TOKEN", "VERCEL_API_TOKEN"] if deploy_enabled else [],
        "optional_env": ["OPENAI_API_KEY", "OPENCODE_MODEL", "WORKSPACE"],
        "configured": {
            "GITHUB_TOKEN": bool(os.getenv("GITHUB_TOKEN")),
            "VERCEL_API_TOKEN": bool(os.getenv("VERCEL_API_TOKEN")),
            "OPENAI_API_KEY": bool(os.getenv("OPENAI_API_KEY")),
        }
    }


@app.post("/portfolio/create", response_model=WorkflowStatus)
async def create_portfolio(request: PortfolioRequest):
    """Crea un nuevo portafolio desde un prompt (sync)"""
    
    missing = validate_config()
    if missing:
        raise HTTPException(400, f"Configuración faltante: {', '.join(missing)}")
    
    job_id = str(uuid.uuid4())
    logger.info(f"[{job_id}] Starting portfolio creation: {request.prompt[:50]}...")
    
    # Notificar inicio
    if request.chat_id and request.telegram_token:
        await send_telegram_message(
            request.chat_id,
            f"🎨 *Creando tu portafolio*\n\n{STATUS_MESSAGES['pending']}\n\nPrompt: {request.prompt[:100]}...",
            request.telegram_token
        )
    
    try:
        initial_state = AgentState(user_prompt=request.prompt)
        save_job(job_id, {"status": "running", "state": initial_state.to_dict()})
        
        final_state = None
        last_status = None
        
        for state in run_portfolio_workflow_stream(request.prompt):
            final_state = state
            
            # Manejar selección de framework
            if state.status == "awaiting_framework":
                logger.info(f"[{job_id}] Awaiting framework selection")
                if request.chat_id and request.telegram_token:
                    await send_framework_buttons(request.chat_id, job_id, request.telegram_token)
                
                save_job(job_id, {"status": "awaiting_framework", "state": final_state.to_dict()})
                
                return WorkflowStatus(
                    job_id=job_id,
                    status="awaiting_framework",
                    message="Selecciona un framework usando los botones o el comando /framework [opcion]",
                    errors=[]
                )
            
            # Notificar cambio de estado
            if state.status != last_status and request.chat_id and request.telegram_token:
                await send_telegram_message(
                    request.chat_id,
                    f"📊 *Estado:* {STATUS_MESSAGES.get(state.status, state.status)}\n\n{state.message}",
                    request.telegram_token
                )
                last_status = state.status
            
            save_job(job_id, {"status": state.status, "state": final_state.to_dict()})
        
        result_data = {
            "status": final_state.status,
            "state": final_state.to_dict()
        }
        save_job(job_id, result_data)
        logger.info(f"[{job_id}] Completed with status: {final_state.status}")
        
        # Notificar resultado final
        if request.chat_id and request.telegram_token:
            if final_state.status == "success":
                msg = f"✅ *¡Portafolio creado!*\n\n🔗 {final_state.final_url}\n📁 {final_state.github_url}"
            elif final_state.github_url:
                msg = f"📁 *Repo creado:* {final_state.github_url}\n⚠️ Deploy manual requerido"
            else:
                msg = f"❌ *Error:* {final_state.message}"
            
            await send_telegram_message(request.chat_id, msg, request.telegram_token)
        
        return WorkflowStatus(
            job_id=job_id,
            status=final_state.status,
            message=final_state.message,
            final_url=final_state.final_url,
            github_url=final_state.github_url,
            errors=final_state.errors
        )
        
    except Exception as e:
        logger.error(f"[{job_id}] Error: {e}")
        save_job(job_id, {"status": "failed", "error": str(e)})
        
        if request.chat_id and request.telegram_token:
            await send_telegram_message(
                request.chat_id,
                f"❌ *Error:* {str(e)}",
                request.telegram_token
            )
        
        raise HTTPException(500, f"Error creando portafolio: {str(e)}")


@app.post("/portfolio/create/stream")
async def create_portfolio_stream(request: PortfolioRequest):
    """Crea portafolio con streaming de eventos"""
    
    missing = validate_config()
    if missing:
        raise HTTPException(400, f"Configuración faltante: {', '.join(missing)}")
    
    job_id = str(uuid.uuid4())
    
    async def event_generator():
        yield f"data: {json.dumps({'job_id': job_id, 'status': 'starting', 'message': STATUS_MESSAGES['pending']})}\n\n"
        
        try:
            for state in run_portfolio_workflow_stream(request.prompt):
                msg = STATUS_MESSAGES.get(state.status, state.status)
                yield f"data: {json.dumps({'job_id': job_id, 'status': state.status, 'message': msg})}\n\n"
                
                if state.status in ["success", "failed"]:
                    yield f"data: {json.dumps({'job_id': job_id, 'status': state.status, 'final_url': state.final_url, 'github_url': state.github_url})}\n\n"
                    break
        except Exception as e:
            yield f"data: {json.dumps({'job_id': job_id, 'status': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/portfolio/update", response_model=WorkflowStatus)
async def update_portfolio(request: PortfolioRequest):
    """Actualiza un portafolio existente"""
    
    missing = validate_config()
    if missing:
        raise HTTPException(400, f"Configuración faltante: {', '.join(missing)}")
    
    job_id = str(uuid.uuid4())
    logger.info(f"[{job_id}] Starting portfolio update: {request.prompt[:50]}...")
    
    try:
        from .agents.creative import creative_graph
        from .agents.monitor import monitor_graph
        
        initial_state = AgentState(user_prompt=request.prompt)
        
        save_job(job_id, {"status": "running", "state": initial_state.to_dict()})
        
        result = creative_graph.invoke(initial_state)
        result = monitor_graph.invoke(result)
        
        save_job(job_id, {"status": result.status, "state": result.to_dict()})
        
        return WorkflowStatus(
            job_id=job_id,
            status=result.status,
            message=result.message,
            final_url=result.final_url,
            github_url=result.github_url,
            errors=result.errors
        )
        
    except Exception as e:
        logger.error(f"[{job_id}] Error: {e}")
        save_job(job_id, {"status": "failed", "error": str(e)})
        raise HTTPException(500, f"Error actualizando portafolio: {str(e)}")


@app.get("/portfolio/status/{job_id}", response_model=WorkflowStatus)
async def get_status(job_id: str):
    """Obtiene el estado de un job"""
    
    job = load_job(job_id)
    if not job:
        raise HTTPException(404, "Job no encontrado")
    
    state_data = job.get("state")
    if not state_data:
        return WorkflowStatus(job_id=job_id, status=job.get("status", "unknown"), message="Job en progreso...")
    
    state = AgentState.from_dict(state_data)
    
    return WorkflowStatus(
        job_id=job_id,
        status=state.status,
        message=state.message,
        final_url=state.final_url,
        github_url=state.github_url,
        errors=state.errors
    )


@app.get("/portfolio/jobs")
async def list_jobs():
    """Lista todos los jobs"""
    return get_job_list()


@app.delete("/portfolio/jobs/{job_id}")
async def remove_job(job_id: str):
    """Elimina un job"""
    job = load_job(job_id)
    if not job:
        raise HTTPException(404, "Job no encontrado")
    delete_job(job_id)
    return {"deleted": job_id}


@app.post("/portfolio/continue/{job_id}")
async def continue_portfolio(job_id: str, framework: str, chat_id: int = None, telegram_token: str = None):
    """Continúa un job que espera selección de framework"""
    job = load_job(job_id)
    if not job:
        raise HTTPException(404, "Job no encontrado")
    
    state_data = job.get("state")
    if not state_data:
        raise HTTPException(400, "Job sin estado")
    
    state = AgentState.from_dict(state_data)
    
    if state.status != "awaiting_framework":
        raise HTTPException(400, "Job no está esperando selección de framework")
    
    valid_frameworks = ["html", "nextjs", "react", "vue", "astro", "svelte"]
    framework = framework.lower().strip()
    if framework not in valid_frameworks:
        raise HTTPException(400, f"Framework inválido. Opciones: {', '.join(valid_frameworks)}")
    
    logger.info(f"[{job_id}] Continuing with framework: {framework}")
    
    state.portfolio_spec.framework = framework
    state.status = "creative"
    state.message = f"Framework {framework} seleccionado"
    
    save_job(job_id, {"status": "running", "state": state.to_dict()})
    
    if chat_id and telegram_token:
        await send_telegram_message(
            chat_id,
            f"🎨 *Creando portafolio con {framework.upper()}*\n\nEsto puede tomar unos minutos...",
            telegram_token
        )
    
    try:
        from .agents.creative import creative_graph
        from .orchestrator import get_state_from_result
        
        result_raw = creative_graph.invoke(state)
        result = get_state_from_result(result_raw)
        
        if result is None:
            raise ValueError("Could not extract state from result")
        
        save_job(job_id, {"status": result.status, "state": result.to_dict()})
        
        if result.status == "creative":
            files = result.files_created
            message = f"✅ *Portafolio creado con {framework.upper()}!*\n\n{len(files)} archivos creados"
            if chat_id and telegram_token:
                await send_telegram_message(chat_id, message, telegram_token)
            
            return WorkflowStatus(
                job_id=job_id,
                status="creative",
                message=f"Portafolio creado con {framework}",
                errors=result.errors
            )
        else:
            return WorkflowStatus(
                job_id=job_id,
                status=result.status,
                message=result.message,
                errors=result.errors
            )
            
    except Exception as e:
        logger.error(f"[{job_id}] Error continuing: {e}")
        return WorkflowStatus(
            job_id=job_id,
            status="failed",
            message=f"Error: {str(e)}",
            errors=[str(e)]
        )


@app.get("/portfolio/download/{job_id}")
async def download_portfolio(job_id: str):
    """Descarga el portafolio como ZIP"""
    import zipfile
    import io
    from fastapi.responses import StreamingResponse
    
    job = load_job(job_id)
    if not job:
        raise HTTPException(404, "Job no encontrado")
    
    state_data = job.get("state")
    if not state_data:
        raise HTTPException(400, "Job sin estado")
    
    state = AgentState.from_dict(state_data)
    workspace = os.getenv("WORKSPACE", "/app/workspace")
    
    if not state.files_created:
        raise HTTPException(400, "No hay archivos creados")
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file_path in state.files_created:
            full_path = Path(workspace) / Path(file_path).name
            if full_path.exists():
                zipf.write(full_path, full_path.name)
    
    zip_buffer.seek(0)
    
    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=portfolio_{job_id[:8]}.zip"}
    )


@app.get("/portfolio/files/{job_id}")
async def list_portfolio_files(job_id: str):
    """Lista los archivos del portafolio"""
    job = load_job(job_id)
    if not job:
        raise HTTPException(404, "Job no encontrado")
    
    state_data = job.get("state")
    if not state_data:
        raise HTTPException(400, "Job sin estado")
    
    state = AgentState.from_dict(state_data)
    
    return {
        "job_id": job_id,
        "files": state.files_created,
        "count": len(state.files_created),
        "workspace_path": os.getenv("WORKSPACE", "/app/workspace")
    }


@app.get("/portfolio/preview/{job_id}")
async def preview_portfolio(job_id: str, path: str = "index.html"):
    """Sirve un archivo del portafolio para preview"""
    from fastapi.responses import FileResponse
    
    job = load_job(job_id)
    if not job:
        raise HTTPException(404, "Job no encontrado")
    
    workspace = os.getenv("WORKSPACE", "/app/workspace")
    file_path = Path(workspace) / path
    
    if not file_path.exists():
        raise HTTPException(404, f"Archivo no encontrado: {path}")
    
    return FileResponse(path=str(file_path))


@app.post("/telegram/webhook")
async def telegram_webhook(update: dict):
    """Webhook para recibir callbacks de Telegram"""
    try:
        from .agents.state import PortfolioSpec
        
        callback_query = update.get("callback_query")
        if not callback_query:
            return {"ok": True}
        
        data = callback_query.get("data", "")
        chat_id = callback_query.get("message", {}).get("chat", {}).get("id")
        
        if data.startswith("fw_"):
            parts = data.split("_")
            if len(parts) >= 3:
                framework = parts[1]
                job_id = "_".join(parts[2:])
                
                logger.info(f"[Webhook] Framework callback: {framework} for job {job_id}")
                
                job = load_job(job_id)
                if job and job.get("status") == "awaiting_framework":
                    state = AgentState.from_dict(job.get("state", {}))
                    state.portfolio_spec.framework = framework
                    state.status = "creative"
                    state.message = f"Framework {framework} seleccionado"
                    save_job(job_id, {"status": "creative", "state": state.to_dict()})
                    
                    return {"ok": True, "message": f"Framework {framework} seleccionado"}
        
        return {"ok": True}
    except Exception as e:
        logger.error(f"[Webhook] Error: {e}")
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
