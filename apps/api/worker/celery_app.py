from celery import Celery
from celery.schedules import crontab
from core.config import settings

celery_app = Celery(
    "worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600, # 1 hour
    beat_schedule={
        "sync-product-connectors-hourly": {
            "task": "sync_all_active_product_connectors",
            "schedule": crontab(minute=0),
        },
    },
)

# Auto-discover tasks from the tasks directory
celery_app.autodiscover_tasks(["worker.tasks"])
