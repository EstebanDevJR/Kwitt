from langgraph.graph import StateGraph, END
from .agents.state import AgentState
from .agents.intake import intake_graph
from .agents.creative import creative_graph
from .agents.deploy import deploy_graph
from .agents.monitor import monitor_graph
from langgraph.checkpoint.memory import MemorySaver


def get_state_from_result(result):
    """Extrae AgentState del resultado del graph"""
    if isinstance(result, dict):
        # Check if it looks like an AgentState dict (has status, message, etc.)
        if 'status' in result and 'user_prompt' in result:
            return AgentState.from_dict(result)
        # Check for nested AgentState values
        for v in result.values():
            if isinstance(v, AgentState):
                return v
    if isinstance(result, AgentState):
        return result
    return None


def create_orchestrator():
    """Crea el grafo principal que orquesta todos los agentes"""
    
    graph = StateGraph(AgentState)
    
    graph.add_node("intake", intake_node)
    graph.add_node("creative", creative_node)
    graph.add_node("deploy", deploy_node)
    graph.add_node("monitor", monitor_node)
    
    graph.set_entry_point("intake")
    
    graph.add_conditional_edges(
        "intake",
        lambda s: "creative" if s and s.portfolio_spec else END,
        {"creative": "creative", END: END}
    )
    
    graph.add_conditional_edges(
        "creative",
        lambda s: "monitor" if s and s.opencode_result and not s.opencode_result.get("success") else ("deploy" if s and s.files_created else END),
        {"monitor": "monitor", "deploy": "deploy", END: END}
    )
    
    graph.add_conditional_edges(
        "monitor",
        lambda s: s.status if s else "failed",
        {
            "creative": "creative",
            "deploy": "deploy",
            "failed": END,
            "success": END
        }
    )
    
    graph.add_edge("deploy", END)
    
    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)


def intake_node(state: AgentState):
    """Wrapper para intake subgraph"""
    result = intake_graph.invoke(state)
    return get_state_from_result(result) or state


def creative_node(state: AgentState):
    """Wrapper para creative subgraph"""
    result = creative_graph.invoke(state)
    return get_state_from_result(result) or state


def deploy_node(state: AgentState):
    """Wrapper para deploy subgraph"""
    result = deploy_graph.invoke(state)
    return get_state_from_result(result) or state


def monitor_node(state: AgentState):
    """Wrapper para monitor subgraph"""
    result = monitor_graph.invoke(state)
    return get_state_from_result(result) or state


orchestrator = create_orchestrator()


def run_portfolio_workflow(user_prompt: str) -> AgentState:
    """Ejecuta el workflow completo"""
    initial_state = AgentState(user_prompt=user_prompt)
    
    config = {"configurable": {"thread_id": "main"}}
    
    final_state = None
    for state in orchestrator.stream(initial_state, config):
        extracted = get_state_from_result(state)
        if extracted:
            final_state = extracted
    
    return final_state or initial_state


def run_portfolio_workflow_stream(user_prompt: str):
    """Ejecuta el workflow con streaming"""
    initial_state = AgentState(user_prompt=user_prompt)
    
    config = {"configurable": {"thread_id": "main"}}
    
    for state_update in orchestrator.stream(initial_state, config):
        if isinstance(state_update, dict):
            for node_name, node_state in state_update.items():
                extracted = get_state_from_result(node_state)
                if extracted:
                    yield extracted
                else:
                    extracted = get_state_from_result(state_update)
                    if extracted:
                        yield extracted
        elif isinstance(state_update, AgentState):
            yield state_update
