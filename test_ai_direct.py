import io
from PIL import Image
from backend.ai_service import ai_engine

def test():
    # 1. Human Face / Skin Portrait Image
    face_img = Image.new('RGB', (640, 480), (215, 155, 125))
    buf_face = io.BytesIO()
    face_img.save(buf_face, format='JPEG')
    res_face = ai_engine.detect_defects(buf_face.getvalue())
    print("1. Human Face / Person Test:")
    print("   Detected:", res_face.detected, "| Issue:", res_face.issue_type, "| Desc:", res_face.description)
    assert not res_face.detected, "Face should NOT be detected as defect"

    # 2. Plane / Flat Surface (White Wall / Plain Desk)
    plane_img = Image.new('RGB', (640, 480), (220, 220, 220))
    buf_plane = io.BytesIO()
    plane_img.save(buf_plane, format='JPEG')
    res_plane = ai_engine.detect_defects(buf_plane.getvalue())
    print("\n2. Plane / Flat Surface Test:")
    print("   Detected:", res_plane.detected, "| Issue:", res_plane.issue_type, "| Desc:", res_plane.description)
    assert not res_plane.detected, "Plane surface should NOT be detected as defect"

    # 3. Real Pothole Road Image
    with open('uploads/pothole_before.jpg', 'rb') as f:
        pothole_bytes = f.read()
    res_pothole = ai_engine.detect_defects(pothole_bytes)
    print("\n3. Real Pothole Image Test:")
    print("   Detected:", res_pothole.detected, "| Issue:", res_pothole.issue_type, "| Conf:", res_pothole.confidence, "| Boxes:", res_pothole.bounding_boxes)
    assert res_pothole.detected, "Real pothole MUST be detected"

    # 4. Open Manhole Image
    with open('uploads/manhole_before.jpg', 'rb') as f:
        manhole_bytes = f.read()
    res_manhole = ai_engine.detect_defects(manhole_bytes)
    print("\n4. Open Manhole / Drainage Test:")
    print("   Detected:", res_manhole.detected, "| Issue:", res_manhole.issue_type, "| Conf:", res_manhole.confidence, "| Boxes:", res_manhole.bounding_boxes)
    assert res_manhole.detected, "Drainage issue MUST be detected"

    print("\n[ALL 4 AI TARGET & REJECTION TESTS PASSED SUCCESSFULLY!]")

if __name__ == '__main__':
    test()
