import subprocess
import os
import json
import logging
from pathlib import Path
from .state import AgentState

logger = logging.getLogger(__name__)


def get_opencode_prompt(state: AgentState) -> str:
    """Genera el prompt para OpenCode basado en el spec"""
    spec = state.portfolio_spec
    
    if hasattr(spec, 'to_opencode_prompt'):
        return spec.to_opencode_prompt()
    
    prompt_parts = [
        "Crea un portafolio profesional con las siguientes características:"
    ]
    
    if spec.name:
        prompt_parts.append(f"- Nombre: {spec.name}")
    if spec.bio:
        prompt_parts.append(f"- Bio: {spec.bio}")
    if spec.role:
        prompt_parts.append(f"- Rol: {spec.role}")
    if spec.theme:
        prompt_parts.append(f"- Tema: {spec.theme}")
    if spec.colors:
        prompt_parts.append(f"- Colores personalizados: {json.dumps(spec.colors)}")
    if spec.projects:
        prompt_parts.append(f"- Proyectos: {', '.join(spec.projects)}")
    if spec.skills:
        skills_str = ", ".join([s.get("name", "") for s in spec.skills])
        prompt_parts.append(f"- Habilidades: {skills_str}")
    if spec.experience:
        exp_str = ", ".join([e.get("company", "") for e in spec.experience])
        prompt_parts.append(f"- Experiencia: {exp_str}")
    if spec.contact:
        prompt_parts.append(f"- Contacto: {json.dumps(spec.contact)}")
    if spec.style:
        prompt_parts.append(f"- Estilo: {spec.style}")
    
    prompt_parts.append("\nEl portafolio debe ser moderno, profesional y con animaciones suaves.")
    
    return "\n".join(prompt_parts)


def run_opencode(prompt: str, workspace: str, timeout: int = None) -> dict:
    """Ejecuta OpenCode con el modelo gratuito de OpenCode Zen"""
    timeout = timeout or int(os.getenv("OPENCODE_TIMEOUT", "300"))
    opencode_bin = os.getenv("OPENCODE_BIN", "/usr/local/bin/opencode")
    
    Path(workspace).mkdir(parents=True, exist_ok=True)
    
    cmd = [
        opencode_bin,
        "run",
        "-m", "opencode/minimax-m2.5-free",
        "--",
        prompt
    ]
    
    logger.info(f"[Creative] Running opencode with opencode/minimax-m2.5-free, timeout={timeout}s")
    logger.info(f"[Creative] Workspace: {workspace}")
    
    try:
        result = subprocess.run(
            cmd,
            cwd=workspace,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        
        success = (
            result.returncode == 0 or 
            "done" in result.stdout.lower() or 
            "completed" in result.stdout.lower() or
            "updated" in result.stdout.lower() or
            "created" in result.stdout.lower() or
            "generat" in result.stdout.lower()
        )
        
        logger.info(f"[Creative] OpenCode finished: returncode={result.returncode}, stdout_len={len(result.stdout)}, stderr_len={len(result.stderr)}")
        
        return {
            "success": success,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        logger.warning(f"[Creative] OpenCode timed out after {timeout}s")
        return {
            "success": False,
            "stdout": "",
            "stderr": f"timeout after {timeout}s",
            "returncode": -1
        }
    except Exception as e:
        logger.error(f"[Creative] OpenCode error: {e}")
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "returncode": -1
        }


def creative_node(state: AgentState) -> AgentState:
    """Nodo que ejecuta OpenCode"""
    import logging
    logger = logging.getLogger(__name__)
    
    workspace = os.getenv("WORKSPACE", "/app/workspace")
    timeout = int(os.getenv("OPENCODE_TIMEOUT", "300"))
    
    Path(workspace).mkdir(parents=True, exist_ok=True)
    
    spec = state.portfolio_spec
    if spec.needs_framework_selection():
        state.status = "awaiting_framework"
        state.message = "Selecciona un framework: /html, /nextjs, /react, /vue, /astro, /svelte"
        logger.info("[Creative] Awaiting framework selection from user")
        return state
    
    prompt = get_opencode_prompt(state)
    
    logger.info(f"[Creative] Starting portfolio creation for: {state.portfolio_spec.name or 'user'} (framework: {spec.framework})")
    
    result = run_opencode(prompt, workspace, timeout)
    
    state.opencode_result = result
    
    if result["success"]:
        files = list(Path(workspace).rglob("*"))
        state.files_created = [str(f) for f in files if f.is_file() and not f.name.startswith('.') and not f.name.endswith('.json')]
        state.status = "creative"
        state.message = f"Portafolio creado ({len(state.files_created)} archivos)"
        logger.info(f"[Creative] Portfolio created with {len(state.files_created)} files")
    else:
        error_msg = result.get('stderr', result.get('stdout', 'unknown error'))
        state.errors.append(f"OpenCode error: {error_msg[:200]}")
        state.status = "monitor"
        state.message = f"Error al crear portafolio: {error_msg[:100]}"
        logger.warning(f"[Creative] Error: {error_msg[:200]}")
    
    return state


def create_creative_graph():
    """Crea el graph de creative"""
    from langgraph.graph import StateGraph, END
    
    graph = StateGraph(AgentState)
    graph.add_node("create", creative_node)
    graph.set_entry_point("create")
    graph.add_edge("create", END)
    return graph.compile()


creative_graph = create_creative_graph()
