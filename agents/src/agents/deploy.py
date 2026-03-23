import httpx
import os
import subprocess
from pathlib import Path
from .state import AgentState


class GitHubClient:
    """Cliente para la API de GitHub"""
    
    def __init__(self, token: str = None):
        self.token = token or os.getenv("GITHUB_TOKEN")
        self.base_url = "https://api.github.com"
    
    def _headers(self):
        return {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
    
    def get_user(self):
        """Obtiene info del usuario actual"""
        resp = httpx.get(f"{self.base_url}/user", headers=self._headers())
        return resp.json() if resp.status_code == 200 else None
    
    def create_repo(self, name: str, private: bool = True, description: str = ""):
        """Crea un nuevo repositorio"""
        data = {
            "name": name,
            "private": private,
            "description": description,
            "auto_init": True
        }
        resp = httpx.post(f"{self.base_url}/user/repos", json=data, headers=self._headers())
        return resp.json() if resp.status_code in [200, 201] else None
    
    def get_repo(self, owner: str, repo: str):
        """Obtiene un repositorio"""
        resp = httpx.get(f"{self.base_url}/repos/{owner}/{repo}", headers=self._headers())
        return resp.json() if resp.status_code == 200 else None
    
    def push_files(self, owner: str, repo: str, files: dict, commit_message: str = "Initial portfolio"):
        """Hace push de archivos al repositorio"""
        # Get default branch
        repo_info = self.get_repo(owner, repo)
        if not repo_info:
            return {"error": "Repo not found"}
        
        branch = repo_info.get("default_branch", "main")
        
        # Get latest commit SHA
        ref_resp = httpx.get(f"{self.base_url}/repos/{owner}/{repo}/git/ref/heads/{branch}", headers=self._headers())
        if ref_resp.status_code != 200:
            return {"error": "Could not get ref"}
        
        commit_sha = ref_resp.json()["object"]["sha"]
        
        # Get tree SHA
        tree_resp = httpx.get(f"{self.base_url}/repos/{owner}/{repo}/git/trees/{commit_sha}", headers=self._headers())
        tree_sha = tree_resp.json()["sha"]
        
        # Create blobs and tree
        blobs = []
        for path, content in files.items():
            blob_resp = httpx.post(
                f"{self.base_url}/repos/{owner}/{repo}/git/blobs",
                json={"content": content, "encoding": "utf-8"},
                headers=self._headers()
            )
            if blob_resp.status_code == 201:
                blobs.append({"path": path, "mode": "100644", "type": "blob", "sha": blob_resp.json()["sha"]})
        
        # Create tree
        tree_resp = httpx.post(
            f"{self.base_url}/repos/{owner}/{repo}/git/trees",
            json={"base_tree": tree_sha, "tree": blobs},
            headers=self._headers()
        )
        tree_sha = tree_resp.json()["sha"]
        
        # Create commit
        commit_resp = httpx.post(
            f"{self.base_url}/repos/{owner}/{repo}/git/commits",
            json={
                "message": commit_message,
                "tree": tree_sha,
                "parents": [commit_sha]
            },
            headers=self._headers()
        )
        commit_sha = commit_resp.json()["sha"]
        
        # Update ref
        httpx.patch(
            f"{self.base_url}/repos/{owner}/{repo}/git/refs/heads/{branch}",
            json={"sha": commit_sha},
            headers=self._headers()
        )
        
        return {"success": True, "branch": branch}


class VercelClient:
    """Cliente para la API de Vercel"""
    
    def __init__(self, token: str = None):
        self.token = token or os.getenv("VERCEL_API_TOKEN")
        self.base_url = "https://api.vercel.com"
    
    def _headers(self):
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def get_projects(self):
        """Lista proyectos"""
        resp = httpx.get(f"{self.base_url}/v6/projects", headers=self._headers())
        return resp.json().get("projects", []) if resp.status_code == 200 else []
    
    def create_project(self, name: str, repo: str = None):
        """Crea un proyecto nuevo"""
        data = {
            "name": name,
            "framework": "nextjs",
            "git": {
                "type": "github",
                "repo": repo
            } if repo else None
        }
        resp = httpx.post(f"{self.base_url}/v6/projects", json=data, headers=self._headers())
        return resp.json() if resp.status_code in [200, 201] else None
    
    def deploy(self, project_name: str, repo: str, branch: str = "main"):
        """Inicia un deployment desde GitHub"""
        # First, link the project to GitHub repo
        data = {
            "git": {
                "type": "github",
                "repo": repo,
                "productionBranch": branch
            }
        }
        
        # Find project
        projects = self.get_projects()
        project = next((p for p in projects if p.get("name") == project_name), None)
        
        if project:
            # Update project with repo info
            httpx.patch(
                f"{self.base_url}/v6/projects/{project['id']}",
                json=data,
                headers=self._headers()
            )
        
        # Trigger deployment
        deploy_resp = httpx.post(
            f"{self.base_url}/v6/deployments",
            json={
                "name": project_name,
                "git": {
                    "type": "github",
                    "repo": repo,
                    "branch": branch
                }
            },
            headers=self._headers()
        )
        
        return deploy_resp.json() if deploy_resp.status_code in [200, 201] else None
    
    def get_deployment_status(self, deployment_id: str):
        """Obtiene el estado de un deployment"""
        resp = httpx.get(f"{self.base_url}/v6/deployments/{deployment_id}", headers=self._headers())
        return resp.json() if resp.status_code == 200 else None
    
    def get_project_url(self, project_name: str):
        """Obtiene la URL de producción del proyecto"""
        projects = self.get_projects()
        project = next((p for p in projects if p.get("name") == project_name), None)
        if project and project.get("links"):
            return project["links"].get("production", "").get("url", "")
        return None


def deploy_node(state: AgentState) -> AgentState:
    """Nodo que hace deploy a GitHub + Vercel"""
    import logging
    logger = logging.getLogger(__name__)
    
    deploy_enabled = os.getenv("DEPLOY_ENABLED", "true").lower() == "true"
    
    if not deploy_enabled:
        state.status = "deploy"
        state.message = "Deploy opcional deshabilitado. Los archivos están en el workspace."
        state.files_created = []
        logger.info("[Deploy] Deploy disabled, skipping")
        return state
    
    github_token = os.getenv("GITHUB_TOKEN")
    vercel_token = os.getenv("VERCEL_API_TOKEN")
    
    if not github_token:
        state.errors.append("GITHUB_TOKEN no configurado")
        state.status = "failed"
        state.message = "Configura GITHUB_TOKEN en las variables de entorno, o usa DEPLOY_ENABLED=false"
        return state
    
    if not vercel_token:
        state.errors.append("VERCEL_API_TOKEN no configurado")
        state.status = "failed"
        state.message = "Configura VERCEL_API_TOKEN en las variables de entorno, o usa DEPLOY_ENABLED=false"
        return state
    
    workspace = os.getenv("WORKSPACE", "/app/workspace")
    spec = state.portfolio_spec
    
    repo_name = f"portfolio-{spec.name.lower().replace(' ', '-')}" if spec.name else "portfolio"
    project_name = repo_name.replace("-", "")[:50]
    
    github = GitHubClient(github_token)
    vercel = VercelClient(vercel_token)
    
    try:
        user = github.get_user()
        if not user:
            state.errors.append("Error autenticando con GitHub")
            state.status = "failed"
            state.message = "Verifica tu GITHUB_TOKEN"
            return state
        
        owner = user.get("login")
        
        # Check if repo already exists
        existing_repo = github.get_repo(owner, repo_name)
        if existing_repo:
            logger.info(f"[Deploy] Repo {repo_name} already exists, reusing")
            state.existing_repo = True
            state.github_url = existing_repo.get("html_url")
        else:
            # Create new repo
            repo = github.create_repo(repo_name, description=f"Portafolio de {spec.name or 'usuario'}")
            if "error" in repo:
                state.errors.append(f"GitHub: {repo.get('error')}")
                state.status = "failed"
                state.message = f"Error creando repo: {repo.get('error')}"
                return state
            state.github_url = f"https://github.com/{owner}/{repo_name}"
            logger.info(f"[Deploy] Created new repo: {repo_name}")
        
        # Read files to push
        files_to_push = {}
        workspace_path = Path(workspace)
        for file_path in workspace_path.rglob("*"):
            if file_path.is_file() and not file_path.name.startswith('.'):
                try:
                    content = file_path.read_text(encoding='utf-8')
                    rel_path = file_path.relative_to(workspace_path)
                    files_to_push[str(rel_path)] = content
                except:
                    pass
        
        if files_to_push:
            push_result = github.push_files(owner, repo_name, files_to_push, "Initial portfolio")
            if push_result.get("success"):
                state.github_url = f"https://github.com/{owner}/{repo_name}"
        
        # Deploy to Vercel
        full_repo = f"{owner}/{repo_name}"
        deploy_result = vercel.deploy(project_name, full_repo)
        
        if deploy_result and "url" in deploy_result:
            state.vercel_url = f"https://{deploy_result['url']}"
            state.final_url = state.vercel_url
        elif deploy_result and "id" in deploy_result:
            # Wait for deployment
            import time
            for _ in range(30):
                time.sleep(2)
                status = vercel.get_deployment_status(deploy_result["id"])
                if status and status.get("state") == "READY":
                    state.vercel_url = f"https://{status.get('url', project_name)}"
                    state.final_url = state.vercel_url
                    break
        
        state.status = "deploy"
        
        if state.final_url:
            state.message = f"Portafolio desplegado: {state.final_url}"
        else:
            state.message = f"Repo creado: {state.github_url} (deploy manual requerido)"
            state.errors.append("Vercel deployment pendiente")
            
    except Exception as e:
        state.errors.append(f"Deploy error: {str(e)}")
        state.status = "failed"
        state.message = f"Error en deploy: {str(e)}"
    
    return state


def create_deploy_graph():
    """Crea el graph de deploy"""
    from langgraph.graph import StateGraph, END
    
    graph = StateGraph(AgentState)
    graph.add_node("deploy", deploy_node)
    graph.set_entry_point("deploy")
    graph.add_edge("deploy", END)
    return graph.compile()


deploy_graph = create_deploy_graph()
