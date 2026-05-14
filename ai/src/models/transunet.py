import torch
import torch.nn as nn
import timm

class TransUNet(nn.Module):
    """
    TransUNet Architecture for Semantic Image Segmentation.
    Combines a ResNet/CNN encoder, a Vision Transformer (ViT) bottleneck,
    and a CNN decoder with skip connections.
    
    Used to generate semantic masks for CVD importance scoring.
    """
    def __init__(self, img_size=224, num_classes=1, vit_name='vit_base_patch16_224'):
        super().__init__()
        self.num_classes = num_classes
        self.img_size = img_size
        
        # CNN Encoder (ResNet50 backbone)
        self.cnn_encoder = timm.create_model('resnet50', pretrained=True, features_only=True)
        # Extract specific layers for skip connections
        
        # ViT Bottleneck
        self.vit = timm.create_model(vit_name, pretrained=True)
        # We replace the head with identity as we just want embeddings
        embed_dim = self.vit.embed_dim
        self.vit.head = nn.Identity()
        
        # Patch embedding mapping
        self.patch_size = self.vit.patch_embed.patch_size[0]
        self.seq_len = (img_size // self.patch_size) ** 2
        
        # CNN Decoder
        # Simplified decoder to map bottleneck + skip connections back to full res
        self.decoder_up1 = nn.ConvTranspose2d(embed_dim, 512, kernel_size=2, stride=2)
        self.decoder_up2 = nn.ConvTranspose2d(512, 256, kernel_size=2, stride=2)
        self.decoder_up3 = nn.ConvTranspose2d(256, 128, kernel_size=2, stride=2)
        self.decoder_up4 = nn.ConvTranspose2d(128, 64, kernel_size=2, stride=2)
        
        self.final_conv = nn.Conv2d(64, num_classes, kernel_size=1)

    def forward(self, x):
        # Forward pass is simplified for prototyping. 
        # Full TransUNet requires precise skip connection feature alignment.
        B, C, H, W = x.shape
        
        # 1. CNN Encoder Features (Skip Connections)
        cnn_features = self.cnn_encoder(x)
        # cnn_features[-1] -> bottleneck input if using hybrid, but here we pass raw image to ViT
        
        # 2. ViT Bottleneck
        vit_out = self.vit.forward_features(x)
        
        # Check if cls token is present
        if vit_out.shape[1] == self.seq_len + 1:
            vit_out = vit_out[:, 1:] # Drop CLS token
            
        # Reshape sequence to spatial grid
        grid_size = H // self.patch_size
        vit_spatial = vit_out.transpose(1, 2).reshape(B, -1, grid_size, grid_size)
        
        # 3. Decoder
        # In a full implementation, we concatenate `cnn_features` at each step
        d1 = torch.relu(self.decoder_up1(vit_spatial))
        d2 = torch.relu(self.decoder_up2(d1))
        d3 = torch.relu(self.decoder_up3(d2))
        d4 = torch.relu(self.decoder_up4(d3))
        
        out = self.final_conv(d4)
        
        # Scale back to exact original size if needed
        if out.shape[2:] != (H, W):
            out = nn.functional.interpolate(out, size=(H, W), mode='bilinear', align_corners=False)
            
        return torch.sigmoid(out)
