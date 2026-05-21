import pytest
import os
import cv2
import numpy as np
import tempfile
import shutil
from PIL import Image
from app.services.media_processor import MediaProcessor

@pytest.fixture
def media_processor():
    return MediaProcessor()

@pytest.fixture
def temp_dir():
    # Cross-platform safe temporary directory
    path = tempfile.mkdtemp(prefix="test_chromashift_")
    yield path
    # Cleanup after test run
    if os.path.exists(path):
        shutil.rmtree(path)

def test_process_image(media_processor, temp_dir):
    input_path = os.path.join(temp_dir, "input.jpg")
    output_path = os.path.join(temp_dir, "output.jpg")
    
    # Create a simple red test image
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    img[:, :, 2] = 255  # Red BGR
    cv2.imwrite(input_path, img)
    
    # Process for Deuteranopia
    res_path = media_processor.process_image(input_path, output_path, "deuteranopia", 1.0)
    assert os.path.exists(res_path)
    assert os.path.getsize(res_path) > 0
    
    # Process for Protanopia
    output_protan = os.path.join(temp_dir, "output_protan.jpg")
    res_protan = media_processor.process_image(input_path, output_protan, "protanopia", 1.0)
    assert os.path.exists(res_protan)
    assert os.path.getsize(res_protan) > 0
    
    # Process for Tritanopia
    output_tritan = os.path.join(temp_dir, "output_tritan.jpg")
    res_tritan = media_processor.process_image(input_path, output_tritan, "tritanopia", 1.0)
    assert os.path.exists(res_tritan)
    assert os.path.getsize(res_tritan) > 0

def test_process_video(media_processor, temp_dir):
    input_path = os.path.join(temp_dir, "input.mp4")
    output_path = os.path.join(temp_dir, "output.mp4")
    
    # Create a simple test video with 5 frames
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(input_path, fourcc, 10.0, (100, 100))
    for _ in range(5):
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        frame[:, :, 2] = 255  # Red BGR
        out.write(frame)
    out.release()
    
    res_path = media_processor.process_video(input_path, output_path, "deuteranopia", 1.0)
    assert os.path.exists(res_path)
    assert os.path.getsize(res_path) > 0

def test_process_pdf(media_processor, temp_dir):
    input_path = os.path.join(temp_dir, "input.pdf")
    output_path = os.path.join(temp_dir, "output.pdf")
    
    # Create a simple PDF using Pillow
    img = Image.new("RGB", (100, 100), color="red")
    img.save(input_path, "PDF")
    
    res_path = media_processor.process_pdf(input_path, output_path, "deuteranopia", 1.0)
    assert os.path.exists(res_path)
    assert os.path.getsize(res_path) > 0
