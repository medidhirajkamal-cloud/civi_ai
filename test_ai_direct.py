import io
from PIL import Image
from backend.ai_service import ai_engine

def test():
    # 1. Blank/Solid image (e.g. wall/desk/ceiling)
    blank_img = Image.new('RGB', (640, 480), (220, 220, 220))
    buf = io.BytesIO()
    blank_img.save(buf, format='JPEG')
    res_blank = ai_engine.detect_defects(buf.getvalue())
    print("Blank Wall/Desk Result:")
    print("Detected:", res_blank.detected, "| Issue:", res_blank.issue_type, "| Conf:", res_blank.confidence)

    # 2. Smooth road image without pothole
    clean_road = Image.new('RGB', (640, 480), (50, 50, 50))
    buf2 = io.BytesIO()
    clean_road.save(buf2, format='JPEG')
    res_clean = ai_engine.detect_defects(buf2.getvalue())
    print("\nClean Smooth Road Result:")
    print("Detected:", res_clean.detected, "| Issue:", res_clean.issue_type, "| Conf:", res_clean.confidence)

    # 3. Pothole image
    with open('uploads/pothole_before.jpg', 'rb') as f:
        pothole_bytes = f.read()
    res_pothole = ai_engine.detect_defects(pothole_bytes, filename=None)
    print("\nReal Pothole Image Result (No filename passed):")
    print("Detected:", res_pothole.detected, "| Issue:", res_pothole.issue_type, "| Conf:", res_pothole.confidence, "| Boxes:", res_pothole.bounding_boxes)

    # 4. Open Manhole image
    with open('uploads/manhole_before.jpg', 'rb') as f:
        manhole_bytes = f.read()
    res_manhole = ai_engine.detect_defects(manhole_bytes, filename=None)
    print("\nReal Manhole Image Result (No filename passed):")
    print("Detected:", res_manhole.detected, "| Issue:", res_manhole.issue_type, "| Conf:", res_manhole.confidence, "| Boxes:", res_manhole.bounding_boxes)

if __name__ == '__main__':
    test()
