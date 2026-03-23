from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal, Any
from datetime import datetime
import json


FRAMEWORKS = ["html", "nextjs", "react", "vue", "astro", "svelte"]


class PortfolioSpec(BaseModel):
    """Especificación estructurada del portafolio"""
    name: str = Field(default="", description="Nombre del usuario")
    bio: str = Field(default="", description="Biografía profesional")
    role: str = Field(default="", description="Rol profesional")
    theme: Literal["dark", "light", "minimal", "creative", "developer"] = "dark"
    framework: Literal["html", "nextjs", "react", "vue", "astro", "svelte", "auto"] = "auto"
    colors: Optional[dict] = None
    projects: list[str] = Field(default_factory=list)
    skills: list[dict] = Field(default_factory=list)
    experience: list[dict] = Field(default_factory=list)
    contact: dict = Field(default_factory=dict)
    style: Literal["professional", "creative", "minimal"] = "professional"

    @field_validator('colors', mode='before')
    @classmethod
    def validate_colors(cls, v):
        if v is None or v == [] or v == '':
            return None
        return v if isinstance(v, dict) else None

    @field_validator('contact', mode='before')
    @classmethod
    def validate_contact(cls, v):
        if v is None or v == [] or v == '':
            return {}
        return v if isinstance(v, dict) else {}

    @field_validator('projects', mode='before')
    @classmethod
    def validate_projects(cls, v):
        if v is None or v == '':
            return []
        return v if isinstance(v, list) else []

    @field_validator('skills', mode='before')
    @classmethod
    def validate_skills(cls, v):
        if v is None or v == '':
            return []
        return v if isinstance(v, list) else []

    @field_validator('experience', mode='before')
    @classmethod
    def validate_experience(cls, v):
        if v is None or v == '':
            return []
        return v if isinstance(v, list) else []

    @field_validator('theme', mode='before')
    @classmethod
    def validate_theme(cls, v):
        if isinstance(v, str):
            v = v.lower().strip()
            valid = ["dark", "light", "minimal", "creative", "developer"]
            return v if v in valid else "dark"
        return v

    @field_validator('style', mode='before')
    @classmethod
    def validate_style(cls, v):
        if isinstance(v, str):
            v = v.lower().strip()
            valid = ["professional", "creative", "minimal"]
            return v if v in valid else "professional"
        return v

    @field_validator('framework', mode='before')
    @classmethod
    def validate_framework(cls, v):
        if isinstance(v, str):
            v = v.lower().strip().replace("next.js", "nextjs").replace("nextjs", "nextjs")
            valid = ["html", "nextjs", "react", "vue", "astro", "svelte", "auto"]
            return v if v in valid else "auto"
        return v

    def needs_framework_selection(self) -> bool:
        """Check if framework needs to be asked to user"""
        return self.framework == "auto" or not self.framework

    def to_opencode_prompt(self) -> str:
        """Convierte el spec a un prompt para OpenCode"""
        framework_map = {
            "html": "HTML/CSS/JS vanilla (un solo archivo index.html)",
            "nextjs": "Next.js con React, Tailwind CSS y App Router",
            "react": "React con Vite, Tailwind CSS",
            "vue": "Vue 3 con Vite, Tailwind CSS",
            "astro": "Astro con Tailwind CSS",
            "svelte": "SvelteKit con Tailwind CSS",
            "auto": "HTML/CSS/JS vanilla (un solo archivo index.html)"
        }
        
        framework_desc = framework_map.get(self.framework, "HTML/CSS/JS vanilla")
        
        parts = [f"Crea un portafolio profesional usando {framework_desc}:"]
        
        if self.name:
            parts.append(f"- Nombre: {self.name}")
        if self.bio:
            parts.append(f"- Bio: {self.bio}")
        if self.role:
            parts.append(f"- Rol: {self.role}")
        if self.theme:
            parts.append(f"- Tema visual: {self.theme}")
        if self.colors:
            parts.append(f"- Colores: {json.dumps(self.colors)}")
        if self.projects:
            parts.append(f"- Proyectos: {', '.join(self.projects)}")
        if self.skills:
            skills_str = ", ".join([s.get("name", "") for s in self.skills if isinstance(s, dict)])
            parts.append(f"- Habilidades: {skills_str}")
        if self.experience:
            exp_str = ", ".join([e.get("company", "") for e in self.experience if isinstance(e, dict)])
            parts.append(f"- Experiencia: {exp_str}")
        if self.contact:
            parts.append(f"- Contacto: {json.dumps(self.contact)}")
        if self.style:
            parts.append(f"- Estilo: {self.style}")
        
        parts.append("\nEl portafolio debe ser moderno, profesional y responsivo.")
        return "\n".join(parts)


class AgentState(BaseModel):
    """Estado global del workflow"""
    user_prompt: str = ""
    
    portfolio_spec: Optional[PortfolioSpec] = None
    intake_error: Optional[str] = None
    
    opencode_result: Optional[dict] = None
    files_created: list[str] = Field(default_factory=list)
    
    github_url: Optional[str] = None
    vercel_url: Optional[str] = None
    deploy_error: Optional[str] = None
    existing_repo: bool = False
    
    errors: list[str] = Field(default_factory=list)
    retry_count: int = 0
    max_retries: int = 3
    
    final_url: Optional[str] = None
    status: Literal["pending", "intake", "awaiting_framework", "creative", "deploy", "monitor", "success", "failed"] = "pending"
    message: str = ""
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = {"arbitrary_types_allowed": True}

    def to_dict(self) -> dict:
        return self.model_dump()
    
    @classmethod
    def from_dict(cls, data: dict) -> "AgentState":
        return cls(**data)
