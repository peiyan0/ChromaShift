import os
import torch
import torch.optim as optim
from torch.utils.data import DataLoader
from tqdm import tqdm
from pathlib import Path

# Fix imports relative to script execution
import sys
sys.path.append(str(Path(__file__).parent.parent.parent))

from src.models.transunet import TransUNet
from src.data.dataset import CVDSegmentationDataset
from src.training.loss import DiceBCELoss

def train_model(data_dir, epochs=20, batch_size=8, lr=1e-4, device='cuda'):
    print(f"Starting training on device: {device}")
    
    # 1. Setup DataLoaders
    train_dir_img = os.path.join(data_dir, 'train', 'images')
    train_dir_mask = os.path.join(data_dir, 'train', 'masks')
    val_dir_img = os.path.join(data_dir, 'val', 'images')
    val_dir_mask = os.path.join(data_dir, 'val', 'masks')
    
    # Check if directories exist, else mock a warning
    if not os.path.exists(train_dir_img):
        print(f"WARNING: Data directory {train_dir_img} not found. Ensure datasets are downloaded.")
        return

    train_dataset = CVDSegmentationDataset(train_dir_img, train_dir_mask, is_train=True)
    val_dataset = CVDSegmentationDataset(val_dir_img, val_dir_mask, is_train=False)
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=4)

    # 2. Setup Model, Loss, Optimizer
    model = TransUNet().to(device)
    criterion = DiceBCELoss()
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    
    checkpoint_dir = Path("ai/checkpoints")
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    
    best_val_loss = float('inf')

    # 3. Training Loop
    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        
        pbar = tqdm(train_loader, desc=f"Epoch {epoch}/{epochs} [Train]")
        for images, masks in pbar:
            images = images.to(device)
            masks = masks.to(device)
            
            optimizer.zero_grad()
            outputs = model(images)
            
            loss = criterion(outputs, masks)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * images.size(0)
            pbar.set_postfix({'loss': loss.item()})
            
        train_loss /= len(train_loader.dataset)
        
        # 4. Validation Loop
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for images, masks in tqdm(val_loader, desc=f"Epoch {epoch}/{epochs} [Val]"):
                images = images.to(device)
                masks = masks.to(device)
                
                outputs = model(images)
                loss = criterion(outputs, masks)
                val_loss += loss.item() * images.size(0)
                
        val_loss /= len(val_loader.dataset)
        
        print(f"Epoch {epoch} Summary - Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}")
        
        # 5. Save Checkpoint
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            save_path = checkpoint_dir / f"transunet_best.pth"
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_loss': val_loss,
            }, save_path)
            print(f"Saved best model to {save_path}")

if __name__ == "__main__":
    # Use GPU if available, else CPU
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    
    # Path to processed 70/20/10 split dataset
    DATA_PATH = "ai/datasets/processed/recoloring"
    
    train_model(data_dir=DATA_PATH, device=device)
