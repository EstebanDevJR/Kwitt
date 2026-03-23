import json
import os
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

JOBS_DIR = os.getenv("JOBS_DIR", "/app/data/jobs")
MAX_JOBS_AGE_HOURS = 24


class JobStorage:
    """Persistencia de jobs en archivo"""
    
    def __init__(self, jobs_dir: str = JOBS_DIR):
        self.jobs_dir = Path(jobs_dir)
        self.jobs_dir.mkdir(parents=True, exist_ok=True)
    
    def _job_path(self, job_id: str) -> Path:
        return self.jobs_dir / f"{job_id}.json"
    
    def save(self, job_id: str, data: dict):
        """Guarda un job"""
        try:
            path = self._job_path(job_id)
            data["saved_at"] = datetime.now().isoformat()
            path.write_text(json.dumps(data, indent=2, default=str))
        except Exception as e:
            logger.error(f"[JobStorage] Save error: {e}")
    
    def load(self, job_id: str) -> Optional[dict]:
        """Carga un job"""
        try:
            path = self._job_path(job_id)
            if path.exists():
                return json.loads(path.read_text())
        except Exception as e:
            logger.error(f"[JobStorage] Load error: {e}")
        return None
    
    def delete(self, job_id: str):
        """Elimina un job"""
        try:
            path = self._job_path(job_id)
            if path.exists():
                path.unlink()
        except Exception as e:
            logger.error(f"[JobStorage] Delete error: {e}")
    
    def list_jobs(self) -> list[dict]:
        """Lista todos los jobs"""
        jobs = []
        try:
            for path in self.jobs_dir.glob("*.json"):
                try:
                    data = json.loads(path.read_text())
                    jobs.append({
                        "job_id": path.stem,
                        "status": data.get("status"),
                        "saved_at": data.get("saved_at"),
                    })
                except:
                    pass
        except Exception as e:
            logger.error(f"[JobStorage] List error: {e}")
        return jobs
    
    def cleanup_old_jobs(self):
        """Elimina jobs mayores a MAX_JOBS_AGE_HOURS"""
        try:
            import time
            now = datetime.now()
            for path in self.jobs_dir.glob("*.json"):
                try:
                    data = json.loads(path.read_text())
                    saved_at = datetime.fromisoformat(data.get("saved_at", "2000-01-01"))
                    age_hours = (now - saved_at).total_seconds() / 3600
                    if age_hours > MAX_JOBS_AGE_HOURS:
                        path.unlink()
                        logger.info(f"[JobStorage] Cleaned up old job: {path.stem}")
                except:
                    pass
        except Exception as e:
            logger.error(f"[JobStorage] Cleanup error: {e}")


storage = JobStorage()


def save_job(job_id: str, data: dict):
    storage.save(job_id, data)


def load_job(job_id: str) -> Optional[dict]:
    return storage.load(job_id)


def delete_job(job_id: str):
    storage.delete(job_id)


def list_jobs() -> list[dict]:
    return storage.list_jobs()
