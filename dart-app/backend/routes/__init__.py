"""
DartVision — Route registration
Importera register_routes(app) i main.py.
"""

from .streams import router as streams_router
from .calibration import router as calibration_router
from .scoring import router as scoring_router
from .status import router as status_router


def register_routes(app):
    """Koppla alla routers till FastAPI-appen."""
    app.include_router(streams_router, prefix="/api")
    app.include_router(calibration_router, prefix="/api")
    app.include_router(scoring_router)       # WS har ingen prefix
    app.include_router(status_router, prefix="/api")
