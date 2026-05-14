import os
import shutil
import random
from pathlib import Path

def create_splits(source_dir, dest_dir, train_pct=0.7, val_pct=0.2, test_pct=0.1):
    """
    Splits a flat directory of images and masks into 70/20/10 train/val/test structure.
    Expects source_dir to have 'images' and 'masks' subdirectories.
    """
    images_dir = Path(source_dir) / "images"
    masks_dir = Path(source_dir) / "masks"
    
    if not images_dir.exists() or not masks_dir.exists():
        print(f"Skipping {source_dir}: 'images' or 'masks' not found.")
        return

    all_images = sorted(os.listdir(images_dir))
    random.shuffle(all_images)
    
    total = len(all_images)
    train_end = int(total * train_pct)
    val_end = train_end + int(total * val_pct)
    
    splits = {
        'train': all_images[:train_end],
        'val': all_images[train_end:val_end],
        'test': all_images[val_end:]
    }
    
    for split_name, files in splits.items():
        split_img_dir = Path(dest_dir) / split_name / "images"
        split_mask_dir = Path(dest_dir) / split_name / "masks"
        
        split_img_dir.mkdir(parents=True, exist_ok=True)
        split_mask_dir.mkdir(parents=True, exist_ok=True)
        
        for f in files:
            shutil.copy(images_dir / f, split_img_dir / f)
            # Assuming mask has same filename or predictable extension
            mask_file = f.replace('.jpg', '.png') 
            if (masks_dir / mask_file).exists():
                shutil.copy(masks_dir / mask_file, split_mask_dir / mask_file)
                
    print(f"Created 70/20/10 split in {dest_dir}")

def download_datasets(base_path="../datasets"):
    """
    Stub for downloading datasets from external sources (S3, Kaggle, Roboflow).
    """
    print("Starting dataset curation pipeline...")
    
    # 1. CVD Recoloring Dataset
    print("[1/5] Downloading CVD Recoloring Dataset...")
    # e.g., os.system("aws s3 cp s3://cvd-datasets/recoloring ./datasets/raw/recoloring --recursive")
    
    # 2. Color Blindness Sim & Correction
    print("[2/5] Downloading Color Blindness Sim & Correction Dataset...")
    
    # 3. Roboflow CVD Dataset (RT-DETR)
    print("[3/5] Downloading Roboflow CVD Object Dataset...")
    
    # 4. DeepCVDVideo
    print("[4/5] Downloading DeepCVDVideo Dataset...")
    
    # 5. Ishihara / ChartEye
    print("[5/5] Downloading Ishihara & Charts Dataset...")

    print("Download complete. Generating splits...")
    
    # Example split generation
    # create_splits(f"{base_path}/raw/recoloring", f"{base_path}/processed/recoloring")
    
    print("Dataset curation finished.")

if __name__ == "__main__":
    download_datasets()
