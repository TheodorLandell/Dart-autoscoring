"""
DartVision — Konfiguration & konstanter
"""

# Board geometry (mm) — importeras även från dartvision_score.py
# men samlade här för routes som behöver dem utan att ladda hela pipelinen
BOARD_SIZE = 800
BOARD_CENTER = BOARD_SIZE / 2
DOUBLE_OUTER = 170.0
TRIPLE_OUTER = 107.0
BOARD_SCALE = (BOARD_SIZE / 2 - 30) / DOUBLE_OUTER

SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
SECTOR_ANGLE = 18.0

# Server defaults
DEFAULT_PORT = 8000
DEFAULT_CONF = 0.10
DEFAULT_TIP_OFFSET = 0.3
DEFAULT_MODEL = "best.pt"
