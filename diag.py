from PIL import Image
from backend.ai_service import ai_engine

with open('uploads/pothole_before.jpg', 'rb') as f:
    feat = ai_engine._analyze_image_features(f.read())
    print("Pothole Features:", feat)
