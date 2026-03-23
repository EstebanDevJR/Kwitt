import os
import json
from pathlib import Path
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from .state import AgentState
from .creative import run_opencode


def analyze_error(state: AgentState) -> AgentState:
    """Nodo que analiza los errores y determina la acción"""
    
    if not state.errors:
        state.status = "success"
        state.message = "Completado exitosamente"
        return state
    
    # Use LLM to analyze error
    llm = ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        temperature=0.2,
        base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        api_key=os.getenv("OPENAI_API_KEY", "")
    )
    
    error_summary = "\n".join(state.errors)
    opencode_output = state.opencode_result.get("stderr", "") if state.opencode_result else ""
    
    analysis_prompt = f"""Analiza el siguiente error de OpenCode y determina cómo solucionarlo.

Errores: {error_summary}
Output de OpenCode: {opencode_output}

Responde con JSON:
{{
    "analysis": "breve análisis del error",
    "action": "retry" | "skip_deploy" | "need_input",
    "retry_prompt": "prompt modificado para reintentar (si action=retry)"
}}"""
    
    try:
        response = llm.invoke(analysis_prompt)
        content = response.content
        
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        
        analysis = json.loads(content.strip())
        
        state.message = analysis.get("analysis", "")
        
        if analysis.get("action") == "retry" and analysis.get("retry_prompt"):
            state.status = "creative"
            state.user_prompt = analysis["retry_prompt"]
        elif analysis.get("action") == "skip_deploy":
            state.status = "deploy"
            state.github_url = state.files_created[0] if state.files_created else ""
        else:
            state.status = "failed"
            state.message = f"Error requiere intervención: {analysis.get('analysis')}"
            
    except Exception as e:
        state.message = f"Error analyzing: {str(e)}"
        state.status = "failed"
    
    state.retry_count += 1
    return state


def retry_node(state: AgentState) -> AgentState:
    """Nodo que reintenta la operación"""
    
    if state.retry_count >= state.max_retries:
        state.status = "failed"
        state.message = f"Máximo de reintentos ({state.max_retries}) alcanzado"
        return state
    
    workspace = os.getenv("WORKSPACE", "/app/workspace")
    model = os.getenv("OPENCODE_MODEL", "minimax-m2.5-free")
    
    # Add error context to prompt
    error_context = f"\n\nError previo: {', '.join(state.errors)}\nPor favor corrige estos errores."
    prompt = state.user_prompt + error_context
    
    result = run_opencode(prompt, workspace, model)
    state.opencode_result = result
    
    if result["success"]:
        files = list(Path(workspace).rglob("*"))
        state.files_created = [str(f) for f in files if f.is_file() and not f.name.startswith('.')]
        state.status = "creative"
        state.message = f"Reintento exitoso ({len(state.files_created)} archivos)"
        state.errors = []
    else:
        state.errors.append(f"Retry {state.retry_count} failed: {result.get('stderr', 'unknown')}")
        state.status = "monitor"
    
    return state


def monitor_node(state: AgentState) -> AgentState:
    """Nodo principal de monitor que decide siguiente paso"""
    
    # Check if we have errors to analyze
    if state.errors and state.retry_count < state.max_retries:
        return analyze_error(state)
    
    # If no errors or max retries, determine final state
    if not state.errors:
        state.status = "success"
        state.message = "Completado sin errores"
    elif state.retry_count >= state.max_retries:
        state.status = "failed"
        state.message = "No se pudo completar después de varios intentos"
    
    return state


def create_monitor_graph():
    """Crea el graph de monitor"""
    
    graph = StateGraph(AgentState)
    graph.add_node("monitor", monitor_node)
    graph.add_node("analyze", analyze_error)
    graph.add_node("retry", retry_node)
    
    graph.set_entry_point("monitor")
    
    # From monitor, if errors exist, go to analyze
    graph.add_conditional_edges(
        "monitor",
        lambda s: "analyze" if s.errors else "success",
        {
            "analyze": "analyze",
            "success": END
        }
    )
    
    # From analyze, determine action
    graph.add_conditional_edges(
        "analyze",
        lambda s: s.status,
        {
            "creative": "retry",
            "deploy": END,
            "failed": END
        }
    )
    
    # From retry, go back to monitor
    graph.add_edge("retry", "monitor")
    
    return graph.compile()


monitor_graph = create_monitor_graph()
