import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision.transforms import transforms
from PIL import Image
from tqdm import tqdm
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent.parent.parent))

from src.models.pix2pix import GeneratorUNet, PatchGANDiscriminator

class PairedImageDataset(Dataset):
    """
    Dataset for Pix2Pix paired image translation.
    Expects a directory with 'original' and 'corrected' subdirectories containing matched pairs.
    """
    def __init__(self, root_dir, img_size=256, is_train=True):
        self.root_dir = root_dir
        self.original_dir = os.path.join(root_dir, 'original')
        self.corrected_dir = os.path.join(root_dir, 'corrected')
        
        # Ensure directories exist for the stub to work without erroring out on len()
        if not os.path.exists(self.original_dir):
            self.images = []
        else:
            self.images = sorted(os.listdir(self.original_dir))
            
        self.transform = transforms.Compose([
            transforms.Resize((img_size, img_size), Image.BICUBIC),
            transforms.ToTensor(),
            transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5)) # Normalize to [-1, 1] for Tanh
        ])

    def __len__(self):
        return len(self.images)

    def __getitem__(self, idx):
        img_name = self.images[idx]
        
        orig_img = Image.open(os.path.join(self.original_dir, img_name)).convert("RGB")
        corr_img = Image.open(os.path.join(self.corrected_dir, img_name)).convert("RGB")
        
        orig_tensor = self.transform(orig_img)
        corr_tensor = self.transform(corr_img)
        
        return orig_tensor, corr_tensor

def train_pix2pix(data_dir, epochs=100, batch_size=4, lr=0.0002, b1=0.5, b2=0.999, device='cuda'):
    print(f"Starting Pix2Pix Baseline training on device: {device}")
    
    # 1. Setup Data
    train_dataset = PairedImageDataset(os.path.join(data_dir, 'train'))
    if len(train_dataset) == 0:
         print(f"WARNING: Data directory {os.path.join(data_dir, 'train', 'original')} not found or empty.")
         print("Please ensure datasets are downloaded before running the full loop.")
         return

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=4)

    # 2. Setup Models
    generator = GeneratorUNet().to(device)
    discriminator = PatchGANDiscriminator().to(device)

    # 3. Setup Losses
    criterion_GAN = nn.MSELoss() # PatchGAN uses MSE
    criterion_pixelwise = nn.L1Loss() # L1 for crispness
    
    # Loss weight for L1 pixel-wise loss
    lambda_pixel = 100 

    # 4. Setup Optimizers
    optimizer_G = optim.Adam(generator.parameters(), lr=lr, betas=(b1, b2))
    optimizer_D = optim.Adam(discriminator.parameters(), lr=lr, betas=(b1, b2))

    checkpoint_dir = Path("ai/checkpoints/pix2pix")
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    # Patch shape for discriminator output
    patch = (1, 256 // 2**4, 256 // 2**4)

    # 5. Training Loop
    for epoch in range(1, epochs + 1):
        generator.train()
        discriminator.train()
        
        g_loss_total = 0.0
        d_loss_total = 0.0
        
        pbar = tqdm(train_loader, desc=f"Epoch {epoch}/{epochs}")
        for i, (imgs_original, imgs_corrected) in enumerate(pbar):
            
            real_A = imgs_original.to(device) # Input (Original)
            real_B = imgs_corrected.to(device) # Target (Corrected)
            
            # Ground truths for PatchGAN
            valid = torch.ones((real_A.size(0), *patch), requires_grad=False).to(device)
            fake = torch.zeros((real_A.size(0), *patch), requires_grad=False).to(device)

            # ------------------
            #  Train Generator
            # ------------------
            optimizer_G.zero_grad()

            # GAN loss
            fake_B = generator(real_A)
            pred_fake = discriminator(fake_B, real_A)
            loss_GAN = criterion_GAN(pred_fake, valid)
            
            # Pixel-wise loss
            loss_pixel = criterion_pixelwise(fake_B, real_B)

            # Total loss
            loss_G = loss_GAN + lambda_pixel * loss_pixel
            loss_G.backward()
            optimizer_G.step()

            # ---------------------
            #  Train Discriminator
            # ---------------------
            optimizer_D.zero_grad()

            # Real loss
            pred_real = discriminator(real_B, real_A)
            loss_real = criterion_GAN(pred_real, valid)

            # Fake loss
            pred_fake = discriminator(fake_B.detach(), real_A)
            loss_fake = criterion_GAN(pred_fake, fake)

            # Total loss
            loss_D = 0.5 * (loss_real + loss_fake)
            loss_D.backward()
            optimizer_D.step()
            
            # Logging
            g_loss_total += loss_G.item()
            d_loss_total += loss_D.item()
            pbar.set_postfix({'D_loss': loss_D.item(), 'G_loss': loss_G.item()})
            
        # 6. Save Checkpoints periodically
        if epoch % 10 == 0:
            torch.save(generator.state_dict(), checkpoint_dir / f"generator_epoch_{epoch}.pth")
            torch.save(discriminator.state_dict(), checkpoint_dir / f"discriminator_epoch_{epoch}.pth")
            print(f"Saved checkpoints for epoch {epoch}")

if __name__ == "__main__":
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    
    # Path to the paired dataset
    DATA_PATH = "ai/datasets/processed/recoloring_pairs"
    
    train_pix2pix(data_dir=DATA_PATH, device=device)
