import json
import os
import logging
from langgraph.graph import StateGraph, END
from .state import AgentState, PortfolioSpec
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

logger = logging.getLogger(__name__)


def get_llm(temperature: float = 0.3):
    """Get LLM instance based on available API keys"""
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    
    if os.getenv("ANTHROPIC_API_KEY"):
        return ChatAnthropic(model="claude-3-5-sonnet-20241022", temperature=temperature)
    
    return ChatOpenAI(
        model=model,
        temperature=temperature,
        base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        api_key=os.getenv("OPENAI_API_KEY", "")
    )


INTAKE_PROMPT = """Eres un asistente que estructura solicitudes de portafolios.
El usuario describe lo que quiere en lenguaje natural. Tu trabajo es extraer la estructura.

Schema del portafolio:
- name: nombre del usuario
- bio: biografía profesional
- role: rol (fullstack, frontend, backend, devops, etc)
- theme: tema (dark, light, minimal, creative, developer)
- framework: framework a usar (html, nextjs, react, vue, astro, svelte). Si no lo menciona, usa "auto".
- colors: colores específicos (opcional)
- projects: lista de proyectos/github repos
- skills: habilidades con nivel y categoría
- experience: experiencia laboral
- contact: email, github, twitter, linkedin
- style: estilo (professional, creative, minimal)

Responde SOLO con JSON válido del schema. Sin comentarios.
Si falta información, usa strings vacíos o arrays vacíos.
No inventes datos que el usuario no proporcionó."""


def extract_json_from_response(content: str) -> dict:
    """Extrae JSON de la respuesta del LLM"""
    content = content.strip()
    
    # Remove markdown code blocks
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]
    
    content = content.strip()
    
    # Try to parse JSON
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Try to find JSON-like structure
        import re
        json_match = re.search(r'\{[^{}]*\}', content)
        if json_match:
            try:
                return json.loads(json_match.group())
            except:
                pass
        raise ValueError(f"Could not parse JSON from: {content[:100]}")


def parse_prompt_node(state: AgentState, attempt: int = 0) -> AgentState:
    """Nodo que parsea el prompt del usuario con reintentos"""
    llm = get_llm(temperature=0.2)  # Lower temperature for more consistent output
    
    prompt = f"""{INTAKE_PROMPT}

Solicitud del usuario:
{state.user_prompt}

Responde con JSON:"""
    
    try:
        logger.info(f"[Intake] Parsing prompt (attempt {attempt + 1})")
        response = llm.invoke(prompt)
        content = response.content
        
        spec_dict = extract_json_from_response(content)
        
        # Validate required fields exist
        if not isinstance(spec_dict, dict):
            raise ValueError("Response is not a dictionary")
        
        # Create PortfolioSpec with defaults for missing fields
        framework = spec_dict.get("framework", "auto")
        if not framework or framework.lower() in ["auto", "", "none", "null"]:
            framework = "auto"
        
        spec = PortfolioSpec(
            name=spec_dict.get("name", ""),
            bio=spec_dict.get("bio", ""),
            role=spec_dict.get("role", ""),
            theme=spec_dict.get("theme", "dark"),
            framework=framework,
            colors=spec_dict.get("colors"),
            projects=spec_dict.get("projects", []),
            skills=spec_dict.get("skills", []),
            experience=spec_dict.get("experience", []),
            contact=spec_dict.get("contact", {}),
            style=spec_dict.get("style", "professional")
        )
        
        state.portfolio_spec = spec
        state.status = "intake"
        
        if spec.needs_framework_selection():
            state.message = "Framework no especificado. Esperando selección del usuario."
        else:
            state.message = f"Prompt parseado: {spec.framework}"
        
        logger.info(f"[Intake] Parsed: name={spec.name}, framework={spec.framework}")
        
    except Exception as e:
        error_msg = str(e)
        logger.warning(f"[Intake] Error attempt {attempt + 1}: {error_msg}")
        
        if attempt < 2:  # Max 3 attempts
            # Retry with more explicit instructions
            llm = get_llm(temperature=0.1)
            retry_prompt = f"""{INTAKE_PROMPT}

Error anterior: {error_msg}

Solicitud del usuario:
{state.user_prompt}

Responde SOLO con JSON válido. Ejemplo: {{"name": "Juan", "bio": "Developer", "theme": "dark"}}"""
            try:
                response = llm.invoke(retry_prompt)
                spec_dict = extract_json_from_response(response.content)
                spec = PortfolioSpec(**spec_dict)
                state.portfolio_spec = spec
                state.status = "intake"
                state.message = "Prompt parseado (con reintento)"
                return state
            except:
                pass
        
        state.intake_error = error_msg
        state.status = "failed"
        state.message = f"Error al parsear prompt: {error_msg}"
    
    return state


def create_intake_graph():
    """Crea el graph de intake"""
    graph = StateGraph(AgentState)
    graph.add_node("parse", lambda s: parse_prompt_node(s, attempt=0))
    graph.set_entry_point("parse")
    graph.add_edge("parse", END)
    return graph.compile()


intake_graph = create_intake_graph()
